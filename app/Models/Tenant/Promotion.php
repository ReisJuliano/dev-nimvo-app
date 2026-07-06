<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Promotion extends Model
{
    use UsesTenantConnection;

    public const CORE_TYPES = ['promo_price', 'buy_x_pay_y', 'quantity_discount', 'category_discount'];

    protected $fillable = [
        'name',
        'description',
        'type',
        'scope',
        'product_id',
        'category_id',
        'collection',
        'discount_value',
        'config',
        'highlight_text',
        'start_at',
        'end_at',
        'weekdays',
        'active',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'config' => 'array',
        'weekdays' => 'array',
        'active' => 'boolean',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function statusLabel(): string
    {
        if (!$this->active) {
            return 'inativa';
        }

        $now = now();

        if ($this->start_at && $this->start_at->isFuture()) {
            return 'agendada';
        }

        if ($this->end_at && $this->end_at->isPast()) {
            return 'expirada';
        }

        return 'ativa';
    }
}
