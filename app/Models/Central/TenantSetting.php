<?php

namespace App\Models\Central;

use Illuminate\Database\Eloquent\Model;

class TenantSetting extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_id',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
