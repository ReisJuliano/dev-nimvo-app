<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'username',
        'password',
        'discount_authorization_password',
        'role',
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
}
