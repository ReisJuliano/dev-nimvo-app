<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use App\Services\Tenant\Sales\SaleReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class SaleReturnServiceTest extends TestCase
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

        $this->tenant = TenantModel::query()->create([
            'id' => 'tenant-sale-return',
            'name' => 'Loja Devolucao Venda',
            'email' => 'devolucao-venda@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_registers_a_commercial_return_and_restores_stock(): void
    {
        $user = $this->makeUser();
        [$sale, $saleItem, $product] = $this->makeSale($user, withFiscalDocument: false);

        $service = app(SaleReturnService::class);
        $saleReturn = $service->createCommercial(
            $sale->id,
            [['sale_item_id' => $saleItem->id, 'quantity' => 1]],
            'Produto com defeito.',
            'store_credit',
            50.0,
            $user->id,
        );

        $this->assertSame('completed', $saleReturn->status);
        $this->assertSame(11.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame(50.0, (float) $saleReturn->refund_amount);
    }

    public function test_it_blocks_returning_more_than_sold_quantity(): void
    {
        $user = $this->makeUser();
        [$sale, $saleItem] = $this->makeSale($user, withFiscalDocument: false);

        $service = app(SaleReturnService::class);

        $this->expectException(ValidationException::class);

        $service->createCommercial(
            $sale->id,
            [['sale_item_id' => $saleItem->id, 'quantity' => 5]],
            'Quantidade maior que a vendida.',
            'none',
            0,
            $user->id,
        );
    }

    public function test_it_blocks_fiscal_return_when_sale_has_no_authorized_document(): void
    {
        $user = $this->makeUser();
        [$sale, $saleItem] = $this->makeSale($user, withFiscalDocument: false);

        $service = app(SaleReturnService::class);
        $saleReturn = $service->createCommercial(
            $sale->id,
            [['sale_item_id' => $saleItem->id, 'quantity' => 1]],
            'Venda sem nota fiscal.',
            'none',
            0,
            $user->id,
        );

        $this->expectException(ValidationException::class);

        $service->issueFiscal($saleReturn->id, $user->id);
    }

    public function test_it_issues_a_return_nfe_referencing_the_original_authorized_document(): void
    {
        $user = $this->makeUser();
        [$sale, $saleItem, $product] = $this->makeSale($user, withFiscalDocument: true);

        $this->makeFiscalProfileModel55();
        LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agentefiscal',
            'secret_hash' => Hash::make('segredo'),
            'metadata' => ['device' => ['supported_types' => ['emit_nfce']]],
            'active' => true,
        ]);

        $service = app(SaleReturnService::class);
        $saleReturn = $service->createCommercial(
            $sale->id,
            [['sale_item_id' => $saleItem->id, 'quantity' => 1]],
            'Cliente devolveu produto com defeito.',
            'cash',
            50.0,
            $user->id,
        );

        $document = $service->issueFiscal($saleReturn->id, $user->id);

        $this->assertSame('nfe_return_sale', $document->type);
        $this->assertSame($sale->id, $document->related_sale_id);
        $this->assertSame(4, (int) data_get($document->payload, 'sale.finalidade'));
        $this->assertSame(0, (int) data_get($document->payload, 'sale.operation_type'));
        $this->assertSame(
            ['35260412345678000123650010000000011000000019'],
            data_get($document->payload, 'sale.referencias'),
        );
        $this->assertSame('1202', data_get($document->payload, 'items.0.cfop'));

        $poll = $this->withHeaders([
            'X-Agent-Key' => 'agentefiscal',
            'X-Agent-Secret' => 'segredo',
        ])->postJson('/api/local-agents/commands/poll');

        $poll->assertOk()
            ->assertJsonPath('command.type', 'emit_nfce')
            ->assertJsonPath('command.payload.sale.finalidade', 4);

        $saleReturn->refresh();
        $this->assertSame($document->id, $saleReturn->fiscal_document_id);
    }

    /**
     * @return array{0: Sale, 1: \App\Models\Tenant\SaleItem, 2: Product}
     */
    protected function makeSale(User $user, bool $withFiscalDocument): array
    {
        $product = Product::query()->create([
            'code' => 'PROD-DEV-VENDA',
            'barcode' => '7891234500022',
            'name' => 'Produto Devolucao Venda',
            'cfop' => '5102',
            'unit' => 'UN',
            'cost_price' => 20,
            'sale_price' => 50,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $cashRegister = CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-DEVOLUCAO-0001',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => $cashRegister->id,
            'subtotal' => 50,
            'discount' => 0,
            'total' => 50,
            'cost_total' => 20,
            'profit' => 30,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'recipient_payload' => [
                'type' => 'document',
                'name' => 'Cliente de Teste',
                'document' => '12345678901',
                'street' => 'Rua do Cliente',
                'number' => '200',
                'district' => 'Centro',
                'city_code' => '3550308',
                'city_name' => 'Sao Paulo',
                'state' => 'SP',
                'zip_code' => '01001000',
            ],
            'notes' => 'Venda de teste devolucao',
        ]);

        $saleItem = $sale->items()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_cost' => 20,
            'unit_price' => 50,
            'total' => 50,
            'profit' => 30,
        ]);

        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount' => 50,
        ]);

        if ($withFiscalDocument) {
            FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                'type' => 'nfce',
                'status' => 'authorized',
                'idempotency_key' => 'sale:'.$sale->id.':nfce',
                'environment' => 2,
                'series' => 1,
                'number' => 55,
                'access_key' => '35260412345678000123650010000000011000000019',
                'payload' => ['flags' => ['document_model' => '65']],
                'authorized_xml' => '<nfeProc>authorized</nfeProc>',
                'sefaz_protocol' => '135260000000055',
                'authorized_at' => now(),
            ]);
        }

        return [$sale, $saleItem, $product];
    }

    protected function makeUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    protected function makeFiscalProfileModel55(): FiscalProfile
    {
        return FiscalProfile::query()->create([
            'active' => true,
            'environment' => 2,
            'invoice_model' => '55',
            'operation_nature' => 'VENDA',
            'series' => 1,
            'next_number' => 900,
            'company_name' => 'Loja Devolucao Venda LTDA',
            'trade_name' => 'Loja Devolucao Venda',
            'cnpj' => '12345678000123',
            'ie' => '123456789',
            'crt' => '1',
            'street' => 'Rua da Loja',
            'number' => '10',
            'district' => 'Centro',
            'city_code' => '3550308',
            'city_name' => 'Sao Paulo',
            'state' => 'SP',
            'zip_code' => '01001000',
            'technical_contact_name' => 'Equipe Nimvo',
            'technical_contact_email' => 'fiscal@nimvo.test',
            'technical_contact_phone' => '11999999999',
            'technical_contact_cnpj' => '12345678000123',
        ]);
    }
}
