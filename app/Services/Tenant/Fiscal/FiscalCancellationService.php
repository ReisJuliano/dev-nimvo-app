<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Services\Tenant\InventoryMovementService;
use App\Services\Central\LocalAgentCommandService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiscalCancellationService
{
    public function __construct(
        protected LocalAgentCommandService $commandService,
        protected FiscalCancellationRules $rules,
        protected InventoryMovementService $inventoryMovementService,
    ) {
    }

    public function cancelSale(int $saleId, string $reason): array
    {
        return DB::transaction(function () use ($saleId, $reason) {
            $sale = Sale::query()
                ->with(['latestFiscalDocument.events'])
                ->lockForUpdate()
                ->findOrFail($saleId);

            $reason = $this->normalizeReason($reason);
            $document = FiscalDocument::query()
                ->where('sale_id', $sale->id)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            $decision = $this->rules->evaluate($sale, $document);

            if ($decision['mode'] === 'already_cancelled') {
                return [
                    'mode' => 'already_cancelled',
                    'message' => $decision['message'],
                    'sale' => $sale,
                    'document' => $document,
                ];
            }

            if (! $document) {
                $sale->forceFill(['status' => 'cancelled'])->save();
                $this->restoreSaleStock($sale, $reason);

                return [
                    'mode' => 'commercial_cancelled',
                    'message' => 'Venda cancelada sem documento fiscal vinculado.',
                    'sale' => $sale->fresh(),
                    'document' => null,
                ];
            }

            if (! $decision['allowed']) {
                throw ValidationException::withMessages([
                    'sale' => $decision['message'],
                ]);
            }

            if (in_array($decision['mode'], ['commercial_cancelled', 'local_cancelled'], true)) {
                $sale->forceFill(['status' => 'cancelled'])->save();
                $this->restoreSaleStock($sale, $reason);

                $document->forceFillCompatible([
                    'status' => $decision['mode'] === 'local_cancelled' ? 'cancelled_local' : 'cancelled',
                    'cancellation_reason' => $reason,
                    'cancellation_requested_at' => now(),
                    'cancelled_at' => now(),
                    'last_error' => null,
                ])->save();

                $document->events()->create([
                    'status' => $document->status,
                    'source' => 'backend',
                    'message' => $decision['mode'] === 'local_cancelled'
                        ? 'Venda cancelada localmente sem transmissão fiscal.'
                        : 'Venda cancelada antes da autorização fiscal.',
                    'payload' => [
                        'reason' => $reason,
                    ],
                ]);

                return [
                    'mode' => 'local_cancelled',
                    'message' => 'Venda cancelada com sucesso.',
                    'sale' => $sale->fresh(),
                    'document' => $document->fresh('events'),
                ];
            }

            $tenantId = (string) tenant()->getTenantKey();
            $agent = $this->resolveCancellationAgent($tenantId);

            if (! $agent) {
                throw ValidationException::withMessages([
                    'agent' => 'Nenhum agente local ativo com suporte a cancelamento fiscal foi encontrado para este tenant.',
                ]);
            }

            $payload = array_merge(is_array($document->payload) ? $document->payload : [], [
                'cancellation' => [
                    'reason' => $reason,
                    'access_key' => $document->access_key,
                    'protocol' => $document->sefaz_protocol,
                    'authorized_xml' => $document->authorized_xml,
                ],
            ]);

            $command = $this->commandService->queueCancellation($agent, $document, $tenantId, $payload);

            $document->forceFillCompatible([
                'status' => 'cancellation_queued',
                'agent_key' => $agent->agent_key,
                'agent_command_id' => $command->id,
                'cancellation_reason' => $reason,
                'cancellation_requested_at' => now(),
                'last_error' => null,
            ])->save();

            $document->events()->create([
                'status' => 'cancellation_queued',
                'source' => 'backend',
                'message' => 'Cancelamento fiscal enviado para o agente local.',
                'payload' => [
                    'command_id' => $command->id,
                    'reason' => $reason,
                ],
            ]);

            return [
                'mode' => 'fiscal_queued',
                'message' => 'Cancelamento fiscal enviado para processamento no agente local.',
                'sale' => $sale->fresh(),
                'document' => $document->fresh('events'),
            ];
        });
    }

    protected function normalizeReason(string $reason): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $reason) ?? '');
        $minLength = $this->rules->minReasonLength();

        if (mb_strlen($normalized) < $minLength) {
            throw ValidationException::withMessages([
                'reason' => sprintf('Informe uma justificativa com pelo menos %d caracteres para cancelar a venda.', $minLength),
            ]);
        }

        return mb_substr($normalized, 0, 255);
    }

    protected function resolveCancellationAgent(string $tenantId): ?LocalAgent
    {
        return LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->orderByDesc('last_seen_at')
            ->get()
            ->first(function (LocalAgent $agent) {
                $supportedTypes = (array) data_get($agent->metadata, 'device.supported_types', []);

                return in_array('cancel_fiscal_document', $supportedTypes, true);
            });
    }

    protected function restoreSaleStock(Sale $sale, string $reason): void
    {
        $sale->loadMissing('items.product');

        foreach ($sale->items as $item) {
            /** @var Product|null $product */
            $product = $item->product;

            if (! $product) {
                continue;
            }

            $this->inventoryMovementService->apply($product, (float) $item->quantity, 'sale_cancelled', [
                'user_id' => $sale->user_id,
                'reference' => $sale,
                'unit_cost' => $item->unit_cost,
                'notes' => sprintf('Estorno da venda %s. Motivo: %s', $sale->sale_number, $reason),
                'occurred_at' => now(),
                'allow_negative' => true,
            ]);
        }
    }
}
