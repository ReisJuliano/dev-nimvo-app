<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Central\LocalAgentCommand;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class FiscalConsultationsPageTest extends TestCase
{
    use RefreshDatabase;

    protected TenantModel $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::connection('central')->hasTable('local_agents')) {
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
            'id' => 'tenant-consultas',
            'name' => 'Loja Consultas',
            'email' => 'consultas@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_renders_the_consultations_page_with_sales_payload(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        $response = $this->get('/consultas-cancelamentos?period=day');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Fiscal/Consultations')
            ->where('filters.period', 'day')
            ->where('sales.data.0.sale_number', $sale->sale_number)
            ->where('sales.data.0.total', 50)
            ->where('sales.data.0.recipient.label', 'Consumidor final')
        );
    }

    public function test_it_accepts_a_custom_period_for_sales_consultation(): void
    {
        $user = $this->actingOperator();
        $outsideSale = $this->makeSale($user, now()->subDays(9));
        $insideSale = $this->makeSale($user, now()->subDays(2));

        $from = now()->subDays(3)->toDateString();
        $to = now()->subDay()->toDateString();

        $response = $this->get("/consultas-cancelamentos?period=custom&from={$from}&to={$to}");

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Fiscal/Consultations')
            ->where('filters.period', 'custom')
            ->where('filters.from', $from)
            ->where('filters.to', $to)
            ->where('range.from', $from)
            ->where('range.to', $to)
            ->has('sales.data', 1)
            ->where('sales.data.0.sale_number', $insideSale->sale_number)
        );

        $this->assertNotSame($outsideSale->sale_number, $insideSale->sale_number);
    }

    public function test_it_can_cancel_a_sale_without_authorized_document_immediately(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/vendas/'.$sale->id.'/cancelar', [
                'reason' => 'Cliente desistiu da compra antes da emissao.',
            ]);

        $response->assertRedirect('/consultas-cancelamentos');

        $sale->refresh();

        $this->assertSame('cancelled', $sale->status);
    }

    public function test_it_queues_cancellation_for_an_authorized_document(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        $document = FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => 'nfce',
            'status' => 'authorized',
            'idempotency_key' => 'sale:'.$sale->id.':nfce',
            'environment' => 2,
            'series' => 1,
            'number' => 10,
            'access_key' => '35260412345678000123650010000000011000000010',
            'payload' => [
                'profile' => [
                    'environment' => 2,
                    'company_name' => 'Loja Consultas LTDA',
                    'state' => 'SP',
                    'cnpj' => '12345678000123',
                    'csc_id' => '000001',
                    'csc_token' => 'TOKEN1234567890',
                ],
                'flags' => [
                    'document_model' => '65',
                ],
                'sale' => [
                    'requested_document_model' => '65',
                ],
            ],
            'authorized_xml' => '<nfeProc>authorized</nfeProc>',
            'sefaz_protocol' => '135260000000001',
            'authorized_at' => now(),
        ]);

        LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agent-cancel',
            'secret_hash' => Hash::make('secret'),
            'active' => true,
            'metadata' => [
                'device' => [
                    'supported_types' => ['cancel_fiscal_document'],
                ],
            ],
            'last_seen_at' => now(),
        ]);

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/vendas/'.$sale->id.'/cancelar', [
                'reason' => 'Erro operacional identificado apos autorizacao.',
            ]);

        $response->assertRedirect('/consultas-cancelamentos');

        $document->refresh();

        $this->assertSame('cancellation_queued', $document->status);
        $this->assertSame('Erro operacional identificado apos autorizacao.', $document->cancellation_reason);

        $this->assertDatabaseHas('local_agent_commands', [
            'tenant_id' => $this->tenant->id,
            'fiscal_document_id' => $document->id,
            'type' => 'cancel_fiscal_document',
            'status' => 'pending',
        ], 'central');
    }

    public function test_it_blocks_cancellation_when_the_authorization_deadline_has_expired(): void
    {
        config()->set('fiscal.cancellation.max_hours_after_authorization', 24);

        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => 'nfce',
            'status' => 'authorized',
            'idempotency_key' => 'sale:'.$sale->id.':nfce',
            'environment' => 2,
            'series' => 1,
            'number' => 11,
            'access_key' => '35260412345678000123650010000000011000000011',
            'payload' => [
                'flags' => [
                    'document_model' => '65',
                ],
            ],
            'authorized_xml' => '<nfeProc>authorized</nfeProc>',
            'sefaz_protocol' => '135260000000011',
            'authorized_at' => now()->subHours(30),
        ]);

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/vendas/'.$sale->id.'/cancelar', [
                'reason' => 'Cliente pediu cancelamento depois do prazo operacional.',
            ]);

        $response->assertRedirect('/consultas-cancelamentos');
        $response->assertSessionHasErrors(['sale']);
    }

    public function test_it_can_move_a_failed_document_to_operational_contingency(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        $document = FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => 'nfce',
            'status' => 'failed',
            'idempotency_key' => 'sale:'.$sale->id.':contingency',
            'environment' => 2,
            'series' => 1,
            'number' => 19,
            'last_error' => 'Sem agente local no momento.',
            'payload' => [
                'flags' => [
                    'document_model' => '65',
                ],
            ],
        ]);

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/vendas/'.$sale->id.'/contingencia', [
                'reason' => 'Caixa isolado aguardando retorno de conectividade local.',
            ]);

        $response->assertRedirect('/consultas-cancelamentos');

        $document->refresh();

        $this->assertSame('contingency_pending', $document->status);
        $this->assertSame('Caixa isolado aguardando retorno de conectividade local.', $document->contingency_reason);
    }

    public function test_it_queues_legal_offline_contingency_when_agent_is_available(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        $document = FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => 'nfce',
            'status' => 'failed',
            'idempotency_key' => 'sale:'.$sale->id.':offline-contingency',
            'environment' => 2,
            'series' => 1,
            'number' => 20,
            'last_error' => 'Timeout na autorizacao.',
            'payload' => [
                'flags' => [
                    'document_model' => '65',
                    'mode' => 'sefaz',
                ],
                'sale' => [
                    'requested_document_model' => '65',
                    'random_code' => '12345678',
                    'issued_at' => now()->subMinute()->toIso8601String(),
                ],
            ],
        ]);

        LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal Offline',
            'agent_key' => 'agent-offline-contingency',
            'secret_hash' => Hash::make('secret'),
            'active' => true,
            'metadata' => [
                'device' => [
                    'supported_types' => ['emit_nfce'],
                ],
            ],
            'last_seen_at' => now(),
        ]);

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/vendas/'.$sale->id.'/contingencia', [
                'reason' => 'Internet caiu na loja e o caixa precisa continuar atendendo.',
            ]);

        $response->assertRedirect('/consultas-cancelamentos');

        $document->refresh();

        $this->assertSame('queued_to_agent', $document->status);
        $this->assertSame('contingency_offline', data_get($document->payload, 'flags.mode'));
        $this->assertTrue((bool) data_get($document->payload, 'flags.offline_contingency'));
        $this->assertSame('issue', data_get($document->payload, 'flags.offline_contingency_stage'));

        $this->assertDatabaseHas('local_agent_commands', [
            'tenant_id' => $this->tenant->id,
            'fiscal_document_id' => $document->id,
            'type' => 'emit_nfce',
            'status' => 'pending',
        ], 'central');
    }

    public function test_it_can_retry_documents_from_operational_contingency(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => 'nfce',
            'status' => 'contingency_pending',
            'idempotency_key' => 'sale:'.$sale->id.':retry-contingency',
            'environment' => 2,
            'series' => 1,
            'number' => 21,
            'payload' => [
                'profile' => [
                    'environment' => 2,
                    'company_name' => 'Loja Consultas LTDA',
                    'state' => 'SP',
                    'cnpj' => '12345678000123',
                    'csc_id' => '000001',
                    'csc_token' => 'TOKEN1234567890',
                ],
                'flags' => [
                    'document_model' => '65',
                ],
                'sale' => [
                    'requested_document_model' => '65',
                ],
            ],
            'contingency_reason' => 'Fila temporariamente em contingencia operacional.',
            'contingency_requested_at' => now(),
        ]);

        LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agent-retry-contingency',
            'secret_hash' => Hash::make('secret'),
            'active' => true,
            'metadata' => [
                'device' => [
                    'supported_types' => ['emit_nfce'],
                ],
            ],
            'last_seen_at' => now(),
        ]);

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/contingencia/retry');

        $response->assertRedirect('/consultas-cancelamentos');

        $document = FiscalDocument::query()->firstOrFail();

        $this->assertSame('queued_to_agent', $document->status);
        $this->assertSame(1, $document->contingency_attempts);

        $this->assertDatabaseHas('local_agent_commands', [
            'tenant_id' => $this->tenant->id,
            'fiscal_document_id' => $document->id,
            'type' => 'emit_nfce',
        ], 'central');
    }

    public function test_it_can_retry_a_signed_offline_contingency_document_for_later_transmission(): void
    {
        $user = $this->actingOperator();
        $sale = $this->makeSale($user, now());

        FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => 'nfce',
            'status' => 'contingency_offline_printed',
            'idempotency_key' => 'sale:'.$sale->id.':offline-retry',
            'environment' => 2,
            'series' => 1,
            'number' => 22,
            'access_key' => '35260412345678000123650010000000011000000022',
            'signed_xml' => '<NFe>signed-offline</NFe>',
            'printed_at' => now()->subMinute(),
            'payload' => [
                'flags' => [
                    'document_model' => '65',
                    'mode' => 'contingency_offline',
                    'offline_contingency' => true,
                    'offline_contingency_stage' => 'transmit_pending',
                ],
                'sale' => [
                    'requested_document_model' => '65',
                ],
            ],
            'contingency_reason' => 'Sem internet na autorizacao inicial.',
            'contingency_requested_at' => now()->subMinute(),
        ]);

        LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal Retry',
            'agent_key' => 'agent-retry-offline',
            'secret_hash' => Hash::make('secret'),
            'active' => true,
            'metadata' => [
                'device' => [
                    'supported_types' => ['emit_nfce'],
                ],
            ],
            'last_seen_at' => now(),
        ]);

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/contingencia/retry');

        $response->assertRedirect('/consultas-cancelamentos');

        $document = FiscalDocument::query()->firstOrFail();

        $this->assertSame('queued_to_agent', $document->status);
        $this->assertSame(1, $document->contingency_attempts);
        $this->assertSame('transmit', data_get($document->payload, 'flags.offline_contingency_stage'));

        $command = LocalAgentCommand::query()
            ->where('tenant_id', $this->tenant->id)
            ->where('fiscal_document_id', $document->id)
            ->latest('created_at')
            ->firstOrFail();

        $this->assertSame('emit_nfce', $command->type);
        $this->assertSame('<NFe>signed-offline</NFe>', data_get($command->payload, 'existing_document.signed_xml'));
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador Consultas',
            'username' => 'operador_consultas',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        return $user;
    }

    protected function makeSale(User $user, mixed $createdAt): Sale
    {
        $sequence = Sale::query()->count() + 1;
        $createdAt = Carbon::parse($createdAt);

        $product = Product::query()->create([
            'code' => 'ITEM-CONSULTA-'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT),
            'barcode' => '7891234567'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT),
            'ncm' => '61091000',
            'cfop' => '5102',
            'cest' => null,
            'origin_code' => '0',
            'icms_csosn' => '102',
            'pis_cst' => '49',
            'cofins_cst' => '49',
            'name' => 'Produto Consulta',
            'description' => null,
            'unit' => 'UN',
            'commercial_unit' => 'UN',
            'taxable_unit' => 'UN',
            'cost_price' => 20,
            'sale_price' => 50,
            'stock_quantity' => 20,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-CONS-'.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT),
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => CashRegister::query()->where('user_id', $user->id)->value('id'),
            'subtotal' => 50,
            'discount' => 0,
            'total' => 50,
            'cost_total' => 20,
            'profit' => 30,
            'payment_method' => 'cash',
            'cash_received' => 50,
            'change_amount' => 0,
            'requested_document_model' => '65',
            'status' => 'finalized',
            'fiscal_decision' => 'emit',
            'notes' => 'Consulta fiscal',
            'recipient_payload' => ['name' => 'Consumidor final'],
        ]);

        $sale->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ])->saveQuietly();

        $sale->items()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_cost' => 20,
            'unit_price' => 50,
            'discount_amount' => 0,
            'total' => 50,
            'profit' => 30,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        $sale->payments()->create([
            'payment_method' => 'cash',
            'amount' => 50,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        return $sale;
    }
}
