<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PermissionGroup extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'base_role',
    ];

    public function grants(): HasMany
    {
        return $this->hasMany(PermissionGroupGrant::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function permissionKeys(): array
    {
        return $this->grants()->pluck('permission_key')->all();
    }
}
