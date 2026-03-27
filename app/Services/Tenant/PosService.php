<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosService
{
    public function finalize(array $payload, int $userId): array
    {
        $cashRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        if (! $cashRegister) {
            throw ValidationException::withMessages([
                'cash_register' => 'Abra um caixa antes de finalizar a venda.',
            ]);
        }

        return DB::transaction(function () use ($payload, $userId, $cashRegister) {
            $items = collect($payload['items'])->map(function (array $item) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($item['id']);
                $quantity = (float) $item['qty'];

                if ((float) $product->stock_quantity < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => "Estoque insuficiente para {$product->name}.",
                    ]);
                }

                return compact('product', 'quantity');
            });

            $subtotal = $items->sum(fn ($item) => (float) $item['product']->sale_price * $item['quantity']);
            $costTotal = $items->sum(fn ($item) => (float) $item['product']->cost_price * $item['quantity']);
            $discount = (float) ($payload['discount'] ?? 0);
            $total = max(0, $subtotal - $discount);

            $payments = collect($payload['payments'])->map(function (array $payment) {
                return [
                    'method' => $payment['method'],
                    'amount' => $payment['amount'] ?? null,
                ];
            });

            $resolvedPayments = $payments->values()->map(function (array $payment, int $index) use ($payments, $total) {
                if ($payments->count() === 1 && $payment['amount'] === null) {
                    return ['method' => $payment['method'], 'amount' => $total];
                }

                if ($payment['amount'] === null) {
                    throw ValidationException::withMessages([
                        'payments' => 'Informe o valor de cada parcela do pagamento misto.',
                    ]);
                }

                return ['method' => $payment['method'], 'amount' => (float) $payment['amount']];
            });

            $paymentsTotal = round($resolvedPayments->sum('amount'), 2);
            if (round($paymentsTotal, 2) !== round($total, 2)) {
                throw ValidationException::withMessages([
                    'payments' => 'A soma dos pagamentos precisa ser igual ao total da venda.',
                ]);
            }

            $paymentMethods = $resolvedPayments->pluck('method')->unique()->values();
            $paymentMethod = $paymentMethods->count() === 1 ? $paymentMethods->first() : 'mixed';

            $sale = Sale::query()->create([
                'sale_number' => $this->nextSaleNumber(),
                'customer_id' => $payload['customer_id'] ?? null,
                'user_id' => $userId,
                'cash_register_id' => $cashRegister->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'cost_total' => $costTotal,
                'profit' => $total - $costTotal,
                'payment_method' => $paymentMethod,
                'status' => 'finalized',
                'notes' => $payload['notes'] ?? null,
            ]);

            foreach ($items as $entry) {
                /** @var Product $product */
                $product = $entry['product'];
                $quantity = $entry['quantity'];
                $lineTotal = (float) $product->sale_price * $quantity;

                $sale->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_cost' => $product->cost_price,
                    'unit_price' => $product->sale_price,
                    'total' => $lineTotal,
                    'profit' => ((float) $product->sale_price - (float) $product->cost_price) * $quantity,
                ]);

                $product->decrement('stock_quantity', $quantity);
            }

            foreach ($resolvedPayments as $payment) {
                $sale->payments()->create([
                    'payment_method' => $payment['method'],
                    'amount' => $payment['amount'],
                ]);
            }

            return [
                'sale_id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'total' => (float) $sale->total,
            ];
        });
    }

    protected function nextSaleNumber(): string
    {
        $prefix = now()->format('Ymd');
        $count = Sale::query()->whereDate('created_at', now())->count() + 1;

        return sprintf('VND-%s-%04d', $prefix, $count);
    }
}
