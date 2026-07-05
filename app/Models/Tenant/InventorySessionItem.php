<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventorySessionItem extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'inventory_session_id',
        'product_id',
        'snapshot_quantity',
        'counted_quantity',
        'interim_delta',
        'final_delta',
        'unit_cost',
        'status',
        'resolution',
        'resolution_reason',
        'resolved_by',
    ];

    protected $casts = [
        'snapshot_quantity' => 'decimal:3',
        'counted_quantity' => 'decimal:3',
        'interim_delta' => 'decimal:3',
        'final_delta' => 'decimal:3',
        'unit_cost' => 'decimal:2',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(InventorySession::class, 'inventory_session_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function counts(): HasMany
    {
        return $this->hasMany(InventoryCount::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function delta(): float
    {
        if ($this->counted_quantity === null) {
            return 0.0;
        }

        return round((float) $this->counted_quantity - (float) $this->snapshot_quantity, 3);
    }

    public function deltaValue(): float
    {
        return round($this->delta() * (float) $this->unit_cost, 2);
    }
}
