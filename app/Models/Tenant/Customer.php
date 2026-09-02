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
        'consumer_final',
        'credit_limit',
        'cashback_balance',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
        'consumer_final' => 'boolean',
        'credit_limit' => 'decimal:2',
        'cashback_balance' => 'decimal:2',
    ];

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function conditionalSales(): HasMany
    {
        return $this->hasMany(ConditionalSale::class);
    }

    public function cashbackTransactions(): HasMany
    {
        return $this->hasMany(CashbackTransaction::class);
    }
}
