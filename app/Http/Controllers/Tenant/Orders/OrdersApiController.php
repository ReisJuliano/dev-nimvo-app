<?php

namespace App\Http\Controllers\Tenant\Orders;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\Orders\PartialCheckoutOrderDraftRequest;
use App\Http\Requests\Tenant\Orders\UpsertOrderDraftRequest;
use App\Models\Tenant\OrderDraft;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\OrderPartialCheckoutService;
use Illuminate\Http\JsonResponse;

class OrdersApiController extends Controller
{
    public function index(OrderDraftService $orderDraftService): JsonResponse
    {
        return response()->json([
            'orders' => $orderDraftService->activeDrafts(),
        ]);
    }

    public function pendingCheckout(OrderDraftService $orderDraftService): JsonResponse
    {
        return response()->json([
            'orders' => $orderDraftService->pendingCheckoutDrafts(),
        ]);
    }

    public function store(OrderDraftService $orderDraftService): JsonResponse
    {
        $userId = (int) auth()->user()?->getKey();
        abort_unless($userId > 0, 401);

        $draft = $orderDraftService->create($userId);

        return response()->json([
            'message' => 'Novo pedido iniciado com sucesso.',
            'order' => $orderDraftService->toDetail($draft),
        ], 201);
    }

    public function show(OrderDraft $orderDraft, OrderDraftService $orderDraftService): JsonResponse
    {
        $draft = $orderDraftService->findForEditing((int) $orderDraft->getKey());

        abort_unless($draft, 404);

        return response()->json([
            'order' => $orderDraftService->toDetail($draft),
        ]);
    }

    public function update(
        UpsertOrderDraftRequest $request,
        OrderDraft $orderDraft,
        OrderDraftService $orderDraftService,
    ): JsonResponse {
        $draft = $orderDraftService->save($orderDraft, $request->validated());

        return response()->json([
            'message' => 'Pedido salvo com sucesso.',
            'order' => $orderDraftService->toDetail($draft),
        ]);
    }

    public function sendToCashier(OrderDraft $orderDraft, OrderDraftService $orderDraftService): JsonResponse
    {
        $draft = $orderDraftService->sendToCashier($orderDraft);

        return response()->json([
            'message' => 'Pedido enviado para o caixa.',
            'order' => $orderDraftService->toDetail($draft),
        ]);
    }

    public function partialCheckout(
        PartialCheckoutOrderDraftRequest $request,
        OrderDraft $orderDraft,
        OrderPartialCheckoutService $partialCheckoutService,
        OrderDraftService $orderDraftService,
    ): JsonResponse {
        $result = $partialCheckoutService->checkout($orderDraft, $request->validated(), (int) auth()->user()?->getKey());

        return response()->json([
            'message' => 'Pagamento parcial registrado com sucesso.',
            'sale' => $result['sale'],
            'order' => $orderDraftService->toDetail($result['order']),
        ]);
    }

    public function destroy(OrderDraft $orderDraft, OrderDraftService $orderDraftService): JsonResponse
    {
        $orderDraftService->destroy($orderDraft);

        return response()->json([
            'message' => 'Atendimento removido com sucesso.',
        ]);
    }
}
