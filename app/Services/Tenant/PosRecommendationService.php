<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PosRecommendationService
{
    protected const TOP_SELLERS_WINDOW_DAYS = 30;

    protected const ASSOCIATION_WINDOW_DAYS = 45;

    protected const MIN_ASSOCIATION_SUPPORT = 2;

    public function build(?int $anchorProductId = null, array $excludeProductIds = [], int $topLimit = 8, int $associationLimit = 6): array
    {
        $topSellers = $this->resolveTopSellers($topLimit);
        $associationsPayload = $this->resolveAssociations(
            $anchorProductId,
            $excludeProductIds,
            $associationLimit,
        );

        return [
            'generated_at' => now()->toIso8601String(),
            'top_sellers_context' => [
                'mode' => $topSellers['mode'],
                'window_days' => $topSellers['window_days'],
            ],
            'top_sellers' => $topSellers['items'],
            'association_context' => $associationsPayload['context'],
            'associations' => $associationsPayload['items'],
        ];
    }

    protected function resolveTopSellers(int $limit): array
    {
        $recentWindowStart = now()->subDays(self::TOP_SELLERS_WINDOW_DAYS)->startOfDay();
        $recentItems = $this->topSellerRows($limit, $recentWindowStart);

        if ($recentItems->isNotEmpty()) {
            return [
                'mode' => 'recent',
                'window_days' => self::TOP_SELLERS_WINDOW_DAYS,
                'items' => $recentItems->all(),
            ];
        }

        return [
            'mode' => 'all_time',
            'window_days' => null,
            'items' => $this->topSellerRows($limit)->all(),
        ];
    }

    protected function topSellerRows(int $limit, mixed $windowStart = null): Collection
    {
        return $this->productSalesBaseQuery($windowStart)
            ->orderByDesc(DB::raw('SUM(sale_items.quantity)'))
            ->orderByDesc(DB::raw('COUNT(DISTINCT sales.id)'))
            ->orderByDesc(DB::raw('MAX(sales.created_at)'))
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                return $this->serializeProductRow($row, [
                    'sales_count' => (int) $row->sales_count,
                    'quantity_sold' => (float) $row->quantity_sold,
                    'revenue' => (float) $row->revenue,
                    'last_sold_at' => $row->last_sold_at,
                ]);
            });
    }

    protected function resolveAssociations(?int $anchorProductId, array $excludeProductIds, int $limit): array
    {
        $anchorProduct = $anchorProductId
            ? Product::query()->where('active', true)->find($anchorProductId)
            : null;

        if (! $anchorProduct) {
            return [
                'context' => null,
                'items' => [],
            ];
        }

        $excludeIds = collect($excludeProductIds)
            ->map(fn ($value) => (int) $value)
            ->filter(fn (int $value) => $value > 0)
            ->push((int) $anchorProduct->id)
            ->unique()
            ->values()
            ->all();

        $recentWindowStart = now()->subDays(self::ASSOCIATION_WINDOW_DAYS)->startOfDay();
        $baseSalesCount = $this->countAnchorSales((int) $anchorProduct->id, $recentWindowStart);
        $associationRows = $this->associationRows(
            anchorProductId: (int) $anchorProduct->id,
            excludeProductIds: $excludeIds,
            baseSalesCount: $baseSalesCount,
            limit: $limit,
            windowStart: $recentWindowStart,
        );

        if ($baseSalesCount > 0 && $associationRows->isNotEmpty()) {
            return [
                'context' => [
                    'anchor_product_id' => (int) $anchorProduct->id,
                    'anchor_product_name' => $anchorProduct->name,
                    'base_sales_count' => $baseSalesCount,
                    'mode' => 'recent',
                    'window_days' => self::ASSOCIATION_WINDOW_DAYS,
                ],
                'items' => $associationRows->all(),
            ];
        }

        $allTimeBaseSalesCount = $this->countAnchorSales((int) $anchorProduct->id);
        $allTimeAssociationRows = $this->associationRows(
            anchorProductId: (int) $anchorProduct->id,
            excludeProductIds: $excludeIds,
            baseSalesCount: $allTimeBaseSalesCount,
            limit: $limit,
        );

        return [
            'context' => [
                'anchor_product_id' => (int) $anchorProduct->id,
                'anchor_product_name' => $anchorProduct->name,
                'base_sales_count' => $allTimeBaseSalesCount,
                'mode' => 'all_time',
                'window_days' => null,
            ],
            'items' => $allTimeAssociationRows->all(),
        ];
    }

    protected function associationRows(
        int $anchorProductId,
        array $excludeProductIds,
        int $baseSalesCount,
        int $limit,
        mixed $windowStart = null,
    ): Collection {
        if ($baseSalesCount === 0) {
            return collect();
        }

        return DB::table('sale_items as anchor_items')
            ->join('sales', 'sales.id', '=', 'anchor_items.sale_id')
            ->join('sale_items as related_items', function ($join) {
                $join->on('related_items.sale_id', '=', 'anchor_items.sale_id')
                    ->whereColumn('related_items.product_id', '<>', 'anchor_items.product_id');
            })
            ->join('products', 'products.id', '=', 'related_items.product_id')
            ->where('sales.status', 'finalized')
            ->where('products.active', true)
            ->where('anchor_items.product_id', $anchorProductId)
            ->when($windowStart, fn ($query) => $query->where('sales.created_at', '>=', $windowStart))
            ->when(
                $excludeProductIds !== [],
                fn ($query) => $query->whereNotIn('related_items.product_id', $excludeProductIds),
            )
            ->groupBy(
                'products.id',
                'products.code',
                'products.barcode',
                'products.name',
                'products.description',
                'products.unit',
                'products.cost_price',
                'products.sale_price',
                'products.stock_quantity',
            )
            ->havingRaw('COUNT(DISTINCT sales.id) >= ?', [self::MIN_ASSOCIATION_SUPPORT])
            ->orderByDesc(DB::raw('COUNT(DISTINCT sales.id)'))
            ->orderByDesc(DB::raw('SUM(related_items.quantity)'))
            ->orderByDesc(DB::raw('MAX(sales.created_at)'))
            ->limit($limit)
            ->get([
                'products.id',
                'products.code',
                'products.barcode',
                'products.name',
                'products.description',
                'products.unit',
                'products.cost_price',
                'products.sale_price',
                'products.stock_quantity',
                DB::raw('COUNT(DISTINCT sales.id) as paired_sales_count'),
                DB::raw('SUM(related_items.quantity) as paired_quantity'),
                DB::raw('MAX(sales.created_at) as last_related_at'),
            ])
            ->map(function ($row) use ($baseSalesCount) {
                return $this->serializeProductRow($row, [
                    'paired_sales_count' => (int) $row->paired_sales_count,
                    'paired_quantity' => (float) $row->paired_quantity,
                    'association_rate' => round(((int) $row->paired_sales_count / $baseSalesCount) * 100, 1),
                    'last_related_at' => $row->last_related_at,
                ]);
            });
    }

    protected function countAnchorSales(int $anchorProductId, mixed $windowStart = null): int
    {
        return (int) DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->where('sale_items.product_id', $anchorProductId)
            ->when($windowStart, fn ($query) => $query->where('sales.created_at', '>=', $windowStart))
            ->distinct('sales.id')
            ->count('sales.id');
    }

    protected function productSalesBaseQuery(mixed $windowStart = null)
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'finalized')
            ->where('products.active', true)
            ->when($windowStart, fn ($query) => $query->where('sales.created_at', '>=', $windowStart))
            ->groupBy(
                'products.id',
                'products.code',
                'products.barcode',
                'products.name',
                'products.description',
                'products.unit',
                'products.cost_price',
                'products.sale_price',
                'products.stock_quantity',
            )
            ->select([
                'products.id',
                'products.code',
                'products.barcode',
                'products.name',
                'products.description',
                'products.unit',
                'products.cost_price',
                'products.sale_price',
                'products.stock_quantity',
                DB::raw('COUNT(DISTINCT sales.id) as sales_count'),
                DB::raw('SUM(sale_items.quantity) as quantity_sold'),
                DB::raw('SUM(sale_items.total) as revenue'),
                DB::raw('MAX(sales.created_at) as last_sold_at'),
            ]);
    }

    protected function serializeProductRow(object $row, array $metrics): array
    {
        return [
            'id' => (int) $row->id,
            'code' => $row->code,
            'barcode' => $row->barcode,
            'name' => $row->name,
            'description' => $row->description,
            'unit' => $row->unit,
            'cost_price' => (float) $row->cost_price,
            'sale_price' => (float) $row->sale_price,
            'stock_quantity' => (float) $row->stock_quantity,
            ...$metrics,
        ];
    }
}
