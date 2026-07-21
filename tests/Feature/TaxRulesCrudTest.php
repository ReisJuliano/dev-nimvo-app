<?php

namespace Tests\Feature;

use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\TaxRule;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class TaxRulesCrudTest extends TestCase
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

    public function test_a_manager_can_list_create_update_and_delete_tax_rules(): void
    {
        $manager = $this->createUser('Gerente', 'gerente-matriz', 'manager');

        $this->actingAs($manager)->getJson('/api/fiscal/tax-rules')
            ->assertOk()
            ->assertJsonPath('rules', []);

        $store = $this->actingAs($manager)->postJson('/api/fiscal/tax-rules', [
            'name' => 'Bebidas alcoólicas SP',
            'active' => true,
            'ncm_pattern' => '2203',
            'cfop' => '5102',
            'uf_origem' => 'SP',
            'uf_destino' => 'SP',
            'csosn' => '500',
            'origin_code' => '0',
            'pis_cst' => '06',
            'pis_rate' => 1.65,
            'cofins_cst' => '06',
            'cofins_rate' => 7.6,
            'priority' => 5,
        ]);

        $store->assertCreated()
            ->assertJsonPath('rule.name', 'Bebidas alcoólicas SP')
            ->assertJsonPath('rule.priority', 5);

        $ruleId = $store->json('rule.id');

        $this->actingAs($manager)->putJson("/api/fiscal/tax-rules/{$ruleId}", [
            'name' => 'Bebidas alcoólicas SP (atualizada)',
            'active' => false,
            'priority' => 10,
        ])->assertOk()
            ->assertJsonPath('rule.name', 'Bebidas alcoólicas SP (atualizada)')
            ->assertJsonPath('rule.active', false)
            ->assertJsonPath('rule.priority', 10);

        $this->assertDatabaseHas('tax_rules', [
            'id' => $ruleId,
            'name' => 'Bebidas alcoólicas SP (atualizada)',
            'active' => false,
        ]);

        $this->actingAs($manager)->deleteJson("/api/fiscal/tax-rules/{$ruleId}")
            ->assertOk();

        $this->assertDatabaseMissing('tax_rules', ['id' => $ruleId]);
    }

    public function test_store_validates_cfop_and_ncm_format(): void
    {
        $manager = $this->createUser('Gerente', 'gerente-matriz-validacao', 'manager');

        $this->actingAs($manager)->postJson('/api/fiscal/tax-rules', [
            'name' => 'Regra inválida',
            'active' => true,
            'ncm_pattern' => 'ABCD',
            'cfop' => '51',
            'priority' => 0,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['ncm_pattern', 'cfop']);
    }

    public function test_operator_without_permission_is_forbidden(): void
    {
        $operator = $this->createUser('Operador', 'operador-matriz', 'operator');

        $this->actingAs($operator)->getJson('/api/fiscal/tax-rules')->assertForbidden();
        $this->actingAs($operator)->postJson('/api/fiscal/tax-rules', [
            'name' => 'Tentativa bloqueada',
            'active' => true,
            'priority' => 0,
        ])->assertForbidden();
    }

    public function test_operator_with_empty_permission_group_cannot_access_the_page(): void
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste matriz)',
            'base_role' => null,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador restrito',
            'username' => 'operador-matriz-restrito',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($operator)->get('/fiscal/matriz-tributaria')->assertForbidden();
    }

    public function test_admin_can_access_the_tax_rules_page(): void
    {
        $admin = $this->createUser('Dono', 'dono-matriz', 'admin');

        $this->actingAs($admin)->get('/fiscal/matriz-tributaria')->assertOk();
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
