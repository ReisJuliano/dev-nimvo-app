<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConditionalSaleItem extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'conditional_sale_id',
        'product_id',
        'product_code',
        'product_name',
        'quantity_sent',
        'quantity_returned',
        'quantity_kept',
        'quantity_lost',
        'quantity_damaged',
        'unit_cost',
        'unit_price',
    ];

    protected $casts = [
        'quantity_sent' => 'decimal:3',
        'quantity_returned' => 'decimal:3',
        'quantity_kept' => 'decimal:3',
        'quantity_lost' => 'decimal:3',
        'quantity_damaged' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
    ];

    public function conditionalSale(): BelongsTo
    {
        return $this->belongsTo(ConditionalSale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
