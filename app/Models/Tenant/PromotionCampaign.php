<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PromotionCampaign extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'code',
        'name',
        'description',
        'cover_note',
        'starts_at',
        'ends_at',
        'active',
        'created_by',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'active' => 'boolean',
    ];

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class, 'campaign_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function statusLabel(): string
    {
        if (!$this->active) {
            return 'inativo';
        }

        $now = now();

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return 'agendado';
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return 'encerrado';
        }

        return 'ativo';
    }
}
