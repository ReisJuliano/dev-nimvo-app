<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function build(): array
    {
        $today = Carbon::today();
        $todayEnd = $today->copy()->endOfDay();
        $yesterday = $today->copy()->subDay();
        $monthStart = Carbon::now()->startOfMonth();
        $monthEnd = Carbon::now()->endOfDay();
        $previousMonthStart = $monthStart->copy()->subMonthNoOverflow()->startOfMonth();
        $previousMonthEnd = $monthStart->copy()->subMonthNoOverflow()->endOfMonth();
        $trendStart = $today->copy()->subDays(6);

        $todaySales = Sale::query()
            ->where('status', 'finalized')
            ->whereDate('created_at', $today)
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $yesterdaySales = Sale::query()
            ->where('status', 'finalized')
            ->whereDate('created_at', $yesterday)
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $monthSales = Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$monthStart->copy()->startOfDay(), $monthEnd])
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $previousMonthSales = Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$previousMonthStart, $previousMonthEnd])
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $salesTrendRows = Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$trendStart->copy()->startOfDay(), $todayEnd])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $salesTrend = collect(range(0, 6))
            ->map(function (int $offset) use ($trendStart, $salesTrendRows) {
                $day = $trendStart->copy()->addDays($offset);
                $dayKey = $day->toDateString();
                $row = $salesTrendRows->get($dayKey);

                return [
                    'date' => $dayKey,
                    'label' => $day->format('d/m'),
                    'total' => (float) ($row->total ?? 0),
                    'profit' => (float) ($row->profit ?? 0),
                    'qty' => (int) ($row->qty ?? 0),
                ];
            })
            ->values()
            ->all();

        $hourlySalesRows = Sale::query()
            ->where('status', 'finalized')
            ->whereDate('created_at', $today)
            ->selectRaw('HOUR(created_at) as hour, COUNT(*) as qty, COALESCE(SUM(total), 0) as total')
            ->groupBy(DB::raw('HOUR(created_at)'))
            ->orderBy('hour')
            ->get()
            ->keyBy('hour');

        $hourlySales = collect(range(0, 23))
            ->map(function (int $hour) use ($hourlySalesRows) {
                $row = $hourlySalesRows->get($hour);

                return [
                    'hour' => sprintf('%02d:00', $hour),
                    'label' => sprintf('%02d', $hour),
                    'total' => (float) ($row->total ?? 0),
                    'qty' => (int) ($row->qty ?? 0),
                ];
            })
            ->values()
            ->all();

        $paymentBreakdown = DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$monthStart->copy()->startOfDay(), $monthEnd])
            ->groupBy('sale_payments.payment_method')
            ->orderByDesc(DB::raw('SUM(sale_payments.amount)'))
            ->limit(6)
            ->get([
                'sale_payments.payment_method',
                DB::raw('COUNT(*) as qty'),
                DB::raw('SUM(sale_payments.amount) as total'),
            ])
            ->map(fn ($payment) => [
                'method' => $payment->payment_method,
                'label' => $this->paymentLabel((string) $payment->payment_method),
                'qty' => (int) $payment->qty,
                'total' => (float) $payment->total,
            ])
            ->values()
            ->all();

        $recentSales = Sale::query()
            ->with(['customer:id,name', 'user:id,name'])
            ->where('status', 'finalized')
            ->latest()
            ->limit(6)
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
            ->whereBetween('sales.created_at', [$trendStart->copy()->startOfDay(), $todayEnd])
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(sale_items.total)'))
            ->limit(5)
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

        $activeProductsCount = Product::query()
            ->where('active', true)
            ->count();

        $lowStockCount = Product::query()
            ->where('active', true)
            ->whereColumn('stock_quantity', '<=', 'min_stock')
            ->count();

        $averageTicket = (int) ($monthSales->qty ?? 0) > 0
            ? (float) $monthSales->total / (int) $monthSales->qty
            : 0;

        $inventoryHealth = $activeProductsCount > 0
            ? (($activeProductsCount - $lowStockCount) / $activeProductsCount) * 100
            : 0;

        return [
            'summary' => [
                'today_sales_total' => (float) ($todaySales->total ?? 0),
                'today_sales_qty' => (int) ($todaySales->qty ?? 0),
                'today_profit' => (float) ($todaySales->profit ?? 0),
                'month_sales_total' => (float) ($monthSales->total ?? 0),
                'month_sales_qty' => (int) ($monthSales->qty ?? 0),
                'month_profit' => (float) ($monthSales->profit ?? 0),
                'average_ticket' => $averageTicket,
                'total_products' => $activeProductsCount,
                'low_stock_count' => $lowStockCount,
                'inventory_health' => $inventoryHealth,
                'profit_margin' => (float) ($monthSales->total ?? 0) > 0
                    ? ((float) ($monthSales->profit ?? 0) / (float) $monthSales->total) * 100
                    : 0,
                'today_growth' => $this->growthPercentage(
                    (float) ($todaySales->total ?? 0),
                    (float) ($yesterdaySales->total ?? 0),
                ),
                'month_growth' => $this->growthPercentage(
                    (float) ($monthSales->total ?? 0),
                    (float) ($previousMonthSales->total ?? 0),
                ),
            ],
            'recentSales' => $recentSales,
            'topProducts' => $topProducts,
            'lowStockItems' => $lowStockItems,
            'salesTrend' => $salesTrend,
            'hourlySales' => $hourlySales,
            'paymentBreakdown' => $paymentBreakdown,
        ];
    }

    protected function growthPercentage(float $current, float $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100 : 0;
        }

        return (($current - $previous) / $previous) * 100;
    }

    protected function paymentLabel(string $paymentMethod): string
    {
        return match ($paymentMethod) {
            'cash' => 'Dinheiro',
            'pix' => 'Pix',
            'debit_card' => 'Debito',
            'credit_card' => 'Credito',
            'credit' => 'A prazo',
            'mixed' => 'Misto',
            default => ucfirst(str_replace('_', ' ', $paymentMethod)),
        };
    }
}
