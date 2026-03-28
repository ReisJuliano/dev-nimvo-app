<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\CashRegister\CloseCashRegisterRequest;
use App\Http\Requests\Tenant\CashRegister\OpenCashRegisterRequest;
use App\Http\Requests\Tenant\CashRegister\RegisterCashMovementRequest;
use App\Models\Tenant\CashRegister;
use App\Services\Tenant\CashRegisterReportService;
use Illuminate\Http\JsonResponse;

class CashRegisterApiController extends Controller
{
    public function open(OpenCashRegisterRequest $request): JsonResponse
    {
        $userId = auth()->user()?->getKey();

        $existing = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->exists();

        if ($existing) {
            return response()->json(['message' => 'Voce ja possui um caixa aberto.'], 422);
        }

        $cashRegister = CashRegister::query()->create([
            'user_id' => $userId,
            'status' => 'open',
            'opening_amount' => $request->validated('opening_amount', 0),
            'opening_notes' => $request->validated('opening_notes'),
            'opened_at' => now(),
        ]);

        return response()->json([
            'message' => 'Caixa aberto com sucesso.',
            'cash_register_id' => $cashRegister->id,
        ], 201);
    }

    public function movement(RegisterCashMovementRequest $request, CashRegister $cashRegister): JsonResponse
    {
        $userId = auth()->user()?->getKey();

        abort_unless($cashRegister->status === 'open' && (int) $cashRegister->user_id === (int) $userId, 404);

        $movement = $cashRegister->movements()->create([
            'user_id' => $userId,
            'type' => $request->validated('type'),
            'amount' => $request->validated('amount'),
            'reason' => $request->validated('reason'),
        ]);

        return response()->json([
            'message' => $movement->type === 'withdrawal'
                ? 'Sangria registrada com sucesso.'
                : 'Suprimento registrado com sucesso.',
        ]);
    }

    public function close(
        CloseCashRegisterRequest $request,
        CashRegister $cashRegister,
        CashRegisterReportService $reportService,
    ): JsonResponse {
        $userId = auth()->user()?->getKey();

        abort_unless($cashRegister->status === 'open' && (int) $cashRegister->user_id === (int) $userId, 404);

        $cashRegister->update([
            'status' => 'closed',
            'closing_amount' => $request->validated('closing_amount'),
            'closing_notes' => $request->validated('closing_notes'),
            'closed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Caixa fechado com sucesso.',
            'report' => $reportService->build($cashRegister->fresh()),
        ]);
    }

    public function report(CashRegister $cashRegister, CashRegisterReportService $reportService): JsonResponse
    {
        return response()->json([
            'report' => $reportService->build($cashRegister),
        ]);
    }
}
