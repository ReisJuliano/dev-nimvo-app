<?php

namespace App\Models\Central;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TenantLicenseInvoice extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'tenant_license_id',
        'reference',
        'period_start',
        'period_end',
        'due_date',
        'amount',
        'status',
        'payment_method',
        'gateway_driver',
        'gateway_reference',
        'boleto_url',
        'pix_payload',
        'paid_at',
        'metadata',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'due_date' => 'date',
        'amount' => 'decimal:2',
        'pix_payload' => 'array',
        'paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function license(): BelongsTo
    {
        return $this->belongsTo(TenantLicense::class, 'tenant_license_id');
    }
}
