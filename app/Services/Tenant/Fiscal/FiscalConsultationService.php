<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\Company;
use App\Models\Tenant\Customer;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalNumberInutilization;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\SalePayment;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;

class FiscalConsultationService
{
    public function __construct(
        protected FiscalCancellationRules $cancellationRules,
    ) {
    }

    public function build(array $filters): array
    {
        $period = $this->resolvePeriod((string) ($filters['period'] ?? 'day'));
        [$from, $to] = $this->periodRange($period);
        $perPage = 18;

        $baseQuery = Sale::query()
            ->with([
                'user:id,name',
                'customer:id,name,document,document_type,phone,email,state_registration,street,number,complement,district,city_name,city_code,state,zip_code,consumer_final',
                'company:id,name,trade_name,document,document_type,email,phone,state_registration,street,number,complement,district,city_name,city_code,state,zip_code',
                'items.product:id,name,code,barcode,unit,commercial_unit,taxable_unit',
                'payments:id,sale_id,payment_method,amount',
                'latestFiscalDocument.events:id,fiscal_document_id,status,source,message,created_at',
            ])
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

        $salesPaginator = (clone $baseQuery)
            ->latest('created_at')
            ->paginate($perPage)
            ->through(fn (Sale $sale) => $this->serializeSale($sale))
            ->withQueryString();

        $salesCount = (clone $baseQuery)->count();
        $grossTotal = (float) (clone $baseQuery)->sum('total');
        $cancelledCount = (clone $baseQuery)->where('status', 'cancelled')->count();
        $fiscalCount = (clone $baseQuery)->whereHas('fiscalDocuments')->count();
        $contingencyCount = FiscalDocument::query()
            ->whereIn('status', ['contingency_pending', 'contingency_failed'])
            ->count();
        $recentInutilizations = FiscalNumberInutilization::query()
            ->latest('created_at')
            ->limit(6)
            ->get()
            ->map(fn (FiscalNumberInutilization $inutilization) => $this->serializeInutilization($inutilization))
            ->values()
            ->all();
        $recentContingencies = FiscalDocument::query()
            ->with('sale:id,sale_number,total')
            ->whereIn('status', ['contingency_pending', 'contingency_failed'])
            ->latest('updated_at')
            ->limit(6)
            ->get()
            ->map(fn (FiscalDocument $document) => $this->serializeContingency($document))
            ->values()
            ->all();

        return [
            'filters' => [
                'period' => $period,
            ],
            'periods' => [
                ['key' => 'day', 'label' => 'Hoje'],
                ['key' => 'week', 'label' => 'Semana'],
                ['key' => 'month', 'label' => 'Mes'],
            ],
            'summary' => [
                [
                    'key' => 'sales',
                    'label' => 'Vendas',
                    'value' => $salesCount,
                    'icon' => 'fa-receipt',
                    'tone' => 'primary',
                ],
                [
                    'key' => 'total',
                    'label' => 'Total',
                    'value' => round($grossTotal, 2),
                    'icon' => 'fa-wallet',
                    'tone' => 'success',
                    'format' => 'currency',
                ],
                [
                    'key' => 'fiscal',
                    'label' => 'Fiscais',
                    'value' => $fiscalCount,
                    'icon' => 'fa-file-invoice-dollar',
                    'tone' => 'info',
                ],
                [
                    'key' => 'cancelled',
                    'label' => 'Canceladas',
                    'value' => $cancelledCount,
                    'icon' => 'fa-ban',
                    'tone' => 'danger',
                ],
                [
                    'key' => 'contingency',
                    'label' => 'Conting.',
                    'value' => $contingencyCount,
                    'icon' => 'fa-triangle-exclamation',
                    'tone' => 'warning',
                ],
            ],
            'range' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'label' => $this->rangeLabel($period, $from, $to),
            ],
            'contingencies' => $recentContingencies,
            'inutilizations' => $recentInutilizations,
            'sales' => [
                'data' => $salesPaginator->items(),
                'current_page' => $salesPaginator->currentPage(),
                'last_page' => $salesPaginator->lastPage(),
                'per_page' => $salesPaginator->perPage(),
                'total' => $salesPaginator->total(),
                'links' => collect($salesPaginator->linkCollection())->map(fn ($link) => [
                    'url' => $link['url'],
                    'label' => strip_tags((string) $link['label']),
                    'active' => (bool) $link['active'],
                ])->values()->all(),
            ],
        ];
    }

    protected function serializeInutilization(FiscalNumberInutilization $inutilization): array
    {
        return [
            'id' => $inutilization->id,
            'status' => $inutilization->status,
            'status_label' => $this->inutilizationStatusLabel((string) $inutilization->status),
            'status_tone' => $this->inutilizationStatusTone((string) $inutilization->status),
            'document_model' => $inutilization->document_model,
            'series' => $inutilization->series,
            'number_start' => $inutilization->number_start,
            'number_end' => $inutilization->number_end,
            'justification' => $inutilization->justification,
            'protocol' => $inutilization->protocol,
            'sefaz_status_code' => $inutilization->sefaz_status_code,
            'sefaz_status_reason' => $inutilization->sefaz_status_reason,
            'last_error' => $inutilization->last_error,
            'created_at' => $inutilization->created_at?->toIso8601String(),
            'processed_at' => $inutilization->processed_at?->toIso8601String(),
        ];
    }

    protected function serializeSale(Sale $sale): array
    {
        /** @var FiscalDocument|null $document */
        $document = $sale->latestFiscalDocument;
        $recipient = $this->resolveRecipient($sale);
        $productsPreview = $sale->items
            ->take(3)
            ->map(fn (SaleItem $item) => $item->product?->name ?? 'Item')
            ->values()
            ->all();

        return [
            'id' => $sale->id,
            'sale_number' => $sale->sale_number,
            'created_at' => $sale->created_at?->toIso8601String(),
            'status' => (string) $sale->status,
            'status_label' => $this->saleStatusLabel((string) $sale->status),
            'status_tone' => $this->saleStatusTone((string) $sale->status),
            'subtotal' => (float) $sale->subtotal,
            'discount' => (float) $sale->discount,
            'total' => (float) $sale->total,
            'cash_received' => (float) ($sale->cash_received ?? 0),
            'change_amount' => (float) ($sale->change_amount ?? 0),
            'payment_method' => PaymentMethod::label((string) $sale->payment_method),
            'requested_document_model' => (string) ($sale->requested_document_model ?? '65'),
            'fiscal_decision' => $sale->fiscal_decision,
            'operator_name' => $sale->user?->name ?? '-',
            'item_count' => $sale->items->count(),
            'products_preview' => $productsPreview,
            'payments' => $sale->payments->map(fn (SalePayment $payment) => [
                'method' => (string) $payment->payment_method,
                'label' => PaymentMethod::label((string) $payment->payment_method),
                'amount' => (float) $payment->amount,
            ])->values()->all(),
            'items' => $sale->items->map(fn (SaleItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'name' => $item->product?->name ?? 'Produto removido',
                'code' => $item->product?->code,
                'barcode' => $item->product?->barcode,
                'unit_label' => $item->product?->commercial_unit ?: $item->product?->taxable_unit ?: $item->product?->unit,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'discount_amount' => (float) ($item->discount_amount ?? 0),
                'total' => (float) $item->total,
            ])->values()->all(),
            'recipient' => $recipient,
            'can_cancel' => $this->saleCanBeCancelled($sale, $document),
            'cancel_hint' => $this->cancelHint($sale, $document),
            'can_flag_contingency' => $this->canFlagContingency($document),
            'contingency_hint' => $this->contingencyHint($document),
            'fiscal_document' => $document ? [
                'id' => $document->id,
                'type' => $document->type,
                'status' => $document->status,
                'status_label' => $this->documentStatusLabel((string) $document->status),
                'status_tone' => $this->documentStatusTone((string) $document->status),
                'document_model' => (string) data_get($document->payload, 'flags.document_model', data_get($document->payload, 'sale.requested_document_model', $sale->requested_document_model ?? '65')),
                'series' => $document->series,
                'number' => $document->number,
                'access_key' => $document->access_key,
                'protocol' => $document->sefaz_protocol,
                'cancellation_protocol' => $document->cancellation_protocol,
                'sefaz_status_code' => $document->sefaz_status_code,
                'sefaz_status_reason' => $document->sefaz_status_reason,
                'last_error' => $document->last_error,
                'authorized_at' => $document->authorized_at?->toIso8601String(),
                'printed_at' => $document->printed_at?->toIso8601String(),
                'cancellation_requested_at' => $document->cancellation_requested_at?->toIso8601String(),
                'cancelled_at' => $document->cancelled_at?->toIso8601String(),
                'cancellation_reason' => $document->cancellation_reason,
                'contingency_reason' => $document->contingency_reason,
                'contingency_requested_at' => $document->contingency_requested_at?->toIso8601String(),
                'contingency_released_at' => $document->contingency_released_at?->toIso8601String(),
                'contingency_attempts' => (int) ($document->contingency_attempts ?? 0),
                'files' => [
                    'preview_url' => route('api.fiscal.documents.preview', $document, false),
                    'signed_xml_url' => filled($document->signed_xml) ? route('api.fiscal.documents.signed-xml', $document, false) : null,
                    'authorized_xml_url' => filled($document->authorized_xml) ? route('api.fiscal.documents.authorized-xml', $document, false) : null,
                    'response_xml_url' => filled($document->response_xml) ? route('api.fiscal.documents.response-xml', $document, false) : null,
                    'cancellation_request_xml_url' => filled($document->cancellation_request_xml) ? route('api.fiscal.documents.cancellation-request-xml', $document, false) : null,
                    'cancellation_response_xml_url' => filled($document->cancellation_response_xml) ? route('api.fiscal.documents.cancellation-response-xml', $document, false) : null,
                    'cancelled_xml_url' => filled($document->cancelled_xml) ? route('api.fiscal.documents.cancelled-xml', $document, false) : null,
                ],
                'events' => $document->events
                    ->sortByDesc('created_at')
                    ->map(fn ($event) => [
                        'status' => $event->status,
                        'source' => $event->source,
                        'message' => $event->message,
                        'created_at' => $event->created_at?->toIso8601String(),
                    ])
                    ->values()
                    ->all(),
            ] : null,
        ];
    }

    protected function serializeContingency(FiscalDocument $document): array
    {
        return [
            'id' => $document->id,
            'sale_id' => $document->sale_id,
            'sale_number' => $document->sale?->sale_number ?? '--',
            'total' => (float) ($document->sale?->total ?? 0),
            'status' => $document->status,
            'status_label' => $this->documentStatusLabel((string) $document->status),
            'status_tone' => $this->documentStatusTone((string) $document->status),
            'document_model' => (string) data_get($document->payload, 'flags.document_model', '65'),
            'series' => $document->series,
            'number' => $document->number,
            'contingency_reason' => $document->contingency_reason,
            'last_error' => $document->last_error,
            'contingency_requested_at' => $document->contingency_requested_at?->toIso8601String(),
            'contingency_attempts' => (int) ($document->contingency_attempts ?? 0),
        ];
    }

    protected function resolveRecipient(Sale $sale): array
    {
        /** @var Customer|null $customer */
        $customer = $sale->customer;
        /** @var Company|null $company */
        $company = $sale->company;
        $payload = is_array($sale->recipient_payload) ? $sale->recipient_payload : [];

        if ($company) {
            return [
                'type' => 'company',
                'label' => $company->trade_name ?: $company->name,
                'name' => $company->name,
                'document' => $company->document,
                'document_type' => $company->document_type,
                'email' => $company->email,
                'phone' => $company->phone,
                'state_registration' => $company->state_registration,
                'address' => $this->formatAddress([
                    'street' => $company->street,
                    'number' => $company->number,
                    'complement' => $company->complement,
                    'district' => $company->district,
                    'city_name' => $company->city_name,
                    'state' => $company->state,
                    'zip_code' => $company->zip_code,
                ]),
            ];
        }

        if ($customer) {
            return [
                'type' => 'customer',
                'label' => $customer->name,
                'name' => $customer->name,
                'document' => $customer->document,
                'document_type' => $customer->document_type,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'state_registration' => $customer->state_registration,
                'consumer_final' => (bool) $customer->consumer_final,
                'address' => $this->formatAddress([
                    'street' => $customer->street,
                    'number' => $customer->number,
                    'complement' => $customer->complement,
                    'district' => $customer->district,
                    'city_name' => $customer->city_name,
                    'state' => $customer->state,
                    'zip_code' => $customer->zip_code,
                ]),
            ];
        }

        return [
            'type' => (string) ($payload['type'] ?? 'anonymous'),
            'label' => (string) ($payload['name'] ?? 'Consumidor final'),
            'name' => $payload['name'] ?? 'Consumidor final',
            'document' => $payload['document'] ?? null,
            'document_type' => $payload['document_type'] ?? null,
            'email' => $payload['email'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'state_registration' => $payload['state_registration'] ?? null,
            'consumer_final' => (bool) ($payload['consumer_final'] ?? true),
            'address' => $this->formatAddress($payload),
        ];
    }

    protected function formatAddress(array $data): ?string
    {
        $parts = array_filter([
            trim(implode(', ', array_filter([
                $data['street'] ?? null,
                $data['number'] ?? null,
            ]))),
            $data['complement'] ?? null,
            $data['district'] ?? null,
            trim(implode(' - ', array_filter([
                $data['city_name'] ?? null,
                $data['state'] ?? null,
            ]))),
            $data['zip_code'] ?? null,
        ]);

        return $parts === [] ? null : implode(' - ', $parts);
    }

    protected function resolvePeriod(string $period): string
    {
        return in_array($period, ['day', 'week', 'month'], true) ? $period : 'day';
    }

    protected function periodRange(string $period): array
    {
        $now = now();

        return match ($period) {
            'week' => [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()],
            'month' => [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()],
            default => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
        };
    }

    protected function rangeLabel(string $period, Carbon $from, Carbon $to): string
    {
        return match ($period) {
            'week' => sprintf('Semana - %s ate %s', $from->format('d/m'), $to->format('d/m')),
            'month' => sprintf('Mes - %s', $from->translatedFormat('F \\d\\e Y')),
            default => sprintf('Hoje - %s', $from->format('d/m/Y')),
        };
    }

    protected function saleCanBeCancelled(Sale $sale, ?FiscalDocument $document): bool
    {
        return (bool) data_get($this->cancellationRules->evaluate($sale, $document), 'allowed', false);
    }

    protected function cancelHint(Sale $sale, ?FiscalDocument $document): ?string
    {
        if (! $document) {
            return 'Sem documento fiscal';
        }

        return (string) data_get($this->cancellationRules->evaluate($sale, $document), 'message', 'Sem cancelamento disponivel');
    }

    protected function canFlagContingency(?FiscalDocument $document): bool
    {
        if (! $document) {
            return false;
        }

        return in_array($document->status, ['awaiting_agent', 'failed', 'rejected', 'contingency_pending'], true);
    }

    protected function contingencyHint(?FiscalDocument $document): string
    {
        if (! $document) {
            return 'Sem documento fiscal';
        }

        return match ($document->status) {
            'awaiting_agent' => 'Sem agente local disponivel',
            'failed', 'rejected' => 'Falha fiscal pronta para contingencia',
            'contingency_pending' => 'Em contingencia operacional',
            'contingency_failed' => 'Falha ao reenfileirar contingencia',
            default => 'Sem contingencia disponivel',
        };
    }

    protected function saleStatusLabel(string $status): string
    {
        return match ($status) {
            'cancelled' => 'Cancelada',
            default => 'Fechada',
        };
    }

    protected function saleStatusTone(string $status): string
    {
        return match ($status) {
            'cancelled' => 'danger',
            default => 'success',
        };
    }

    protected function documentStatusLabel(string $status): string
    {
        return match ($status) {
            'authorized' => 'Autorizada',
            'printed' => 'Impressa',
            'awaiting_agent' => 'Sem agente',
            'queued' => 'Na fila',
            'queued_to_agent' => 'No agente',
            'processing' => 'Emitindo',
            'failed' => 'Falhou',
            'rejected' => 'Rejeitada',
            'signed_local' => 'Ensaio',
            'printed_local' => 'Ensaio impresso',
            'cancellation_queued', 'cancellation_processing' => 'Cancelando',
            'cancellation_failed' => 'Falha cancel.',
            'contingency_pending' => 'Contingencia',
            'contingency_failed' => 'Falha conting.',
            'cancelled' => 'Cancelada',
            'cancelled_local' => 'Cancelada local',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    protected function documentStatusTone(string $status): string
    {
        return match ($status) {
            'authorized', 'printed' => 'success',
            'cancelled', 'cancelled_local' => 'danger',
            'cancellation_queued', 'cancellation_processing', 'awaiting_agent', 'queued', 'queued_to_agent', 'processing' => 'warning',
            'contingency_pending' => 'warning',
            'failed', 'rejected', 'cancellation_failed', 'contingency_failed' => 'danger',
            'signed_local', 'printed_local' => 'info',
            default => 'neutral',
        };
    }

    protected function inutilizationStatusLabel(string $status): string
    {
        return match ($status) {
            'queued' => 'Na fila',
            'processing' => 'Processando',
            'processed' => 'Concluida',
            'rejected' => 'Rejeitada',
            'failed' => 'Falhou',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }

    protected function inutilizationStatusTone(string $status): string
    {
        return match ($status) {
            'processed' => 'success',
            'queued', 'processing' => 'warning',
            'rejected', 'failed' => 'danger',
            default => 'neutral',
        };
    }
}
