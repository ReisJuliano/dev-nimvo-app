<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnExchange extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'customer_id',
        'sale_id',
        'product_id',
        'type',
        'status',
        'product_name',
        'product_code',
        'size',
        'color',
        'reason',
        'resolution',
        'refund_amount',
        'store_credit_amount',
        'notes',
        'processed_at',
    ];

    protected $casts = [
        'refund_amount' => 'decimal:2',
        'store_credit_amount' => 'decimal:2',
        'processed_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
