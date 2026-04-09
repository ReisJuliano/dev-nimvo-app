<?php

namespace App\Services\Tenant\Fiscal;

use App\Jobs\Tenant\QueueFiscalDocumentForEmission;
use App\Models\Central\LocalAgent;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Sale;
use App\Services\Central\LocalAgentCommandService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiscalContingencyService
{
    public function __construct(
        protected LocalAgentCommandService $commandService,
    ) {
    }

    public function queueSale(int $saleId, string $reason): array
    {
        return DB::transaction(function () use ($saleId, $reason) {
            $sale = Sale::query()
                ->with(['latestFiscalDocument.events'])
                ->lockForUpdate()
                ->findOrFail($saleId);

            $document = FiscalDocument::query()
                ->where('sale_id', $sale->id)
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $document) {
                throw ValidationException::withMessages([
                    'sale' => 'A venda nao possui documento fiscal vinculado para entrar em contingencia.',
                ]);
            }

            if (in_array($document->status, ['queued', 'queued_to_agent', 'processing', 'cancellation_queued', 'cancellation_processing'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'O documento fiscal ainda esta em processamento e nao pode entrar em contingencia agora.',
                ]);
            }

            if (in_array($document->status, ['authorized', 'printed', 'cancelled', 'cancelled_local'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'Documentos concluidos nao podem entrar em contingencia operacional.',
                ]);
            }

            if (! in_array($document->status, ['awaiting_agent', 'failed', 'rejected', 'contingency_pending', 'contingency_failed'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'O status atual nao permite marcar este documento em contingencia operacional.',
                ]);
            }

            $normalizedReason = $this->normalizeReason($reason);
            $tenantId = (string) tenant()->getTenantKey();
            $agent = $this->resolveEmissionAgent($tenantId);

            if ($agent && $this->canIssueOfflineLegally($document)) {
                $document->forceFillCompatible([
                    'status' => 'queued',
                    'payload' => $this->offlinePayload($document, $normalizedReason),
                    'request_xml' => null,
                    'signed_xml' => null,
                    'response_xml' => null,
                    'authorized_xml' => null,
                    'access_key' => null,
                    'sefaz_receipt' => null,
                    'sefaz_protocol' => null,
                    'sefaz_status_code' => null,
                    'sefaz_status_reason' => null,
                    'queued_at' => now(),
                    'contingency_reason' => $normalizedReason,
                    'contingency_requested_at' => now(),
                    'contingency_released_at' => null,
                    'last_error' => null,
                    'failed_at' => null,
                ])->save();

                $command = $this->commandService->queueEmission($agent, $document, $tenantId);

                $document->forceFillCompatible([
                    'status' => 'queued_to_agent',
                    'agent_key' => $agent->agent_key,
                    'agent_command_id' => $command->id,
                ])->save();

                $document->events()->create([
                    'status' => 'queued_to_agent',
                    'source' => 'backend',
                    'message' => 'NFC-e enviada ao agente local para contingencia offline legal.',
                    'payload' => [
                        'command_id' => $command->id,
                        'reason' => $normalizedReason,
                    ],
                ]);

                return [
                    'mode' => 'contingency_offline',
                    'message' => 'NFC-e enviada para contingencia offline legal no agente local.',
                    'sale' => $sale->fresh(),
                    'document' => $document->fresh('events'),
                ];
            }

            $document->forceFillCompatible([
                'status' => 'contingency_pending',
                'contingency_reason' => $normalizedReason,
                'contingency_requested_at' => now(),
            ])->save();

            $document->events()->create([
                'status' => 'contingency_pending',
                'source' => 'backend',
                'message' => 'Documento fiscal marcado em contingencia operacional.',
                'payload' => [
                    'reason' => $normalizedReason,
                ],
            ]);

            return [
                'mode' => 'contingency_pending',
                'message' => 'Documento fiscal movido para contingencia operacional.',
                'sale' => $sale->fresh(),
                'document' => $document->fresh('events'),
            ];
        });
    }

    public function retryPending(): int
    {
        $ids = FiscalDocument::query()
            ->whereIn('status', [
                'contingency_pending',
                'contingency_failed',
                'contingency_offline_signed',
                'contingency_offline_printed',
            ])
            ->pluck('id');

        $retried = 0;

        foreach ($ids as $documentId) {
            DB::transaction(function () use ($documentId, &$retried) {
                $document = FiscalDocument::query()
                    ->lockForUpdate()
                    ->find($documentId);

                if (! $document || ! in_array($document->status, [
                    'contingency_pending',
                    'contingency_failed',
                    'contingency_offline_signed',
                    'contingency_offline_printed',
                ], true)) {
                    return;
                }

                $payload = is_array($document->payload) ? $document->payload : [];
                $offlineStage = $this->nextOfflineStage($document);

                if ($offlineStage) {
                    data_set($payload, 'flags.mode', 'contingency_offline');
                    data_set($payload, 'flags.offline_contingency', true);
                    data_set($payload, 'flags.offline_contingency_stage', $offlineStage);
                }

                $document->forceFillCompatible([
                    'status' => 'queued',
                    'payload' => $payload,
                    'queued_at' => now(),
                    'last_error' => null,
                    'failed_at' => null,
                    'contingency_released_at' => now(),
                    'contingency_attempts' => (int) ($document->contingency_attempts ?? 0) + 1,
                ])->save();

                $document->events()->create([
                    'status' => 'queued',
                    'source' => 'backend',
                    'message' => $offlineStage === 'transmit'
                        ? 'NFC-e de contingencia offline reenfileirada para transmissao posterior.'
                        : 'Documento retirado da contingencia e reenfileirado para emissao.',
                ]);

                QueueFiscalDocumentForEmission::dispatch((string) tenant()->getTenantKey(), $document->id)
                    ->onQueue(config('fiscal.queues.documents'));

                $retried++;
            });
        }

        return $retried;
    }

    protected function normalizeReason(string $reason): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $reason) ?? '');

        if (mb_strlen($normalized) < 15) {
            throw ValidationException::withMessages([
                'reason' => 'Informe uma justificativa com pelo menos 15 caracteres para ativar a contingencia.',
            ]);
        }

        return mb_substr($normalized, 0, 255);
    }

    protected function canIssueOfflineLegally(FiscalDocument $document): bool
    {
        $documentModel = (string) data_get($document->payload, 'flags.document_model', '65');

        return $documentModel === '65';
    }

    protected function offlinePayload(FiscalDocument $document, string $reason): array
    {
        $payload = is_array($document->payload) ? $document->payload : [];
        $issuedAt = now()->format('Y-m-d\TH:i:sP');
        $randomCode = str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT);

        data_set($payload, 'sale.issued_at', $issuedAt);
        data_set($payload, 'sale.random_code', $randomCode);
        data_set($payload, 'sale.print_type', 4);
        data_set($payload, 'sale.emission_type', 9);
        data_set($payload, 'sale.dh_contingency', $issuedAt);
        data_set($payload, 'sale.contingency_reason', $reason);
        data_set($payload, 'flags.local_test', false);
        data_set($payload, 'flags.mode', 'contingency_offline');
        data_set($payload, 'flags.offline_contingency', true);
        data_set($payload, 'flags.offline_contingency_stage', 'issue');

        return $payload;
    }

    protected function nextOfflineStage(FiscalDocument $document): ?string
    {
        $payload = is_array($document->payload) ? $document->payload : [];

        if (! (bool) data_get($payload, 'flags.offline_contingency', false)) {
            return null;
        }

        if (filled($document->signed_xml) || filled($document->access_key)) {
            return 'transmit';
        }

        return 'issue';
    }

    protected function resolveEmissionAgent(string $tenantId): ?LocalAgent
    {
        return LocalAgent::query()
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->orderByDesc('last_seen_at')
            ->get()
            ->first(function (LocalAgent $agent) {
                $supportedTypes = (array) data_get($agent->metadata, 'device.supported_types', []);

                return in_array('emit_nfce', $supportedTypes, true);
            });
    }
}
