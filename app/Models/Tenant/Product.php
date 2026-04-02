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
        'icms_rate',
        'pis_cst',
        'pis_rate',
        'cofins_cst',
        'cofins_rate',
        'ipi_rate',
        'fiscal_enabled',
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
        'commercial_unit',
        'taxable_unit',
        'cost_price',
        'sale_price',
        'stock_quantity',
        'min_stock',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'catalog_visible' => 'boolean',
        'fiscal_enabled' => 'boolean',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'stock_quantity' => 'decimal:3',
        'min_stock' => 'decimal:3',
        'icms_rate' => 'decimal:4',
        'pis_rate' => 'decimal:4',
        'cofins_rate' => 'decimal:4',
        'ipi_rate' => 'decimal:4',
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
