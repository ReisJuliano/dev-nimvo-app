<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Services\Tenant\InventoryMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StockEntryPageController extends Controller
{
    // Página /estoque — visualização de estoque
    public function __invoke(): Response
    {
        $products = $this->buildProductPayload();

        return Inertia::render('StockEntry/Index', [
            'payload' => ['products' => $products],
        ]);
    }

    // Página /entrada-estoque — entrada rápida de mercadoria
    public function entrada(): Response
    {
        $products = $this->buildProductPayload();

        return Inertia::render('StockEntry/Entrada', [
            'payload' => ['products' => $products],
        ]);
    }

    // Página /ajuste-estoque — ajuste de estoque
    public function ajuste(): Response
    {
        $products = $this->buildProductPayload();

        return Inertia::render('StockEntry/Ajuste', [
            'payload' => ['products' => $products],
        ]);
    }

    // API — entrada rápida sem NF
    public function quickReceive(Request $request, InventoryMovementService $inventoryMovementService): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity'   => ['required', 'numeric', 'min:0.001'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'notes'      => ['nullable', 'string', 'max:500'],
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
                'user_id'  => (int) auth()->id(),
                'unit_cost' => round((float) ($validated['cost_price'] ?? $product->cost_price ?? 0), 2),
                'notes'    => $validated['notes'] ?? 'Recebi mercadoria',
            ],
        );

        return response()->json([
            'message' => 'Mercadoria recebida e estoque atualizado.',
            'product' => $this->formatProduct($updated),
        ]);
    }

    // API — ajuste de estoque (definir quantidade total)
    public function quickAdjust(Request $request, InventoryMovementService $inventoryMovementService): JsonResponse
    {
        $validated = $request->validate([
            'product_id'        => ['required', 'integer', 'exists:products,id'],
            'counted_quantity'  => ['required', 'numeric', 'min:0'],
            'reason'            => ['nullable', 'string', 'max:255'],
            'notes'             => ['nullable', 'string', 'max:500'],
        ]);

        $product = Product::query()->findOrFail((int) $validated['product_id']);
        $current = (float) $product->stock_quantity;
        $target  = round((float) $validated['counted_quantity'], 3);
        $delta   = $target - $current;

        if (abs($delta) < 0.001) {
            return response()->json([
                'message' => 'Estoque já está nessa quantidade.',
                'product' => $this->formatProduct($product),
            ]);
        }

        $updated = $inventoryMovementService->apply(
            $product,
            $delta,
            'manual_adjustment',
            [
                'user_id' => (int) auth()->id(),
                'reason'  => $validated['reason'] ?? 'Ajuste manual',
                'notes'   => $validated['notes'] ?? null,
            ],
        );

        return response()->json([
            'message' => 'Estoque ajustado com sucesso.',
            'product' => $this->formatProduct($updated),
        ]);
    }

    private function buildProductPayload(): array
    {
        return Product::query()
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(fn ($p) => $this->formatProduct($p))
            ->all();
    }

    private function formatProduct(Product $product): array
    {
        return [
            'id'             => $product->id,
            'name'           => $product->name,
            'code'           => $product->code,
            'barcode'        => $product->barcode,
            'unit'           => $product->unit,
            'cost_price'     => (float) $product->cost_price,
            'sale_price'     => (float) $product->sale_price,
            'stock_quantity' => (float) $product->stock_quantity,
            'min_stock'      => (float) $product->min_stock,
            'supplier_name'  => $product->supplier?->name ?? null,
        ];
    }
}
