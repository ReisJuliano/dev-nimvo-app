<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use Illuminate\Support\Facades\Schema;

class ProductService
{
    protected array $productColumnCache = [];

    public function nextCode(): string
    {
        $lastNumericCode = Product::query()
            ->whereRaw("code REGEXP '^[0-9]+$'")
            ->selectRaw('MAX(CAST(code AS UNSIGNED)) as max_code')
            ->value('max_code');

        return str_pad(((int) $lastNumericCode) + 1, 6, '0', STR_PAD_LEFT);
    }

    public function activeCatalog(): array
    {
        return Product::query()
            ->with(['category:id,name', 'supplier:id,name'])
            ->where('active', true)
            ->orderBy('name')
            ->get($this->productSelectColumns())
            ->map(fn (Product $product) => $this->mapCatalogProduct($product))
            ->values()
            ->all();
    }

    public function save(Product $product, array $data): Product
    {
        if (blank($data['code'] ?? null)) {
            $data['code'] = $product->exists ? $product->code : $this->nextCode();
        }

        $baseUnit = strtoupper((string) ($data['unit'] ?? $product->unit ?? 'UN'));

        $product->fill([
            'code' => $data['code'],
            'barcode' => $data['barcode'] ?? null,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'category_id' => $data['category_id'] ?? null,
            'supplier_id' => $data['supplier_id'] ?? null,
            'unit' => $baseUnit,
            'cost_price' => $data['cost_price'] ?? 0,
            'sale_price' => $data['sale_price'] ?? 0,
            'stock_quantity' => $data['stock_quantity'] ?? ($product->exists ? $product->stock_quantity : 0),
            'min_stock' => $data['min_stock'] ?? 0,
            'active' => array_key_exists('active', $data)
                ? (bool) $data['active']
                : ($product->exists ? (bool) $product->active : true),
        ]);

        if ($this->productColumnExists('internal_notes')) {
            $product->internal_notes = $data['internal_notes'] ?? null;
        }

        if ($this->productColumnExists('style_reference')) {
            $product->style_reference = $data['style_reference'] ?? null;
        }

        if ($this->productColumnExists('color')) {
            $product->color = $data['color'] ?? null;
        }

        if ($this->productColumnExists('size')) {
            $product->size = $data['size'] ?? null;
        }

        if ($this->productColumnExists('collection')) {
            $product->collection = $data['collection'] ?? null;
        }

        if ($this->productColumnExists('catalog_visible')) {
            $product->catalog_visible = (bool) ($data['catalog_visible'] ?? false);
        }

        if ($this->productColumnExists('ncm')) {
            $product->ncm = $data['ncm'] ?? null;
        }

        if ($this->productColumnExists('cfop')) {
            $product->cfop = $data['cfop'] ?? null;
        }

        if ($this->productColumnExists('cest')) {
            $product->cest = $data['cest'] ?? null;
        }

        if ($this->productColumnExists('origin_code')) {
            $product->origin_code = $data['origin_code'] ?? '0';
        }

        if ($this->productColumnExists('icms_csosn')) {
            $product->icms_csosn = $data['icms_csosn'] ?? '102';
        }

        if ($this->productColumnExists('pis_cst')) {
            $product->pis_cst = $data['pis_cst'] ?? '49';
        }

        if ($this->productColumnExists('cofins_cst')) {
            $product->cofins_cst = $data['cofins_cst'] ?? '49';
        }

        if ($this->productColumnExists('fiscal_enabled')) {
            $product->fiscal_enabled = array_key_exists('fiscal_enabled', $data)
                ? (bool) $data['fiscal_enabled']
                : ($product->exists ? (bool) $product->fiscal_enabled : true);
        }

        if ($this->productColumnExists('commercial_unit')) {
            $product->commercial_unit = strtoupper((string) ($data['commercial_unit'] ?? $baseUnit)) ?: $baseUnit;
        }

        if ($this->productColumnExists('taxable_unit')) {
            $product->taxable_unit = strtoupper((string) ($data['taxable_unit'] ?? $data['commercial_unit'] ?? $baseUnit)) ?: $baseUnit;
        }

        if ($this->productColumnExists('icms_rate')) {
            $product->icms_rate = $data['icms_rate'] ?? null;
        }

        if ($this->productColumnExists('pis_rate')) {
            $product->pis_rate = $data['pis_rate'] ?? null;
        }

        if ($this->productColumnExists('cofins_rate')) {
            $product->cofins_rate = $data['cofins_rate'] ?? null;
        }

        if ($this->productColumnExists('ipi_rate')) {
            $product->ipi_rate = $data['ipi_rate'] ?? null;
        }

        $product->save();

        return $product->fresh(['category:id,name', 'supplier:id,name']);
    }

    protected function mapCatalogProduct(Product $product): array
    {
        return [
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
        ];
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
