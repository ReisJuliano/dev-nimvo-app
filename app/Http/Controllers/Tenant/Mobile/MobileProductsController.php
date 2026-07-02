<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MobileProductsController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));
        $limit = min(max((int) $request->integer('limit', 20), 1), 50);

        $query = Product::query()
            ->with('category:id,name')
            ->where('active', true)
            ->select([
                'id',
                'category_id',
                'code',
                'barcode',
                'name',
                'unit',
                'cost_price',
                'sale_price',
                'stock_quantity',
                'min_stock',
            ]);

        if ($term !== '') {
            $query->where(function ($builder) use ($term) {
                $builder
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%")
                    ->orWhere('barcode', 'like', "%{$term}%");
            });
        }

        $products = $query
            ->orderBy('name')
            ->limit($limit)
            ->get();

        $sales = $this->salesSnapshot($products->pluck('id'));

        $items = $products
            ->map(function (Product $product) use ($sales) {
                $snapshot = $sales->get($product->id);

                return [
                    'id' => $product->id,
                    'code' => $product->code ?: '-',
                    'barcode' => $product->barcode ?: null,
                    'name' => $product->name,
                    'category_name' => $product->category?->name,
                    'unit' => $product->unit,
                    'cost_price' => (float) $product->cost_price,
                    'sale_price' => (float) $product->sale_price,
                    'stock_quantity' => (float) $product->stock_quantity,
                    'min_stock' => (float) $product->min_stock,
                    'avg_daily_qty_30d' => (float) ($snapshot?->avg_daily_qty_30d ?? 0),
                    'last_sale_at' => $snapshot?->last_sale_at,
                    'last_sale_qty' => (float) ($snapshot?->last_sale_qty ?? 0),
                    'last_sale_total' => (float) ($snapshot?->last_sale_total ?? 0),
                ];
            })
            ->values();

        return response()->json([
            'data' => ['items' => $items],
            'message' => 'OK',
        ]);
    }

    protected function salesSnapshot(Collection $productIds): Collection
    {
        if ($productIds->isEmpty()) {
            return collect();
        }

        $lastSales = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->whereIn('sale_items.product_id', $productIds)
            ->select([
                'sale_items.product_id',
                'sale_items.quantity as last_sale_qty',
                'sale_items.total as last_sale_total',
                'sales.created_at as last_sale_at',
            ])
            ->orderByDesc('sales.created_at')
            ->get()
            ->unique('product_id')
            ->keyBy('product_id');

        $recentSales = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->whereIn('sale_items.product_id', $productIds)
            ->where('sales.created_at', '>=', now()->subDays(30)->startOfDay())
            ->groupBy('sale_items.product_id')
            ->get([
                'sale_items.product_id',
                DB::raw('SUM(sale_items.quantity) / 30 as avg_daily_qty_30d'),
            ])
            ->keyBy('product_id');

        return $productIds
            ->mapWithKeys(function ($productId) use ($recentSales, $lastSales) {
                $recent = $recentSales->get($productId);
                $lastSale = $lastSales->get($productId);

                return [$productId => (object) [
                    'product_id' => $productId,
                    'avg_daily_qty_30d' => (float) ($recent?->avg_daily_qty_30d ?? 0),
                    'last_sale_at' => $lastSale?->last_sale_at,
                    'last_sale_qty' => (float) ($lastSale?->last_sale_qty ?? 0),
                    'last_sale_total' => (float) ($lastSale?->last_sale_total ?? 0),
                ]];
            });
    }
}
