<?php

namespace Tests\Feature;

use App\Models\Central\LocalAgent;
use App\Models\Tenant as TenantModel;
use App\Models\Tenant\FiscalNumberInutilization;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class FiscalNumberInutilizationsTest extends TestCase
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

        $this->tenant = TenantModel::query()->create([
            'id' => 'tenant-inutilizacao',
            'name' => 'Loja Inutilizacao',
            'email' => 'inutilizacao@example.test',
        ]);

        tenancy()->initialize($this->tenant);
    }

    protected function tearDown(): void
    {
        tenancy()->end();

        parent::tearDown();
    }

    public function test_it_queues_a_number_inutilization_for_the_local_agent(): void
    {
        $this->actingOperator();
        $this->makeFiscalProfile();
        $this->makeAgent();

        $response = $this->from('/consultas-cancelamentos')
            ->post('/consultas-cancelamentos/inutilizacoes', [
                'document_model' => '65',
                'series' => 1,
                'number_start' => 40,
                'number_end' => 45,
                'justification' => 'Faixa perdida apos ajuste operacional interno.',
            ]);

        $response->assertRedirect('/consultas-cancelamentos');

        $inutilization = FiscalNumberInutilization::query()->firstOrFail();

        $this->assertSame('queued', $inutilization->status);
        $this->assertSame(40, $inutilization->number_start);
        $this->assertSame(45, $inutilization->number_end);

        $this->assertDatabaseHas('local_agent_commands', [
            'tenant_id' => $this->tenant->id,
            'fiscal_number_inutilization_id' => $inutilization->id,
            'type' => 'invalidate_fiscal_range',
            'status' => 'pending',
        ], 'central');
    }

    public function test_local_agent_can_process_a_number_inutilization(): void
    {
        $this->actingOperator();
        $this->makeFiscalProfile();
        [$agent, $secret] = $this->makeAgentWithSecret();

        $this->post('/consultas-cancelamentos/inutilizacoes', [
            'document_model' => '65',
            'series' => 1,
            'number_start' => 50,
            'number_end' => 52,
            'justification' => 'Numeracao pulada durante troca de ambiente fiscal.',
        ])->assertRedirect();

        $poll = $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson('/api/local-agents/commands/poll');

        $poll->assertOk()
            ->assertJsonPath('command.type', 'invalidate_fiscal_range');

        $commandId = $poll->json('command.id');
        $inutilization = FiscalNumberInutilization::query()->firstOrFail();

        $this->withHeaders([
            'X-Agent-Key' => $agent->agent_key,
            'X-Agent-Secret' => $secret,
        ])->postJson("/api/local-agents/commands/{$commandId}/complete", [
            'successful' => true,
            'status' => 'processed',
            'request_xml' => '<inutNFe>request</inutNFe>',
            'response_xml' => '<retInutNFe>response</retInutNFe>',
            'protocol' => '135260000000321',
            'sefaz_status_code' => '102',
            'sefaz_status_reason' => 'Inutilizacao homologada',
        ])->assertOk();

        $inutilization->refresh();

        $this->assertSame('processed', $inutilization->status);
        $this->assertSame('135260000000321', $inutilization->protocol);
        $this->assertSame('102', $inutilization->sefaz_status_code);
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador Fiscal',
            'username' => 'operador_inutilizacao',
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
        $secret = 'segredo-inutilizacao';

        $agent = LocalAgent::query()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'PDV Fiscal',
            'agent_key' => 'agent-inutilizacao',
            'secret_hash' => Hash::make($secret),
            'metadata' => [
                'device' => [
                    'supported_types' => ['invalidate_fiscal_range'],
                ],
            ],
            'active' => true,
        ]);

        return [$agent, $secret];
    }
}
