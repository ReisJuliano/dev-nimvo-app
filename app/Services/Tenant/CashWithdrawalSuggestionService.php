<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;
use App\Support\Tenant\PaymentMethod;

class CashWithdrawalSuggestionService
{
    public function __construct(
        protected CashRegisterReportService $reportService,
    ) {
    }

    public function evaluate(array $saleResult, array $settings): ?array
    {
        $threshold = (float) data_get($settings, 'cash_closing.max_cash_before_withdrawal_suggestion', 0);
        $hasCashPayment = collect($saleResult['payments'] ?? [])
            ->contains(fn (array $payment) => ($payment['method'] ?? null) === PaymentMethod::CASH);

        if ($threshold <= 0 || ! $hasCashPayment || empty($saleResult['cash_register_id'])) {
            return null;
        }

        $cashRegister = CashRegister::query()->find($saleResult['cash_register_id']);

        if (! $cashRegister) {
            return null;
        }

        $expectedCash = (float) ($this->reportService->build($cashRegister)['expected_cash'] ?? 0);

        if ($expectedCash <= $threshold) {
            return null;
        }

        return [
            'excess' => round($expectedCash - $threshold, 2),
            'expected_cash' => $expectedCash,
            'threshold' => $threshold,
        ];
    }
}
