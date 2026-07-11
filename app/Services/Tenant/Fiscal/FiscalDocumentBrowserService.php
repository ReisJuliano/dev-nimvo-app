<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalDocument;
use Illuminate\Support\Carbon;

class FiscalDocumentBrowserService
{
    /**
     * Listagem paginada de documentos fiscais (NFC-e/NF-e) já emitidos, usada
     * pela aba "Notas emitidas" para localizar e reimprimir uma nota. A
     * reimpressão em si usa o endpoint `preview` já existente
     * (`FiscalDocumentsApiController::preview`) — este serviço só monta a
     * listagem/filtro.
     */
    public function list(array $filters = []): array
    {
        [$from, $to] = $this->resolveRange($filters);
        $documentModel = in_array($filters['document_model'] ?? null, ['55', '65'], true)
            ? $filters['document_model']
            : 'all';
        $status = in_array($filters['status'] ?? null, ['authorized', 'cancelled', 'pending', 'failed'], true)
            ? $filters['status']
            : 'all';
        $search = trim((string) ($filters['search'] ?? ''));

        $applied = filter_var($filters['applied'] ?? false, FILTER_VALIDATE_BOOL)
            || array_key_exists('from', $filters)
            || array_key_exists('to', $filters)
            || $documentModel !== 'all'
            || $status !== 'all'
            || $search !== '';

        $baseFilters = [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'document_model' => $documentModel,
            'status' => $status,
            'search' => $search,
        ];

        if (! $applied) {
            return [
                'filters' => ['applied' => false, ...$baseFilters],
                'documents' => ['data' => [], 'current_page' => 1, 'last_page' => 1, 'per_page' => 20, 'total' => 0],
            ];
        }

        $documents = FiscalDocument::query()
            ->with(['sale:id,sale_number,total,customer_id', 'sale.customer:id,name'])
            ->whereBetween('created_at', [$from, $to])
            ->when($documentModel !== 'all', fn ($query) => $query->where('payload->flags->document_model', $documentModel))
            ->when($status !== 'all', fn ($query) => $query->whereIn('status', $this->statusesFor($status)))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $nested
                        ->where('access_key', 'like', "%{$search}%")
                        ->orWhere('payload->consumer->name', 'like', "%{$search}%")
                        ->orWhereHas('sale', fn ($saleQuery) => $saleQuery->where('sale_number', 'like', "%{$search}%"));
                });
            })
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        return [
            'filters' => ['applied' => true, ...$baseFilters],
            'documents' => [
                'data' => $documents->getCollection()->map(fn (FiscalDocument $document) => $this->serialize($document))->all(),
                'current_page' => $documents->currentPage(),
                'last_page' => $documents->lastPage(),
                'per_page' => $documents->perPage(),
                'total' => $documents->total(),
            ],
        ];
    }

    protected function statusesFor(string $status): array
    {
        return match ($status) {
            'authorized' => ['authorized', 'printed'],
            'cancelled' => ['cancelled', 'cancelled_local'],
            'pending' => ['queued', 'queued_to_agent', 'processing', 'awaiting_agent', 'signed_local', 'contingency_pending'],
            'failed' => ['failed', 'rejected', 'cancellation_failed', 'contingency_failed'],
            default => [],
        };
    }

    protected function resolveRange(array $filters): array
    {
        $from = filled($filters['from'] ?? null)
            ? Carbon::parse((string) $filters['from'])->startOfDay()
            : now()->subDays(30)->startOfDay();

        $to = filled($filters['to'] ?? null)
            ? Carbon::parse((string) $filters['to'])->endOfDay()
            : now()->endOfDay();

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to];
    }

    protected function serialize(FiscalDocument $document): array
    {
        $documentModel = (string) data_get($document->payload, 'flags.document_model', '65');
        $recipientName = data_get($document->payload, 'consumer.name') ?: $document->sale?->customer?->name;

        return [
            'id' => $document->id,
            'sale_id' => $document->sale_id,
            'sale_number' => $document->sale?->sale_number,
            'type' => $document->type,
            'document_model' => $documentModel,
            'document_label' => $documentModel === '55' ? 'NF-e' : 'NFC-e',
            'status' => $document->status,
            'status_label' => $this->statusLabel($document->status),
            'status_tone' => $this->statusTone($document->status),
            'series' => $document->series,
            'number' => $document->number,
            'access_key' => $document->access_key,
            'recipient_name' => $recipientName,
            'total' => (float) ($document->sale?->total ?? 0),
            'created_at' => optional($document->created_at)?->toIso8601String(),
            'authorized_at' => optional($document->authorized_at)?->toIso8601String(),
            'can_reprint' => filled($document->authorized_xml) || filled($document->cancelled_xml),
            'preview_url' => route('api.fiscal.documents.preview', $document),
        ];
    }

    protected function statusLabel(string $status): string
    {
        return match ($status) {
            'authorized' => 'Autorizada',
            'printed' => 'Autorizada',
            'cancelled', 'cancelled_local' => 'Cancelada',
            'failed' => 'Falhou',
            'rejected' => 'Rejeitada',
            'cancellation_failed' => 'Falha no cancelamento',
            'contingency_failed' => 'Falha na contingência',
            'contingency_pending', 'contingency_offline_signed' => 'Contingência pendente',
            default => 'Processando',
        };
    }

    protected function statusTone(string $status): string
    {
        return match (true) {
            in_array($status, ['authorized', 'printed'], true) => 'success',
            in_array($status, ['cancelled', 'cancelled_local'], true) => 'neutral',
            in_array($status, ['failed', 'rejected', 'cancellation_failed', 'contingency_failed'], true) => 'danger',
            default => 'info',
        };
    }
}
