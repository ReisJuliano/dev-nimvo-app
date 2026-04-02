<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Purchase extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'supplier_id',
        'producer_id',
        'user_id',
        'code',
        'status',
        'expected_at',
        'received_at',
        'subtotal',
        'freight',
        'total',
        'notes',
        'stock_applied_at',
    ];

    protected $casts = [
        'expected_at' => 'date',
        'received_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'freight' => 'decimal:2',
        'total' => 'decimal:2',
        'stock_applied_at' => 'datetime',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function producer(): BelongsTo
    {
        return $this->belongsTo(Producer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function incomingNfeDocument(): HasOne
    {
        return $this->hasOne(IncomingNfeDocument::class);
    }
}
