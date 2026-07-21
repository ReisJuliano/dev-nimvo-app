<?php

namespace Tests\Unit;

use App\Support\NfceLayoutBuilder;
use Tests\TestCase;

class NfceLayoutBuilderReturnTest extends TestCase
{
    public function test_it_builds_a_normal_document_with_finalidade_1_and_no_nfref(): void
    {
        $xml = (new NfceLayoutBuilder())->build($this->basePayload());

        $this->assertStringContainsString('<finNFe>1</finNFe>', $xml);
        $this->assertStringContainsString('<tpNF>1</tpNF>', $xml);
        $this->assertStringNotContainsString('<NFref>', $xml);
    }

    public function test_it_builds_a_return_document_with_finalidade_4_and_a_single_nfref(): void
    {
        $payload = $this->basePayload();
        $payload['sale']['finalidade'] = 4;
        $payload['sale']['operation_type'] = 0;
        $payload['sale']['referencias'] = ['35260412345678000123550010000000011000000019'];

        $xml = (new NfceLayoutBuilder())->build($payload);

        $this->assertStringContainsString('<finNFe>4</finNFe>', $xml);
        $this->assertStringContainsString('<tpNF>0</tpNF>', $xml);
        $this->assertStringContainsString('<NFref>', $xml);
        $this->assertStringContainsString('<refNFe>35260412345678000123550010000000011000000019</refNFe>', $xml);
    }

    public function test_it_builds_multiple_nfref_tags_for_multiple_references(): void
    {
        $payload = $this->basePayload();
        $payload['sale']['finalidade'] = 4;
        $payload['sale']['referencias'] = [
            '35260412345678000123550010000000011000000019',
            '35260412345678000123550010000000012000000020',
        ];

        $xml = (new NfceLayoutBuilder())->build($payload);

        $this->assertSame(2, substr_count($xml, '<NFref>'));
        $this->assertStringContainsString('<refNFe>35260412345678000123550010000000011000000019</refNFe>', $xml);
        $this->assertStringContainsString('<refNFe>35260412345678000123550010000000012000000020</refNFe>', $xml);
    }

    public function test_it_ignores_blank_reference_entries(): void
    {
        $payload = $this->basePayload();
        $payload['sale']['finalidade'] = 4;
        $payload['sale']['referencias'] = ['', '   ', '35260412345678000123550010000000011000000019'];

        $xml = (new NfceLayoutBuilder())->build($payload);

        $this->assertSame(1, substr_count($xml, '<NFref>'));
    }

    protected function basePayload(): array
    {
        return [
            'profile' => [
                'environment' => 2,
                'state' => 'SP',
                'operation_nature' => 'VENDA',
                'company_name' => 'Loja Teste LTDA',
                'trade_name' => 'Loja Teste',
                'ie' => '123456789',
                'im' => null,
                'cnae' => '4781400',
                'crt' => 1,
                'cnpj' => '12345678000123',
                'street' => 'Rua Teste',
                'number' => '100',
                'complement' => null,
                'district' => 'Centro',
                'city_code' => '3550308',
                'city_name' => 'Sao Paulo',
                'zip_code' => '01001000',
                'phone' => '11999999999',
                'technical_contact_cnpj' => null,
                'technical_contact_name' => null,
                'technical_contact_email' => null,
                'technical_contact_phone' => null,
            ],
            'sale' => [
                'random_code' => '12345678',
                'series' => 1,
                'number' => 42,
                'issued_at' => now()->format('Y-m-d\TH:i:sP'),
                'emission_type' => 1,
                'id_destination' => 1,
                'print_type' => 1,
                'consumer_final' => 1,
                'presence_indicator' => 1,
                'total' => 50.0,
                'requested_document_model' => '65',
            ],
            'items' => [
                [
                    'code' => 'PROD-1',
                    'barcode' => '7891234567895',
                    'name' => 'Produto Teste',
                    'ncm' => '61091000',
                    'cest' => null,
                    'cfop' => '5102',
                    'commercial_unit' => 'UN',
                    'unit' => 'UN',
                    'taxable_unit' => 'UN',
                    'quantity' => 1,
                    'unit_price' => 50.0,
                    'total' => 50.0,
                    'line_subtotal' => 50.0,
                    'discount_amount' => 0,
                    'origin_code' => '0',
                    'icms_csosn' => '102',
                    'pis_cst' => '49',
                    'pis_base' => 50.0,
                    'pis_amount' => 0,
                    'pis_rate' => 0,
                    'cofins_cst' => '49',
                    'cofins_base' => 50.0,
                    'cofins_amount' => 0,
                    'cofins_rate' => 0,
                    'ipi_amount' => 0,
                    'tax_total' => 0,
                ],
            ],
            'payments' => [
                [
                    'indPag' => 0,
                    'tPag' => '01',
                    'xPag' => null,
                    'amount' => 50.0,
                ],
            ],
            'consumer' => [],
            'additional_info' => null,
        ];
    }
}
