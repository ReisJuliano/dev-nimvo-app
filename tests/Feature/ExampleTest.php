<?php

namespace Tests\Feature;

use App\Models\Central\AdminUser;
use App\Models\Central\Client;
use App\Models\Tenant;
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
}
