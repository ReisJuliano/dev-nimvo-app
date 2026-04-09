<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\Company;
use App\Models\Tenant\Customer;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\SalePayment;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;

class FiscalConsultationService
{
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
                'latestFiscalDocument',
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
            ],
            'range' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'label' => $this->rangeLabel($period, $from, $to),
            ],
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
            'cancel_hint' => $this->cancelHint($document),
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
            ] : null,
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

        return $parts === [] ? null : implode(' • ', $parts);
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
            'week' => sprintf('Semana • %s ate %s', $from->format('d/m'), $to->format('d/m')),
            'month' => sprintf('Mes • %s', $from->translatedFormat('F \\d\\e Y')),
            default => sprintf('Hoje • %s', $from->format('d/m/Y')),
        };
    }

    protected function saleCanBeCancelled(Sale $sale, ?FiscalDocument $document): bool
    {
        if ($sale->status === 'cancelled') {
            return false;
        }

        if (! $document) {
            return true;
        }

        return in_array($document->status, [
            'authorized',
            'printed',
            'awaiting_agent',
            'failed',
            'rejected',
            'signed_local',
            'printed_local',
            'cancellation_failed',
        ], true);
    }

    protected function cancelHint(?FiscalDocument $document): ?string
    {
        if (! $document) {
            return 'Sem documento fiscal';
        }

        return match ($document->status) {
            'authorized', 'printed', 'cancellation_failed' => 'Cancela na SEFAZ',
            'signed_local', 'printed_local' => 'Cancela localmente',
            'awaiting_agent', 'failed', 'rejected' => 'Cancela a venda',
            'queued', 'queued_to_agent', 'processing', 'cancellation_queued', 'cancellation_processing' => 'Processamento em andamento',
            'cancelled', 'cancelled_local' => 'Ja cancelada',
            default => null,
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
            'failed', 'rejected', 'cancellation_failed' => 'danger',
            'signed_local', 'printed_local' => 'info',
            default => 'neutral',
        };
    }
}
