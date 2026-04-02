<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'ncm',
        'cfop',
        'unit',
        'quantity',
        'unit_price',
        'total_price',
        'match_status',
        'match_type',
        'match_confidence',
        'validation_warnings',
        'metadata',
    ];

    protected $casts = [
        'item_number' => 'integer',
        'quantity' => 'decimal:3',
        'unit_price' => 'decimal:4',
        'total_price' => 'decimal:2',
        'match_confidence' => 'decimal:2',
        'validation_warnings' => 'array',
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
}
