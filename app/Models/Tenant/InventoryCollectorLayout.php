<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;

class InventoryCollectorLayout extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'direction',
        'format',
        'config',
        'is_default',
    ];

    protected $casts = [
        'config' => 'array',
        'is_default' => 'boolean',
    ];
}
