<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalDocument extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'sale_id',
        'profile_id',
        'type',
        'status',
        'idempotency_key',
        'environment',
        'series',
        'number',
        'access_key',
        'agent_key',
        'agent_command_id',
        'payload',
        'request_xml',
        'signed_xml',
        'authorized_xml',
        'sefaz_receipt',
        'sefaz_protocol',
        'sefaz_status_code',
        'sefaz_status_reason',
        'last_error',
        'queued_at',
        'processing_started_at',
        'authorized_at',
        'printed_at',
        'failed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'queued_at' => 'datetime',
        'processing_started_at' => 'datetime',
        'authorized_at' => 'datetime',
        'printed_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(FiscalProfile::class, 'profile_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(FiscalDocumentEvent::class);
    }
}
