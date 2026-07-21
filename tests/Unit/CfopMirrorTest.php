<?php

namespace Tests\Unit;

use App\Support\CfopMirror;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class CfopMirrorTest extends TestCase
{
    public static function saleCfopProvider(): array
    {
        return [
            ['5101', '1201'],
            ['6101', '2201'],
            ['5102', '1202'],
            ['6102', '2202'],
            ['5405', '1411'],
            ['6405', '2411'],
        ];
    }

    #[DataProvider('saleCfopProvider')]
    public function test_it_mirrors_sale_cfop_to_the_matching_return_cfop(string $original, string $expected): void
    {
        $this->assertSame($expected, (new CfopMirror())->mirrorForSaleReturn($original));
    }

    public static function purchaseCfopProvider(): array
    {
        return [
            ['1101', '5201'],
            ['2101', '6201'],
            ['1102', '5202'],
            ['2102', '6202'],
            ['1401', '5411'],
            ['2401', '6411'],
        ];
    }

    #[DataProvider('purchaseCfopProvider')]
    public function test_it_mirrors_purchase_cfop_to_the_matching_return_cfop(string $original, string $expected): void
    {
        $this->assertSame($expected, (new CfopMirror())->mirrorForPurchaseReturn($original));
    }

    public function test_it_throws_for_an_unmapped_sale_cfop(): void
    {
        $this->expectException(RuntimeException::class);

        (new CfopMirror())->mirrorForSaleReturn('9999');
    }

    public function test_it_throws_for_an_unmapped_purchase_cfop(): void
    {
        $this->expectException(RuntimeException::class);

        (new CfopMirror())->mirrorForPurchaseReturn('9999');
    }
}
