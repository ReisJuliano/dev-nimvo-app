<?php

namespace Tests\Feature;

use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ProductsApiTest extends TestCase
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

    public function test_it_creates_a_product_without_gtin(): void
    {
        $this->authenticateOperator();

        $category = Category::query()->create([
            'name' => 'Mercearia',
            'description' => null,
            'active' => true,
        ]);

        $response = $this->postJson('/api/products', [
            'name' => 'Cafe sem GTIN',
            'code' => 'CAF-SEM-GTIN',
            'barcode' => null,
            'category_id' => $category->id,
            'unit' => 'UN',
            'cost_price' => 9.5,
            'sale_price' => 14.9,
            'fiscal_enabled' => true,
            'ncm' => '09012100',
            'cfop' => '5102',
            'origin_code' => '0',
            'icms_csosn' => '102',
            'pis_cst' => '49',
            'cofins_cst' => '49',
        ]);

        $response->assertCreated()
            ->assertJsonPath('product.barcode', null);

        $product = Product::query()->firstOrFail();

        $this->assertNull($product->barcode);
        $this->assertSame('Cafe sem GTIN', $product->name);
        $this->assertSame(0.0, (float) $product->cost_price);
        $this->assertArrayNotHasKey('cost_price', $response->json('product'));
    }

    public function test_product_cost_is_hidden_and_ignored_without_permission(): void
    {
        $operator = $this->authenticateOperator();

        $product = Product::query()->create([
            'code' => 'RES-001',
            'barcode' => '7891000100103',
            'name' => 'Produto reservado',
            'unit' => 'UN',
            'cost_price' => 12.34,
            'sale_price' => 19.90,
            'stock_quantity' => 5,
            'min_stock' => 1,
            'active' => true,
        ]);

        $showResponse = $this->getJson("/api/products/{$product->id}");
        $showResponse->assertOk();
        $this->assertArrayNotHasKey('cost_price', $showResponse->json('product'));

        $searchResponse = $this->getJson('/api/pdv/products?term=RES-001');
        $searchResponse->assertOk();
        $this->assertArrayNotHasKey('cost_price', $searchResponse->json('products.0'));

        Sanctum::actingAs($operator);
        $mobileResponse = $this->getJson('/mobile-api/v1/products/search?q=RES-001');
        $mobileResponse->assertOk();
        $this->assertArrayNotHasKey('cost_price', $mobileResponse->json('data.items.0'));

        $updateResponse = $this->putJson("/api/products/{$product->id}", [
            'name' => 'Produto reservado atualizado',
            'code' => 'RES-001',
            'barcode' => '7891000100103',
            'unit' => 'UN',
            'cost_price' => 99.99,
            'sale_price' => 21.90,
            'stock_quantity' => 9,
            'min_stock' => 1,
            'active' => true,
        ]);

        $updateResponse->assertOk();
        $this->assertArrayNotHasKey('cost_price', $updateResponse->json('product'));
        $this->assertSame(12.34, (float) $product->fresh()->cost_price);
    }

    public function test_admin_can_view_and_update_product_cost(): void
    {
        $this->authenticateAdmin();

        $product = Product::query()->create([
            'code' => 'ADM-001',
            'barcode' => null,
            'name' => 'Produto gerencial',
            'unit' => 'UN',
            'cost_price' => 8.50,
            'sale_price' => 16.90,
            'stock_quantity' => 3,
            'min_stock' => 1,
            'active' => true,
        ]);

        $this->getJson("/api/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('product.cost_price', 8.5);

        $this->putJson("/api/products/{$product->id}", [
            'name' => 'Produto gerencial',
            'code' => 'ADM-001',
            'barcode' => null,
            'unit' => 'UN',
            'cost_price' => 10.75,
            'sale_price' => 17.90,
            'stock_quantity' => 3,
            'min_stock' => 1,
            'active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('product.cost_price', 10.75);

        $this->assertSame(10.75, (float) $product->fresh()->cost_price);
    }

    protected function authenticateOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function authenticateAdmin(): User
    {
        $user = User::query()->create([
            'name' => 'Admin',
            'username' => 'admin',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }
}
