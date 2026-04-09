<?php

namespace App\Services\Tenant\Fiscal;

use App\Jobs\Tenant\QueueFiscalDocumentForEmission;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Sale;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FiscalContingencyService
{
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

            if (! in_array($document->status, ['awaiting_agent', 'failed', 'rejected', 'contingency_pending'], true)) {
                throw ValidationException::withMessages([
                    'sale' => 'O status atual nao permite marcar este documento em contingencia operacional.',
                ]);
            }

            $normalizedReason = $this->normalizeReason($reason);

            $document->forceFill([
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
            ->whereIn('status', ['contingency_pending', 'contingency_failed'])
            ->pluck('id');

        $retried = 0;

        foreach ($ids as $documentId) {
            DB::transaction(function () use ($documentId, &$retried) {
                $document = FiscalDocument::query()
                    ->lockForUpdate()
                    ->find($documentId);

                if (! $document || ! in_array($document->status, ['contingency_pending', 'contingency_failed'], true)) {
                    return;
                }

                $document->forceFill([
                    'status' => 'queued',
                    'queued_at' => now(),
                    'last_error' => null,
                    'failed_at' => null,
                    'contingency_released_at' => now(),
                    'contingency_attempts' => (int) ($document->contingency_attempts ?? 0) + 1,
                ])->save();

                $document->events()->create([
                    'status' => 'queued',
                    'source' => 'backend',
                    'message' => 'Documento retirado da contingencia e reenfileirado para emissao.',
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
}
