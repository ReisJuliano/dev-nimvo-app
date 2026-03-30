<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryOrder extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'customer_id',
        'order_draft_id',
        'reference',
        'status',
        'channel',
        'recipient_name',
        'phone',
        'courier_name',
        'address',
        'neighborhood',
        'delivery_fee',
        'order_total',
        'scheduled_for',
        'dispatched_at',
        'delivered_at',
        'notes',
    ];

    protected $casts = [
        'delivery_fee' => 'decimal:2',
        'order_total' => 'decimal:2',
        'scheduled_for' => 'datetime',
        'dispatched_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function orderDraft(): BelongsTo
    {
        return $this->belongsTo(OrderDraft::class);
    }
}
