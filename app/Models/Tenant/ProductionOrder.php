<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionOrder extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'recipe_id',
        'product_id',
        'user_id',
        'code',
        'status',
        'planned_quantity',
        'produced_quantity',
        'unit',
        'scheduled_for',
        'notes',
        'stock_applied_at',
        'completed_at',
    ];

    protected $casts = [
        'planned_quantity' => 'decimal:3',
        'produced_quantity' => 'decimal:3',
        'scheduled_for' => 'date',
        'stock_applied_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
