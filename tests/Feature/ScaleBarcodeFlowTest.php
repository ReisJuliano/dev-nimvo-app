<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ScaleBarcodeFlowTest extends TestCase
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

    public function test_scanning_a_scale_barcode_in_the_pos_search_resolves_weight_and_price(): void
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

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        Product::query()->create([
            'code' => 'MORT',
            'name' => 'Mortadela',
            'unit' => 'KG',
            'sold_by' => 'weight',
            'scale_code' => 123,
            'cost_price' => 20,
            'sale_price' => 39.90,
            'stock_quantity' => 50,
            'min_stock' => 0,
            'active' => true,
        ]);

        // 2 + 000123 + 01297 + check digit 1 => R$ 12,97 embedded (price_embedded default)
        $response = $this->getJson('/api/pdv/products?term=2000123012971');

        $response->assertOk();
        $response->assertJsonPath('products.0.code', 'MORT');
        $response->assertJsonPath('products.0.scale_quantity', 0.325);
        $response->assertJsonPath('products.0.scale_total_price', 12.97);
    }
}
