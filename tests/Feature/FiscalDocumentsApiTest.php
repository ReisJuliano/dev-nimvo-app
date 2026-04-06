<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Central\LocalAgentCommand;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use App\Services\Central\LocalAgentBootstrapService;
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

    public function test_heartbeat_syncs_local_machine_data_without_returning_central_printer_overrides(): void
    {
        [$agent, $secret] = $this->makeAgentWithSecret();

        $agent->forceFill([
            'metadata' => [
                'runtime_config' => [
                    'poll_interval_seconds' => 9,
                ],
            ],
        ])->save();

        $response = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson('/api/local-agents/heartbeat', [
            'machine' => [
                'name' => 'PDV-CAIXA-01',
                'user' => 'operador',
            ],
            'certificate' => [
                'path' => 'C:\\certificados\\empresa.pfx',
            ],
            'printer' => [
                'enabled' => true,
                'connector' => 'windows',
                'name' => 'ELGIN-I9',
                'host' => '127.0.0.1',
                'port' => 9100,
                'logo_path' => 'C:\\logos\\cupom.png',
            ],
            'local_api' => [
                'enabled' => true,
                'host' => '127.0.0.1',
                'port' => 18123,
                'url' => 'http://127.0.0.1:18123',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('config.poll_interval_seconds', 9)
            ->assertJsonMissingPath('config.printer')
            ->assertJsonMissingPath('config.local_api');

        $agent->refresh();

        $this->assertSame('PDV-CAIXA-01', data_get($agent->metadata, 'device.machine.name'));
        $this->assertSame('ELGIN-I9', data_get($agent->metadata, 'device.printer.name'));
        $this->assertSame('http://127.0.0.1:18123', data_get($agent->metadata, 'device.local_api.url'));
    }

    public function test_local_agent_can_activate_with_a_temporary_code(): void
    {
        /** @var LocalAgentBootstrapService $bootstrapService */
        $bootstrapService = app(LocalAgentBootstrapService::class);

        $agent = $bootstrapService->upsertForTenant((string) $this->tenant->id, [
            'name' => 'PDV Fiscal',
            'active' => true,
            'runtime_config' => [
                'poll_interval_seconds' => 9,
            ],
        ]);
        $issued = $bootstrapService->issueActivationCode($agent);

        $response = $this->postJson('/api/local-agents/activate', [
            'activation_code' => $issued['code'],
        ]);

        $response->assertOk()
            ->assertJsonPath('agent.key', $agent->agent_key)
            ->assertJsonPath('credentials.key', $agent->agent_key)
            ->assertJsonPath('credentials.secret', $bootstrapService->secret($agent->fresh()))
            ->assertJsonPath('credentials.poll_interval_seconds', 9);

        $agent->refresh();

        $this->assertNull(data_get($agent->metadata, 'activation.code_hash'));
        $this->assertNotNull(data_get($agent->metadata, 'activation.activated_at'));
    }

    public function test_local_agent_activation_rejects_invalid_codes(): void
    {
        $response = $this->postJson('/api/local-agents/activate', [
            'activation_code' => 'CODIGO-INVALIDO',
        ]);

        $response->assertStatus(422);
    }

    public function test_pos_finalize_queues_a_payment_receipt_for_the_local_agent(): void
    {
        $user = $this->actingOperator();

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'COPO',
            'barcode' => '7891234567000',
            'ncm' => '39241000',
            'cfop' => '5102',
            'cest' => null,
            'origin_code' => '0',
            'icms_csosn' => '102',
            'pis_cst' => '49',
            'cofins_cst' => '49',
            'name' => 'Copo Personalizado',
            'description' => null,
            'unit' => 'UN',
            'cost_price' => 5,
            'sale_price' => 12.5,
            'stock_quantity' => 20,
            'min_stock' => 0,
            'active' => true,
        ]);

        /** @var LocalAgentBootstrapService $bootstrapService */
        $bootstrapService = app(LocalAgentBootstrapService::class);
        $agent = $bootstrapService->upsertForTenant((string) $this->tenant->id, [
            'name' => 'PDV Impressao',
            'active' => true,
        ]);
        $agent->forceFill([
            'metadata' => array_replace_recursive($agent->metadata ?? [], [
                'device' => [
                    'printer' => [
                        'enabled' => true,
                    ],
                ],
            ]),
        ])->save();

        $response = $this->postJson('/api/pdv/sales', [
            'discount' => 0,
            'notes' => 'Fila central',
            'fiscal_decision' => 'close',
            'requested_document_model' => '65',
            'items' => [
                [
                    'id' => $product->id,
                    'qty' => 2,
                    'discount' => 0,
                ],
            ],
            'payments' => [
                [
                    'method' => 'cash',
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('local_agent_print.status', 'queued');

        $command = LocalAgentCommand::query()
            ->where('tenant_id', $this->tenant->id)
            ->where('type', 'print_payment_receipt')
            ->latest('created_at')
            ->firstOrFail();

        $this->assertSame('pending', $command->status);
        $this->assertSame('Loja Fiscal', data_get($command->payload, 'store_name'));
        $this->assertSame('Dinheiro', data_get($command->payload, 'payments.0.label'));
        $this->assertSame('Copo Personalizado', data_get($command->payload, 'items.0.name'));
    }

    public function test_local_agent_poll_can_filter_only_supported_print_commands(): void
    {
        [$agent, $secret] = $this->makeAgentWithSecret();

        LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'emit_nfce',
            'status' => 'pending',
            'payload' => ['document' => 'fiscal'],
            'available_at' => now(),
        ]);

        LocalAgentCommand::query()->create([
            'local_agent_id' => $agent->id,
            'tenant_id' => $this->tenant->id,
            'type' => 'print_test',
            'status' => 'pending',
            'payload' => ['store_name' => 'Loja Fiscal', 'message' => 'Teste'],
            'available_at' => now(),
        ]);

        $response = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson('/api/local-agents/commands/poll', [
            'supported_types' => ['print_test'],
        ]);

        $response->assertOk()
            ->assertJsonPath('command.type', 'print_test');
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
