<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\SalePayment;
use App\Models\Tenant\CashMovement;
use App\Models\Tenant\FiscalProfile;
use App\Support\Tenant\PaymentMethod;

class LocalAgentReceiptPayloadService
{
    public function buildPaymentReceiptPayload(Sale $sale): array
    {
        $sale->loadMissing([
            'customer:id,name',
            'company:id,name,trade_name',
            'items.product:id,name,sold_by',
            'items.promotion:id,name',
            'payments',
        ]);

        $customerName = $sale->customer?->name
            ?: $sale->company?->trade_name
            ?: $sale->company?->name
            ?: data_get($sale->recipient_payload, 'name');

        return [
            'sale_id' => $sale->id,
            'store_name' => tenant()?->name ?: config('app.name', 'Nimvo'),
            'company' => $this->companyHeader(),
            'sale_number' => (string) $sale->sale_number,
            'issued_at' => optional($sale->created_at)?->toIso8601String(),
            'total' => (float) $sale->total,
            'change_amount' => (float) ($sale->change_amount ?? 0),
            'notes' => filled($sale->notes) ? (string) $sale->notes : null,
            'customer' => filled($customerName) ? ['name' => (string) $customerName] : null,
            'items' => $sale->items
                ->map(fn (SaleItem $item) => [
                    'name' => (string) ($item->product?->name ?: 'Item'),
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'total' => (float) $item->total,
                    'weighable' => $item->product?->sold_by === 'weight',
                    'unit' => $item->product?->sold_by === 'weight' ? 'KG' : 'UN',
                    'promotion_name' => $item->promotion?->name,
                ])
                ->values()
                ->all(),
            'payments' => $sale->payments
                ->map(fn (SalePayment $payment) => [
                    'label' => PaymentMethod::label($payment->payment_method),
                    'amount' => (float) $payment->amount,
                    'method' => (string) $payment->payment_method,
                ])
                ->values()
                ->all(),
        ];
    }

    public function buildTestPrintPayload(?string $storeName = null, ?string $message = null): array
    {
        return [
            'store_name' => $storeName ?: (tenant()?->name ?: config('app.name', 'Nimvo')),
            'message' => $message ?: 'Teste enviado pela fila central do Nimvo.',
            'issued_at' => now()->toIso8601String(),
        ];
    }

    public function buildCashMovementPayload(CashMovement $movement): array
    {
        $movement->loadMissing(['user', 'cashRegister']);

        return [
            'type' => $movement->type === 'withdrawal' ? 'sangria' : 'suprimento',
            'store_name' => tenant()?->name ?: config('app.name', 'Nimvo'),
            'company' => $this->companyHeader(),
            'issued_at' => optional($movement->created_at)?->toIso8601String() ?: now()->toIso8601String(),
            'amount' => (float) $movement->amount,
            'reason' => (string) $movement->reason,
            'operator' => (string) ($movement->user?->name ?: ''),
        ];
    }

    public function buildOperationPaymentPayload(Sale $sale, SalePayment $payment): array
    {
        $sale->loadMissing(['customer:id,name', 'company:id,name,trade_name']);

        $customerName = $sale->customer?->name
            ?: $sale->company?->trade_name
            ?: $sale->company?->name
            ?: data_get($sale->recipient_payload, 'name');

        return [
            'type' => (string) $payment->payment_method,
            'store_name' => tenant()?->name ?: config('app.name', 'Nimvo'),
            'company' => $this->companyHeader(),
            'issued_at' => optional($sale->created_at)?->toIso8601String() ?: now()->toIso8601String(),
            'amount' => (float) $payment->amount,
            'payment_method' => (string) $payment->payment_method,
            'customer_name' => filled($customerName) ? (string) $customerName : '',
            'due_at' => data_get($sale->recipient_payload, 'due_at'),
            'extra' => [
                'sale_id' => $sale->id,
                'sale_number' => (string) $sale->sale_number,
                'label' => PaymentMethod::label($payment->payment_method),
            ],
        ];
    }

    /**
     * Store identity shown on every receipt header (CNPJ + address). Reuses
     * the fiscal profile when one has been filled in, even if NFC-e emission
     * itself is disabled ("Status: Inativo") - a store that took the time to
     * fill in its CNPJ/address wants that on its non-fiscal coupons too.
     */
    protected function companyHeader(): ?array
    {
        $profile = FiscalProfile::query()->first();

        if (! $profile) {
            return null;
        }

        $cnpj = trim((string) $profile->cnpj);
        $address = $this->formatAddress($profile);

        if ($cnpj === '' && $address === '') {
            return null;
        }

        return [
            'name' => $profile->trade_name ?: $profile->company_name,
            'cnpj' => $cnpj !== '' ? $this->formatCnpj($cnpj) : null,
            'ie' => filled($profile->ie) ? (string) $profile->ie : null,
            'address' => $address !== '' ? $address : null,
        ];
    }

    protected function formatAddress(FiscalProfile $profile): string
    {
        $line = trim(implode(', ', array_filter([
            trim((string) $profile->street),
            trim((string) $profile->number),
        ])));

        $district = trim((string) $profile->district);
        if ($district !== '') {
            $line = trim(implode(', ', array_filter([$line, $district])));
        }

        $cityState = trim(implode(' - ', array_filter([
            trim((string) $profile->city_name),
            trim((string) $profile->state),
        ])));

        return trim(implode(' - ', array_filter([$line, $cityState])));
    }

    protected function formatCnpj(string $cnpj): string
    {
        $digits = preg_replace('/\D/', '', $cnpj) ?? '';

        if (strlen($digits) !== 14) {
            return $cnpj;
        }

        return sprintf(
            '%s.%s.%s/%s-%s',
            substr($digits, 0, 2),
            substr($digits, 2, 3),
            substr($digits, 5, 3),
            substr($digits, 8, 4),
            substr($digits, 12, 2),
        );
    }
}
