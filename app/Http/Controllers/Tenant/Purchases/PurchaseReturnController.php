<?php

namespace App\Http\Controllers\Tenant\Purchases;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\PurchaseReturn;
use App\Services\Tenant\Purchases\PurchaseReturnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseReturnController extends Controller
{
    public function index(Purchase $purchase): JsonResponse
    {
        return response()->json([
            'returns' => $purchase->returns()->with('items')->latest('id')->get(),
        ]);
    }

    public function store(Request $request, Purchase $purchase, PurchaseReturnService $service): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('compras.adicionar'), 403);

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_item_id' => ['required', 'integer', 'exists:purchase_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $purchaseReturn = $service->create(
            $purchase->id,
            $validated['items'],
            $validated['reason'],
            (int) auth()->id(),
        );

        return response()->json([
            'message' => 'Devolução ao fornecedor registrada com sucesso.',
            'purchase_return' => $purchaseReturn,
        ], 201);
    }

    public function show(PurchaseReturn $purchaseReturn): JsonResponse
    {
        return response()->json([
            'purchase_return' => $purchaseReturn->load(['items', 'fiscalDocument']),
        ]);
    }

    public function issueFiscal(PurchaseReturn $purchaseReturn, PurchaseReturnService $service): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('fiscal.emitir_devolucao'), 403);

        $document = $service->issueFiscal($purchaseReturn->id, (int) auth()->id());

        return response()->json([
            'message' => 'NF-e de devolução enviada para processamento.',
            'fiscal_document_id' => $document->id,
            'fiscal_document_status' => $document->status,
        ], 202);
    }
}
