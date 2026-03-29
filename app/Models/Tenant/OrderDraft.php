<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderDraft extends Model
{
    use UsesTenantConnection;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_SENT_TO_CASHIER = 'sent_to_cashier';
    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'user_id',
        'customer_id',
        'sale_id',
        'type',
        'reference',
        'status',
        'subtotal',
        'total',
        'cost_total',
        'profit',
        'notes',
        'sent_to_cashier_at',
        'completed_at',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'total' => 'decimal:2',
        'cost_total' => 'decimal:2',
        'profit' => 'decimal:2',
        'sent_to_cashier_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderDraftItem::class);
    }
}
