<?php

namespace Tests\Unit;

use App\Services\Tenant\ScaleBarcodeService;
use App\Services\Tenant\TenantSettingsService;
use PHPUnit\Framework\TestCase;

class ScaleBarcodeServiceTest extends TestCase
{
    protected function defaultSettings(): array
    {
        return [
            'prefix' => '2',
            'type' => 'price_embedded',
            'code_length' => 6,
            'value_length' => 5,
        ];
    }

    protected function service(): ScaleBarcodeService
    {
        return new ScaleBarcodeService(new TenantSettingsService());
    }

    public function test_it_decodes_a_price_embedded_barcode(): void
    {
        $decoded = $this->service()->decode('2000123012971', $this->defaultSettings());

        $this->assertNotNull($decoded);
        $this->assertSame(123, $decoded['scale_code']);
        $this->assertSame(1297, $decoded['raw_value']);
        $this->assertSame('price_embedded', $decoded['type']);
    }

    public function test_it_decodes_a_weight_embedded_barcode(): void
    {
        $settings = [...$this->defaultSettings(), 'type' => 'weight_embedded'];

        $decoded = $this->service()->decode('2000123003252', $settings);

        $this->assertNotNull($decoded);
        $this->assertSame(123, $decoded['scale_code']);
        $this->assertSame(325, $decoded['raw_value']);
        $this->assertSame('weight_embedded', $decoded['type']);
    }

    public function test_it_rejects_a_barcode_with_an_invalid_check_digit(): void
    {
        $decoded = $this->service()->decode('2000123012970', $this->defaultSettings());

        $this->assertNull($decoded);
    }

    public function test_it_rejects_a_barcode_with_the_wrong_prefix(): void
    {
        $decoded = $this->service()->decode('7891000100103', $this->defaultSettings());

        $this->assertNull($decoded);
    }

    public function test_it_rejects_non_numeric_or_wrong_length_input(): void
    {
        $this->assertNull($this->service()->decode('ABC', $this->defaultSettings()));
        $this->assertNull($this->service()->decode('200012301297', $this->defaultSettings()));
    }

    public function test_it_falls_back_gracefully_when_configured_lengths_do_not_add_up(): void
    {
        $settings = [...$this->defaultSettings(), 'code_length' => 10];

        $decoded = $this->service()->decode('2000123012971', $settings);

        $this->assertNull($decoded);
    }

    public function test_ean13_check_digit_validation(): void
    {
        $service = $this->service();

        $this->assertTrue($service->isValidEan13('2000123012971'));
        $this->assertTrue($service->isValidEan13('7891000100103'));
        $this->assertFalse($service->isValidEan13('7891000100100'));
    }
}
