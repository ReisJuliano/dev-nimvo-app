<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Services\Tenant\CashRegisterReportService;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\TenantSettingsService;
use Inertia\Inertia;
use Inertia\Response;

class CashRegisterPageController extends Controller
{
    public function __invoke(
        CashRegisterReportService $reportService,
        OrderDraftService $orderDraftService,
        TenantSettingsService $settingsService,
    ): Response
    {
        $userId = auth()->user()?->getKey();

        $openRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        $history = CashRegister::query()
            ->with('user:id,name')
            ->where('user_id', $userId)
            ->where('status', 'closed')
            ->latest('closed_at')
            ->limit(30)
            ->get()
            ->map(function (CashRegister $cashRegister) use ($reportService) {
                $report = $reportService->build($cashRegister);

                return [
                    'id' => $cashRegister->id,
                    'user_name' => $cashRegister->user?->name,
                    'opening_amount' => (float) $cashRegister->opening_amount,
                    'closing_amount' => (float) ($cashRegister->closing_amount ?? 0),
                    'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                    'closed_at' => $cashRegister->closed_at?->toIso8601String(),
                    'difference' => (float) ($report['difference'] ?? 0),
                    'sales_count' => (int) ($report['sales_count'] ?? 0),
                    'total_sales' => (float) ($report['total_sales'] ?? 0),
                ];
            })
            ->values();

        return Inertia::render('CashRegister/Index', [
            'openRegister' => $openRegister ? $reportService->build($openRegister) : null,
            'history' => $history,
            'pendingOrderDrafts' => $orderDraftService->pendingCheckoutDrafts(),
            'settings' => $settingsService->get(),
        ]);
    }
}
