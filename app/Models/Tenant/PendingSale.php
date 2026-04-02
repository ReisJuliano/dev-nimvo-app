<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PendingSale extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'user_id',
        'cash_register_id',
        'order_draft_id',
        'customer_id',
        'company_id',
        'cart_payload',
        'discount_payload',
        'payment_payload',
        'notes',
        'status',
        'restored_at',
    ];

    protected $casts = [
        'cart_payload' => 'array',
        'discount_payload' => 'array',
        'payment_payload' => 'array',
        'restored_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cashRegister(): BelongsTo
    {
        return $this->belongsTo(CashRegister::class);
    }

    public function orderDraft(): BelongsTo
    {
        return $this->belongsTo(OrderDraft::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
