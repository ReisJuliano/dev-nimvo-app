<?php

namespace App\Models\Central;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Client extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'document',
        'domain',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
