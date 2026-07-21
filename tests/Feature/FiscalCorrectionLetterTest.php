<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class FiscalCorrectionLetterTest extends TestCase
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

        $this->tenant = TenantModel::query()->create([
            'id' => 'tenant-correction',
            'name' => 'Loja Correcao',
            'email' => 'correcao@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_rejects_correction_letter_for_nfce_model_65(): void
    {
        $user = $this->actingAdmin();
        $sale = $this->makeSale($user);
        $document = $this->makeAuthorizedDocument($sale, '65');

        $response = $this->postJson("/api/fiscal/documents/{$document->id}/correction", [
            'text' => 'Correção do endereço do destinatário na nota emitida por engano.',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document']);
    }

    public function test_it_rejects_correction_letter_without_fiscal_eventos_permission(): void
    {
        $user = $this->actingOperatorWithoutEventsPermission();
        $sale = $this->makeSale($user);
        $document = $this->makeAuthorizedDocument($sale, '55');

        $response = $this->postJson("/api/fiscal/documents/{$document->id}/correction", [
            'text' => 'Correção do endereço do destinatário na nota emitida por engano.',
        ]);

        $response->assertForbidden();
    }

    public function test_it_rejects_correction_text_shorter_than_minimum_length(): void
    {
        $user = $this->actingAdmin();
        $sale = $this->makeSale($user);
        $document = $this->makeAuthorizedDocument($sale, '55');

        $response = $this->postJson("/api/fiscal/documents/{$document->id}/correction", [
            'text' => 'Muito curto',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['text']);
    }

    public function test_it_queues_polls_and_registers_a_correction_letter_for_nfe_model_55(): void
    {
        Storage::fake('local');

        $user = $this->actingAdmin();
        $sale = $this->makeSale($user);
        $document = $this->makeAuthorizedDocument($sale, '55');
        [$agent, $secret] = $this->makeAgentWithSecret();

        $response = $this->postJson("/api/fiscal/documents/{$document->id}/correction", [
            'text' => 'Correção do endereço do destinatário na nota emitida por engano.',
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('sequence', 1);

        $poll = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson('/api/local-agents/commands/poll');

        $poll->assertOk()
            ->assertJsonPath('command.type', 'send_correction_letter')
            ->assertJsonPath('command.payload.correction.sequence', 1);

        $commandId = $poll->json('command.id');

        $complete = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson("/api/local-agents/commands/{$commandId}/complete", [
            'successful' => true,
            'correction_request_xml' => '<envEvento>correction-request</envEvento>',
            'correction_response_xml' => '<retEnvEvento>correction-response</retEnvEvento>',
            'correction_protocol' => '135260000000077',
            'correction_sequence' => 1,
            'correction_text' => 'Correção do endereço do destinatário na nota emitida por engano.',
            'sefaz_status_code' => '135',
            'sefaz_status_reason' => 'Evento registrado e vinculado a NF-e',
            'corrected_at' => now()->toIso8601String(),
        ]);

        $complete->assertOk()->assertJsonPath('command.status', 'completed');

        Storage::disk('local')->assertExists(sprintf(
            'fiscal-documents/%s/sales/%s/document-%s/correction-1-request.xml',
            $this->tenant->id,
            $document->sale_id,
            $document->id,
        ));
        Storage::disk('local')->assertExists(sprintf(
            'fiscal-documents/%s/sales/%s/document-%s/correction-1-response.xml',
            $this->tenant->id,
            $document->sale_id,
            $document->id,
        ));

        $show = $this->getJson("/api/fiscal/documents/{$document->id}")->assertOk();
        $events = collect($show->json('document.events'));

        $this->assertTrue($events->contains(fn ($event) => $event['status'] === 'correction_registered'));

        $this->get("/api/fiscal/documents/{$document->id}/correction/1/request-xml")
            ->assertOk()
            ->assertSee('<envEvento>correction-request</envEvento>', false);

        $this->get("/api/fiscal/documents/{$document->id}/correction/1/response-xml")
            ->assertOk()
            ->assertSee('<retEnvEvento>correction-response</retEnvEvento>', false);

        // Documento fiscal em si não muda de status por causa da CC-e.
        $document->refresh();
        $this->assertSame('authorized', $document->status);
    }

    public function test_it_blocks_a_second_letter_while_one_is_still_pending(): void
    {
        $user = $this->actingAdmin();
        $sale = $this->makeSale($user);
        $document = $this->makeAuthorizedDocument($sale, '55');
        $this->makeAgentWithSecret();

        $this->postJson("/api/fiscal/documents/{$document->id}/correction", [
            'text' => 'Correção do endereço do destinatário na nota emitida por engano.',
        ])->assertStatus(202);

        $response = $this->postJson("/api/fiscal/documents/{$document->id}/correction", [
            'text' => 'Segunda correção antes da primeira terminar de processar.',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['document']);
    }

    protected function actingAdmin(): User
    {
        $group = PermissionGroup::query()->where('base_role', 'admin')->first();

        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_correcao',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'permission_group_id' => $group?->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function actingOperatorWithoutEventsPermission(): User
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $user = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_correcao',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function makeSale(User $user): Sale
    {
        $cashRegister = CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-CORRECAO-0001',
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
            'notes' => 'Venda de teste para carta de correção',
        ]);

        return $sale;
    }

    protected function makeAuthorizedDocument(Sale $sale, string $documentModel): FiscalDocument
    {
        return FiscalDocument::query()->create([
            'sale_id' => $sale->id,
            'profile_id' => null,
            'type' => $documentModel === '55' ? 'nfe' : 'nfce',
            'status' => 'authorized',
            'idempotency_key' => 'sale:'.$sale->id.':correction',
            'environment' => 2,
            'series' => 1,
            'number' => 42,
            'access_key' => '35260412345678000123'.($documentModel === '55' ? '550' : '650').'010000000042000000420',
            'payload' => [
                'flags' => [
                    'document_model' => $documentModel,
                ],
            ],
            'authorized_xml' => '<nfeProc>authorized</nfeProc>',
            'sefaz_protocol' => '135260000000042',
            'authorized_at' => now(),
        ]);
    }

    protected function makeAgentWithSecret(): array
    {
        $secret = 'segredo-do-agente';

        $agent = LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agentefiscal',
            'secret_hash' => Hash::make($secret),
            'metadata' => [
                'device' => [
                    'supported_types' => ['send_correction_letter'],
                ],
            ],
            'active' => true,
        ]);

        return [$agent, $secret];
    }
}
