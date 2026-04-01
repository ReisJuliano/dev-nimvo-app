<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'code',
        'barcode',
        'ncm',
        'cfop',
        'cest',
        'origin_code',
        'icms_csosn',
        'pis_cst',
        'cofins_cst',
        'name',
        'description',
        'internal_notes',
        'style_reference',
        'color',
        'size',
        'collection',
        'catalog_visible',
        'category_id',
        'supplier_id',
        'unit',
        'cost_price',
        'sale_price',
        'stock_quantity',
        'min_stock',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'catalog_visible' => 'boolean',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'stock_quantity' => 'decimal:3',
        'min_stock' => 'decimal:3',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }
}
