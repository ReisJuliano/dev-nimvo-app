<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\TaxRule;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class TaxRuleFiscalPayloadIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected TenantModel $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        if (!Schema::connection('central')->hasTable('local_agents')) {
            $this->artisan('migrate', ['--database' => 'central'])->run();
        }

        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();

        $this->withoutMiddleware([
            InitializeTenancyByDomain::class,
            PreventAccessFromCentralDomains::class,
        ]);

        config(['queue.default' => 'sync']);

        $this->tenant = TenantModel::query()->create([
            'id' => 'tenant-tax-rule-payload',
            'name' => 'Loja Matriz Tributaria',
            'email' => 'matriz-tributaria@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_fills_blank_product_tax_fields_from_a_matching_tax_rule(): void
    {
        TaxRule::query()->create([
            'name' => 'Regra bebidas SP',
            'ncm_pattern' => '2203',
            'csosn' => '400',
            'origin_code' => '0',
            'pis_cst' => '06',
            'pis_rate' => 1.65,
            'cofins_cst' => '06',
            'cofins_rate' => 7.6,
            'icms_rate' => 4.5,
            'ibs_cbs_cst' => '200',
            'c_class_trib' => '123456',
            'priority' => 0,
        ]);

        $user = $this->actingOperator();

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'CERVEJA-001',
            'barcode' => '7891234500028',
            'ncm' => '22030000',
            'cfop' => '5102',
            'cest' => null,
            'origin_code' => '',
            'icms_csosn' => '',
            'pis_cst' => '',
            'cofins_cst' => '',
            'name' => 'Cerveja Teste',
            'description' => null,
            'unit' => 'UN',
            'cost_price' => 3,
            'sale_price' => 8,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-TAXRULE-0001',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => 1,
            'subtotal' => 8,
            'discount' => 0,
            'total' => 8,
            'cost_total' => 3,
            'profit' => 5,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'notes' => 'Venda de teste matriz tributaria',
        ]);

        $sale->items()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_cost' => 3,
            'unit_price' => 8,
            'total' => 8,
            'profit' => 5,
        ]);

        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount' => 8,
        ]);

        $this->makeFiscalProfile();
        $this->makeAgent();

        $response = $this->postJson('/api/fiscal/documents', [
            'sale_id' => $sale->id,
        ]);

        $response->assertStatus(202);

        $document = FiscalDocument::query()->firstOrFail();

        $this->assertSame('400', data_get($document->payload, 'items.0.icms_csosn'));
        $this->assertSame('06', data_get($document->payload, 'items.0.pis_cst'));
        $this->assertSame(1.65, (float) data_get($document->payload, 'items.0.pis_rate'));
        $this->assertSame('06', data_get($document->payload, 'items.0.cofins_cst'));
        $this->assertSame(7.6, (float) data_get($document->payload, 'items.0.cofins_rate'));
        $this->assertSame(4.5, (float) data_get($document->payload, 'items.0.icms_rate'));
        $this->assertSame('200', data_get($document->payload, 'items.0.ibs_cbs_cst'));
        $this->assertSame('123456', data_get($document->payload, 'items.0.c_class_trib'));
    }

    public function test_product_own_tax_fields_take_priority_over_a_matching_tax_rule(): void
    {
        TaxRule::query()->create([
            'name' => 'Regra bebidas SP',
            'ncm_pattern' => '2203',
            'csosn' => '500',
            'pis_cst' => '06',
            'pis_rate' => 1.65,
            'cofins_cst' => '06',
            'cofins_rate' => 7.6,
            'priority' => 0,
        ]);

        $user = $this->actingOperator();

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'CERVEJA-002',
            'barcode' => '7891234500035',
            'ncm' => '22030000',
            'cfop' => '5102',
            'cest' => null,
            'origin_code' => '0',
            'icms_csosn' => '102',
            'pis_cst' => '49',
            'pis_rate' => 0,
            'cofins_cst' => '49',
            'cofins_rate' => 0,
            'name' => 'Cerveja Teste 2',
            'description' => null,
            'unit' => 'UN',
            'cost_price' => 3,
            'sale_price' => 8,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-TAXRULE-0002',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => 1,
            'subtotal' => 8,
            'discount' => 0,
            'total' => 8,
            'cost_total' => 3,
            'profit' => 5,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'notes' => 'Venda de teste matriz tributaria - produto com dados proprios',
        ]);

        $sale->items()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_cost' => 3,
            'unit_price' => 8,
            'total' => 8,
            'profit' => 5,
        ]);

        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount' => 8,
        ]);

        $this->makeFiscalProfile();
        $this->makeAgent();

        $response = $this->postJson('/api/fiscal/documents', [
            'sale_id' => $sale->id,
        ]);

        $response->assertStatus(202);

        $document = FiscalDocument::query()->firstOrFail();

        $this->assertSame('102', data_get($document->payload, 'items.0.icms_csosn'));
        $this->assertSame('49', data_get($document->payload, 'items.0.pis_cst'));
        $this->assertSame(0.0, (float) data_get($document->payload, 'items.0.pis_rate'));
        $this->assertSame('49', data_get($document->payload, 'items.0.cofins_cst'));
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador Fiscal',
            'username' => 'operador_fiscal_taxrule',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function makeFiscalProfile(): FiscalProfile
    {
        return FiscalProfile::query()->create([
            'active' => true,
            'environment' => 2,
            'invoice_model' => '65',
            'operation_nature' => 'VENDA NFC-E',
            'series' => 1,
            'next_number' => 1,
            'company_name' => 'Loja Matriz Tributaria LTDA',
            'trade_name' => 'Loja Matriz Tributaria',
            'cnpj' => '12345678000123',
            'ie' => '123456789',
            'im' => null,
            'cnae' => '4781400',
            'crt' => '1',
            'phone' => '11999999999',
            'street' => 'Rua Fiscal',
            'number' => '100',
            'complement' => null,
            'district' => 'Centro',
            'city_code' => '3550308',
            'city_name' => 'Sao Paulo',
            'state' => 'SP',
            'zip_code' => '01001000',
            'csc_id' => '000001',
            'csc_token' => 'TESTECSC1234567890',
            'technical_contact_name' => 'Equipe Nimvo',
            'technical_contact_email' => 'fiscal@nimvo.test',
            'technical_contact_phone' => '11999999999',
            'technical_contact_cnpj' => '12345678000123',
        ]);
    }

    protected function makeAgent(): LocalAgent
    {
        return LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agentefiscal',
            'secret_hash' => Hash::make('segredo-do-agente'),
            'metadata' => [
                'device' => [
                    'supported_types' => ['emit_nfce'],
                ],
            ],
            'active' => true,
        ]);
    }
}
