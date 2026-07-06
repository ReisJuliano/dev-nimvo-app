<?php

namespace Tests\Unit;

use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Services\Tenant\LabelPayloadService;
use App\Services\Tenant\PromotionEngine;
use PHPUnit\Framework\TestCase;

class LabelPayloadServiceTest extends TestCase
{
    protected function product(array $attributes): Product
    {
        $product = new Product($attributes);
        $product->id = $attributes['id'] ?? 1;

        return $product;
    }

    public function test_it_builds_a_plain_gondola_label(): void
    {
        $service = new LabelPayloadService(new PromotionEngine());

        $product = $this->product([
            'name' => 'Arroz 5kg',
            'code' => 'ARROZ5',
            'barcode' => '7891000100103',
            'sale_price' => 24.9,
            'sold_by' => 'unit',
        ]);

        $label = $service->build($product, 'gondola', 2);

        $this->assertSame('gondola', $label['template']);
        $this->assertSame('ean13', $label['barcode_type']);
        $this->assertSame(24.9, $label['price']);
        $this->assertSame(2, $label['copies']);
        $this->assertNull($label['promo_new_price']);
    }

    public function test_it_marks_internal_code_barcode_type_when_barcode_is_not_a_valid_ean13(): void
    {
        $service = new LabelPayloadService(new PromotionEngine());

        $product = $this->product([
            'name' => 'Produto sem EAN',
            'code' => 'INT001',
            'barcode' => null,
            'sale_price' => 10,
            'sold_by' => 'unit',
        ]);

        $label = $service->build($product, 'adesiva_interno');

        $this->assertSame('code128', $label['barcode_type']);
        $this->assertSame('INT001', $label['barcode']);
    }

    public function test_weighable_products_get_a_kg_unit_suffix(): void
    {
        $service = new LabelPayloadService(new PromotionEngine());

        $product = $this->product([
            'name' => 'Mortadela',
            'code' => 'MORT',
            'barcode' => '7891000100103',
            'sale_price' => 39.9,
            'sold_by' => 'weight',
        ]);

        $label = $service->build($product, 'gondola');

        $this->assertTrue($label['weighable']);
        $this->assertSame('KG', $label['unit_label']);
    }

    public function test_oferta_template_fills_de_por_when_a_promotion_applies(): void
    {
        $product = $this->product([
            'name' => 'Refrigerante',
            'code' => 'REFRI',
            'barcode' => '7891000100103',
            'sale_price' => 8.0,
            'sold_by' => 'unit',
        ]);

        $promotion = new Promotion([
            'type' => 'promo_price',
            'scope' => 'product',
            'product_id' => 1,
            'active' => true,
            'discount_value' => 6.0,
        ]);
        $promotion->id = 1;

        $engine = $this->getMockBuilder(PromotionEngine::class)->onlyMethods(['evaluateLine'])->getMock();
        $engine->method('evaluateLine')->willReturn([
            'promotion_id' => 1,
            'promotion_name' => 'Oferta',
            'promotion_discount' => 2.0,
            'promotion_effective_unit_price' => 6.0,
        ]);

        $service = new LabelPayloadService($engine);
        $label = $service->build($product, 'oferta');

        $this->assertSame(8.0, $label['promo_old_price']);
        $this->assertSame(6.0, $label['promo_new_price']);
    }
}
