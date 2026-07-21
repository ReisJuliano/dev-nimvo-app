<?php

namespace App\Http\Controllers\Tenant\Sales;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleReturn;
use App\Services\Tenant\Sales\SaleReturnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleReturnController extends Controller
{
    public function index(Sale $sale): JsonResponse
    {
        return response()->json([
            'returns' => $sale->returns()->with('items')->latest('id')->get(),
        ]);
    }

    public function store(Request $request, Sale $sale, SaleReturnService $service): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('vendas.registrar_devolucao'), 403);

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'integer', 'exists:sale_items,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
            'refund_method' => ['required', 'string', 'in:cash,store_credit,none'],
            'refund_amount' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $saleReturn = $service->createCommercial(
            $sale->id,
            $validated['items'],
            $validated['reason'],
            $validated['refund_method'],
            (float) ($validated['refund_amount'] ?? 0),
            (int) auth()->id(),
            $validated['notes'] ?? null,
        );

        return response()->json([
            'message' => 'Devolução registrada com sucesso.',
            'sale_return' => $saleReturn,
        ], 201);
    }

    public function show(SaleReturn $saleReturn): JsonResponse
    {
        return response()->json([
            'sale_return' => $saleReturn->load(['items', 'fiscalDocument']),
        ]);
    }

    public function issueFiscal(SaleReturn $saleReturn, SaleReturnService $service): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('fiscal.emitir_devolucao'), 403);

        $document = $service->issueFiscal($saleReturn->id, (int) auth()->id());

        return response()->json([
            'message' => 'NF-e de devolução enviada para processamento.',
            'fiscal_document_id' => $document->id,
            'fiscal_document_status' => $document->status,
        ], 202);
    }
}
