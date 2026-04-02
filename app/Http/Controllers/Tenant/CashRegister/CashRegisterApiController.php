<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\CashRegister\AuthorizeCashClosingSupervisorRequest;
use App\Http\Requests\Tenant\CashRegister\CloseCashRegisterRequest;
use App\Http\Requests\Tenant\CashRegister\OpenCashRegisterRequest;
use App\Http\Requests\Tenant\CashRegister\RegisterCashMovementRequest;
use App\Models\Tenant\CashRegister;
use App\Services\Tenant\CashRegisterReportService;
use App\Services\Tenant\SupervisorAuthorizationService;
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
        $closedAt = now();

        abort_unless($cashRegister->status === 'open' && (int) $cashRegister->user_id === (int) $userId, 404);

        $report = $reportService->build($cashRegister);
        $closingSnapshot = $reportService->buildClosingSnapshot(
            $cashRegister,
            $report,
            $request->validated('closing_totals', []),
            $request->validated('closing_notes'),
            $closedAt,
        );

        $updates = [
            'status' => 'closed',
            'closing_amount' => $request->validated('closing_amount'),
            'closing_notes' => $request->validated('closing_notes'),
            'closed_at' => $closedAt,
        ];

        if ($reportService->supportsDatabaseSnapshotStorage()) {
            $updates['closing_breakdown'] = $closingSnapshot['closing_breakdown'];
            $updates['closing_snapshot'] = $closingSnapshot;
        }

        $cashRegister->update($updates);

        if (!$reportService->supportsDatabaseSnapshotStorage()) {
            $reportService->persistClosingSnapshot($cashRegister->fresh(), $closingSnapshot);
        }

        return response()->json([
            'message' => 'Caixa fechado com sucesso.',
            'report' => $reportService->build($cashRegister->fresh()),
        ]);
    }

    public function authorizeSupervisor(
        AuthorizeCashClosingSupervisorRequest $request,
        SupervisorAuthorizationService $supervisorAuthorizationService,
    ): JsonResponse {
        $supervisor = $supervisorAuthorizationService->authorize(
            $request->integer('supervisor_user_id'),
            $request->string('supervisor_password')->toString(),
        );

        return response()->json([
            'message' => 'Edicao liberada pelo supervisor.',
            'supervisor' => [
                'id' => $supervisor->id,
                'name' => $supervisor->name,
                'username' => $supervisor->username,
                'role' => $supervisor->role,
            ],
        ]);
    }

    public function report(CashRegister $cashRegister, CashRegisterReportService $reportService): JsonResponse
    {
        abort_unless((int) $cashRegister->user_id === (int) auth()->user()?->getKey(), 404);

        return response()->json([
            'report' => $reportService->build($cashRegister),
        ]);
    }
}
