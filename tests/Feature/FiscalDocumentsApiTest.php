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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class FiscalDocumentsApiTest extends TestCase
{
    use RefreshDatabase;

    protected TenantModel $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        if (!Schema::connection('central')->hasTable('local_agents')) {
            $this->artisan('migrate', [
                '--database' => 'central',
            ])->run();
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
            'id' => 'tenant-fiscal',
            'name' => 'Loja Fiscal',
            'email' => 'fiscal@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_queues_a_fiscal_document_and_creates_a_local_agent_command(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user);
        $this->makeFiscalProfile();
        $agent = $this->makeAgent();

        $response = $this->postJson('/api/fiscal/documents', [
            'sale_id' => $sale->id,
            'idempotency_key' => 'sale-'.$sale->id,
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('document.status', 'queued_to_agent')
            ->assertJsonPath('document.agent_key', $agent->agent_key);

        $document = FiscalDocument::query()->firstOrFail();

        $this->assertSame($sale->id, $document->sale_id);
        $this->assertSame('queued_to_agent', $document->status);

        $this->assertDatabaseHas('local_agent_commands', [
            'tenant_id' => $this->tenant->id,
            'fiscal_document_id' => $document->id,
            'status' => 'pending',
        ], 'central');
    }

    public function test_local_agent_can_poll_and_complete_a_command(): void
    {
        Storage::fake('local');

        $user = $this->actingOperator();
        $sale = $this->makeSale($user);
        $this->makeFiscalProfile();
        [$agent, $secret] = $this->makeAgentWithSecret();

        $this->postJson('/api/fiscal/documents', [
            'sale_id' => $sale->id,
        ])->assertStatus(202);

        $poll = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson('/api/local-agents/commands/poll');

        $poll->assertOk()
            ->assertJsonPath('command.type', 'emit_nfce');

        $document = FiscalDocument::query()->firstOrFail();
        $commandId = $poll->json('command.id');

        $document->refresh();
        $this->assertSame('processing', $document->status);

        $complete = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson("/api/local-agents/commands/{$commandId}/complete", [
            'successful' => true,
            'request_xml' => '<NFe>request</NFe>',
            'signed_xml' => '<NFe>signed</NFe>',
            'authorized_xml' => '<nfeProc>authorized</nfeProc>',
            'access_key' => '35260412345678000123650010000000011000000010',
            'receipt' => '123456789012345',
            'protocol' => '135260000000001',
            'sefaz_status_code' => '100',
            'sefaz_status_reason' => 'Autorizado o uso da NF-e',
            'printed_at' => now()->toIso8601String(),
        ]);

        $complete->assertOk()
            ->assertJsonPath('command.status', 'completed');

        $document->refresh();

        $this->assertSame('printed', $document->status);
        $this->assertSame('100', $document->sefaz_status_code);
        $this->assertNotNull($document->printed_at);
        Storage::disk('local')->assertExists(sprintf(
            'fiscal-documents/%s/sales/%s/document-%s/request.xml',
            $this->tenant->id,
            $document->sale_id,
            $document->id,
        ));
        Storage::disk('local')->assertExists(sprintf(
            'fiscal-documents/%s/sales/%s/document-%s/signed.xml',
            $this->tenant->id,
            $document->sale_id,
            $document->id,
        ));
        Storage::disk('local')->assertExists(sprintf(
            'fiscal-documents/%s/sales/%s/document-%s/authorized.xml',
            $this->tenant->id,
            $document->sale_id,
            $document->id,
        ));
        Storage::disk('local')->assertExists(sprintf(
            'fiscal-documents/%s/sales/%s/document-%s/meta.json',
            $this->tenant->id,
            $document->sale_id,
            $document->id,
        ));
        $this->assertDatabaseHas('local_agent_commands', [
            'id' => $commandId,
            'status' => 'completed',
        ], 'central');
    }

    public function test_it_requires_csc_data_before_queueing_a_fiscal_document(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user);

        $profile = $this->makeFiscalProfile();
        $profile->forceFill([
            'csc_id' => null,
            'csc_token' => null,
        ])->save();

        $response = $this->postJson('/api/fiscal/documents', [
            'sale_id' => $sale->id,
            'mode' => 'sefaz',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['fiscal_profile']);
    }

    public function test_it_falls_back_to_local_signature_when_csc_is_missing(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user);
        $profile = $this->makeFiscalProfile();
        $profile->forceFill([
            'csc_id' => null,
            'csc_token' => null,
        ])->save();
        $agent = $this->makeAgent();

        $response = $this->postJson('/api/fiscal/documents', [
            'sale_id' => $sale->id,
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('document.status', 'queued_to_agent')
            ->assertJsonPath('document.type', 'nfce_local_test')
            ->assertJsonPath('document.mode', 'local_test')
            ->assertJsonPath('document.agent_key', $agent->agent_key);
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador Fiscal',
            'username' => 'operador_fiscal',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function makeSale(User $user): Sale
    {
        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'CAMISETA',
            'barcode' => '7891234567895',
            'ncm' => '61091000',
            'cfop' => '5102',
            'cest' => null,
            'origin_code' => '0',
            'icms_csosn' => '102',
            'pis_cst' => '49',
            'cofins_cst' => '49',
            'name' => 'Camiseta Teste',
            'description' => null,
            'unit' => 'UN',
            'cost_price' => 20,
            'sale_price' => 50,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-TESTE-0001',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => 1,
            'subtotal' => 50,
            'discount' => 0,
            'total' => 50,
            'cost_total' => 20,
            'profit' => 30,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'notes' => 'Venda de teste fiscal',
        ]);

        $sale->items()->create([
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

        return $sale;
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
            'company_name' => 'Loja Fiscal LTDA',
            'trade_name' => 'Loja Fiscal',
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
        return $this->makeAgentWithSecret()[0];
    }

    protected function makeAgentWithSecret(): array
    {
        $secret = 'segredo-do-agente';

        $agent = LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agentefiscal',
            'secret_hash' => Hash::make($secret),
            'active' => true,
        ]);

        return [$agent, $secret];
    }
}
