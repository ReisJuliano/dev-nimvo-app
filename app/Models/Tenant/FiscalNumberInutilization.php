<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiscalNumberInutilization extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'profile_id',
        'status',
        'environment',
        'document_model',
        'series',
        'number_start',
        'number_end',
        'justification',
        'requested_by_user_id',
        'agent_key',
        'agent_command_id',
        'request_xml',
        'response_xml',
        'protocol',
        'sefaz_status_code',
        'sefaz_status_reason',
        'last_error',
        'queued_at',
        'processing_started_at',
        'processed_at',
        'failed_at',
    ];

    protected $casts = [
        'queued_at' => 'datetime',
        'processing_started_at' => 'datetime',
        'processed_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(FiscalProfile::class, 'profile_id');
    }
}
