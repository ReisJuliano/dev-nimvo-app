<?php

namespace App\Http\Controllers\Tenant\Delivery;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\Delivery\CreateDeliveryFromOrderDraftRequest;
use App\Http\Requests\Tenant\Delivery\UpdateDeliveryStatusRequest;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\OrderDraft;
use App\Services\Tenant\OperationsWorkspaceService;
use Illuminate\Http\JsonResponse;

class DeliveryApiController extends Controller
{
    public function index(OperationsWorkspaceService $workspaceService): JsonResponse
    {
        return response()->json($workspaceService->listDeliveryOrders());
    }

    public function storeFromDraft(
        CreateDeliveryFromOrderDraftRequest $request,
        OrderDraft $orderDraft,
        OperationsWorkspaceService $workspaceService,
    ): JsonResponse {
        return response()->json(
            $workspaceService->createDeliveryFromDraft($orderDraft, $request->validated()),
            201,
        );
    }

    public function updateStatus(
        UpdateDeliveryStatusRequest $request,
        DeliveryOrder $deliveryOrder,
        OperationsWorkspaceService $workspaceService,
    ): JsonResponse {
        return response()->json(
            $workspaceService->updateDeliveryStatus($deliveryOrder, $request->validated()),
        );
    }
}

