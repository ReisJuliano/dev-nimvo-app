<?php

namespace App\Http\Controllers\Tenant\Products;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class ProductsPageController extends Controller
{
    protected array $productColumnCache = [];

    public function __invoke(): Response
    {
        $products = Product::query()
            ->with(['category:id,name', 'supplier:id,name'])
            ->where('active', true)
            ->orderBy('name')
            ->get($this->productSelectColumns())
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'description' => $product->description,
                'internal_notes' => $this->productColumnExists('internal_notes') ? $product->internal_notes : null,
                'style_reference' => $this->productColumnExists('style_reference') ? $product->style_reference : null,
                'color' => $this->productColumnExists('color') ? $product->color : null,
                'size' => $this->productColumnExists('size') ? $product->size : null,
                'collection' => $this->productColumnExists('collection') ? $product->collection : null,
                'catalog_visible' => $this->productColumnExists('catalog_visible') ? (bool) $product->catalog_visible : false,
                'active' => (bool) $product->active,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'category_id' => $product->category_id,
                'supplier_id' => $product->supplier_id,
                'category_name' => $product->category?->name,
                'supplier_name' => $product->supplier?->name,
            ]);

        return Inertia::render('Products/Index', [
            'products' => $products,
            'categories' => Category::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
            'suppliers' => Supplier::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    protected function productSelectColumns(): array
    {
        $columns = [
            'id',
            'code',
            'barcode',
            'name',
            'description',
            'unit',
            'cost_price',
            'sale_price',
            'stock_quantity',
            'min_stock',
            'category_id',
            'supplier_id',
            'active',
        ];

        foreach (['internal_notes', 'style_reference', 'color', 'size', 'collection', 'catalog_visible'] as $column) {
            if ($this->productColumnExists($column)) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    protected function productColumnExists(string $column): bool
    {
        return $this->productColumnCache[$column]
            ??= Schema::connection((new Product())->getConnectionName())->hasColumn('products', $column);
    }
}
