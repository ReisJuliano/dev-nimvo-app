<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KitchenTicketItem extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'kitchen_ticket_id',
        'product_id',
        'item_name',
        'quantity',
        'unit',
        'notes',
        'done_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'done_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(KitchenTicket::class, 'kitchen_ticket_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
