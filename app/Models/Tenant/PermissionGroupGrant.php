<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PermissionGroupGrant extends Model
{
    use UsesTenantConnection;

    public $timestamps = false;

    protected $fillable = [
        'permission_group_id',
        'permission_key',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function permissionGroup(): BelongsTo
    {
        return $this->belongsTo(PermissionGroup::class);
    }
}
