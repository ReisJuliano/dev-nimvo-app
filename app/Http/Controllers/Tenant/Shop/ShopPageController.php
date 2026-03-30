<?php

namespace App\Http\Controllers\Tenant\Shop;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Services\Tenant\FashionModuleSettingsService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class ShopPageController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __invoke(
        TenantSettingsService $tenantSettingsService,
        FashionModuleSettingsService $fashionSettingsService,
    ): Response {
        abort_unless($tenantSettingsService->isModuleEnabled('catalogo_online'), 404);

        $catalog = $fashionSettingsService->getCatalog();
        $whatsApp = $fashionSettingsService->getWhatsApp();
        $promotions = $this->activePromotions();
        $products = $this->publishedProducts($promotions);

        return Inertia::render('Shop/Index', [
            'store' => [
                'name' => (string) (tenant('name') ?? 'Loja'),
                'email' => (string) (tenant('email') ?? ''),
                'shopPath' => '/shop',
                'checkoutEnabled' => $tenantSettingsService->isModuleEnabled('pedidos_online'),
                'whatsAppEnabled' => $tenantSettingsService->isModuleEnabled('whatsapp_pedidos')
                    && filled($whatsApp['phone'] ?? null),
            ],
            'catalog' => $catalog,
            'whatsApp' => [
                'phone' => (string) ($whatsApp['phone'] ?? ''),
                'greeting' => (string) ($whatsApp['greeting'] ?? ''),
                'business_hours' => (string) ($whatsApp['business_hours'] ?? ''),
            ],
            'collections' => collect($products)
                ->pluck('collection')
                ->filter()
                ->unique()
                ->values()
                ->all(),
            'products' => $products,
        ]);
    }

    protected function publishedProducts(Collection $promotions): array
    {
        return Product::query()
            ->with('category:id,name')
            ->where('active', true)
            ->when(
                $this->hasColumn('products', 'catalog_visible'),
                fn ($query) => $query->where('catalog_visible', true),
            )
            ->when(
                $this->hasColumn('products', 'collection'),
                fn ($query) => $query->orderBy('collection'),
            )
            ->orderBy('name')
            ->get($this->productSelectColumns([
                'style_reference',
                'color',
                'size',
                'collection',
                'catalog_visible',
            ]))
            ->map(fn (Product $product) => $this->serializeProduct($product, $promotions))
            ->values()
            ->all();
    }

    protected function serializeProduct(Product $product, Collection $promotions): array
    {
        $promotion = $promotions->first(fn (Promotion $promotion) => $this->promotionMatchesProduct($promotion, $product));

        return [
            'id' => $product->id,
            'code' => $product->code,
            'name' => $product->name,
            'description' => $product->description,
            'style_reference' => $this->productValue($product, 'style_reference'),
            'color' => $this->productValue($product, 'color'),
            'size' => $this->productValue($product, 'size'),
            'collection' => $this->productValue($product, 'collection'),
            'category_name' => $product->category?->name,
            'sale_price' => (float) $product->sale_price,
            'stock_quantity' => (float) $product->stock_quantity,
            'in_stock' => (float) $product->stock_quantity > 0,
            'promotion' => $promotion ? [
                'name' => $promotion->name,
                'highlight_text' => $promotion->highlight_text,
            ] : null,
        ];
    }

    protected function activePromotions(): Collection
    {
        if (!$this->hasTable('promotions')) {
            return collect();
        }

        return Promotion::query()
            ->where('active', true)
            ->where(fn ($query) => $query->whereNull('start_at')->orWhere('start_at', '<=', now()))
            ->where(fn ($query) => $query->whereNull('end_at')->orWhere('end_at', '>=', now()))
            ->latest()
            ->get([
                'id',
                'name',
                'scope',
                'product_id',
                'category_id',
                'collection',
                'highlight_text',
            ]);
    }

    protected function promotionMatchesProduct(Promotion $promotion, Product $product): bool
    {
        return match ($promotion->scope) {
            'product' => (int) $promotion->product_id === (int) $product->id,
            'category' => (int) $promotion->category_id === (int) $product->category_id,
            'collection' => filled($promotion->collection)
                && $promotion->collection === $this->productValue($product, 'collection'),
            default => true,
        };
    }

    protected function productSelectColumns(array $extraColumns = []): array
    {
        $columns = [
            'id',
            'code',
            'name',
            'description',
            'category_id',
            'sale_price',
            'stock_quantity',
            'active',
        ];

        foreach ($extraColumns as $column) {
            if ($this->hasColumn('products', $column)) {
                $columns[] = $column;
            }
        }

        return array_values(array_unique($columns));
    }

    protected function productValue(Product $product, string $column, mixed $default = null): mixed
    {
        return $this->hasColumn('products', $column)
            ? $product->getAttribute($column)
            : $default;
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Product())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new Product())->getConnectionName())->hasColumn($table, $column);
    }
}
