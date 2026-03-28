<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Services\Tenant\CashRegisterReportService;
use Inertia\Inertia;
use Inertia\Response;

class CashRegisterPageController extends Controller
{
    public function __invoke(CashRegisterReportService $reportService): Response
    {
        $userId = auth()->user()?->getKey();

        $openRegister = CashRegister::query()
            ->with(['movements.user:id,name', 'sales.payments'])
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        $history = CashRegister::query()
            ->with('user:id,name')
            ->where('status', 'closed')
            ->latest('closed_at')
            ->limit(15)
            ->get()
            ->map(fn (CashRegister $register) => [
                'id' => $register->id,
                'user_name' => $register->user?->name,
                'opening_amount' => (float) $register->opening_amount,
                'closing_amount' => (float) ($register->closing_amount ?? 0),
                'opened_at' => $register->opened_at?->toIso8601String(),
                'closed_at' => $register->closed_at?->toIso8601String(),
            ]);

        return Inertia::render('CashRegister/Index', [
            'openRegister' => $openRegister ? $reportService->build($openRegister) : null,
            'history' => $history,
        ]);
    }
}
