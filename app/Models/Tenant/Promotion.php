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
        'campaign_id',
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

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(PromotionCampaign::class, 'campaign_id');
    }

    public function statusLabel(): string
    {
        if (!$this->active) {
            return 'inativa';
        }

        $now = now();

        if ($this->campaign && !$this->campaign->active) {
            return 'inativa';
        }

        if ($this->campaign?->ends_at?->isPast()) {
            return 'expirada';
        }

        if ($this->start_at && $this->start_at->isFuture()) {
            return 'agendada';
        }

        if ($this->end_at && $this->end_at->isPast()) {
            return 'expirada';
        }

        return 'ativa';
    }

    public function toDisplayArray(): array
    {
        return [
            'id' => $this->id,
            'campaign_id' => $this->campaign_id,
            'campaign_name' => $this->campaign?->name,
            'name' => $this->name,
            'description' => $this->description,
            'type' => $this->type,
            'scope' => $this->scope,
            'product_id' => $this->product_id,
            'product_name' => $this->product?->name,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name,
            'discount_value' => (float) $this->discount_value,
            'config' => $this->config,
            'highlight_text' => $this->highlight_text,
            'start_at' => $this->start_at?->format('Y-m-d\TH:i'),
            'end_at' => $this->end_at?->format('Y-m-d\TH:i'),
            'weekdays' => $this->weekdays,
            'active' => $this->active,
            'status' => $this->statusLabel(),
            'offer_summary' => $this->offerSummary(),
        ];
    }

    /**
     * Resumo legível da oferta ("De R$ 12,90 por R$ 9,90", "Leve 3 pague 2"...)
     * — usado na API, na tabela de promoções avulsas e no PDF do tabloide.
     */
    public function offerSummary(): string
    {
        return match ($this->type) {
            'promo_price' => $this->product
                ? sprintf('De %s por %s', $this->formatMoney((float) $this->product->sale_price), $this->formatMoney((float) $this->discount_value))
                : sprintf('Por %s', $this->formatMoney((float) $this->discount_value)),
            'buy_x_pay_y' => sprintf(
                'Leve %d pague %d',
                (int) data_get($this->config, 'buy_quantity', 0),
                (int) data_get($this->config, 'pay_quantity', 0),
            ),
            'quantity_discount' => $this->quantityDiscountSummary(),
            'category_discount' => sprintf(
                '%s%% off%s',
                $this->trimDecimal((float) $this->discount_value),
                $this->category ? " em {$this->category->name}" : '',
            ),
            default => $this->highlight_text ?: $this->name,
        };
    }

    protected function quantityDiscountSummary(): string
    {
        $tiers = collect((array) data_get($this->config, 'tiers', []))
            ->sortBy(fn (array $tier) => (float) ($tier['min_quantity'] ?? 0));

        $first = $tiers->first();

        if (!$first) {
            return $this->name;
        }

        return sprintf(
            'A partir de %sun: %s',
            $this->trimDecimal((float) $first['min_quantity']),
            $this->formatMoney((float) $first['unit_price']),
        );
    }

    protected function trimDecimal(float $value): string
    {
        return rtrim(rtrim(number_format($value, 2, ',', '.'), '0'), ',');
    }

    protected function formatMoney(float $value): string
    {
        return 'R$ '.number_format($value, 2, ',', '.');
    }
}
