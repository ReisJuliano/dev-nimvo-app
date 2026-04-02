<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'document',
        'document_type',
        'phone',
        'email',
        'state_registration',
        'street',
        'number',
        'complement',
        'district',
        'city_name',
        'city_code',
        'state',
        'zip_code',
        'credit_limit',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'credit_limit' => 'decimal:2',
    ];

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
