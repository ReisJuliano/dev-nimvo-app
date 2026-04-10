<?php

namespace Tests\Feature;

use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
}
