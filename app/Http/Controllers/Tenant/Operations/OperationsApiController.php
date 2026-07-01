<?php

namespace App\Http\Controllers\Tenant\Operations;

use App\Http\Controllers\Controller;
use App\Models\Tenant\SalePayment;
use App\Services\Tenant\OperationsWorkspaceService;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OperationsApiController extends Controller
{
    public function index(
        Request $request,
        OperationsWorkspaceService $workspaceService,
        string $module,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        return response()->json($workspaceService->records($module, $request->query()));
    }

    public function store(
        Request $request,
        OperationsWorkspaceService $workspaceService,
        string $module,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        $response = $workspaceService->store($module, $request->all(), (int) auth()->id());

        return response()->json($response, 201);
    }

    public function update(
        Request $request,
        OperationsWorkspaceService $workspaceService,
        string $module,
        int $record,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        return response()->json(
            $workspaceService->update($module, $record, $request->all(), (int) auth()->id()),
        );
    }

    public function destroy(
        OperationsWorkspaceService $workspaceService,
        string $module,
        int $record,
    ): JsonResponse {
        abort_unless($workspaceService->isWorkspaceModule($module), 404);

        return response()->json([
            'message' => $workspaceService->destroy($module, $record),
        ]);
    }

    public function receiveCreditPayment(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', Rule::in([
                PaymentMethod::CASH,
                PaymentMethod::PIX,
                PaymentMethod::DEBIT_CARD,
                PaymentMethod::CREDIT_CARD,
            ])],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $remaining = round((float) $validated['amount'], 2);

        DB::transaction(function () use ($validated, &$remaining) {
            $openPayments = SalePayment::query()
                ->select('sale_payments.*')
                ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
                ->where('sales.customer_id', (int) $validated['customer_id'])
                ->where('sales.status', 'finalized')
                ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
                ->where('sale_payments.amount', '>', 0)
                ->orderBy('sales.created_at')
                ->orderBy('sale_payments.id')
                ->lockForUpdate()
                ->get();

            $openTotal = round((float) $openPayments->sum('amount'), 2);

            if ($openTotal <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Este cliente não tem fiado em aberto.',
                ]);
            }

            if ($remaining > $openTotal) {
                throw ValidationException::withMessages([
                    'amount' => 'O valor informado e maior que o fiado em aberto.',
                ]);
            }

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
        });

        return response()->json([
            'message' => 'Fiado recebido com sucesso.',
        ]);
    }
}
