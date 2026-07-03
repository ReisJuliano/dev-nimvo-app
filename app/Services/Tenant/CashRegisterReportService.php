<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;
use App\Support\Tenant\PaymentMethod;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class CashRegisterReportService
{
    public function build(CashRegister $cashRegister): array
    {
        if ($cashRegister->status === 'closed') {
            $storedSnapshot = is_array($cashRegister->closing_snapshot)
                ? $cashRegister->closing_snapshot
                : $this->loadStoredSnapshot($cashRegister);

            if (is_array($storedSnapshot)) {
                return $this->normalizeStoredSnapshot($storedSnapshot, $cashRegister);
            }
        }

        $cashRegister->load(['user:id,name', 'movements.user:id,name']);

        $sales = $cashRegister->sales()
            ->with('payments')
            ->where('status', 'finalized')
            ->get();
        $salesRows = $sales->map(fn ($sale) => [
            'id' => $sale->id,
            'sale_number' => $sale->sale_number,
            'total' => (float) $sale->total,
            'created_at' => $sale->created_at?->toIso8601String(),
        ])->values()->all();
        $paymentTransactions = $sales
            ->flatMap(fn ($sale) => $sale->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'sale_id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'payment_method' => $payment->payment_method,
                'label' => PaymentMethod::label($payment->payment_method),
                'amount' => (float) $payment->amount,
                'details' => $payment->payment_details ?? [],
                'created_at' => $sale->created_at?->toIso8601String(),
            ]))
            ->filter(fn (array $payment) => in_array($payment['payment_method'], [
                PaymentMethod::DEBIT_CARD,
                PaymentMethod::CREDIT_CARD,
                PaymentMethod::CHECK,
            ], true))
            ->values()
            ->all();

        $payments = $sales
            ->flatMap(fn ($sale) => $sale->payments)
            ->groupBy('payment_method')
            ->map(fn ($group, $method) => [
                'payment_method' => $method,
                'label' => PaymentMethod::label($method),
                'qtd' => $group->count(),
                'total' => (float) $group->sum('amount'),
            ])
            ->values();

        $movements = $cashRegister->movements->map(fn ($movement) => [
            'id' => $movement->id,
            'type' => $movement->type,
            'amount' => (float) $movement->amount,
            'reason' => $movement->reason,
            'user_name' => $movement->user?->name,
            'created_at' => $movement->created_at?->toIso8601String(),
        ]);

        $totalWithdrawals = (float) $cashRegister->movements->where('type', 'withdrawal')->sum('amount');
        $totalSupplies = (float) $cashRegister->movements->where('type', 'supply')->sum('amount');
        $cashSales = (float) $payments->where('payment_method', PaymentMethod::CASH)->sum('total');
        $expectedCash = (float) $cashRegister->opening_amount + $totalSupplies + $cashSales - $totalWithdrawals;
        $difference = (float) ($cashRegister->closing_amount ?? 0) - $expectedCash;
        $paymentTotals = $payments->pluck('total', 'payment_method')->map(fn ($value) => (float) $value)->all();

        $closingBreakdown = $this->buildClosingBreakdown($paymentTotals, $expectedCash, [], $cashRegister->closed_at);

        return [
            'cashRegister' => [
                'id' => $cashRegister->id,
                'user_name' => $cashRegister->user?->name,
                'status' => $cashRegister->status,
                'opening_amount' => (float) $cashRegister->opening_amount,
                'closing_amount' => (float) ($cashRegister->closing_amount ?? 0),
                'opening_notes' => $cashRegister->opening_notes,
                'closing_notes' => $cashRegister->closing_notes,
                'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                'closed_at' => $cashRegister->closed_at?->toIso8601String(),
            ],
            'sales_rows' => $salesRows,
            'payments' => $payments,
            'payment_transactions' => $paymentTransactions,
            'movements' => $movements,
            'payment_totals' => $paymentTotals,
            'total_sales' => (float) $sales->sum('total'),
            'sales_count' => $sales->count(),
            'total_withdrawals' => $totalWithdrawals,
            'total_supplies' => $totalSupplies,
            'cash_sales' => $cashSales,
            'expected_cash' => $expectedCash,
            'difference' => $difference,
            'total_difference' => $this->sumClosingDifferences($closingBreakdown),
            'closing_breakdown' => $closingBreakdown,
        ];
    }

    public function buildClosingSnapshot(
        CashRegister $cashRegister,
        array $report,
        array $closingTotals,
        ?string $closingNotes,
        CarbonInterface $closedAt,
    ): array {
        $paymentTotals = $report['payment_totals'] ?? [];
        $closingBreakdown = $this->buildClosingBreakdown(
            $paymentTotals,
            (float) ($report['expected_cash'] ?? 0),
            $closingTotals,
            $closedAt,
        );

        $cashClosing = collect($closingBreakdown)->firstWhere('payment_method', PaymentMethod::CASH);
        $closingAmount = (float) ($cashClosing['informed'] ?? 0);
        $difference = (float) ($cashClosing['difference'] ?? 0);
        $totalDifference = $this->sumClosingDifferences($closingBreakdown);

        return [
            ...$report,
            'cashRegister' => [
                ...$report['cashRegister'],
                'status' => 'closed',
                'closing_amount' => $closingAmount,
                'closing_notes' => $closingNotes,
                'closed_at' => $closedAt->toIso8601String(),
            ],
            'difference' => $difference,
            'total_difference' => $totalDifference,
            'closing_breakdown' => $closingBreakdown,
        ];
    }

    protected function buildClosingBreakdown(
        array $paymentTotals,
        float $expectedCash,
        array $closingTotals,
        ?CarbonInterface $recordedAt,
    ): array {
        return collect($this->closingPaymentFields())->map(function (array $field) use (
            $paymentTotals,
            $expectedCash,
            $closingTotals,
            $recordedAt,
        ) {
            $expected = $field['key'] === PaymentMethod::CASH
                ? $expectedCash
                : (float) ($paymentTotals[$field['key']] ?? 0);

            $hasInformedValue = array_key_exists($field['key'], $closingTotals);
            $informed = $hasInformedValue ? (float) $closingTotals[$field['key']] : null;

            return [
                'payment_method' => $field['key'],
                'label' => $field['label'],
                'expected' => $expected,
                'informed' => $informed,
                'difference' => $informed === null ? null : (float) ($informed - $expected),
                'recorded_at' => $recordedAt?->toIso8601String(),
            ];
        })->values()->all();
    }

    protected function normalizeStoredSnapshot(array $snapshot, CashRegister $cashRegister): array
    {
        $cashRegisterData = $snapshot['cashRegister'] ?? [];
        $paymentTotals = collect($snapshot['payments'] ?? [])
            ->pluck('total', 'payment_method')
            ->map(fn ($value) => (float) $value)
            ->all();

        return [
            ...$snapshot,
            'cashRegister' => [
                ...$cashRegisterData,
                'id' => $cashRegister->id,
                'status' => $cashRegister->status,
                'opening_notes' => $cashRegisterData['opening_notes'] ?? $cashRegister->opening_notes,
                'closing_notes' => $cashRegisterData['closing_notes'] ?? $cashRegister->closing_notes,
            ],
            'payment_totals' => $snapshot['payment_totals'] ?? $paymentTotals,
            'payment_transactions' => $snapshot['payment_transactions'] ?? [],
            'closing_breakdown' => $snapshot['closing_breakdown'] ?? $cashRegister->closing_breakdown ?? [],
            'total_difference' => $snapshot['total_difference'] ?? $this->sumClosingDifferences($snapshot['closing_breakdown'] ?? $cashRegister->closing_breakdown ?? []),
        ];
    }

    protected function closingPaymentFields(): array
    {
        return [
            ['key' => PaymentMethod::CASH, 'label' => PaymentMethod::label(PaymentMethod::CASH)],
            ['key' => PaymentMethod::PIX, 'label' => PaymentMethod::label(PaymentMethod::PIX)],
            ['key' => PaymentMethod::DEBIT_CARD, 'label' => PaymentMethod::label(PaymentMethod::DEBIT_CARD)],
            ['key' => PaymentMethod::CREDIT_CARD, 'label' => PaymentMethod::label(PaymentMethod::CREDIT_CARD)],
            ['key' => PaymentMethod::CHECK, 'label' => PaymentMethod::label(PaymentMethod::CHECK)],
            ['key' => PaymentMethod::CREDIT, 'label' => PaymentMethod::label(PaymentMethod::CREDIT)],
        ];
    }

    protected function sumClosingDifferences(array $closingBreakdown): float
    {
        return (float) collect($closingBreakdown)
            ->filter(fn (array $row) => $row['difference'] !== null)
            ->sum(fn (array $row) => (float) $row['difference']);
    }

    public function persistClosingSnapshot(CashRegister $cashRegister, array $snapshot): void
    {
        Storage::disk('local')->put(
            $this->snapshotPath($cashRegister),
            json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    public function supportsDatabaseSnapshotStorage(): bool
    {
        $schema = Schema::connection($this->cashRegisterConnection());

        return $schema->hasColumn('cash_registers', 'closing_breakdown')
            && $schema->hasColumn('cash_registers', 'closing_snapshot');
    }

    protected function loadStoredSnapshot(CashRegister $cashRegister): ?array
    {
        if (!Storage::disk('local')->exists($this->snapshotPath($cashRegister))) {
            return null;
        }

        $stored = json_decode((string) Storage::disk('local')->get($this->snapshotPath($cashRegister)), true);

        return is_array($stored) ? $stored : null;
    }

    protected function snapshotPath(CashRegister $cashRegister): string
    {
        return sprintf(
            'private/tenant-runtime/%s/cash-registers/%s.json',
            $this->tenantId(),
            $cashRegister->getKey(),
        );
    }

    protected function tenantId(): string
    {
        return (string) (tenant()?->getTenantKey() ?? 'central');
    }

    protected function cashRegisterConnection(): ?string
    {
        return $this->newCashRegister()->getConnectionName();
    }

    protected function newCashRegister(): CashRegister
    {
        return new CashRegister();
    }
}
