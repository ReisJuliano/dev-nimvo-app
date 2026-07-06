<?php

namespace App\Services\Tenant;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\CashMovement;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SalePayment;
use App\Services\Central\LocalAgentCommandService;

class LocalAgentPrintQueueService
{
    public function __construct(
        protected LocalAgentCommandService $commandService,
        protected LocalAgentReceiptPayloadService $payloadService,
        protected LocalAgentBridgeService $bridgeService,
    ) {
    }

    public function queuePaymentReceiptForSale(Sale $sale): array
    {
        $tenantId = tenant()?->getTenantKey();

        if (!filled($tenantId)) {
            return [
                'status' => 'unavailable',
                'message' => 'Não foi possível identificar o tenant para enfileirar a impressão.',
            ];
        }

        $agent = $this->resolveAgent((string) $tenantId, 'print_payment_receipt');

        if (!$agent) {
            return [
                'status' => 'skipped',
                'message' => 'Nenhum agente de impressão compatível foi encontrado para este tenant.',
            ];
        }

        if (data_get($agent->metadata, 'device.printer.enabled') === false) {
            return [
                'status' => 'skipped',
                'message' => 'O agente local está com a impressora desativada.',
            ];
        }

        if (! $this->bridgeService->isOnline($agent)) {
            return [
                'status' => 'unavailable',
                'message' => 'Agente local offline. A venda foi finalizada, mas nenhum comando de impressão foi criado.',
            ];
        }

        $command = $this->commandService->queuePaymentReceipt(
            $agent,
            (string) $tenantId,
            $this->payloadService->buildPaymentReceiptPayload($sale),
        );

        return [
            'status' => 'queued',
            'message' => 'O comprovante foi enviado para a fila central de impressão do agente.',
            'command_id' => $command->id,
            'queued_at' => optional($command->created_at)?->toIso8601String(),
        ];
    }

    public function queueCashMovementReceipt(CashMovement $movement): array
    {
        return $this->queueOperationReceipt(
            $movement->type === 'withdrawal' ? 'sangria' : 'suprimento',
            $this->payloadService->buildCashMovementPayload($movement),
        );
    }

    public function queueOperationReceiptForSalePayment(Sale $sale, SalePayment $payment): array
    {
        return $this->queueOperationReceipt(
            (string) $payment->payment_method,
            $this->payloadService->buildOperationPaymentPayload($sale, $payment),
        );
    }

    public function queueLabelPrint(array $labels): array
    {
        $tenantId = tenant()?->getTenantKey();

        if (! filled($tenantId)) {
            return [
                'status' => 'unavailable',
                'message' => 'Não foi possível identificar o tenant para enfileirar a impressão.',
            ];
        }

        $agent = $this->resolveAgent((string) $tenantId, 'print_label');

        if (! $agent) {
            return [
                'status' => 'skipped',
                'message' => 'Nenhum agente de impressão compatível com etiquetas foi encontrado para este tenant.',
            ];
        }

        if (! $this->bridgeService->isOnline($agent)) {
            return [
                'status' => 'unavailable',
                'message' => 'Agente local offline. Nenhuma etiqueta foi enviada para impressão.',
            ];
        }

        $command = $this->commandService->queueLabelPrint($agent, (string) $tenantId, ['labels' => $labels]);

        return [
            'status' => 'queued',
            'message' => 'Etiquetas enviadas para a fila do agente local.',
            'command_id' => $command->id,
            'queued_at' => optional($command->created_at)?->toIso8601String(),
        ];
    }

    protected function queueOperationReceipt(string $operationType, array $payload): array
    {
        $tenantId = tenant()?->getTenantKey();

        if (! filled($tenantId)) {
            return [
                'status' => 'unavailable',
                'message' => 'Não foi possível identificar o tenant para enfileirar a impressão.',
            ];
        }

        $agent = $this->resolveAgent((string) $tenantId, 'print_operation_receipt');

        if (! $agent) {
            return [
                'status' => 'skipped',
                'message' => 'Nenhum agente de impressão compatível foi encontrado para este tenant.',
            ];
        }

        if (! $this->bridgeService->isOnline($agent)) {
            return [
                'status' => 'unavailable',
                'message' => 'Agente local offline. O comprovante operacional não foi enviado para impressão.',
            ];
        }

        $command = $this->commandService->queueOperationReceipt($agent, (string) $tenantId, [
            ...$payload,
            'type' => $operationType,
        ]);

        return [
            'status' => 'queued',
            'message' => 'Comprovante operacional enviado para a fila do agente.',
            'command_id' => $command->id,
            'queued_at' => optional($command->created_at)?->toIso8601String(),
        ];
    }

    protected function resolveAgent(string $tenantId, string $commandType): ?LocalAgent
    {
        return LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->orderByDesc('last_seen_at')
            ->get()
            ->first(function (LocalAgent $candidate) use ($commandType) {
                $supportedTypes = (array) data_get($candidate->metadata, 'device.supported_types', []);

                return $supportedTypes === [] || in_array($commandType, $supportedTypes, true);
            });
    }
}
