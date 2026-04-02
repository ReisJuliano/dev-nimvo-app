<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'document',
        'document_type',
        'phone',
        'email',
        'trade_name',
        'state_registration',
        'city_name',
        'state',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function incomingNfeDocuments(): HasMany
    {
        return $this->hasMany(IncomingNfeDocument::class);
    }
}
