<?php

namespace App\Http\Controllers\Tenant\Orders;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Services\Tenant\OrderDraftService;
use Inertia\Inertia;
use Inertia\Response;

class OrdersPageController extends Controller
{
    public function __invoke(OrderDraftService $orderDraftService): Response
    {
        $draftId = request()->integer('draft');
        $initialDraft = $draftId
            ? $orderDraftService->findForEditing($draftId)
            : null;

        if (!$initialDraft) {
            $firstDraftId = data_get($orderDraftService->activeDrafts(), '0.id');
            $initialDraft = $firstDraftId ? $orderDraftService->findForEditing((int) $firstDraftId) : null;
        }

        return Inertia::render('Orders/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'customers' => Customer::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'phone']),
            'drafts' => $orderDraftService->activeDrafts(),
            'initialDraft' => $initialDraft ? $orderDraftService->toDetail($initialDraft) : null,
        ]);
    }
}
