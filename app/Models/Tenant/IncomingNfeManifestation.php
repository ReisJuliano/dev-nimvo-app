<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncomingNfeManifestation extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'document_id',
        'event_type',
        'status',
        'sefaz_status_code',
        'sefaz_status_reason',
        'justification',
        'request_xml',
        'response_xml',
        'payload',
        'manifested_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'manifested_at' => 'datetime',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(IncomingNfeDocument::class, 'document_id');
    }
}
