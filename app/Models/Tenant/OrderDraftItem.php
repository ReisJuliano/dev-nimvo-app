<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderDraftItem extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'order_draft_id',
        'product_id',
        'product_name',
        'product_code',
        'product_barcode',
        'unit',
        'quantity',
        'unit_cost',
        'unit_price',
        'total',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function orderDraft(): BelongsTo
    {
        return $this->belongsTo(OrderDraft::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
