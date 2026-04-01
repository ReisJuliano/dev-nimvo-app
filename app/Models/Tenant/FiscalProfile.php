<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalProfile extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'active',
        'environment',
        'invoice_model',
        'operation_nature',
        'series',
        'next_number',
        'company_name',
        'trade_name',
        'cnpj',
        'ie',
        'im',
        'cnae',
        'crt',
        'phone',
        'street',
        'number',
        'complement',
        'district',
        'city_code',
        'city_name',
        'state',
        'zip_code',
        'csc_id',
        'csc_token',
        'technical_contact_name',
        'technical_contact_email',
        'technical_contact_phone',
        'technical_contact_cnpj',
    ];

    protected $casts = [
        'active' => 'boolean',
        'environment' => 'integer',
        'series' => 'integer',
        'next_number' => 'integer',
        'csc_token' => 'encrypted',
    ];

    public function documents(): HasMany
    {
        return $this->hasMany(FiscalDocument::class, 'profile_id');
    }
}
