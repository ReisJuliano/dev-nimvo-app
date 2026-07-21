<?php

namespace App\Http\Controllers\Tenant\Customers;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Customer;
use App\Services\Tenant\CashbackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerCashbackController extends Controller
{
    public function history(Customer $customer): JsonResponse
    {
        $transactions = $customer->cashbackTransactions()
            ->with('sale:id,sale_number')
            ->latest('id')
            ->limit(50)
            ->get()
            ->map(fn ($transaction) => [
                'id' => $transaction->id,
                'type' => $transaction->type,
                'amount' => (float) $transaction->amount,
                'balance_after' => (float) $transaction->balance_after,
                'notes' => $transaction->notes,
                'sale_number' => $transaction->sale?->sale_number,
                'created_at' => $transaction->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'balance' => (float) $customer->cashback_balance,
            'transactions' => $transactions,
        ]);
    }

    public function redeem(Request $request, Customer $customer, CashbackService $cashbackService): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $transaction = $cashbackService->redeem(
            $customer,
            (float) $validated['amount'],
            $validated['notes'] ?? null,
            auth()->id(),
        );

        return response()->json([
            'message' => 'Cashback resgatado com sucesso.',
            'balance' => (float) $transaction->balance_after,
        ]);
    }
}
