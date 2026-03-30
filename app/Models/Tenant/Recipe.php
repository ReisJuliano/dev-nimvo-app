<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recipe extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'product_id',
        'code',
        'name',
        'yield_quantity',
        'yield_unit',
        'prep_time_minutes',
        'instructions',
        'active',
    ];

    protected $casts = [
        'yield_quantity' => 'decimal:3',
        'prep_time_minutes' => 'integer',
        'active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(RecipeItem::class);
    }

    public function productionOrders(): HasMany
    {
        return $this->hasMany(ProductionOrder::class);
    }
}
