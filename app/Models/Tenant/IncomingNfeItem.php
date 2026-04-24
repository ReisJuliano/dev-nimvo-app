<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IncomingNfeItem extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'document_id',
        'purchase_item_id',
        'product_id',
        'item_number',
        'supplier_code',
        'barcode',
        'description',
        'purchase_order_reference',
        'purchase_order_item',
        'ncm',
        'cest',
        'cfop',
        'origin_code',
        'icms_cst_csosn',
        'icms_base',
        'icms_rate',
        'icms_amount',
        'icms_st_base',
        'icms_st_rate',
        'icms_st_amount',
        'icms_mva_rate',
        'difal_amount',
        'fcp_st_amount',
        'ipi_cst',
        'ipi_base',
        'ipi_rate',
        'ipi_amount',
        'pis_cst',
        'pis_base',
        'pis_rate',
        'pis_amount',
        'cofins_cst',
        'cofins_base',
        'cofins_rate',
        'cofins_amount',
        'unit',
        'quantity',
        'unit_price',
        'total_price',
        'match_status',
        'match_type',
        'match_confidence',
        'validation_warnings',
        'fiscal_snapshot',
        'metadata',
    ];

    protected $casts = [
        'item_number' => 'integer',
        'purchase_order_item' => 'integer',
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:4',
        'total_price' => 'decimal:2',
        'icms_base' => 'decimal:2',
        'icms_rate' => 'decimal:4',
        'icms_amount' => 'decimal:2',
        'icms_st_base' => 'decimal:2',
        'icms_st_rate' => 'decimal:4',
        'icms_st_amount' => 'decimal:2',
        'icms_mva_rate' => 'decimal:4',
        'difal_amount' => 'decimal:2',
        'fcp_st_amount' => 'decimal:2',
        'ipi_base' => 'decimal:2',
        'ipi_rate' => 'decimal:4',
        'ipi_amount' => 'decimal:2',
        'pis_base' => 'decimal:2',
        'pis_rate' => 'decimal:4',
        'pis_amount' => 'decimal:2',
        'cofins_base' => 'decimal:2',
        'cofins_rate' => 'decimal:4',
        'cofins_amount' => 'decimal:2',
        'match_confidence' => 'decimal:2',
        'validation_warnings' => 'array',
        'fiscal_snapshot' => 'array',
        'metadata' => 'array',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(IncomingNfeDocument::class, 'document_id');
    }

    public function purchaseItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function taxCredits(): HasMany
    {
        return $this->hasMany(IncomingNfeTaxCredit::class, 'incoming_nfe_item_id');
    }
}
