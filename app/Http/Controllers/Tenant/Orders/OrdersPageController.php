<?php

namespace App\Http\Controllers\Tenant\Orders;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Models\Tenant\OrderDraft;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\ProductService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OrdersPageController extends Controller
{
    public function __invoke(
        Request $request,
        OrderDraftService $orderDraftService,
        ProductService $productService,
    ): Response
    {
        $userId = auth()->user()?->getKey();
        $draftId = $request->integer('draft');
        $applied = $request->boolean('applied') || $draftId !== null;
        $activeDrafts = $applied ? $orderDraftService->activeDrafts() : [];
        $cashRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();
        $initialDraft = $draftId
            ? $orderDraftService->findForEditing($draftId)
            : null;

        return Inertia::render('Orders/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'customers' => Customer::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'phone']),
            'drafts' => $activeDrafts,
            'statusCounts' => [
                'open' => OrderDraft::query()->where('status', OrderDraft::STATUS_DRAFT)->count(),
                'preparing' => OrderDraft::query()->whereIn('status', ['preparing', 'in_progress'])->count(),
                'ready' => OrderDraft::query()->whereIn('status', [OrderDraft::STATUS_SENT_TO_CASHIER, 'ready'])->count(),
                'delivered' => OrderDraft::query()->where('status', 'delivered')->count(),
                'cancelled' => OrderDraft::query()->whereIn('status', ['cancelled', 'canceled'])->count(),
            ],
            'draftDetails' => $applied ? $orderDraftService->activeDraftsDetailed() : [],
            'initialDraft' => $initialDraft ? $orderDraftService->toDetail($initialDraft) : null,
            'filters' => [
                'applied' => $applied,
                'search' => $request->query('search', ''),
                'status' => $request->query('status', 'open'),
                'from' => $request->query('from'),
                'to' => $request->query('to'),
            ],
            'productCatalog' => $productService->activeCatalog((bool) auth()->user()?->hasPermission('produtos.ver_custo')),
            'cashRegister' => $cashRegister ? [
                'id' => $cashRegister->id,
                'user_name' => auth()->user()?->name,
                'status' => $cashRegister->status,
                'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                'opening_amount' => (float) $cashRegister->opening_amount,
                'opening_notes' => $cashRegister->opening_notes,
            ] : null,
        ]);
    }
}
