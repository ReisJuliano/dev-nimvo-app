<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class PromotionEngine
{
    /**
     * Avalia uma coleção de linhas de carrinho e anexa a melhor promoção
     * aplicável a cada uma (produto vence categoria; entre aplicáveis, a de
     * maior benefício ao cliente vence; nunca acumula).
     *
     * @param  Collection<int, array{product: Product, quantity: float, unit_price: float}>  $lines
     * @return Collection<int, array>
     */
    public function evaluate(Collection $lines): Collection
    {
        $now = now();
        $promotions = $this->activePromotions($now);

        return $lines->map(function (array $line) use ($promotions, $now) {
            $result = $this->evaluateLine($line['product'], (float) $line['quantity'], (float) $line['unit_price'], $promotions, $now);

            return array_merge($line, $result);
        });
    }

    public function evaluateLine(Product $product, float $quantity, float $unitPrice, ?Collection $promotions = null, ?Carbon $now = null): array
    {
        $now ??= now();
        $promotions ??= $this->activePromotions($now);

        $productPromotions = $promotions->filter(fn (Promotion $promotion) => $promotion->scope === 'product'
            && (int) $promotion->product_id === $product->id
            && $this->matchesSchedule($promotion, $now));

        $categoryPromotions = $product->category_id
            ? $promotions->filter(fn (Promotion $promotion) => $promotion->scope === 'category'
                && (int) $promotion->category_id === (int) $product->category_id
                && $this->matchesSchedule($promotion, $now))
            : collect();

        $candidates = $productPromotions->isNotEmpty() ? $productPromotions : $categoryPromotions;

        $best = null;
        $bestResult = null;

        foreach ($candidates as $promotion) {
            $applied = $this->applyPromotion($promotion, $unitPrice, $quantity);

            if ($applied === null) {
                continue;
            }

            if ($bestResult === null || $applied['discount_total'] > $bestResult['discount_total']) {
                $best = $promotion;
                $bestResult = $applied;
            }
        }

        if (!$best) {
            return [
                'promotion_id' => null,
                'promotion_name' => null,
                'promotion_discount' => 0.0,
                'promotion_effective_unit_price' => $unitPrice,
            ];
        }

        return [
            'promotion_id' => $best->id,
            'promotion_name' => $best->name,
            'promotion_discount' => $bestResult['discount_total'],
            'promotion_effective_unit_price' => $bestResult['effective_unit_price'],
        ];
    }

    protected function activePromotions(Carbon $now): Collection
    {
        return Promotion::query()
            ->where('active', true)
            ->whereIn('type', Promotion::CORE_TYPES)
            ->where(fn ($query) => $query->whereNull('start_at')->orWhere('start_at', '<=', $now))
            ->where(fn ($query) => $query->whereNull('end_at')->orWhere('end_at', '>=', $now))
            ->where(fn ($query) => $query->whereNull('campaign_id')->orWhereHas('campaign', function ($campaignQuery) use ($now) {
                $campaignQuery->where('active', true)
                    ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
                    ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now));
            }))
            ->get();
    }

    protected function matchesSchedule(Promotion $promotion, Carbon $now): bool
    {
        $weekdays = (array) ($promotion->weekdays ?? []);

        if ($weekdays === []) {
            return true;
        }

        return in_array($now->isoWeekday(), array_map('intval', $weekdays), true);
    }

    protected function applyPromotion(Promotion $promotion, float $unitPrice, float $quantity): ?array
    {
        return match ($promotion->type) {
            'promo_price' => $this->applyPromoPrice($promotion, $unitPrice, $quantity),
            'buy_x_pay_y' => $this->applyBuyXPayY($promotion, $unitPrice, $quantity),
            'quantity_discount' => $this->applyQuantityDiscount($promotion, $unitPrice, $quantity),
            'category_discount' => $this->applyCategoryDiscount($promotion, $unitPrice, $quantity),
            default => null,
        };
    }

    protected function applyPromoPrice(Promotion $promotion, float $unitPrice, float $quantity): ?array
    {
        $promoPrice = (float) $promotion->discount_value;

        if ($promoPrice <= 0 || $promoPrice >= $unitPrice) {
            return null;
        }

        return [
            'effective_unit_price' => $promoPrice,
            'discount_total' => round(($unitPrice - $promoPrice) * $quantity, 2),
        ];
    }

    protected function applyBuyXPayY(Promotion $promotion, float $unitPrice, float $quantity): ?array
    {
        $buyQuantity = max(1, (int) data_get($promotion->config, 'buy_quantity', 0));
        $payQuantity = max(0, (int) data_get($promotion->config, 'pay_quantity', 0));

        if ($buyQuantity <= $payQuantity || $quantity < $buyQuantity) {
            return null;
        }

        $groups = intdiv((int) floor($quantity), $buyQuantity);
        $remainder = $quantity - ($groups * $buyQuantity);
        $paidUnits = ($groups * $payQuantity) + $remainder;
        $discountTotal = round(($quantity - $paidUnits) * $unitPrice, 2);

        if ($discountTotal <= 0) {
            return null;
        }

        $effectiveUnitPrice = $quantity > 0
            ? round((($quantity * $unitPrice) - $discountTotal) / $quantity, 4)
            : $unitPrice;

        return ['effective_unit_price' => $effectiveUnitPrice, 'discount_total' => $discountTotal];
    }

    protected function applyQuantityDiscount(Promotion $promotion, float $unitPrice, float $quantity): ?array
    {
        $tier = collect((array) data_get($promotion->config, 'tiers', []))
            ->filter(fn (array $tier) => (float) ($tier['min_quantity'] ?? 0) <= $quantity)
            ->sortByDesc(fn (array $tier) => (float) ($tier['min_quantity'] ?? 0))
            ->first();

        if (!$tier) {
            return null;
        }

        $tierPrice = (float) ($tier['unit_price'] ?? $unitPrice);

        if ($tierPrice >= $unitPrice) {
            return null;
        }

        return [
            'effective_unit_price' => $tierPrice,
            'discount_total' => round(($unitPrice - $tierPrice) * $quantity, 2),
        ];
    }

    protected function applyCategoryDiscount(Promotion $promotion, float $unitPrice, float $quantity): ?array
    {
        $percent = (float) $promotion->discount_value;

        if ($percent <= 0 || $percent >= 100) {
            return null;
        }

        $effectiveUnitPrice = round($unitPrice * (1 - $percent / 100), 4);

        return [
            'effective_unit_price' => $effectiveUnitPrice,
            'discount_total' => round(($unitPrice - $effectiveUnitPrice) * $quantity, 2),
        ];
    }
}
