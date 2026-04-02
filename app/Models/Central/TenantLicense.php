<?php

namespace App\Models\Central;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TenantLicense extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'starts_at',
        'cycle_days',
        'grace_days',
        'amount',
        'status',
        'last_blocked_at',
        'metadata',
    ];

    protected $casts = [
        'starts_at' => 'date',
        'amount' => 'decimal:2',
        'last_blocked_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(TenantLicenseInvoice::class);
    }
}
