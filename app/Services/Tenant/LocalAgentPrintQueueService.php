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

        $agent = LocalAgent::query()->firstWhere('tenant_id', (string) $tenantId);

        if (!$agent || !$agent->active) {
            return [
                'status' => 'skipped',
                'message' => 'Nenhum agente de impressao ativo foi encontrado para este tenant.',
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
