<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use Notifiable;
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'username',
        'password',
        'discount_authorization_password',
        'role',
        'permission_group_id',
        'is_supervisor',
        'active',
        'must_change_password',
    ];

    protected $hidden = [
        'password',
        'discount_authorization_password',
        'remember_token',
    ];

    protected $casts = [
        'active' => 'boolean',
        'is_supervisor' => 'boolean',
        'must_change_password' => 'boolean',
    ];

    public function getAuthPassword(): string
    {
        return $this->password;
    }

    public function permissionGroup(): BelongsTo
    {
        return $this->belongsTo(PermissionGroup::class);
    }

    public function permissionOverrides(): HasMany
    {
        return $this->hasMany(UserPermissionOverride::class);
    }

    public function hasPermission(string $key): bool
    {
        $override = $this->permissionOverrides->firstWhere('permission_key', $key);

        if ($override) {
            return (bool) $override->granted;
        }

        return in_array($key, $this->permissionGroup?->permissionKeys() ?? [], true);
    }
}
