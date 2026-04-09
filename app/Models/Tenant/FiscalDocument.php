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
        'response_xml',
        'authorized_xml',
        'cancellation_request_xml',
        'cancellation_response_xml',
        'cancelled_xml',
        'sefaz_receipt',
        'sefaz_protocol',
        'cancellation_protocol',
        'sefaz_status_code',
        'sefaz_status_reason',
        'cancellation_reason',
        'contingency_reason',
        'last_error',
        'queued_at',
        'processing_started_at',
        'cancellation_requested_at',
        'contingency_requested_at',
        'contingency_released_at',
        'contingency_attempts',
        'authorized_at',
        'printed_at',
        'cancelled_at',
        'failed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'queued_at' => 'datetime',
        'processing_started_at' => 'datetime',
        'cancellation_requested_at' => 'datetime',
        'contingency_requested_at' => 'datetime',
        'contingency_released_at' => 'datetime',
        'authorized_at' => 'datetime',
        'printed_at' => 'datetime',
        'cancelled_at' => 'datetime',
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
