<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;

class CashRegisterReportService
{
    public function build(CashRegister $cashRegister): array
    {
        $cashRegister->load(['user:id,name', 'movements.user:id,name']);

        $sales = $cashRegister->sales()
            ->with('payments')
            ->where('status', 'finalized')
            ->get();

        $payments = $sales
            ->flatMap(fn ($sale) => $sale->payments)
            ->groupBy('payment_method')
            ->map(fn ($group, $method) => [
                'payment_method' => $method,
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
        $cashSales = (float) $payments->where('payment_method', 'cash')->sum('total');
        $expectedCash = (float) $cashRegister->opening_amount + $totalSupplies + $cashSales - $totalWithdrawals;
        $difference = (float) ($cashRegister->closing_amount ?? 0) - $expectedCash;

        return [
            'cashRegister' => [
                'id' => $cashRegister->id,
                'user_name' => $cashRegister->user?->name,
                'status' => $cashRegister->status,
                'opening_amount' => (float) $cashRegister->opening_amount,
                'closing_amount' => (float) ($cashRegister->closing_amount ?? 0),
                'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                'closed_at' => $cashRegister->closed_at?->toIso8601String(),
            ],
            'payments' => $payments,
            'movements' => $movements,
            'total_sales' => (float) $sales->sum('total'),
            'sales_count' => $sales->count(),
            'total_withdrawals' => $totalWithdrawals,
            'total_supplies' => $totalSupplies,
            'expected_cash' => $expectedCash,
            'difference' => $difference,
        ];
    }
}
