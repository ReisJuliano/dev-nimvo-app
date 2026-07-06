<?php

namespace Tests\Unit;

use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Services\Tenant\PromotionEngine;
use PHPUnit\Framework\TestCase;

class PromotionEngineTest extends TestCase
{
    protected function product(int $id, ?int $categoryId = null): Product
    {
        $product = new Product(['category_id' => $categoryId]);
        $product->id = $id;

        return $product;
    }

    protected function promotion(array $attributes): Promotion
    {
        $promotion = new Promotion($attributes);
        $promotion->id = $attributes['id'] ?? 1;

        return $promotion;
    }

    public function test_buy_x_pay_y_charges_for_the_correct_number_of_units(): void
    {
        $engine = new PromotionEngine();
        $product = $this->product(1);

        $promotion = $this->promotion([
            'type' => 'buy_x_pay_y',
            'scope' => 'product',
            'product_id' => 1,
            'active' => true,
            'config' => ['buy_quantity' => 3, 'pay_quantity' => 2],
        ]);

        // 7 unidades: 2 grupos de 3 pagando 2 (paga 4) + resto de 1 = paga 5 no total.
        $result = $engine->evaluateLine($product, quantity: 7, unitPrice: 10.0, promotions: collect([$promotion]));

        $this->assertSame($promotion->id, $result['promotion_id']);
        $this->assertSame(20.0, $result['promotion_discount']);
        $this->assertEqualsWithDelta(50 / 7, $result['promotion_effective_unit_price'], 0.001);
    }

    public function test_quantity_discount_applies_the_highest_matching_tier(): void
    {
        $engine = new PromotionEngine();
        $product = $this->product(2);

        $promotion = $this->promotion([
            'type' => 'quantity_discount',
            'scope' => 'product',
            'product_id' => 2,
            'active' => true,
            'config' => ['tiers' => [
                ['min_quantity' => 1, 'unit_price' => 5.0],
                ['min_quantity' => 3, 'unit_price' => 4.5],
            ]],
        ]);

        $result = $engine->evaluateLine($product, quantity: 4, unitPrice: 5.0, promotions: collect([$promotion]));

        $this->assertSame(4.5, $result['promotion_effective_unit_price']);
        $this->assertSame(2.0, $result['promotion_discount']);
    }

    public function test_promo_price_is_ignored_when_it_is_not_actually_cheaper(): void
    {
        $engine = new PromotionEngine();
        $product = $this->product(3);

        $promotion = $this->promotion([
            'type' => 'promo_price',
            'scope' => 'product',
            'product_id' => 3,
            'active' => true,
            'discount_value' => 12.0,
        ]);

        $result = $engine->evaluateLine($product, quantity: 2, unitPrice: 10.0, promotions: collect([$promotion]));

        $this->assertNull($result['promotion_id']);
        $this->assertSame(0.0, $result['promotion_discount']);
    }

    public function test_product_scoped_promotion_wins_over_category_scoped(): void
    {
        $engine = new PromotionEngine();
        $product = $this->product(4, categoryId: 9);

        $categoryPromo = $this->promotion([
            'id' => 1,
            'type' => 'category_discount',
            'scope' => 'category',
            'category_id' => 9,
            'active' => true,
            'discount_value' => 50.0,
        ]);

        $productPromo = $this->promotion([
            'id' => 2,
            'type' => 'promo_price',
            'scope' => 'product',
            'product_id' => 4,
            'active' => true,
            'discount_value' => 9.0,
        ]);

        $result = $engine->evaluateLine($product, quantity: 1, unitPrice: 10.0, promotions: collect([$categoryPromo, $productPromo]));

        $this->assertSame(2, $result['promotion_id']);
    }

    public function test_the_best_discount_wins_among_multiple_applicable_product_promotions(): void
    {
        $engine = new PromotionEngine();
        $product = $this->product(5);

        $weakPromo = $this->promotion([
            'id' => 1,
            'type' => 'promo_price',
            'scope' => 'product',
            'product_id' => 5,
            'active' => true,
            'discount_value' => 9.0,
        ]);

        $strongPromo = $this->promotion([
            'id' => 2,
            'type' => 'promo_price',
            'scope' => 'product',
            'product_id' => 5,
            'active' => true,
            'discount_value' => 6.0,
        ]);

        $result = $engine->evaluateLine($product, quantity: 1, unitPrice: 10.0, promotions: collect([$weakPromo, $strongPromo]));

        $this->assertSame(2, $result['promotion_id']);
        $this->assertSame(4.0, $result['promotion_discount']);
    }

    public function test_weekday_restricted_promotion_only_applies_on_matching_days(): void
    {
        $engine = new PromotionEngine();
        $product = $this->product(6);

        $monday = \Illuminate\Support\Carbon::parse('2026-07-06'); // segunda-feira
        $tuesday = \Illuminate\Support\Carbon::parse('2026-07-07'); // terca-feira

        $promotion = $this->promotion([
            'type' => 'promo_price',
            'scope' => 'product',
            'product_id' => 6,
            'active' => true,
            'discount_value' => 5.0,
            'weekdays' => [1],
        ]);

        $onMonday = $engine->evaluateLine($product, quantity: 1, unitPrice: 10.0, promotions: collect([$promotion]), now: $monday);
        $onTuesday = $engine->evaluateLine($product, quantity: 1, unitPrice: 10.0, promotions: collect([$promotion]), now: $tuesday);

        $this->assertNotNull($onMonday['promotion_id']);
        $this->assertNull($onTuesday['promotion_id']);
    }
}
