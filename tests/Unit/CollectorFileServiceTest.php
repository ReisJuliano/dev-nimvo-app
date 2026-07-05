<?php

namespace Tests\Unit;

use App\Services\Tenant\Inventory\CollectorFileService;
use App\Services\Tenant\Inventory\InventorySessionService;
use App\Services\Tenant\ScaleBarcodeService;
use App\Services\Tenant\TenantSettingsService;
use PHPUnit\Framework\TestCase;

class CollectorFileServiceTest extends TestCase
{
    protected function service(): CollectorFileService
    {
        $settingsService = new TenantSettingsService();

        return new CollectorFileService(
            new ScaleBarcodeService($settingsService),
            $settingsService,
            new InventorySessionService(),
        );
    }

    protected function delimitedConfig(): array
    {
        return [
            'format' => 'delimited',
            'has_header' => false,
            'delimiter' => ';',
            'decimal_separator' => ',',
            'fields' => [
                ['name' => 'barcode', 'position' => 1],
                ['name' => 'quantity', 'position' => 2],
            ],
        ];
    }

    protected function fixedWidthConfig(): array
    {
        return [
            'format' => 'fixed_width',
            'fields' => [
                ['name' => 'barcode', 'start' => 1, 'length' => 14],
                ['name' => 'quantity', 'start' => 15, 'length' => 10, 'implied_decimals' => 3],
            ],
        ];
    }

    public function test_it_parses_a_delimited_file(): void
    {
        $contents = "7891000100103;12,5\r\n7891000100200;3\r\n";

        $result = $this->service()->parseLines($contents, $this->delimitedConfig());

        $this->assertCount(2, $result['lines']);
        $this->assertSame('7891000100103', $result['lines'][0]['barcode']);
        $this->assertSame(12.5, $result['lines'][0]['quantity']);
        $this->assertSame(3.0, $result['lines'][1]['quantity']);
    }

    public function test_it_parses_a_fixed_width_file_with_implied_decimals(): void
    {
        $line = '00000000012345'.'0000012500';

        $result = $this->service()->parseLines($line, $this->fixedWidthConfig());

        $this->assertCount(1, $result['lines']);
        $this->assertSame('00000000012345', $result['lines'][0]['barcode']);
        $this->assertSame(12.5, $result['lines'][0]['quantity']);
    }

    public function test_it_treats_crlf_and_lf_line_endings_the_same(): void
    {
        $crlf = "7891000100103;1\r\n7891000100200;2\r\n";
        $lf = "7891000100103;1\n7891000100200;2\n";

        $resultCrlf = $this->service()->parseLines($crlf, $this->delimitedConfig());
        $resultLf = $this->service()->parseLines($lf, $this->delimitedConfig());

        $this->assertSame($resultCrlf['lines'], $resultLf['lines']);
        $this->assertCount(2, $resultLf['lines']);
    }

    public function test_it_converts_iso_8859_1_encoding_to_utf8(): void
    {
        $latin1 = mb_convert_encoding('café com açúcar', 'ISO-8859-1', 'UTF-8');

        $converted = $this->service()->normalizeEncoding($latin1, 'ISO-8859-1');

        $this->assertSame('café com açúcar', $converted);
    }

    public function test_it_skips_header_when_configured(): void
    {
        $config = [...$this->delimitedConfig(), 'has_header' => true];
        $contents = "codigo;quantidade\n7891000100103;1\n";

        $result = $this->service()->parseLines($contents, $config);

        $this->assertCount(1, $result['lines']);
        $this->assertSame('7891000100103', $result['lines'][0]['barcode']);
    }

    public function test_it_sums_duplicate_lines_of_the_same_product(): void
    {
        $lines = [
            ['line_number' => 1, 'barcode' => '7891000100103', 'internal_code' => null, 'quantity' => 2.0],
            ['line_number' => 2, 'barcode' => '007891000100103', 'internal_code' => null, 'quantity' => 3.0],
            ['line_number' => 3, 'barcode' => '7891000100200', 'internal_code' => null, 'quantity' => 1.0],
        ];

        $aggregated = $this->service()->aggregateLines($lines);

        $this->assertCount(2, $aggregated);

        $first = collect($aggregated)->firstWhere('barcode', '7891000100103');
        $this->assertSame(5.0, $first['quantity']);
        $this->assertSame(2, $first['line_count']);
    }

    public function test_it_resolves_a_scale_ean_to_its_scale_code_instead_of_the_literal_barcode(): void
    {
        $scaleSettings = ['prefix' => '2', 'type' => 'price_embedded', 'code_length' => 6, 'value_length' => 5];

        $matchKey = $this->service()->resolveMatchKey('2000123012971', $scaleSettings);

        $this->assertSame('scale_code', $matchKey['type']);
        $this->assertSame(123, $matchKey['value']);
    }

    public function test_it_falls_back_to_the_literal_code_for_a_regular_barcode(): void
    {
        $scaleSettings = ['prefix' => '2', 'type' => 'price_embedded', 'code_length' => 6, 'value_length' => 5];

        $matchKey = $this->service()->resolveMatchKey('7891000100103', $scaleSettings);

        $this->assertSame('code', $matchKey['type']);
        $this->assertSame('7891000100103', $matchKey['value']);
    }
}
