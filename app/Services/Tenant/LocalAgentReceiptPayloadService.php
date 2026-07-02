<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\SalePayment;
use App\Models\Tenant\CashMovement;
use App\Support\Tenant\PaymentMethod;

class LocalAgentReceiptPayloadService
{
    public function buildPaymentReceiptPayload(Sale $sale): array
    {
        $sale->loadMissing([
            'customer:id,name',
            'company:id,name,trade_name',
            'items.product:id,name',
            'payments',
        ]);

        $customerName = $sale->customer?->name
            ?: $sale->company?->trade_name
            ?: $sale->company?->name
            ?: data_get($sale->recipient_payload, 'name');

        return [
            'sale_id' => $sale->id,
            'store_name' => tenant()?->name ?: config('app.name', 'Nimvo'),
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
}
