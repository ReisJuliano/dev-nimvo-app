<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryCount extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'inventory_session_item_id',
        'count_round',
        'quantity',
        'source',
        'import_batch_id',
        'counted_by',
        'counted_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:3',
        'counted_at' => 'datetime',
    ];

    public function sessionItem(): BelongsTo
    {
        return $this->belongsTo(InventorySessionItem::class, 'inventory_session_item_id');
    }

    public function importBatch(): BelongsTo
    {
        return $this->belongsTo(InventoryImportBatch::class, 'import_batch_id');
    }

    public function countedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counted_by');
    }
}
