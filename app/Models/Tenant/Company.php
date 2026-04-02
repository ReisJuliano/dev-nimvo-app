<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'trade_name',
        'document',
        'document_type',
        'email',
        'phone',
        'state_registration',
        'street',
        'number',
        'complement',
        'district',
        'city_name',
        'city_code',
        'state',
        'zip_code',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
