<?php

namespace Tests\Feature;

use App\Models\Central\AdminUser;
use App\Models\Central\Client;
use App\Models\Tenant;
use App\Models\Tenant\FiscalProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    protected function ensureCentralTables(): void
    {
        if (!Schema::connection('central')->hasTable('central_admins')) {
            Schema::connection('central')->create('central_admins', function (Blueprint $table): void {
                $table->id();
                $table->string('name');
                $table->string('username')->unique();
                $table->string('password');
                $table->boolean('active')->default(true);
                $table->rememberToken();
                $table->timestamps();
            });
        }

        if (!Schema::connection('central')->hasTable('clients')) {
            Schema::connection('central')->create('clients', function (Blueprint $table): void {
                $table->id();
                $table->string('tenant_id')->unique();
                $table->string('name');
                $table->string('email')->nullable();
                $table->string('document', 30)->nullable();
                $table->string('domain')->unique();
                $table->boolean('active')->default(true);
                $table->timestamps();
            });
        }
    }

    protected function authenticateCentralAdmin(): void
    {
        $this->ensureCentralTables();

        $admin = AdminUser::create([
            'name' => 'Admin Central',
            'username' => 'admin',
            'password' => Hash::make('secret'),
            'active' => true,
        ]);

        $this->actingAs($admin, 'central_admin');
    }

    protected function ensureTenantFiscalTables(Tenant $tenant): void
    {
        tenancy()->initialize($tenant);

        try {
            if (! Schema::connection((new FiscalProfile())->getConnectionName())->hasTable('fiscal_profiles')) {
                $this->artisan('migrate', [
                    '--path' => database_path('migrations/tenant'),
                    '--realpath' => true,
                ])->run();
            }
        } finally {
            tenancy()->end();
        }
    }

    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('http://admin.nimvo.com.br/admin');

        $response->assertRedirect('/admin/login');
    }

    public function test_central_admin_can_create_a_tenant_using_a_subdomain(): void
    {
        $this->authenticateCentralAdmin();

        $response = $this->postJson('http://admin.nimvo.com.br/admin/tenants', [
            'client_name' => 'Cliente Centro',
            'tenant_name' => 'Tenant Centro',
            'tenant_id' => 'tenant-centro',
            'subdomain' => 'centro',
            'client_email' => 'centro@nimvo.com.br',
            'client_document' => '999',
            'active' => true,
        ]);

        $response
            ->assertCreated()
            ->assertJson([
                'message' => 'Tenant criado com sucesso.',
                'tenant' => [
                    'id' => 'tenant-centro',
                ],
            ]);

        $this->assertDatabaseHas('domains', [
            'tenant_id' => 'tenant-centro',
            'domain' => 'centro.nimvo.com.br',
        ]);

        $this->assertDatabaseHas('clients', [
            'tenant_id' => 'tenant-centro',
            'domain' => 'centro.nimvo.com.br',
            'active' => true,
        ], 'central');
    }

    public function test_central_admin_can_update_a_tenant(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-alpha',
            'name' => 'Tenant Antigo',
            'email' => 'old@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'old.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Antigo',
            'email' => 'old@tenant.com',
            'document' => '111',
            'domain' => 'old.nimvo.com.br',
            'active' => true,
        ]);

        $response = $this->putJson("http://admin.nimvo.com.br/admin/tenants/{$tenant->id}", [
            'client_name' => 'Cliente Novo',
            'tenant_name' => 'Tenant Novo',
            'subdomain' => 'novo',
            'client_email' => 'new@tenant.com',
            'client_document' => '222',
            'active' => false,
        ]);

        $response
            ->assertOk()
            ->assertJson([
                'message' => 'Tenant atualizado com sucesso.',
            ]);

        $this->assertDatabaseHas('tenants', [
            'id' => 'tenant-alpha',
            'name' => 'Tenant Novo',
            'email' => 'new@tenant.com',
        ]);

        $this->assertDatabaseHas('domains', [
            'tenant_id' => 'tenant-alpha',
            'domain' => 'novo.nimvo.com.br',
        ]);

        $this->assertDatabaseHas('clients', [
            'tenant_id' => 'tenant-alpha',
            'name' => 'Cliente Novo',
            'email' => 'new@tenant.com',
            'document' => '222',
            'domain' => 'novo.nimvo.com.br',
            'active' => false,
        ], 'central');
    }

    public function test_central_admin_dashboard_loads_when_tenants_exist(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-dashboard',
            'name' => 'Tenant Dashboard',
            'email' => 'dashboard@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'dashboard.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Dashboard',
            'email' => 'dashboard@tenant.com',
            'document' => '444',
            'domain' => 'dashboard.nimvo.com.br',
            'active' => true,
        ]);

        $response = $this->get('http://admin.nimvo.com.br/admin/painel');

        $response->assertOk();
    }

    public function test_central_admin_clients_page_loads_when_tenants_exist(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-clients',
            'name' => 'Tenant Clients',
            'email' => 'clients@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'clients.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Clients',
            'email' => 'clients@tenant.com',
            'document' => '555',
            'domain' => 'clients.nimvo.com.br',
            'active' => true,
        ]);

        $response = $this->get('http://admin.nimvo.com.br/admin/clientes');

        $response->assertOk();
    }

    public function test_central_admin_feature_flags_page_loads_when_tenants_exist(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-feature-flags',
            'name' => 'Tenant Feature Flags',
            'email' => 'flags@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'flags.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Feature Flags',
            'email' => 'flags@tenant.com',
            'document' => '666',
            'domain' => 'flags.nimvo.com.br',
            'active' => true,
        ]);

        $response = $this->get('http://admin.nimvo.com.br/admin/feature-flags');

        $response->assertOk();
    }

    public function test_unauthenticated_central_admin_routes_redirect_to_admin_login(): void
    {
        $this->get('http://admin.nimvo.com.br/admin/clientes')
            ->assertRedirect('http://admin.nimvo.com.br/admin/login');

        $this->get('http://admin.nimvo.com.br/admin/feature-flags')
            ->assertRedirect('http://admin.nimvo.com.br/admin/login');
    }

    public function test_central_admin_can_delete_a_tenant(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-delete',
            'name' => 'Tenant Delete',
            'email' => 'delete@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'delete.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Delete',
            'email' => 'delete@tenant.com',
            'document' => '333',
            'domain' => 'delete.nimvo.com.br',
            'active' => true,
        ]);

        $response = $this->deleteJson("http://admin.nimvo.com.br/admin/tenants/{$tenant->id}");

        $response
            ->assertOk()
            ->assertJson([
                'message' => 'Tenant Tenant Delete excluido com sucesso.',
            ]);

        $this->assertDatabaseMissing('tenants', [
            'id' => 'tenant-delete',
        ]);

        $this->assertDatabaseMissing('domains', [
            'tenant_id' => 'tenant-delete',
        ]);

        $this->assertDatabaseMissing('clients', [
            'tenant_id' => 'tenant-delete',
        ], 'central');
    }

    public function test_central_admin_can_save_nfce_csc_credentials_in_tenant_database(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-fiscal-central',
            'name' => 'Tenant Fiscal Central',
            'email' => 'fiscal@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'fiscal-central.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Fiscal Central',
            'email' => 'fiscal@tenant.com',
            'document' => '777',
            'domain' => 'fiscal-central.nimvo.com.br',
            'active' => true,
        ]);

        $this->ensureTenantFiscalTables($tenant);

        tenancy()->initialize($tenant);

        FiscalProfile::query()->create([
            'active' => true,
            'environment' => 2,
            'invoice_model' => '65',
            'operation_nature' => 'VENDA NFC-E',
            'series' => 1,
            'next_number' => 1,
            'company_name' => 'Tenant Fiscal Central LTDA',
            'trade_name' => 'Tenant Fiscal Central',
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
        ]);

        tenancy()->end();

        $response = $this->putJson("http://admin.nimvo.com.br/admin/tenants/{$tenant->id}/fiscal", [
            'csc_id' => '000001',
            'csc_token' => 'TOKENCENTRAL1234567890',
        ]);

        $response
            ->assertOk()
            ->assertJson([
                'message' => 'CSC do tenant salvo com sucesso.',
            ])
            ->assertJsonPath('fiscal.csc_id', '000001')
            ->assertJsonPath('fiscal.csc_token_configured', true)
            ->assertJsonPath('fiscal.status', 'configured');

        tenancy()->initialize($tenant);

        $profile = FiscalProfile::query()
            ->where('invoice_model', '65')
            ->firstOrFail();

        $this->assertSame('000001', $profile->csc_id);
        $this->assertSame('TOKENCENTRAL1234567890', $profile->csc_token);

        tenancy()->end();
    }

    public function test_central_admin_cannot_save_csc_when_tenant_has_no_nfce_profile(): void
    {
        $this->authenticateCentralAdmin();

        $tenant = Tenant::create([
            'id' => 'tenant-sem-perfil-fiscal',
            'name' => 'Tenant Sem Perfil',
            'email' => 'semperfil@tenant.com',
        ]);

        $tenant->domains()->create([
            'domain' => 'semperfil.nimvo.com.br',
        ]);

        Client::create([
            'tenant_id' => $tenant->id,
            'name' => 'Cliente Sem Perfil',
            'email' => 'semperfil@tenant.com',
            'document' => '888',
            'domain' => 'semperfil.nimvo.com.br',
            'active' => true,
        ]);

        $this->ensureTenantFiscalTables($tenant);

        $response = $this->putJson("http://admin.nimvo.com.br/admin/tenants/{$tenant->id}/fiscal", [
            'csc_id' => '000001',
            'csc_token' => 'TOKENCENTRAL1234567890',
        ]);

        $response
            ->assertStatus(422)
            ->assertJsonValidationErrors(['fiscal']);
    }
}
