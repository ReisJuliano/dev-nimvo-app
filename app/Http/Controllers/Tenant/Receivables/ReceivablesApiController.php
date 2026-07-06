<?php

namespace App\Http\Controllers\Tenant\Receivables;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\DeliveryOrder;
use App\Services\Tenant\ReceivablesOverviewService;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ReceivablesApiController extends Controller
{
    public function index(Request $request, ReceivablesOverviewService $service): JsonResponse
    {
        $rows = $service->overview([
            'search' => $request->query('search'),
            'aging_bucket' => $request->query('aging_bucket'),
        ]);

        $summary = [
            'total' => round((float) $rows->sum('total'), 2),
            'credit_total' => round((float) $rows->sum('credit_balance'), 2),
            'conditional_total' => round((float) $rows->sum('conditional_balance'), 2),
            'delivery_total' => round((float) $rows->sum('delivery_balance'), 2),
            'customers_count' => $rows->count(),
            'overdue_60_plus' => $rows->whereIn('aging_bucket', ['61_90', '90_mais'])->count(),
        ];

        return response()->json(['rows' => $rows, 'summary' => $summary]);
    }

    public function statement(int $customer, ReceivablesOverviewService $service): JsonResponse
    {
        return response()->json($service->customerStatement($customer));
    }

    public function receive(Request $request, ReceivablesOverviewService $service): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', Rule::in([
                PaymentMethod::CASH,
                PaymentMethod::PIX,
                PaymentMethod::DEBIT_CARD,
                PaymentMethod::CREDIT_CARD,
                PaymentMethod::CHECK,
            ])],
            'cash_register_id' => ['required', 'integer', 'exists:cash_registers,id'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $cashRegister = $this->resolveOpenRegister((int) $validated['cash_register_id']);

        $service->receiveCreditPayment(
            (int) $validated['customer_id'],
            (float) $validated['amount'],
            $validated['payment_method'],
            (int) auth()->id(),
            $validated['notes'] ?? null,
            $cashRegister,
        );

        return response()->json(['message' => 'Recebimento registrado com sucesso.']);
    }

    public function collectDelivery(Request $request, DeliveryOrder $deliveryOrder, ReceivablesOverviewService $service): JsonResponse
    {
        $validated = $request->validate([
            'payment_method' => ['required', 'string', Rule::in(PaymentMethod::settlementMethods())],
            'cash_register_id' => ['required', 'integer', 'exists:cash_registers,id'],
        ]);

        $cashRegister = $this->resolveOpenRegister((int) $validated['cash_register_id']);

        $service->collectDeliveryPayment($deliveryOrder, $validated['payment_method'], (int) auth()->id(), $cashRegister);

        return response()->json(['message' => 'Recebimento da entrega registrado com sucesso.']);
    }

    protected function resolveOpenRegister(int $cashRegisterId): CashRegister
    {
        $cashRegister = CashRegister::query()
            ->where('user_id', auth()->id())
            ->where('status', 'open')
            ->find($cashRegisterId);

        if (!$cashRegister) {
            throw ValidationException::withMessages(['cash_register_id' => 'Abra um caixa antes de registrar o recebimento.']);
        }

        return $cashRegister;
    }
}
