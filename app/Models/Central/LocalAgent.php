<?php

namespace App\Models\Central;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LocalAgent extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'name',
        'agent_key',
        'secret_hash',
        'active',
        'last_ip',
        'last_seen_at',
        'metadata',
    ];

    protected $casts = [
        'active' => 'boolean',
        'last_seen_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function commands(): HasMany
    {
        return $this->hasMany(LocalAgentCommand::class);
    }
}
