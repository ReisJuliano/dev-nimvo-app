<?php

namespace Tests\Feature;

use App\Models\Tenant\Customer;
use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\Sale;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class CustomerSupplierImportTest extends TestCase
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

    public function test_it_imports_customers_and_registers_initial_credit_balance_as_a_migration_sale(): void
    {
        $this->actingAsAdmin();

        $csv = "nome,documento,telefone,email,limite_credito,saldo_fiado_inicial\n"
            ."Maria da Silva,12345678900,11999990000,maria@example.com,200,50\n"
            .",Sem Nome,,,,\n";

        $preview = $this->postJson('/api/customers/import/preview', [
            'file' => UploadedFile::fake()->createWithContent('clientes.csv', $csv),
        ]);

        $preview->assertOk()->assertJsonPath('summary.valid', 1);

        $rows = $preview->json('rows');

        $commit = $this->postJson('/api/customers/import/commit', ['rows' => $rows]);

        $commit->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('skipped', 1);

        $customer = Customer::query()->where('document', '12345678900')->firstOrFail();
        $this->assertSame('Maria da Silva', $customer->name);

        $migrationSale = Sale::query()->where('origin', 'migration')->where('customer_id', $customer->id)->firstOrFail();
        $this->assertSame('finalized', $migrationSale->status);
        $this->assertSame(50.0, (float) $migrationSale->total);
        $this->assertDatabaseHas('sale_payments', [
            'sale_id' => $migrationSale->id,
            'payment_method' => 'credit',
            'amount' => 50,
        ]);
    }

    public function test_reimporting_the_same_document_updates_instead_of_duplicating(): void
    {
        $this->actingAsAdmin();

        Customer::query()->create([
            'name' => 'Cliente Antigo',
            'document' => '12345678900',
        ]);

        $csv = "nome,documento\nCliente Atualizado,123.456.789-00\n";

        $preview = $this->postJson('/api/customers/import/preview', [
            'file' => UploadedFile::fake()->createWithContent('clientes.csv', $csv),
        ]);

        $rows = $preview->json('rows');
        $this->assertSame('update', $rows[0]['action']);

        $commit = $this->postJson('/api/customers/import/commit', ['rows' => $rows]);
        $commit->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('created', 0);

        $this->assertSame(1, Customer::query()->count());
        $this->assertDatabaseHas('customers', ['document' => '12345678900', 'name' => 'Cliente Atualizado']);
    }

    public function test_it_imports_suppliers(): void
    {
        $this->actingAsAdmin();

        $csv = "nome,documento,nome_fantasia,telefone,email\n"
            ."Distribuidora ABC LTDA,12345678000199,ABC Distribuidora,1140028922,contato@abc.example.com\n";

        $preview = $this->postJson('/api/suppliers/import/preview', [
            'file' => UploadedFile::fake()->createWithContent('fornecedores.csv', $csv),
        ]);

        $preview->assertOk()->assertJsonPath('summary.valid', 1);

        $commit = $this->postJson('/api/suppliers/import/commit', ['rows' => $preview->json('rows')]);

        $commit->assertOk()->assertJsonPath('created', 1);

        $this->assertDatabaseHas('suppliers', [
            'document' => '12345678000199',
            'name' => 'Distribuidora ABC LTDA',
            'trade_name' => 'ABC Distribuidora',
        ]);
    }

    public function test_operator_without_clientes_adicionar_cannot_import_customers(): void
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_customer_import',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($operator)
            ->postJson('/api/customers/import/commit', ['rows' => []])
            ->assertForbidden();
    }

    public function test_operator_without_fornecedores_adicionar_cannot_import_suppliers(): void
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_supplier_import',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($operator)
            ->postJson('/api/suppliers/import/commit', ['rows' => []])
            ->assertForbidden();
    }

    protected function actingAsAdmin(): User
    {
        $group = PermissionGroup::query()->where('base_role', 'admin')->first();

        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'admin',
            'permission_group_id' => $group?->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }
}
