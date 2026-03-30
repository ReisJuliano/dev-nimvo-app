<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceOrder extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'customer_id',
        'user_id',
        'code',
        'status',
        'equipment',
        'issue_description',
        'diagnosis',
        'resolution',
        'technician_name',
        'labor_total',
        'parts_total',
        'total',
        'due_at',
        'closed_at',
        'notes',
    ];

    protected $casts = [
        'labor_total' => 'decimal:2',
        'parts_total' => 'decimal:2',
        'total' => 'decimal:2',
        'due_at' => 'date',
        'closed_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(ServiceOrderItem::class);
    }
}
