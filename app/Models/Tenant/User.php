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
        'role',
        'active',
        'must_change_password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'active' => 'boolean',
        'must_change_password' => 'boolean',
    ];

    public function getAuthPassword(): string
    {
        return $this->password;
    }
}
