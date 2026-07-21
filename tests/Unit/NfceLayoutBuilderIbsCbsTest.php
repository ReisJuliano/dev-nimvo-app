<?php

namespace Tests\Unit;

use App\Support\NfceLayoutBuilder;
use Tests\TestCase;

class NfceLayoutBuilderIbsCbsTest extends TestCase
{
    public function test_it_omits_the_ibscbs_group_when_reforma_flag_is_off(): void
    {
        $payload = $this->basePayload();
        $payload['items'][0]['ibs_cbs_cst'] = '000';
        $payload['items'][0]['c_class_trib'] = '000001';

        $xml = (new NfceLayoutBuilder())->build($payload);

        $this->assertStringNotContainsString('<IBSCBS>', $xml);
    }

    public function test_it_omits_the_ibscbs_group_when_product_has_no_cst_or_class_trib(): void
    {
        $payload = $this->basePayload();
        $payload['flags'] = ['reforma_enabled' => true];

        $xml = (new NfceLayoutBuilder())->build($payload);

        $this->assertStringNotContainsString('<IBSCBS>', $xml);
    }

    public function test_it_includes_the_ibscbs_group_with_cst_and_class_trib_when_configured(): void
    {
        $payload = $this->basePayload();
        $payload['flags'] = ['reforma_enabled' => true];
        $payload['items'][0]['ibs_cbs_cst'] = '000';
        $payload['items'][0]['c_class_trib'] = '000001';

        $xml = (new NfceLayoutBuilder())->build($payload);

        $this->assertStringContainsString('<IBSCBS>', $xml);
        $this->assertStringContainsString('<CST>000</CST>', $xml);
        $this->assertStringContainsString('<cClassTrib>000001</cClassTrib>', $xml);
        // v1 nao emite base de calculo/aliquota - so o destaque informativo (CST + cClassTrib).
        $this->assertStringNotContainsString('<gIBSCBS>', $xml);
    }

    public function test_a_normal_emission_stays_byte_identical_with_the_flag_off_regardless_of_product_configuration(): void
    {
        $payloadWithoutIbsCbsData = $this->basePayload();

        $payloadWithConfiguredProduct = $this->basePayload();
        $payloadWithConfiguredProduct['items'][0]['ibs_cbs_cst'] = '000';
        $payloadWithConfiguredProduct['items'][0]['c_class_trib'] = '000001';

        $xmlWithout = (new NfceLayoutBuilder())->build($payloadWithoutIbsCbsData);
        $xmlWithConfigured = (new NfceLayoutBuilder())->build($payloadWithConfiguredProduct);

        // Sem 'reforma_enabled' no payload (tenant que nao ligou a flag), o XML nao muda
        // nada mesmo que o produto ja tenha CST/cClassTrib cadastrados - zero regressao.
        $this->assertSame(
            preg_replace('/<cNF>\d+<\/cNF>/', '', $xmlWithout),
            preg_replace('/<cNF>\d+<\/cNF>/', '', $xmlWithConfigured),
        );
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
