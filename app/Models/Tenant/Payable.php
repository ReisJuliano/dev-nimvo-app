<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payable extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'purchase_id',
        'supplier_id',
        'user_id',
        'code',
        'description',
        'category',
        'status',
        'payment_method',
        'amount',
        'amount_paid',
        'due_date',
        'paid_at',
        'bank_name',
        'barcode',
        'installment_label',
        'installment_number',
        'installment_total',
        'recurrence',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'due_date' => 'date',
        'paid_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
