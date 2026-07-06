<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashMovement;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\ConditionalSale;
use App\Models\Tenant\ConditionalSaleItem;
use App\Models\Tenant\CreditPayment;
use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\SalePayment;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReceivablesOverviewService
{
    protected const AGING_ORDER = ['a_vencer' => 0, '1_30' => 1, '31_60' => 2, '61_90' => 3, '90_mais' => 4];

    public function overview(array $filters = []): Collection
    {
        $credit = $this->creditByCustomer();
        $conditional = $this->conditionalByCustomer();
        $delivery = $this->deliveryByCustomer();

        $customerIds = collect()
            ->merge($credit->keys())
            ->merge($conditional->keys())
            ->merge($delivery->keys())
            ->unique()
            ->values();

        $customers = Customer::query()->whereIn('id', $customerIds)->get()->keyBy('id');
        $lastPayments = CreditPayment::query()
            ->whereIn('customer_id', $customerIds)
            ->selectRaw('customer_id, MAX(received_at) as last_received_at')
            ->groupBy('customer_id')
            ->pluck('last_received_at', 'customer_id');

        $rows = $customerIds->map(function ($customerId) use ($credit, $conditional, $delivery, $customers, $lastPayments) {
            $creditRow = $credit->get($customerId);
            $conditionalRow = $conditional->get($customerId);
            $deliveryRow = $delivery->get($customerId);

            $creditBalance = round((float) ($creditRow['balance'] ?? 0), 2);
            $conditionalBalance = round((float) ($conditionalRow['balance'] ?? 0), 2);
            $deliveryBalance = round((float) ($deliveryRow['balance'] ?? 0), 2);
            $total = round($creditBalance + $conditionalBalance + $deliveryBalance, 2);

            $buckets = array_filter([
                $creditRow['bucket'] ?? null,
                $conditionalRow['bucket'] ?? null,
                $deliveryRow['bucket'] ?? null,
            ]);

            $worstBucket = collect($buckets)->sortByDesc(fn ($bucket) => self::AGING_ORDER[$bucket] ?? 0)->first() ?? 'a_vencer';

            return [
                'customer_id' => $customerId,
                'customer_name' => $customers->get($customerId)?->name,
                'phone' => $customers->get($customerId)?->phone,
                'credit_limit' => (float) ($customers->get($customerId)?->credit_limit ?? 0),
                'credit_balance' => $creditBalance,
                'conditional_balance' => $conditionalBalance,
                'delivery_balance' => $deliveryBalance,
                'total' => $total,
                'aging_bucket' => $worstBucket,
                'last_payment_at' => $lastPayments->get($customerId),
            ];
        })->filter(fn (array $row) => $row['total'] > 0.009)->values();

        if (filled($filters['aging_bucket'] ?? null)) {
            $rows = $rows->filter(fn (array $row) => $row['aging_bucket'] === $filters['aging_bucket'])->values();
        }

        if (filled($filters['search'] ?? null)) {
            $term = mb_strtolower((string) $filters['search']);
            $rows = $rows->filter(fn (array $row) => str_contains(mb_strtolower((string) $row['customer_name']), $term))->values();
        }

        return $rows->sortByDesc('total')->values();
    }

    public function customerStatement(int $customerId): array
    {
        $customer = Customer::query()->findOrFail($customerId);

        $creditSales = SalePayment::query()
            ->select('sales.id', 'sales.sale_number', 'sales.created_at', 'sale_payments.amount')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.customer_id', $customerId)
            ->where('sales.status', 'finalized')
            ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
            ->where('sale_payments.amount', '>', 0)
            ->orderBy('sales.created_at')
            ->get()
            ->map(fn ($row) => [
                'type' => 'venda_fiado',
                'reference' => $row->sale_number,
                'date' => Carbon::parse($row->created_at)->toIso8601String(),
                'amount' => (float) $row->amount,
            ]);

        $payments = CreditPayment::query()
            ->where('customer_id', $customerId)
            ->orderBy('received_at')
            ->get()
            ->map(fn (CreditPayment $payment) => [
                'type' => 'pagamento',
                'reference' => PaymentMethod::label($payment->payment_method),
                'date' => $payment->received_at?->toIso8601String(),
                'amount' => -1 * (float) $payment->amount,
            ]);

        $entries = $creditSales->concat($payments)->sortBy('date')->values();

        $runningBalance = 0.0;
        $entries = $entries->map(function (array $entry) use (&$runningBalance) {
            $runningBalance = round($runningBalance + $entry['amount'], 2);
            $entry['running_balance'] = $runningBalance;

            return $entry;
        });

        return [
            'customer' => ['id' => $customer->id, 'name' => $customer->name, 'credit_limit' => (float) $customer->credit_limit],
            'entries' => $entries->values(),
            'current_balance' => $runningBalance,
        ];
    }

    public function receiveCreditPayment(int $customerId, float $amount, string $paymentMethod, int $userId, ?string $notes, CashRegister $cashRegister): void
    {
        $remaining = round($amount, 2);

        DB::transaction(function () use ($customerId, $paymentMethod, $userId, $notes, $cashRegister, &$remaining) {
            $openPayments = SalePayment::query()
                ->select('sale_payments.*')
                ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
                ->where('sales.customer_id', $customerId)
                ->where('sales.status', 'finalized')
                ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
                ->where('sale_payments.amount', '>', 0)
                ->orderBy('sales.created_at')
                ->orderBy('sale_payments.id')
                ->lockForUpdate()
                ->get();

            $openTotal = round((float) $openPayments->sum('amount'), 2);

            if ($openTotal <= 0) {
                throw ValidationException::withMessages(['amount' => 'Este cliente não tem fiado em aberto.']);
            }

            if ($remaining > $openTotal) {
                throw ValidationException::withMessages(['amount' => 'O valor informado é maior que o fiado em aberto.']);
            }

            $totalReceived = $remaining;

            foreach ($openPayments as $payment) {
                if ($remaining <= 0) {
                    break;
                }

                $currentAmount = round((float) $payment->amount, 2);
                $paidNow = min($currentAmount, $remaining);
                $nextAmount = round($currentAmount - $paidNow, 2);

                if ($nextAmount <= 0.009) {
                    $payment->delete();
                } else {
                    $payment->forceFill(['amount' => $nextAmount])->save();
                }

                $remaining = round($remaining - $paidNow, 2);
            }

            CreditPayment::query()->create([
                'customer_id' => $customerId,
                'amount' => $totalReceived,
                'payment_method' => $paymentMethod,
                'cash_register_id' => $cashRegister->id,
                'user_id' => $userId,
                'notes' => $notes,
                'received_at' => now(),
            ]);

            CashMovement::query()->create([
                'cash_register_id' => $cashRegister->id,
                'user_id' => $userId,
                'type' => 'supply',
                'amount' => $totalReceived,
                'reason' => 'Recebimento de fiado',
            ]);
        });
    }

    public function collectDeliveryPayment(DeliveryOrder $order, string $paymentMethod, int $userId, CashRegister $cashRegister): void
    {
        if (!$order->isPendingPayment()) {
            throw ValidationException::withMessages(['order' => 'Esta entrega não está com pagamento pendente.']);
        }

        DB::transaction(function () use ($order, $paymentMethod, $userId, $cashRegister) {
            $order->forceFill([
                'payment_collected_at' => now(),
                'payment_method' => $paymentMethod,
            ])->save();

            CashMovement::query()->create([
                'cash_register_id' => $cashRegister->id,
                'user_id' => $userId,
                'type' => 'supply',
                'amount' => (float) $order->order_total,
                'reason' => "Recebimento de entrega {$order->reference}",
            ]);
        });
    }

    protected function creditByCustomer(): Collection
    {
        return SalePayment::query()
            ->select('sales.customer_id')
            ->selectRaw('SUM(sale_payments.amount) as balance')
            ->selectRaw('MIN(sales.created_at) as oldest_at')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
            ->where('sale_payments.amount', '>', 0)
            ->whereNotNull('sales.customer_id')
            ->groupBy('sales.customer_id')
            ->get()
            ->keyBy('customer_id')
            ->map(fn ($row) => [
                'balance' => (float) $row->balance,
                'bucket' => $this->bucketFromDate(Carbon::parse($row->oldest_at)),
            ]);
    }

    protected function conditionalByCustomer(): Collection
    {
        return ConditionalSale::query()
            ->with('items')
            ->where('status', 'open')
            ->whereNotNull('customer_id')
            ->get()
            ->groupBy('customer_id')
            ->map(function (Collection $sales) {
                $balance = round($sales->sum(fn (ConditionalSale $sale) => $this->conditionalOutstanding($sale)), 2);
                $referenceDates = $sales->map(fn (ConditionalSale $sale) => $sale->due_at ?: $sale->withdrawn_at ?: $sale->created_at);
                $bucket = $referenceDates->map(fn ($date) => $this->bucketFromDate(Carbon::parse($date)))
                    ->sortByDesc(fn ($bucket) => self::AGING_ORDER[$bucket] ?? 0)
                    ->first();

                return ['balance' => $balance, 'bucket' => $bucket];
            });
    }

    protected function conditionalOutstanding(ConditionalSale $sale): float
    {
        return round($sale->items->sum(fn (ConditionalSaleItem $item) => $this->remainingQuantity($item) * (float) $item->unit_price), 2);
    }

    protected function remainingQuantity(ConditionalSaleItem $item): float
    {
        return round(
            (float) $item->quantity_sent
            - (float) $item->quantity_returned
            - (float) $item->quantity_kept
            - (float) $item->quantity_lost
            - (float) $item->quantity_damaged,
            3,
        );
    }

    protected function deliveryByCustomer(): Collection
    {
        return DeliveryOrder::query()
            ->where('status', 'delivered')
            ->whereNull('payment_collected_at')
            ->whereNotNull('customer_id')
            ->get()
            ->groupBy('customer_id')
            ->map(fn (Collection $orders) => [
                'balance' => round((float) $orders->sum('order_total'), 2),
                'bucket' => $this->bucketFromDate(Carbon::parse($orders->min('delivered_at') ?? now())),
            ]);
    }

    protected function bucketFromDate(Carbon $referenceDate): string
    {
        if ($referenceDate->isFuture()) {
            return 'a_vencer';
        }

        $days = $referenceDate->diffInDays(now());

        return match (true) {
            $days <= 30 => '1_30',
            $days <= 60 => '31_60',
            $days <= 90 => '61_90',
            default => '90_mais',
        };
    }
}
