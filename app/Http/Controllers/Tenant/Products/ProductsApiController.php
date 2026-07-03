<?php

namespace App\Http\Controllers\Tenant\Products;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\Products\UpsertProductRequest;
use App\Models\Tenant\Product;
use App\Services\Tenant\ProductService;
use Illuminate\Http\JsonResponse;

class ProductsApiController extends Controller
{
    public function store(UpsertProductRequest $request, ProductService $productService): JsonResponse
    {
        $product = $productService->save(new Product(), $request->validated());

        return response()->json([
            'message' => 'Produto cadastrado com sucesso.',
            'product' => $product,
        ], 201);
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['category:id,name', 'supplier:id,name']);

        return response()->json(['product' => $product]);
    }

    public function update(UpsertProductRequest $request, Product $product, ProductService $productService): JsonResponse
    {
        $product = $productService->save($product, $request->validated());

        return response()->json([
            'message' => 'Produto atualizado com sucesso.',
            'product' => $product,
        ]);
    }

    public function destroy(Product $product): JsonResponse
    {
        $hasStock = (float) $product->stock_quantity > 0;
        $hasSaleHistory = $product->saleItems()->exists() || $product->conditionalSaleItems()->exists();

        if ($hasStock || $hasSaleHistory) {
            return response()->json([
                'message' => $hasSaleHistory
                    ? 'Este produto já teve vendas registradas e não pode ser apagado. Inative-o para deixar de vendê-lo.'
                    : 'Este produto possui estoque em mãos e não pode ser apagado. Inative-o para deixar de vendê-lo.',
                'reason' => $hasSaleHistory ? 'has_sales' : 'has_stock',
                'can_deactivate' => true,
            ], 422);
        }

        $product->delete();

        return response()->json(['message' => 'Produto apagado com sucesso.']);
    }
}
