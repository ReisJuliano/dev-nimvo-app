<?php

namespace App\Services\Tenant\Inventory;

use App\Models\Tenant\Product;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InventoryCycleCountService
{
    /**
     * Intervalo recomendado (em dias) entre contagens por classe da curva ABC.
     */
    protected const CLASS_INTERVAL_DAYS = [
        'A' => 30,
        'B' => 90,
        'C' => 365,
    ];

    /**
     * Classifica os produtos ativos em A/B/C por faturamento acumulado no
     * período (curva ABC), reaproveitando o mesmo padrão de query de
     * ReportBrowserService::salesProductsReport(). Produtos sem venda no
     * período caem em C.
     */
    public function classify(?string $from = null, ?string $to = null): Collection
    {
        $fromDate = $from ? Carbon::parse($from)->startOfDay() : now()->subDays(90)->startOfDay();
        $toDate = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();

        $revenueByProduct = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$fromDate, $toDate])
            ->selectRaw('sale_items.product_id as product_id, SUM(sale_items.total) as revenue')
            ->groupBy('sale_items.product_id');

        $rows = Product::query()
            ->where('active', true)
            ->leftJoinSub($revenueByProduct, 'revenue', 'revenue.product_id', '=', 'products.id')
            ->selectRaw('products.*, COALESCE(revenue.revenue, 0) as period_revenue')
            ->orderByDesc('period_revenue')
            ->get();

        $totalRevenue = (float) $rows->sum('period_revenue');
        $cumulative = 0.0;

        return $rows->map(function (Product $product) use (&$cumulative, $totalRevenue) {
            $revenue = (float) $product->getAttribute('period_revenue');
            $cumulative += $revenue;
            $cumulativePercent = $totalRevenue > 0 ? ($cumulative / $totalRevenue) * 100 : 100.0;
            $class = self::classForCumulativePercent($revenue, $cumulativePercent);

            return [
                'product_id' => $product->id,
                'code' => $product->code,
                'name' => $product->name,
                'category_id' => $product->category_id,
                'stock_value' => round((float) $product->stock_quantity * (float) $product->cost_price, 2),
                'revenue' => round($revenue, 2),
                'class' => $class,
                'last_counted_at' => $product->last_counted_at,
            ];
        })->values();
    }

    /**
     * Bucket puro da curva ABC por % de faturamento acumulado — sem produto
     * vendido no período (revenue <= 0) sempre cai em C, independente do
     * acumulado. Extraído de classify() pra ser testável sem DB.
     */
    public static function classForCumulativePercent(float $revenue, float $cumulativePercent): string
    {
        return match (true) {
            $revenue <= 0 => 'C',
            $cumulativePercent <= 80 => 'A',
            $cumulativePercent <= 95 => 'B',
            default => 'C',
        };
    }

    /**
     * Produtos de uma classe ABC que estão "vencidos" pro intervalo
     * recomendado da classe — pronto pra virar filtros.product_ids de uma
     * sessão parcial de contagem cíclica.
     */
    public function suggestForCycle(string $class): array
    {
        $class = strtoupper($class);
        $days = self::CLASS_INTERVAL_DAYS[$class] ?? 90;
        $cutoff = now()->subDays($days);

        $candidates = $this->classify()
            ->filter(fn (array $row) => $row['class'] === $class)
            ->filter(fn (array $row) => $row['last_counted_at'] === null || $row['last_counted_at']->lt($cutoff))
            ->values();

        return [
            'class' => $class,
            'interval_days' => $days,
            'product_ids' => $candidates->pluck('product_id')->all(),
            'total_candidates' => $candidates->count(),
        ];
    }
}
