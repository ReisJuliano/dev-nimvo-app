<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Customer;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosService
{
    public function __construct(
        protected OrderDraftService $orderDraftService,
    ) {
    }

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
            $orderDraft = null;

            if (!empty($payload['order_draft_id'])) {
                $orderDraft = OrderDraft::query()
                    ->lockForUpdate()
                    ->find($payload['order_draft_id']);

                if (!$orderDraft || $orderDraft->status === OrderDraft::STATUS_COMPLETED || $orderDraft->sale_id) {
                    throw ValidationException::withMessages([
                        'order_draft_id' => 'Este pedido nao esta mais disponivel para cobranca.',
                    ]);
                }
            }

            $items = collect($payload['items'])->map(function (array $item) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($item['id']);
                $quantity = (float) $item['qty'];

                if ((float) $product->stock_quantity < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => "Estoque insuficiente para {$product->name}.",
                    ]);
                }

                $lineSubtotal = round((float) $product->sale_price * $quantity, 2);
                $lineDiscount = round((float) ($item['discount'] ?? 0), 2);

                if ($lineDiscount < 0 || $lineDiscount > $lineSubtotal) {
                    throw ValidationException::withMessages([
                        'items' => "Desconto invalido para {$product->name}.",
                    ]);
                }

                return compact('product', 'quantity', 'lineSubtotal', 'lineDiscount');
            });

            $subtotal = round($items->sum('lineSubtotal'), 2);
            $costTotal = $items->sum(fn ($item) => (float) $item['product']->cost_price * $item['quantity']);
            $discount = round((float) ($payload['discount'] ?? 0), 2);
            $itemDiscountTotal = round($items->sum('lineDiscount'), 2);

            if (abs($itemDiscountTotal - $discount) > 0.02) {
                throw ValidationException::withMessages([
                    'discount' => 'O desconto total nao confere com os descontos aplicados nos itens.',
                ]);
            }

            if ($discount > $subtotal) {
                throw ValidationException::withMessages([
                    'discount' => 'O desconto nao pode ser maior que o subtotal da venda.',
                ]);
            }

            $total = round(max(0, $subtotal - $discount), 2);

            $payments = collect($payload['payments'])->map(function (array $payment) {
                return [
                    'method' => PaymentMethod::normalize($payment['method'] ?? null),
                    'amount' => $payment['amount'] ?? null,
                ];
            });

            if ($payments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::MIXED)) {
                throw ValidationException::withMessages([
                    'payments' => 'O pagamento misto deve ser detalhado em parcelas.',
                ]);
            }

            $resolvedPayments = $payments->values()->map(function (array $payment) use ($payments, $total) {
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

            if ($resolvedPayments->count() > 1 && $resolvedPayments->pluck('method')->unique()->count() < 2) {
                throw ValidationException::withMessages([
                    'payments' => 'Use ao menos duas formas para registrar pagamento misto.',
                ]);
            }

            $paymentsTotal = round($resolvedPayments->sum('amount'), 2);
            if (round($paymentsTotal, 2) !== round($total, 2)) {
                throw ValidationException::withMessages([
                    'payments' => 'A soma dos pagamentos precisa ser igual ao total da venda.',
                ]);
            }

            $paymentMethods = $resolvedPayments->pluck('method')->unique()->values();
            $paymentMethod = $paymentMethods->count() === 1 ? $paymentMethods->first() : PaymentMethod::MIXED;

            $customerId = $payload['customer_id'] ?? $orderDraft?->customer_id;
            $hasCredit = $resolvedPayments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::CREDIT);

            if ($hasCredit && ! $customerId) {
                throw ValidationException::withMessages([
                    'customer_id' => 'Selecione um cliente para venda no crediario.',
                ]);
            }

            if ($hasCredit && $customerId) {
                /** @var Customer $customer */
                $customer = Customer::query()->findOrFail($customerId);
                $creditAmount = (float) $resolvedPayments
                    ->where('method', PaymentMethod::CREDIT)
                    ->sum('amount');

                $openCredit = (float) $customer->sales()
                    ->where('status', 'finalized')
                    ->whereHas('payments', fn ($query) => $query->where('payment_method', PaymentMethod::CREDIT))
                    ->join('sale_payments', 'sale_payments.sale_id', '=', 'sales.id')
                    ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
                    ->sum('sale_payments.amount');

                $availableCredit = max(0, (float) $customer->credit_limit - $openCredit);

                if ((float) $customer->credit_limit > 0 && $creditAmount > $availableCredit) {
                    throw ValidationException::withMessages([
                        'payments' => 'O valor em crediario ultrapassa o limite disponivel deste cliente.',
                    ]);
                }
            }

            $sale = Sale::query()->create([
                'sale_number' => $this->nextSaleNumber(),
                'customer_id' => $customerId,
                'user_id' => $userId,
                'cash_register_id' => $cashRegister->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'cost_total' => $costTotal,
                'profit' => $total - $costTotal,
                'payment_method' => $paymentMethod,
                'status' => 'finalized',
                'notes' => $payload['notes'] ?? $orderDraft?->notes,
            ]);

            foreach ($items as $entry) {
                /** @var Product $product */
                $product = $entry['product'];
                $quantity = $entry['quantity'];
                $lineTotal = round(max(0, $entry['lineSubtotal'] - $entry['lineDiscount']), 2);
                $unitPrice = $quantity > 0 ? round($lineTotal / $quantity, 2) : 0;

                $sale->items()->create([
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_cost' => $product->cost_price,
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                    'profit' => round($lineTotal - ((float) $product->cost_price * $quantity), 2),
                ]);

                $product->decrement('stock_quantity', $quantity);
            }

            foreach ($resolvedPayments as $payment) {
                $sale->payments()->create([
                    'payment_method' => $payment['method'],
                    'amount' => $payment['amount'],
                ]);
            }

            if ($orderDraft) {
                $this->orderDraftService->markAsCompleted($orderDraft, $sale);
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
