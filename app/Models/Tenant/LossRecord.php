<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LossRecord extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'product_id',
        'user_id',
        'reason',
        'status',
        'quantity',
        'unit_cost',
        'total_cost',
        'notes',
        'occurred_at',
        'stock_applied_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'unit_cost' => 'decimal:2',
        'total_cost' => 'decimal:2',
        'occurred_at' => 'datetime',
        'stock_applied_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
