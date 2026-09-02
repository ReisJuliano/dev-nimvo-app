<?php

namespace App\Services\Tenant;

use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SalePayment;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;

class ConsultationsPageService
{
    public function build(array $filters): array
    {
        $applied = filter_var($filters['applied'] ?? false, FILTER_VALIDATE_BOOL)
            || array_key_exists('period', $filters)
            || array_key_exists('from', $filters)
            || array_key_exists('to', $filters)
            || filled($filters['search'] ?? null);
        [$period, $from, $to] = $this->resolveRange($filters);

        if (! $applied) {
            return [
                'filters' => [
                    'applied' => false,
                    'period' => $period,
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'search' => trim((string) ($filters['search'] ?? '')),
                ],
                'range' => [
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'label' => $this->rangeLabel($period, $from, $to),
                ],
                'recordTypes' => [
                    ['key' => 'all', 'label' => 'Todas'],
                    ['key' => 'sale', 'label' => 'Vendas'],
                    ['key' => 'entry', 'label' => 'Entradas'],
                    ['key' => 'delivery', 'label' => 'Entregas'],
                    ['key' => 'credit', 'label' => 'Fiado'],
                    ['key' => 'fiscal', 'label' => 'NF-e Fiscais'],
                ],
                'summary' => [
                    ['key' => 'sales', 'label' => 'Vendas', 'value' => 0],
                    ['key' => 'entries', 'label' => 'Entradas', 'value' => 0],
                    ['key' => 'deliveries', 'label' => 'Entregas', 'value' => 0],
                    ['key' => 'credit', 'label' => 'Fiado', 'value' => 0],
                    ['key' => 'fiscal', 'label' => 'NF-e', 'value' => 0],
                ],
                'records' => [],
            ];
        }

        $sales = Sale::query()
            ->with([
                'customer:id,name,phone,document',
                'company:id,name,trade_name,document',
                'user:id,name',
                'items:id,sale_id,product_id,quantity,unit_price,total',
                'items.product:id,name,code',
                'payments:id,sale_id,payment_method,amount',
                'latestFiscalDocument' => fn ($query) => $query->select([
                    'fiscal_documents.id',
                    'fiscal_documents.sale_id',
                    'fiscal_documents.status',
                    'fiscal_documents.number',
                    'fiscal_documents.series',
                    'fiscal_documents.access_key',
                    'fiscal_documents.signed_xml',
                    'fiscal_documents.authorized_xml',
                    'fiscal_documents.response_xml',
                    'fiscal_documents.cancelled_xml',
                    'fiscal_documents.printed_at',
                    'fiscal_documents.authorized_at',
                    'fiscal_documents.cancelled_at',
                    'fiscal_documents.last_error',
                ]),
            ])
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->latest('created_at')
            ->limit(80)
            ->get();

        $entries = Purchase::query()
            ->with([
                'supplier:id,name,document',
                'items:id,purchase_id,product_name,product_id,quantity,unit_cost,total',
                'incomingNfeDocument:id,purchase_id,access_key,number,series,danfe_path',
            ])
            ->where('status', 'received')
            ->whereBetween('received_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->latest('received_at')
            ->limit(80)
            ->get();

        $deliveries = DeliveryOrder::query()
            ->with(['customer:id,name,phone'])
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->latest('created_at')
            ->limit(80)
            ->get();

        $creditSales = $sales
            ->filter(function (Sale $sale) {
                if (PaymentMethod::normalize($sale->payment_method) === PaymentMethod::CREDIT) {
                    return true;
                }

                return $sale->payments->contains(fn (SalePayment $payment) => PaymentMethod::normalize($payment->payment_method) === PaymentMethod::CREDIT);
            })
            ->values();

        $fiscalDocuments = FiscalDocument::query()
            ->with(['sale:id,sale_number,total,status,created_at'])
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->latest('created_at')
            ->limit(80)
            ->get();

        $records = collect()
            ->concat($sales->map(fn (Sale $sale) => $this->serializeSale($sale)))
            ->concat($entries->map(fn (Purchase $purchase) => $this->serializeEntry($purchase)))
            ->concat($deliveries->map(fn (DeliveryOrder $delivery) => $this->serializeDelivery($delivery)))
            ->concat($creditSales->map(fn (Sale $sale) => $this->serializeCreditSale($sale)))
            ->concat($fiscalDocuments->map(fn (FiscalDocument $document) => $this->serializeFiscalDocument($document)))
            ->sortByDesc('date_sort')
            ->values()
            ->all();

        return [
            'filters' => [
                'applied' => true,
                'period' => $period,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'search' => trim((string) ($filters['search'] ?? '')),
            ],
            'range' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'label' => $this->rangeLabel($period, $from, $to),
            ],
            'recordTypes' => [
                ['key' => 'all', 'label' => 'Todas'],
                ['key' => 'sale', 'label' => 'Vendas'],
                ['key' => 'entry', 'label' => 'Entradas'],
                ['key' => 'delivery', 'label' => 'Entregas'],
                ['key' => 'credit', 'label' => 'Fiado'],
                ['key' => 'fiscal', 'label' => 'NF-e Fiscais'],
            ],
            'summary' => [
                ['key' => 'sales', 'label' => 'Vendas', 'value' => $sales->count()],
                ['key' => 'entries', 'label' => 'Entradas', 'value' => $entries->count()],
                ['key' => 'deliveries', 'label' => 'Entregas', 'value' => $deliveries->count()],
                ['key' => 'credit', 'label' => 'Fiado', 'value' => $creditSales->count()],
                ['key' => 'fiscal', 'label' => 'NF-e', 'value' => $fiscalDocuments->count()],
            ],
            'records' => $records,
        ];
    }

    protected function serializeSale(Sale $sale): array
    {
        $recipient = $sale->company?->trade_name
            ?: $sale->company?->name
            ?: $sale->customer?->name
            ?: 'Consumidor final';
        $document = $sale->latestFiscalDocument;

        return [
            'uid' => sprintf('sale-%d', $sale->id),
            'type' => 'sale',
            'entity_id' => $sale->id,
            'title' => $sale->sale_number,
            'subtitle' => $recipient,
            'amount' => (float) $sale->total,
            'date' => $sale->created_at?->toIso8601String(),
            'date_sort' => $sale->created_at?->timestamp ?? 0,
            'status_label' => $sale->status === 'cancelled' ? 'Cancelada' : 'Fechada',
            'status_tone' => $sale->status === 'cancelled' ? 'danger' : 'success',
            'tags' => array_values(array_filter([
                $document ? sprintf('Fiscal %s', ucfirst((string) $document->status)) : 'Sem fiscal',
                PaymentMethod::label($sale->payment_method),
            ])),
            'actions' => [
                'preview_url' => $document ? route('api.fiscal.documents.preview', $document, false) : null,
                'retry_url' => $document ? route('api.fiscal.documents.retry', $document, false) : null,
                'cancel_url' => route('fiscal.consultations.sales.cancel', $sale, false),
                'authorized_xml_url' => $document && filled($document->authorized_xml) ? route('api.fiscal.documents.authorized-xml', $document, false) : null,
                'signed_xml_url' => $document && filled($document->signed_xml) ? route('api.fiscal.documents.signed-xml', $document, false) : null,
            ],
            'details' => [
                'operator' => $sale->user?->name,
                'recipient' => $recipient,
                'document' => $sale->customer?->document ?? $sale->company?->document,
                'notes' => $sale->notes,
                'payments' => $sale->payments->map(fn (SalePayment $payment) => [
                    'label' => PaymentMethod::label($payment->payment_method),
                    'amount' => (float) $payment->amount,
                ])->values()->all(),
                'items' => $sale->items->map(fn ($item) => [
                    'name' => $item->product?->name ?? 'Item',
                    'code' => $item->product?->code,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'total' => (float) $item->total,
                ])->values()->all(),
                'fiscal' => $document ? [
                    'status' => $document->status,
                    'number' => $document->number,
                    'series' => $document->series,
                    'access_key' => $document->access_key,
                    'authorized_at' => $document->authorized_at?->toIso8601String(),
                    'printed_at' => $document->printed_at?->toIso8601String(),
                    'last_error' => $document->last_error,
                ] : null,
            ],
        ];
    }

    protected function serializeEntry(Purchase $purchase): array
    {
        $document = $purchase->incomingNfeDocument;

        return [
            'uid' => sprintf('entry-%d', $purchase->id),
            'type' => 'entry',
            'entity_id' => $purchase->id,
            'title' => $this->purchaseTitle($purchase),
            'subtitle' => $purchase->supplier?->name ?? 'Fornecedor não informado',
            'amount' => (float) $purchase->total,
            'date' => $purchase->received_at?->toIso8601String(),
            'date_sort' => $purchase->received_at?->timestamp ?? 0,
            'status_label' => 'Entrada confirmada',
            'status_tone' => 'info',
            'tags' => array_values(array_filter([
                sprintf('%d item(ns)', $purchase->items->count()),
                $document?->access_key ? 'NF-e vinculada' : null,
            ])),
            'actions' => [
                'mirror_url' => $document && filled($document->danfe_path) ? route('api.purchases.incoming-nfe.danfe', $document, false) : null,
                'cancel_supported' => false,
                'reverse_supported' => false,
            ],
            'details' => [
                'supplier' => $purchase->supplier?->name,
                'supplier_document' => $purchase->supplier?->document,
                'code' => $purchase->code,
                'received_at' => $purchase->received_at?->toIso8601String(),
                'notes' => $purchase->notes,
                'items' => $purchase->items->map(fn ($item) => [
                    'name' => $item->product_name,
                    'quantity' => (float) $item->quantity,
                    'unit_cost' => (float) $item->unit_cost,
                    'total' => (float) $item->total,
                ])->values()->all(),
            ],
        ];
    }

    protected function serializeDelivery(DeliveryOrder $delivery): array
    {
        $statusLabel = match ((string) $delivery->status) {
            'dispatched' => 'Em rota',
            'delivered' => 'Entregue',
            default => 'Pendente',
        };

        $statusTone = match ((string) $delivery->status) {
            'delivered' => 'success',
            'dispatched' => 'info',
            default => 'warning',
        };

        return [
            'uid' => sprintf('delivery-%d', $delivery->id),
            'type' => 'delivery',
            'entity_id' => $delivery->id,
            'title' => $delivery->reference ?: sprintf('Entrega #%d', $delivery->id),
            'subtitle' => $delivery->customer?->name ?: $delivery->recipient_name ?: 'Sem cliente',
            'amount' => round((float) $delivery->order_total + (float) $delivery->delivery_fee, 2),
            'date' => ($delivery->scheduled_for ?: $delivery->created_at)?->toIso8601String(),
            'date_sort' => ($delivery->scheduled_for ?: $delivery->created_at)?->timestamp ?? 0,
            'status_label' => $statusLabel,
            'status_tone' => $statusTone,
            'tags' => array_values(array_filter([
                $delivery->channel === 'retirada' ? 'Retirada' : 'Delivery',
                $delivery->courier_name,
            ])),
            'actions' => [
                'mark_dispatched' => route('api.delivery.orders.status', $delivery, false),
                'delete_url' => sprintf('/api/operations/delivery/records/%d', $delivery->id),
            ],
            'details' => [
                'recipient' => $delivery->recipient_name ?: $delivery->customer?->name,
                'phone' => $delivery->phone ?: $delivery->customer?->phone,
                'address' => $delivery->address,
                'neighborhood' => $delivery->neighborhood,
                'courier' => $delivery->courier_name,
                'delivery_fee' => (float) $delivery->delivery_fee,
                'order_total' => (float) $delivery->order_total,
                'notes' => $delivery->notes,
            ],
        ];
    }

    protected function serializeCreditSale(Sale $sale): array
    {
        $recipient = $sale->company?->trade_name
            ?: $sale->company?->name
            ?: $sale->customer?->name
            ?: 'Cliente fiado';

        return [
            'uid' => sprintf('credit-%d', $sale->id),
            'type' => 'credit',
            'entity_id' => $sale->id,
            'title' => $sale->sale_number,
            'subtitle' => $recipient,
            'amount' => (float) $sale->total,
            'date' => $sale->created_at?->toIso8601String(),
            'date_sort' => $sale->created_at?->timestamp ?? 0,
            'status_label' => 'Fiado',
            'status_tone' => 'warning',
            'tags' => ['Recebimento pendente'],
            'actions' => [
                'payment_supported' => false,
                'cancel_url' => route('fiscal.consultations.sales.cancel', $sale, false),
            ],
            'details' => [
                'recipient' => $recipient,
                'operator' => $sale->user?->name,
                'document' => $sale->customer?->document ?? $sale->company?->document,
                'payments' => $sale->payments->map(fn (SalePayment $payment) => [
                    'label' => PaymentMethod::label($payment->payment_method),
                    'amount' => (float) $payment->amount,
                ])->values()->all(),
                'notes' => $sale->notes,
            ],
        ];
    }

    protected function serializeFiscalDocument(FiscalDocument $document): array
    {
        return [
            'uid' => sprintf('fiscal-%d', $document->id),
            'type' => 'fiscal',
            'entity_id' => $document->id,
            'title' => sprintf('NF %s / %s', $document->number ?: '--', $document->series ?: '--'),
            'subtitle' => $document->sale?->sale_number ?: 'Sem venda vinculada',
            'amount' => (float) ($document->sale?->total ?? 0),
            'date' => $document->created_at?->toIso8601String(),
            'date_sort' => $document->created_at?->timestamp ?? 0,
            'status_label' => ucfirst(str_replace('_', ' ', (string) $document->status)),
            'status_tone' => in_array($document->status, ['authorized', 'printed'], true)
                ? 'success'
                : (in_array($document->status, ['failed', 'rejected', 'cancelled'], true) ? 'danger' : 'info'),
            'tags' => array_values(array_filter([
                $document->access_key ? 'Chave disponível' : null,
                $document->sale?->status === 'cancelled' ? 'Venda cancelada' : null,
            ])),
            'actions' => [
                'preview_url' => route('api.fiscal.documents.preview', $document, false),
                'retry_url' => route('api.fiscal.documents.retry', $document, false),
                'signed_xml_url' => filled($document->signed_xml) ? route('api.fiscal.documents.signed-xml', $document, false) : null,
                'authorized_xml_url' => filled($document->authorized_xml) ? route('api.fiscal.documents.authorized-xml', $document, false) : null,
                'cancelled_xml_url' => filled($document->cancelled_xml) ? route('api.fiscal.documents.cancelled-xml', $document, false) : null,
                'inutilize_supported' => false,
            ],
            'details' => [
                'sale_number' => $document->sale?->sale_number,
                'status' => $document->status,
                'number' => $document->number,
                'series' => $document->series,
                'access_key' => $document->access_key,
                'last_error' => $document->last_error,
            ],
        ];
    }

    protected function purchaseTitle(Purchase $purchase): string
    {
        $metadata = json_decode((string) $purchase->notes, true);
        $invoiceNumber = is_array($metadata) && ($metadata['schema'] ?? null) === 'ops_purchase_v1'
            ? data_get($metadata, 'meta.invoice_number')
            : null;

        return $invoiceNumber ?: $purchase->code;
    }

    protected function resolvePeriod(string $period): string
    {
        return in_array($period, ['day', 'week', 'month', 'custom'], true) ? $period : 'day';
    }

    protected function resolveRange(array $filters): array
    {
        $period = $this->resolvePeriod((string) ($filters['period'] ?? 'day'));
        $customFrom = $this->parseFilterDate($filters['from'] ?? null);
        $customTo = $this->parseFilterDate($filters['to'] ?? null);

        if ($period === 'custom' || $customFrom || $customTo) {
            $from = $customFrom?->copy() ?? $customTo?->copy();
            $to = $customTo?->copy() ?? $customFrom?->copy();

            if ($from && $to && $from->gt($to)) {
                [$from, $to] = [$to, $from];
            }

            if ($from && $to) {
                return ['custom', $from->startOfDay(), $to->endOfDay()];
            }
        }

        if ($period === 'custom') {
            $period = 'day';
        }

        $now = now();
        [$from, $to] = match ($period) {
            'week' => [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()],
            'month' => [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()],
            default => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
        };

        return [$period, $from, $to];
    }

    protected function parseFilterDate(mixed $value): ?Carbon
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', trim($value))->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }

    protected function rangeLabel(string $period, Carbon $from, Carbon $to): string
    {
        return match ($period) {
            'custom' => sprintf('Periodo personalizado · %s ate %s', $from->format('d/m/Y'), $to->format('d/m/Y')),
            'week' => sprintf('Semana · %s ate %s', $from->format('d/m'), $to->format('d/m')),
            'month' => sprintf('Mes · %s', $from->translatedFormat('F \\d\\e Y')),
            default => sprintf('Hoje · %s', $from->format('d/m/Y')),
        };
    }
}
