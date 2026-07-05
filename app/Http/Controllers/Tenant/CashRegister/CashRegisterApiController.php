<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\CashRegister\AuthorizeCashClosingSupervisorRequest;
use App\Http\Requests\Tenant\CashRegister\CloseCashRegisterRequest;
use App\Http\Requests\Tenant\CashRegister\OpenCashRegisterRequest;
use App\Http\Requests\Tenant\CashRegister\RegisterCashMovementRequest;
use App\Models\Tenant\CashRegister;
use App\Services\Tenant\AuditLogService;
use App\Services\Tenant\CashRegisterReportService;
use App\Services\Tenant\LocalAgentPrintQueueService;
use App\Services\Tenant\SupervisorAuthorizationService;
use App\Services\Tenant\TillService;
use App\Support\Tenant\AuditActions;
use Illuminate\Http\JsonResponse;

class CashRegisterApiController extends Controller
{
    public function open(OpenCashRegisterRequest $request, TillService $tillService, AuditLogService $auditLogService): JsonResponse
    {
        $userId = auth()->user()?->getKey();
        $till = $tillService->resolveForOpening($request->validated('till_id'));

        $existing = CashRegister::query()
            ->where('till_id', $till->id)
            ->where('status', 'open')
            ->exists();

        if ($existing) {
            return response()->json(['message' => 'Este caixa já está aberto.'], 422);
        }

        $cashRegister = CashRegister::query()->create([
            'user_id' => $userId,
            'till_id' => $till->id,
            'status' => 'open',
            'opening_amount' => $request->validated('opening_amount', 0),
            'opening_notes' => $request->validated('opening_notes'),
            'opened_at' => now(),
        ]);

        $auditLogService->record(AuditActions::CASH_REGISTER_OPENED, $cashRegister, after: [
            'till_id' => $till->id,
            'till_name' => $till->name,
            'opening_amount' => $cashRegister->opening_amount,
        ]);

        return response()->json([
            'message' => 'Caixa aberto com sucesso.',
            'cash_register_id' => $cashRegister->id,
            'till_id' => $till->id,
            'till_name' => $till->name,
        ], 201);
    }

    public function movement(
        RegisterCashMovementRequest $request,
        CashRegister $cashRegister,
        LocalAgentPrintQueueService $printQueueService,
        AuditLogService $auditLogService,
    ): JsonResponse
    {
        $userId = auth()->user()?->getKey();

        abort_unless($cashRegister->status === 'open' && (int) $cashRegister->user_id === (int) $userId, 404);

        $movement = $cashRegister->movements()->create([
            'user_id' => $userId,
            'type' => $request->validated('type'),
            'amount' => $request->validated('amount'),
            'reason' => $request->validated('reason'),
        ]);

        $auditLogService->record(AuditActions::CASH_REGISTER_MOVEMENT, $cashRegister, after: [
            'type' => $movement->type,
            'amount' => $movement->amount,
            'reason' => $movement->reason,
        ]);

        $printResult = null;

        try {
            $printResult = $printQueueService->queueCashMovementReceipt($movement);
        } catch (\Throwable) {
            $printResult = [
                'status' => 'failed',
                'message' => 'Movimentação registrada, mas não foi possível enviar o comprovante para impressão.',
            ];
        }

        return response()->json([
            'message' => $movement->type === 'withdrawal'
                ? 'Sangria registrada com sucesso.'
                : 'Suprimento registrado com sucesso.',
            'local_agent_print' => $printResult,
        ]);
    }

    public function close(
        CloseCashRegisterRequest $request,
        CashRegister $cashRegister,
        CashRegisterReportService $reportService,
        AuditLogService $auditLogService,
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

        $difference = (float) ($closingSnapshot['difference'] ?? $closingSnapshot['total_difference'] ?? 0);
        $auditLogService->record(
            abs($difference) > 0.009 ? AuditActions::CASH_REGISTER_CLOSED_WITH_DIFFERENCE : AuditActions::CASH_REGISTER_CLOSED,
            $cashRegister,
            after: [
                'closing_amount' => $updates['closing_amount'],
                'difference' => $difference,
            ],
        );

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
            'message' => 'Edição liberada pelo supervisor.',
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
        $user = auth()->user();
        $isOwner = (int) $cashRegister->user_id === (int) $user?->getKey();
        $isManager = in_array($user?->role, ['admin', 'manager'], true);

        abort_unless($isOwner || $isManager, 404);

        return response()->json([
            'report' => $reportService->build($cashRegister),
        ]);
    }
}
