<?php

namespace Tests\Feature;

use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\User;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ModulePermissionGatesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();

        $this->withoutMiddleware([
            InitializeTenancyByDomain::class,
            PreventAccessFromCentralDomains::class,
        ]);

        // 'compras' e 'relatorios_avancados' vêm desligados por padrão (defaultModules());
        // os testes abaixo verificam o gate de PERMISSÃO, não o de módulo/licença.
        app(TenantSettingsService::class)->update([
            'business' => ['preset' => TenantSettingsService::CUSTOM_PRESET],
            'modules' => [
                'compras' => true,
                'relatorios_avancados' => true,
            ],
        ]);
    }

    public function test_operator_with_default_group_can_view_purchases_payables_and_reports(): void
    {
        $operator = $this->createUser('Operador', 'operador-padrao', 'operator');

        $this->actingAs($operator)->get('/compras')->assertOk();
        $this->actingAs($operator)->get('/contas-a-pagar')->assertOk();
        $this->actingAs($operator)->get('/relatorios')->assertOk();
    }

    public function test_operator_without_any_permission_grant_is_blocked_from_back_office_modules(): void
    {
        $operator = $this->createUserWithEmptyGroup('Operador Restrito', 'operador-restrito', 'operator');

        $this->actingAs($operator)->get('/compras')->assertForbidden();
        $this->actingAs($operator)->get('/contas-a-pagar')->assertForbidden();
        $this->actingAs($operator)->get('/relatorios')->assertForbidden();
        $this->actingAs($operator)->get('/a-receber')->assertForbidden();
        $this->actingAs($operator)->get('/caixa/painel')->assertForbidden();
    }

    public function test_admin_can_access_all_back_office_modules(): void
    {
        $admin = $this->createUser('Dono', 'dono-modulos', 'admin');

        $this->actingAs($admin)->get('/compras')->assertOk();
        $this->actingAs($admin)->get('/contas-a-pagar')->assertOk();
        $this->actingAs($admin)->get('/relatorios')->assertOk();
        $this->actingAs($admin)->get('/a-receber')->assertOk();
        $this->actingAs($admin)->get('/caixa/painel')->assertOk();
    }

    public function test_manager_can_see_cash_register_panel_but_default_operator_cannot(): void
    {
        $manager = $this->createUser('Gerente', 'gerente-painel', 'manager');
        $operator = $this->createUser('Operador', 'operador-painel', 'operator');

        $this->actingAs($manager)->get('/caixa/painel')->assertOk();
        $this->actingAs($operator)->get('/caixa/painel')->assertForbidden();
    }

    public function test_operator_without_a_receber_permission_is_blocked_but_manager_is_allowed(): void
    {
        $operator = $this->createUser('Operador', 'operador-receber', 'operator');
        $manager = $this->createUser('Gerente', 'gerente-receber', 'manager');

        $this->actingAs($operator)->get('/a-receber')->assertForbidden();
        $this->actingAs($manager)->get('/a-receber')->assertOk();
    }

    protected function createUser(string $name, string $username, string $baseRole): User
    {
        $group = PermissionGroup::query()->where('base_role', $baseRole)->first();

        return User::query()->create([
            'name' => $name,
            'username' => $username,
            'password' => Hash::make('password'),
            'role' => $baseRole,
            'permission_group_id' => $group?->id,
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    protected function createUserWithEmptyGroup(string $name, string $username, string $baseRole): User
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        return User::query()->create([
            'name' => $name,
            'username' => $username,
            'password' => Hash::make('password'),
            'role' => $baseRole,
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);
    }
}
