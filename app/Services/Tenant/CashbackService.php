<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashbackTransaction;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Sale;
use Illuminate\Validation\ValidationException;

class CashbackService
{
    public function __construct(
        protected TenantSettingsService $settingsService,
    ) {
    }

    public function earn(Sale $sale): ?CashbackTransaction
    {
        if (! $this->settingsService->isModuleEnabled('fidelidade')) {
            return null;
        }

        if (! $sale->customer_id) {
            return null;
        }

        $percent = (float) data_get($this->settingsService->get(), 'loyalty.cashback_percent', 0);

        if ($percent <= 0) {
            return null;
        }

        $amount = round((float) $sale->total * $percent / 100, 2);

        if ($amount <= 0) {
            return null;
        }

        /** @var Customer $customer */
        $customer = Customer::query()->lockForUpdate()->findOrFail($sale->customer_id);
        $balanceAfter = round((float) $customer->cashback_balance + $amount, 2);
        $customer->forceFill(['cashback_balance' => $balanceAfter])->save();

        return CashbackTransaction::query()->create([
            'customer_id' => $customer->id,
            'sale_id' => $sale->id,
            'user_id' => $sale->user_id,
            'type' => CashbackTransaction::TYPE_EARN,
            'amount' => $amount,
            'balance_after' => $balanceAfter,
            'notes' => sprintf('Cashback de %s%% na venda %s', rtrim(rtrim(number_format($percent, 2, ',', '.'), '0'), ','), $sale->sale_number),
        ]);
    }

    public function reverseForSale(Sale $sale): ?CashbackTransaction
    {
        $earned = CashbackTransaction::query()
            ->where('sale_id', $sale->id)
            ->where('type', CashbackTransaction::TYPE_EARN)
            ->first();

        if (! $earned) {
            return null;
        }

        /** @var Customer $customer */
        $customer = Customer::query()->lockForUpdate()->findOrFail($earned->customer_id);
        $reversalAmount = min((float) $earned->amount, (float) $customer->cashback_balance);

        if ($reversalAmount <= 0) {
            return null;
        }

        $balanceAfter = round((float) $customer->cashback_balance - $reversalAmount, 2);
        $customer->forceFill(['cashback_balance' => $balanceAfter])->save();

        return CashbackTransaction::query()->create([
            'customer_id' => $customer->id,
            'sale_id' => $sale->id,
            'type' => CashbackTransaction::TYPE_ADJUSTMENT,
            'amount' => -$reversalAmount,
            'balance_after' => $balanceAfter,
            'notes' => sprintf('Estorno do cashback da venda %s cancelada', $sale->sale_number),
        ]);
    }

    public function redeem(Customer $customer, float $amount, ?string $notes, ?int $userId): CashbackTransaction
    {
        $amount = round($amount, 2);

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Informe um valor de resgate maior que zero.',
            ]);
        }

        if ($amount > (float) $customer->cashback_balance) {
            throw ValidationException::withMessages([
                'amount' => 'O valor de resgate não pode ser maior que o saldo disponível.',
            ]);
        }

        $balanceAfter = round((float) $customer->cashback_balance - $amount, 2);
        $customer->forceFill(['cashback_balance' => $balanceAfter])->save();

        return CashbackTransaction::query()->create([
            'customer_id' => $customer->id,
            'user_id' => $userId,
            'type' => CashbackTransaction::TYPE_REDEEM,
            'amount' => -$amount,
            'balance_after' => $balanceAfter,
            'notes' => $notes,
        ]);
    }
}
