<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function build(): array
    {
        $today = Carbon::today();
        $monthStart = Carbon::now()->startOfMonth();

        $todaySales = Sale::query()
            ->where('status', 'finalized')
            ->whereDate('created_at', $today)
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $monthSales = Sale::query()
            ->where('status', 'finalized')
            ->where('created_at', '>=', $monthStart)
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $recentSales = Sale::query()
            ->with(['customer:id,name', 'user:id,name'])
            ->where('status', 'finalized')
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'customer_name' => $sale->customer?->name ?? 'Nao identificado',
                'user_name' => $sale->user?->name,
                'payment_method' => $sale->payment_method,
                'total' => (float) $sale->total,
                'created_at' => $sale->created_at?->toIso8601String(),
            ]);

        $topProducts = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'finalized')
            ->whereDate('sales.created_at', $today)
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(sale_items.quantity)'))
            ->limit(6)
            ->get([
                'products.name',
                DB::raw('SUM(sale_items.quantity) as qty_sold'),
                DB::raw('SUM(sale_items.total) as total_sold'),
            ])
            ->map(fn ($product) => [
                'name' => $product->name,
                'qty_sold' => (float) $product->qty_sold,
                'total_sold' => (float) $product->total_sold,
            ]);

        $lowStockItems = Product::query()
            ->where('active', true)
            ->whereColumn('stock_quantity', '<=', 'min_stock')
            ->orderBy('stock_quantity')
            ->limit(6)
            ->get()
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'unit' => $product->unit,
            ]);

        return [
            'summary' => [
                'today_sales_total' => (float) ($todaySales->total ?? 0),
                'today_sales_qty' => (int) ($todaySales->qty ?? 0),
                'today_profit' => (float) ($todaySales->profit ?? 0),
                'month_sales_total' => (float) ($monthSales->total ?? 0),
                'month_sales_qty' => (int) ($monthSales->qty ?? 0),
                'total_products' => Product::query()->where('active', true)->count(),
                'low_stock_count' => Product::query()
                    ->where('active', true)
                    ->whereColumn('stock_quantity', '<=', 'min_stock')
                    ->count(),
            ],
            'recentSales' => $recentSales,
            'topProducts' => $topProducts,
            'lowStockItems' => $lowStockItems,
        ];
    }
}
