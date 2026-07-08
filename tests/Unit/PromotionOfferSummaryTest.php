<?php

namespace Tests\Unit;

use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use PHPUnit\Framework\TestCase;

class PromotionOfferSummaryTest extends TestCase
{
    public function test_promo_price_shows_de_por(): void
    {
        $promotion = new Promotion(['type' => 'promo_price', 'discount_value' => 9.90]);
        $promotion->setRelation('product', new Product(['sale_price' => 12.90]));

        $this->assertSame('De R$ 12,90 por R$ 9,90', $promotion->offerSummary());
    }

    public function test_promo_price_without_product_falls_back_to_por(): void
    {
        $promotion = new Promotion(['type' => 'promo_price', 'discount_value' => 9.90]);
        $promotion->setRelation('product', null);

        $this->assertSame('Por R$ 9,90', $promotion->offerSummary());
    }

    public function test_buy_x_pay_y_shows_leve_pague(): void
    {
        $promotion = new Promotion([
            'type' => 'buy_x_pay_y',
            'config' => ['buy_quantity' => 3, 'pay_quantity' => 2],
        ]);

        $this->assertSame('Leve 3 pague 2', $promotion->offerSummary());
    }

    public function test_quantity_discount_shows_lowest_tier(): void
    {
        $promotion = new Promotion([
            'type' => 'quantity_discount',
            'config' => ['tiers' => [
                ['min_quantity' => 10, 'unit_price' => 3.50],
                ['min_quantity' => 3, 'unit_price' => 4.50],
            ]],
        ]);

        $this->assertSame('A partir de 3un: R$ 4,50', $promotion->offerSummary());
    }

    public function test_category_discount_shows_percent_off_with_category_name(): void
    {
        $promotion = new Promotion(['type' => 'category_discount', 'discount_value' => 20]);
        $promotion->setRelation('category', new Category(['name' => 'Bebidas']));

        $this->assertSame('20% off em Bebidas', $promotion->offerSummary());
    }

    public function test_category_discount_trims_trailing_zero_decimals(): void
    {
        $promotion = new Promotion(['type' => 'category_discount', 'discount_value' => 12.50]);
        $promotion->setRelation('category', null);

        $this->assertSame('12,5% off', $promotion->offerSummary());
    }
}
