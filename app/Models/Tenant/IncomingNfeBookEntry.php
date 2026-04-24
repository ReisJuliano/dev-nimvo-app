<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncomingNfeBookEntry extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'document_id',
        'entry_type',
        'status',
        'period_reference',
        'reference_code',
        'payload',
        'generated_at',
        'transmitted_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'generated_at' => 'datetime',
        'transmitted_at' => 'datetime',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(IncomingNfeDocument::class, 'document_id');
    }
}
