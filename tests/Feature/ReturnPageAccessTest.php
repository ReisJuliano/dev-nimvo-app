<?php

namespace Tests\Feature;

use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ReturnPageAccessTest extends TestCase
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
    }

    public function test_admin_can_open_both_return_wizard_pages(): void
    {
        $admin = $this->createUser('Dono', 'dono_return_pages', 'admin');

        $this->actingAs($admin)->get('/compras/devolucoes')->assertOk();
        $this->actingAs($admin)->get('/vendas/devolucoes')->assertOk();
    }

    public function test_operator_without_grants_is_forbidden_from_both_return_wizard_pages(): void
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_return_pages',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($operator)->get('/compras/devolucoes')->assertForbidden();
        $this->actingAs($operator)->get('/vendas/devolucoes')->assertForbidden();
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
}
