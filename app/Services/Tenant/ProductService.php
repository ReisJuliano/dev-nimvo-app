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

    public function save(Product $product, array $data): Product
    {
        if (blank($data['code'] ?? null)) {
            $data['code'] = $product->exists ? $product->code : $this->nextCode();
        }

        $product->fill([
            'code' => $data['code'],
            'barcode' => $data['barcode'] ?? null,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'category_id' => $data['category_id'] ?? null,
            'supplier_id' => $data['supplier_id'] ?? null,
            'unit' => $data['unit'],
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

        $product->save();

        return $product->fresh(['category:id,name', 'supplier:id,name']);
    }

    protected function productColumnExists(string $column): bool
    {
        return $this->productColumnCache[$column]
            ??= Schema::connection((new Product())->getConnectionName())->hasColumn('products', $column);
    }
}
