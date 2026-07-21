<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\IncomingNfeItem;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\PurchaseItem;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\Purchases\PurchaseReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class PurchaseReturnFiscalIssueTest extends TestCase
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
            'id' => 'tenant-purchase-return',
            'name' => 'Loja Devolucao Compra',
            'email' => 'devolucao-compra@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_issues_a_return_nfe_referencing_the_original_supplier_document(): void
    {
        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_devolucao_compra',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);

        $supplier = Supplier::query()->create([
            'name' => 'Fornecedor Teste LTDA',
            'document' => '12345678000199',
            'street' => 'Rua do Fornecedor',
            'number' => '500',
            'district' => 'Industrial',
            'city_code' => '3550308',
            'city_name' => 'Sao Paulo',
            'state' => 'SP',
            'zip_code' => '01001000',
        ]);

        $product = Product::query()->create([
            'code' => 'PROD-DEV-COMPRA',
            'barcode' => '7891234500011',
            'name' => 'Produto Devolucao Compra',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $purchase = Purchase::query()->create([
            'supplier_id' => $supplier->id,
            'code' => 'COMPRA-FISCAL-01',
            'status' => 'received',
            'subtotal' => 100,
            'total' => 100,
            'stock_applied_at' => now(),
        ]);

        $purchaseItem = PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 10,
            'unit_cost' => 10,
            'total' => 100,
        ]);

        IncomingNfeDocument::query()->create([
            'purchase_id' => $purchase->id,
            'supplier_id' => $supplier->id,
            'access_key' => '35260412345678000199550010000000011000000019',
            'status' => 'processed',
            'supplier_name' => $supplier->name,
            'recipient_name' => 'Loja Devolucao Compra',
            'recipient_document' => '12345678000123',
        ]);

        IncomingNfeItem::query()->create([
            'document_id' => IncomingNfeDocument::query()->first()->id,
            'purchase_item_id' => $purchaseItem->id,
            'product_id' => $product->id,
            'item_number' => 1,
            'description' => $product->name,
            'cfop' => '1102',
            'quantity' => 10,
            'unit_price' => 10,
            'total_price' => 100,
        ]);

        FiscalProfile::query()->create([
            'active' => true,
            'environment' => 2,
            'invoice_model' => '55',
            'operation_nature' => 'VENDA',
            'series' => 1,
            'next_number' => 900,
            'company_name' => 'Loja Devolucao Compra LTDA',
            'trade_name' => 'Loja Devolucao Compra',
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

        LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agentefiscal',
            'secret_hash' => Hash::make('segredo'),
            'metadata' => [
                'device' => [
                    'supported_types' => ['emit_nfce'],
                ],
            ],
            'active' => true,
        ]);

        $service = app(PurchaseReturnService::class);
        $purchaseReturn = $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 4],
        ], 'Produto avariado devolvido ao fornecedor.', $user->id);

        $document = $service->issueFiscal($purchaseReturn->id, $user->id);

        $this->assertSame('nfe_return_purchase', $document->type);
        $this->assertSame($purchase->id, $document->related_purchase_id);
        $this->assertSame(4, (int) data_get($document->payload, 'sale.finalidade'));
        $this->assertSame(1, (int) data_get($document->payload, 'sale.operation_type'));
        $this->assertSame(
            ['35260412345678000199550010000000011000000019'],
            data_get($document->payload, 'sale.referencias'),
        );
        $this->assertSame('5202', data_get($document->payload, 'items.0.cfop'));

        $poll = $this->withHeaders([
            'X-Agent-Key' => 'agentefiscal',
            'X-Agent-Secret' => 'segredo',
        ])->postJson('/api/local-agents/commands/poll');

        $poll->assertOk()
            ->assertJsonPath('command.type', 'emit_nfce')
            ->assertJsonPath('command.payload.sale.finalidade', 4);

        $purchaseReturn->refresh();
        $this->assertSame($document->id, $purchaseReturn->fiscal_document_id);
    }
}
