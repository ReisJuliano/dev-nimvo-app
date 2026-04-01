<?php

namespace App\Models\Central;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class LocalAgentCommand extends Model
{
    protected $connection = 'central';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'local_agent_id',
        'tenant_id',
        'fiscal_document_id',
        'type',
        'status',
        'payload',
        'result_payload',
        'attempts',
        'last_error',
        'available_at',
        'claimed_at',
        'completed_at',
    ];

    protected $casts = [
        'payload' => 'encrypted:array',
        'result_payload' => 'encrypted:array',
        'available_at' => 'datetime',
        'claimed_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $command): void {
            if (!$command->getKey()) {
                $command->{$command->getKeyName()} = (string) Str::uuid();
            }
        });
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LocalAgent::class, 'local_agent_id');
    }
}
