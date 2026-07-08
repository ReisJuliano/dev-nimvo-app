<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventorySession extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'code',
        'type',
        'mode',
        'count_resolution',
        'blind_count',
        'status',
        'filters',
        'created_by',
        'approved_by',
        'notes',
        'started_at',
        'counting_finished_at',
        'approved_at',
        'completed_at',
    ];

    protected $casts = [
        'filters' => 'array',
        'blind_count' => 'boolean',
        'started_at' => 'datetime',
        'counting_finished_at' => 'datetime',
        'approved_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(InventorySessionItem::class);
    }

    public function importBatches(): HasMany
    {
        return $this->hasMany(InventoryImportBatch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isFrozen(): bool
    {
        return $this->mode === 'frozen' && in_array($this->status, ['counting', 'review', 'adjusting'], true);
    }
}
