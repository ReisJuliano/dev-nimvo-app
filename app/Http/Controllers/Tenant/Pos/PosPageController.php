<?php

namespace App\Http\Controllers\Tenant\Pos;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\TenantSettingsService;
use Inertia\Inertia;
use Inertia\Response;

class PosPageController extends Controller
{
    public function __invoke(
        OrderDraftService $orderDraftService,
        TenantSettingsService $settingsService,
    ): Response
    {
        $userId = auth()->user()?->getKey();
        $requestedOrderDraftId = request()->integer('orderDraft');
        $ordersEnabled = $settingsService->isModuleEnabled('pedidos');

        $cashRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();
        $preloadedOrderDraft = $ordersEnabled && $requestedOrderDraftId
            ? $orderDraftService->findForCheckout($requestedOrderDraftId)
            : null;

        return Inertia::render('Pos/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'customers' => Customer::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'phone', 'credit_limit']),
            'pendingOrderDrafts' => $ordersEnabled ? $orderDraftService->pendingCheckoutDrafts() : [],
            'preloadedOrderDraft' => $preloadedOrderDraft ? $orderDraftService->toDetail($preloadedOrderDraft) : null,
            'cashRegister' => $cashRegister ? [
                'id' => $cashRegister->id,
                'status' => $cashRegister->status,
                'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                'opening_amount' => (float) $cashRegister->opening_amount,
            ] : null,
        ]);
    }
}
