<?php

namespace Tests\Feature;

use App\Models\Tenant\Category;
use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ProductImportTest extends TestCase
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

    public function test_it_previews_a_csv_flagging_errors_and_warnings(): void
    {
        $this->actingAsAdmin();

        Category::query()->create(['name' => 'Papelaria']);

        $csv = "codigo,nome,categoria,fornecedor,unidade,vendido_por,preco_custo,preco_venda,estoque_inicial,estoque_minimo,codigo_barras\n"
            ."CAD-001,Caderno Universitario,Papelaria,,UN,unidade,12.50,19.90,30,5,\n"
            .",Produto Sem Preco,Categoria Inexistente,,UN,unidade,10,,0,0,\n";

        $file = UploadedFile::fake()->createWithContent('produtos.csv', $csv);

        $response = $this->postJson('/api/products/import/preview', ['file' => $file]);

        $response->assertOk()
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.valid', 1)
            ->assertJsonPath('summary.with_errors', 1);

        $rows = $response->json('rows');
        $this->assertSame('Caderno Universitario', $rows[0]['preview']['name']);
        $this->assertEmpty($rows[0]['errors']);
        $this->assertNotEmpty($rows[1]['errors']);
        $this->assertNotEmpty($rows[1]['warnings']);
    }

    public function test_it_commits_valid_rows_creating_and_updating_products(): void
    {
        $this->actingAsAdmin();

        $supplier = Supplier::query()->create(['name' => 'Fornecedor Teste']);

        $existing = Product::query()->create([
            'code' => 'EXIST-01',
            'barcode' => null,
            'name' => 'Produto Existente',
            'unit' => 'UN',
            'cost_price' => 5,
            'sale_price' => 10,
            'stock_quantity' => 2,
            'min_stock' => 0,
            'active' => true,
        ]);

        $rows = [
            [
                'row_number' => 2,
                'product_id' => null,
                'errors' => [],
                'data' => [
                    'code' => 'NOVO-01',
                    'barcode' => null,
                    'name' => 'Produto Novo',
                    'category_id' => null,
                    'supplier_id' => $supplier->id,
                    'unit' => 'UN',
                    'sold_by' => 'unit',
                    'cost_price' => 8,
                    'sale_price' => 15,
                    'stock_quantity' => 20,
                    'min_stock' => 3,
                ],
            ],
            [
                'row_number' => 3,
                'product_id' => $existing->id,
                'errors' => [],
                'data' => [
                    'code' => 'EXIST-01',
                    'barcode' => null,
                    'name' => 'Produto Existente Atualizado',
                    'category_id' => null,
                    'supplier_id' => null,
                    'unit' => 'UN',
                    'sold_by' => 'unit',
                    'cost_price' => 6,
                    'sale_price' => 12,
                    'stock_quantity' => 50,
                    'min_stock' => 0,
                ],
            ],
            [
                'row_number' => 4,
                'product_id' => null,
                'errors' => ['Preço de venda é obrigatório e deve ser numérico.'],
                'data' => ['name' => 'Produto Invalido', 'sale_price' => 0],
            ],
        ];

        $response = $this->postJson('/api/products/import/commit', ['rows' => $rows]);

        $response->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('updated', 1)
            ->assertJsonPath('skipped', 1);

        $this->assertDatabaseHas('products', ['code' => 'NOVO-01', 'name' => 'Produto Novo']);
        $this->assertDatabaseHas('products', ['code' => 'EXIST-01', 'name' => 'Produto Existente Atualizado']);

        $newProduct = Product::query()->where('code', 'NOVO-01')->firstOrFail();
        $this->assertSame(20.0, (float) $newProduct->stock_quantity);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $newProduct->id,
            'type' => 'saldo_inicial',
            'quantity_delta' => 20,
        ]);

        // Update nao mexe no estoque existente (fluxo de reimportacao nao pode sobrescrever
        // estoque que ja mudou desde a migracao original).
        $existing->refresh();
        $this->assertSame(2.0, (float) $existing->stock_quantity);
    }

    public function test_operator_without_produtos_adicionar_cannot_import(): void
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_import',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($operator)
            ->postJson('/api/products/import/commit', ['rows' => []])
            ->assertForbidden();
    }

    protected function actingAsAdmin(): User
    {
        $group = PermissionGroup::query()->where('base_role', 'admin')->first();

        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_import_'.str()->random(6),
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
