<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Models\Tenant\Product;
use Illuminate\Http\JsonResponse;

class MobileStockController extends Controller
{
    use FormatsMobileResponses;

    public function alerts(): JsonResponse
    {
        $items = Product::query()
            ->where('active', true)
            ->whereColumn('stock_quantity', '<=', 'min_stock')
            ->orderBy('stock_quantity')
            ->orderBy('name')
            ->get(['id', 'name', 'stock_quantity', 'min_stock', 'unit'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'unit' => $product->unit,
                'alert_level' => (float) $product->stock_quantity <= 0 ? 'critical' : 'warning',
            ])
            ->values();

        return response()->json($this->success($items));
    }
}
