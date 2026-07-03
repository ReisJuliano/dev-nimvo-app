<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalePayment extends Model
{
    use UsesTenantConnection;

    protected $fillable = ['sale_id', 'payment_method', 'amount', 'payment_details'];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_details' => 'array',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }
}
