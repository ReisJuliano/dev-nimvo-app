<?php

namespace App\Services\Tenant;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\Sale;
use App\Services\Central\LocalAgentCommandService;

class LocalAgentPrintQueueService
{
    public function __construct(
        protected LocalAgentCommandService $commandService,
        protected LocalAgentReceiptPayloadService $payloadService,
    ) {
    }

    public function queuePaymentReceiptForSale(Sale $sale): array
    {
        $tenantId = tenant()?->getTenantKey();

        if (!filled($tenantId)) {
            return [
                'status' => 'unavailable',
                'message' => 'Nao foi possivel identificar o tenant para enfileirar a impressao.',
            ];
        }

        $agent = LocalAgent::query()
            ->where('tenant_id', (string) $tenantId)
            ->where('active', true)
            ->orderByDesc('last_seen_at')
            ->get()
            ->first(function (LocalAgent $candidate) {
                $supportedTypes = (array) data_get($candidate->metadata, 'device.supported_types', []);

                return $supportedTypes === [] || in_array('print_payment_receipt', $supportedTypes, true);
            });

        if (!$agent) {
            return [
                'status' => 'skipped',
                'message' => 'Nenhum agente de impressao compativel foi encontrado para este tenant.',
            ];
        }

        if (data_get($agent->metadata, 'device.printer.enabled') === false) {
            return [
                'status' => 'skipped',
                'message' => 'O agente local esta com a impressora desativada.',
            ];
        }

        $command = $this->commandService->queuePaymentReceipt(
            $agent,
            (string) $tenantId,
            $this->payloadService->buildPaymentReceiptPayload($sale),
        );

        return [
            'status' => 'queued',
            'message' => 'O comprovante foi enviado para a fila central de impressao do agente.',
            'command_id' => $command->id,
            'queued_at' => optional($command->created_at)?->toIso8601String(),
        ];
    }
}
