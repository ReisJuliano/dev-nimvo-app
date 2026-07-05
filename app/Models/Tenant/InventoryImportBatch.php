<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryImportBatch extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'inventory_session_id',
        'filename',
        'layout_id',
        'count_round',
        'total_lines',
        'matched_lines',
        'unmatched_lines',
        'duplicate_lines',
        'unmatched_payload',
        'status',
        'imported_by',
    ];

    protected $casts = [
        'unmatched_payload' => 'array',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(InventorySession::class, 'inventory_session_id');
    }

    public function layout(): BelongsTo
    {
        return $this->belongsTo(InventoryCollectorLayout::class, 'layout_id');
    }

    public function importedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }

    public function counts(): HasMany
    {
        return $this->hasMany(InventoryCount::class, 'import_batch_id');
    }
}
