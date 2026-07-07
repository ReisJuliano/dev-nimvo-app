<?php

namespace Tests\Unit;

use App\Models\Tenant\LabelTemplate;
use App\Support\Labels\LegacyLabelLayoutSynthesizer;
use PHPUnit\Framework\TestCase;

class LegacyLabelLayoutSynthesizerTest extends TestCase
{
    protected function template(array $attributes): LabelTemplate
    {
        return new LabelTemplate(array_merge([
            'label_width_mm' => 66.7,
            'label_height_mm' => 25.4,
        ], $attributes));
    }

    protected function synthesizer(): LegacyLabelLayoutSynthesizer
    {
        return new LegacyLabelLayoutSynthesizer();
    }

    protected function elementsById(array $layout): array
    {
        return collect($layout['elements'])->keyBy('id')->all();
    }

    public function test_gondola_padrao_produces_border_name_price_and_barcode(): void
    {
        $template = $this->template([
            'show_name' => true,
            'show_price' => true,
            'show_promo' => false,
            'barcode_mode' => 'auto',
        ]);

        $layout = $this->synthesizer()->fromTemplate($template);
        $elements = $this->elementsById($layout);

        $this->assertSame(1, $layout['version']);
        $this->assertSame(['legacy_border', 'legacy_name', 'legacy_price', 'legacy_barcode'], array_keys($elements));
        $this->assertFalse($elements['legacy_price']['hide_when_promo_active']);
        $this->assertSame('auto', $elements['legacy_barcode']['barcode_type']);
    }

    public function test_gondola_de_oferta_adds_promo_pair_and_hides_plain_price_when_promo_active(): void
    {
        $template = $this->template([
            'show_name' => true,
            'show_price' => true,
            'show_promo' => true,
            'barcode_mode' => 'auto',
        ]);

        $layout = $this->synthesizer()->fromTemplate($template);
        $elements = $this->elementsById($layout);

        $this->assertSame(
            ['legacy_border', 'legacy_name', 'legacy_price_de', 'legacy_price_por', 'legacy_price', 'legacy_barcode'],
            array_keys($elements)
        );
        $this->assertSame('promo_old_price', $elements['legacy_price_de']['binding']);
        $this->assertSame('promo_new_price', $elements['legacy_price_por']['binding']);
        $this->assertTrue($elements['legacy_price']['hide_when_promo_active']);

        // Área do nome encolhe para abrir espaço ao bloco De/Por.
        $this->assertEqualsWithDelta(11.9, $elements['legacy_name']['height_mm'], 0.001);
    }

    public function test_adesiva_ean13_forces_barcode_type(): void
    {
        $template = $this->template([
            'show_name' => true,
            'show_price' => true,
            'show_promo' => false,
            'barcode_mode' => 'ean13',
        ]);

        $elements = $this->elementsById($this->synthesizer()->fromTemplate($template));

        $this->assertSame('ean13', $elements['legacy_barcode']['barcode_type']);
    }

    public function test_adesiva_code128_forces_barcode_type(): void
    {
        $template = $this->template([
            'show_name' => true,
            'show_price' => true,
            'show_promo' => false,
            'barcode_mode' => 'code128',
        ]);

        $elements = $this->elementsById($this->synthesizer()->fromTemplate($template));

        $this->assertSame('code128', $elements['legacy_barcode']['barcode_type']);
    }

    public function test_barcode_mode_none_omits_barcode_element(): void
    {
        $template = $this->template([
            'show_name' => true,
            'show_price' => true,
            'show_promo' => false,
            'barcode_mode' => 'none',
        ]);

        $elements = $this->elementsById($this->synthesizer()->fromTemplate($template));

        $this->assertArrayNotHasKey('legacy_barcode', $elements);
    }

    public function test_show_name_false_omits_name_element(): void
    {
        $template = $this->template([
            'show_name' => false,
            'show_price' => true,
            'show_promo' => false,
            'barcode_mode' => 'none',
        ]);

        $elements = $this->elementsById($this->synthesizer()->fromTemplate($template));

        $this->assertArrayNotHasKey('legacy_name', $elements);
    }
}
