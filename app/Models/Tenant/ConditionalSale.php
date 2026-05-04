<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConditionalSale extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'code',
        'customer_id',
        'user_id',
        'sale_id',
        'status',
        'subtotal',
        'withdrawn_at',
        'due_at',
        'closed_at',
        'notes',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'withdrawn_at' => 'datetime',
        'due_at' => 'date',
        'closed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ConditionalSaleItem::class);
    }
}
