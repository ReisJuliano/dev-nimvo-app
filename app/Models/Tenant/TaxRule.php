<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use App\Services\Tenant\Fiscal\TaxRuleResolver;
use Illuminate\Database\Eloquent\Model;

class TaxRule extends Model
{
    use UsesTenantConnection;

    protected static function booted(): void
    {
        static::saved(fn () => app(TaxRuleResolver::class)->forgetCache());
        static::deleted(fn () => app(TaxRuleResolver::class)->forgetCache());
    }

    protected $fillable = [
        'name',
        'active',
        'regime',
        'ncm_pattern',
        'cfop',
        'uf_origem',
        'uf_destino',
        'origin_code',
        'csosn',
        'cst_icms',
        'icms_rate',
        'st_mva',
        'st_fcp',
        'pis_cst',
        'pis_rate',
        'cofins_cst',
        'cofins_rate',
        'ibs_cbs_cst',
        'c_class_trib',
        'priority',
        'notes',
    ];

    protected $casts = [
        'active' => 'boolean',
        'icms_rate' => 'decimal:2',
        'st_mva' => 'decimal:2',
        'st_fcp' => 'decimal:2',
        'pis_rate' => 'decimal:4',
        'cofins_rate' => 'decimal:4',
        'priority' => 'integer',
    ];
}
