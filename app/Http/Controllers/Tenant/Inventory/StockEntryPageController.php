<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use App\Services\Tenant\InventoryMovementService;
use App\Services\Tenant\OperationsWorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class StockEntryPageController extends Controller
{
    public function __invoke(OperationsWorkspaceService $workspaceService): Response
    {
        $stockWorkspace = $workspaceService->build('entrada-estoque');

        return Inertia::render('StockEntry/Index', [
            'moduleTitle' => data_get($stockWorkspace, 'moduleTitle', 'Estoque'),
            'payload' => Arr::only(data_get($stockWorkspace, 'payload', []), ['products', 'suppliers']),
        ]);
    }

    public function quickReceive(Request $request, InventoryMovementService $inventoryMovementService): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $product = Product::query()->findOrFail((int) $validated['product_id']);

        if (array_key_exists('cost_price', $validated) && $validated['cost_price'] !== null) {
            $product->forceFill(['cost_price' => round((float) $validated['cost_price'], 2)])->save();
            $product->refresh();
        }

        $updated = $inventoryMovementService->apply(
            $product,
            round((float) $validated['quantity'], 3),
            'manual_inbound',
            [
                'user_id' => (int) auth()->id(),
                'unit_cost' => round((float) ($validated['cost_price'] ?? $product->cost_price ?? 0), 2),
                'notes' => $validated['notes'] ?? 'Recebi mercadoria',
            ],
        );

        return response()->json([
            'message' => 'Mercadoria recebida e estoque atualizado.',
            'product' => [
                'id' => $updated->id,
                'name' => $updated->name,
                'code' => $updated->code,
                'barcode' => $updated->barcode,
                'unit' => $updated->unit,
                'cost_price' => (float) $updated->cost_price,
                'sale_price' => (float) $updated->sale_price,
                'stock_quantity' => (float) $updated->stock_quantity,
                'min_stock' => (float) $updated->min_stock,
            ],
        ]);
    }
}
