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
                'ncm' => $this->productColumnExists('ncm') ? $product->ncm : null,
                'cfop' => $this->productColumnExists('cfop') ? $product->cfop : null,
                'cest' => $this->productColumnExists('cest') ? $product->cest : null,
                'origin_code' => $this->productColumnExists('origin_code') ? $product->origin_code : '0',
                'icms_csosn' => $this->productColumnExists('icms_csosn') ? $product->icms_csosn : '102',
                'pis_cst' => $this->productColumnExists('pis_cst') ? $product->pis_cst : '49',
                'cofins_cst' => $this->productColumnExists('cofins_cst') ? $product->cofins_cst : '49',
                'fiscal_enabled' => $this->productColumnExists('fiscal_enabled') ? (bool) $product->fiscal_enabled : true,
                'internal_notes' => $this->productColumnExists('internal_notes') ? $product->internal_notes : null,
                'style_reference' => $this->productColumnExists('style_reference') ? $product->style_reference : null,
                'color' => $this->productColumnExists('color') ? $product->color : null,
                'size' => $this->productColumnExists('size') ? $product->size : null,
                'collection' => $this->productColumnExists('collection') ? $product->collection : null,
                'catalog_visible' => $this->productColumnExists('catalog_visible') ? (bool) $product->catalog_visible : false,
                'active' => (bool) $product->active,
                'unit' => $product->unit,
                'commercial_unit' => $this->productColumnExists('commercial_unit') ? ($product->commercial_unit ?: $product->unit) : $product->unit,
                'taxable_unit' => $this->productColumnExists('taxable_unit') ? ($product->taxable_unit ?: $product->unit) : $product->unit,
                'cost_price' => (float) $product->cost_price,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'icms_rate' => $this->productColumnExists('icms_rate') && $product->icms_rate !== null ? (float) $product->icms_rate : null,
                'pis_rate' => $this->productColumnExists('pis_rate') && $product->pis_rate !== null ? (float) $product->pis_rate : null,
                'cofins_rate' => $this->productColumnExists('cofins_rate') && $product->cofins_rate !== null ? (float) $product->cofins_rate : null,
                'ipi_rate' => $this->productColumnExists('ipi_rate') && $product->ipi_rate !== null ? (float) $product->ipi_rate : null,
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

        foreach ([
            'ncm',
            'cfop',
            'cest',
            'origin_code',
            'icms_csosn',
            'pis_cst',
            'cofins_cst',
            'fiscal_enabled',
            'commercial_unit',
            'taxable_unit',
            'icms_rate',
            'pis_rate',
            'cofins_rate',
            'ipi_rate',
            'internal_notes',
            'style_reference',
            'color',
            'size',
            'collection',
            'catalog_visible',
        ] as $column) {
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
