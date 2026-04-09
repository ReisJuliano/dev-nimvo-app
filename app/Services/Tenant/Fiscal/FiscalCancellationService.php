<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Central\LocalAgent;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Sale;
use App\Services\Central\LocalAgentCommandService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiscalCancellationService
{
    public function __construct(
        protected LocalAgentCommandService $commandService,
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

            if ($sale->status === 'cancelled' || in_array($document?->status, ['cancelled', 'cancelled_local'], true)) {
                return [
                    'mode' => 'already_cancelled',
                    'message' => 'Essa venda ja esta cancelada.',
                    'sale' => $sale,
                    'document' => $document,
                ];
            }

            if (! $document) {
                $sale->forceFill(['status' => 'cancelled'])->save();

                return [
                    'mode' => 'commercial_cancelled',
                    'message' => 'Venda cancelada sem documento fiscal vinculado.',
                    'sale' => $sale->fresh(),
                    'document' => null,
                ];
            }

            if (in_array($document->status, ['queued', 'queued_to_agent', 'processing', 'cancellation_queued', 'cancellation_processing'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'A venda possui um documento fiscal em processamento. Aguarde a conclusao antes de cancelar.',
                ]);
            }

            if (in_array($document->status, ['awaiting_agent', 'failed', 'rejected', 'signed_local', 'printed_local'], true)) {
                $sale->forceFill(['status' => 'cancelled'])->save();

                $document->forceFill([
                    'status' => in_array($document->status, ['signed_local', 'printed_local'], true) ? 'cancelled_local' : 'cancelled',
                    'cancellation_reason' => $reason,
                    'cancellation_requested_at' => now(),
                    'cancelled_at' => now(),
                    'last_error' => null,
                ])->save();

                $document->events()->create([
                    'status' => $document->status,
                    'source' => 'backend',
                    'message' => in_array($document->status, ['signed_local', 'printed_local', 'cancelled_local'], true)
                        ? 'Venda cancelada localmente sem transmissao fiscal.'
                        : 'Venda cancelada antes da autorizacao fiscal.',
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

            if (! in_array($document->status, ['authorized', 'printed', 'cancellation_failed'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'O status atual do documento fiscal nao permite cancelamento por este fluxo.',
                ]);
            }

            if (blank($document->access_key) || blank($document->sefaz_protocol) || blank($document->authorized_xml)) {
                throw ValidationException::withMessages([
                    'document' => 'O documento fiscal nao possui chave, protocolo e XML autorizado suficientes para cancelamento.',
                ]);
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

            $document->forceFill([
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

        if (mb_strlen($normalized) < 15) {
            throw ValidationException::withMessages([
                'reason' => 'Informe uma justificativa com pelo menos 15 caracteres para cancelar a venda.',
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
}
