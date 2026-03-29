<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;

class AppSetting extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'key',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
