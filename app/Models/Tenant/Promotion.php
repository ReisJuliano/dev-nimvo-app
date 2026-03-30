<?php

namespace App\Models\Tenant;

use App\Models\Tenant\Concerns\UsesTenantConnection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Promotion extends Model
{
    use UsesTenantConnection;

    protected $fillable = [
        'name',
        'description',
        'type',
        'scope',
        'product_id',
        'category_id',
        'collection',
        'discount_value',
        'highlight_text',
        'start_at',
        'end_at',
        'active',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
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
}
