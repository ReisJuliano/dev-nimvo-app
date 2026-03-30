<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeighingRecord extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'product_id',
        'customer_id',
        'reference',
        'status',
        'gross_weight',
        'tare_weight',
        'net_weight',
        'unit_price',
        'total',
        'notes',
        'weighed_at',
    ];

    protected $casts = [
        'gross_weight' => 'decimal:3',
        'tare_weight' => 'decimal:3',
        'net_weight' => 'decimal:3',
        'unit_price' => 'decimal:2',
        'total' => 'decimal:2',
        'weighed_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
