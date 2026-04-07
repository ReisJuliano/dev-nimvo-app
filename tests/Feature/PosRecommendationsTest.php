<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class PosRecommendationsTest extends TestCase
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

    public function test_it_returns_top_sellers_and_cart_associations_for_the_pos_api(): void
    {
        $user = $this->authenticateOperator();

        $paoDeQueijo = $this->createProduct('PAOQ', 'Pao de queijo', 5);
        $cafe = $this->createProduct('CAFE', 'Cafe coado', 4);
        $suco = $this->createProduct('SUCO', 'Suco natural', 7);
        $bolo = $this->createProduct('BOLO', 'Bolo do dia', 8);

        $this->createSale($user, [
            [$paoDeQueijo, 2],
            [$cafe, 1],
        ], now()->subDays(2));

        $this->createSale($user, [
            [$paoDeQueijo, 1],
            [$cafe, 1],
            [$suco, 1],
        ], now()->subDay());

        $this->createSale($user, [
            [$paoDeQueijo, 3],
            [$bolo, 1],
        ], now()->subHours(8));

        $this->createSale($user, [
            [$cafe, 2],
            [$suco, 1],
        ], now()->subHours(4));

        $response = $this->getJson('/api/pdv/recommendations?anchor_product_id='.$paoDeQueijo->id.'&exclude_product_ids[]='.$paoDeQueijo->id);

        $response->assertOk();
        $response->assertJsonPath('recommendations.top_sellers.0.id', $paoDeQueijo->id);
        $response->assertJsonPath('recommendations.association_context.anchor_product_id', $paoDeQueijo->id);
        $response->assertJsonPath('recommendations.associations.0.id', $cafe->id);
        $response->assertJsonPath('recommendations.associations.0.paired_sales_count', 2);
        $response->assertJsonPath('recommendations.associations.0.association_rate', 66.7);
    }

    public function test_it_returns_customer_history_recommendations_when_a_customer_is_selected(): void
    {
        $user = $this->authenticateOperator();
        $customer = Customer::query()->create([
            'name' => 'Cliente Recorrente',
            'phone' => null,
            'credit_limit' => 0,
            'active' => true,
        ]);

        $paoDeQueijo = $this->createProduct('PAOQ', 'Pao de queijo', 5);
        $cafe = $this->createProduct('CAFE', 'Cafe coado', 4);
        $suco = $this->createProduct('SUCO', 'Suco natural', 7);

        $this->createSale($user, [
            [$paoDeQueijo, 2],
            [$cafe, 1],
        ], now()->subDays(10), $customer->id);

        $this->createSale($user, [
            [$paoDeQueijo, 1],
            [$suco, 1],
        ], now()->subDays(4), $customer->id);

        $this->createSale($user, [
            [$cafe, 2],
        ], now()->subDays(2));

        $response = $this->getJson('/api/pdv/recommendations?customer_id='.$customer->id.'&exclude_product_ids[]='.$paoDeQueijo->id);

        $response->assertOk();
        $response->assertJsonPath('recommendations.customer_context.customer_id', $customer->id);
        $response->assertJsonPath('recommendations.customer_context.customer_name', 'Cliente Recorrente');
        $response->assertJsonPath('recommendations.customer_recommendations.0.id', $cafe->id);
        $response->assertJsonPath('recommendations.customer_recommendations.0.customer_sales_count', 1);
        $response->assertJsonPath('recommendations.customer_recommendations.1.id', $suco->id);
    }

    public function test_it_preloads_top_sellers_in_the_pos_page_payload(): void
    {
        $user = $this->authenticateOperator();

        $paoDeQueijo = $this->createProduct('PAOQ', 'Pao de queijo', 5);
        $cafe = $this->createProduct('CAFE', 'Cafe coado', 4);

        $this->createSale($user, [
            [$paoDeQueijo, 2],
            [$cafe, 1],
        ], now()->subDay());

        $response = $this->get('/pdv');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Pos/Index')
            ->has('recommendations.top_sellers', 2)
            ->where('recommendations.top_sellers.0.id', $paoDeQueijo->id)
            ->where('recommendations.association_context', null)
        );
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

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        return $user;
    }

    protected function createProduct(string $code, string $name, float $salePrice): Product
    {
        return Product::query()->create([
            'code' => $code,
            'barcode' => null,
            'name' => $name,
            'description' => null,
            'unit' => 'UN',
            'cost_price' => max(1, $salePrice - 2),
            'sale_price' => $salePrice,
            'stock_quantity' => 50,
            'min_stock' => 0,
            'active' => true,
        ]);
    }

    protected function createSale(User $user, array $items, mixed $createdAt, ?int $customerId = null): Sale
    {
        $subtotal = collect($items)->sum(fn (array $entry) => (float) $entry[0]->sale_price * $entry[1]);
        $costTotal = collect($items)->sum(fn (array $entry) => (float) $entry[0]->cost_price * $entry[1]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-TEST-'.(Sale::query()->count() + 1),
            'customer_id' => $customerId,
            'user_id' => $user->id,
            'cash_register_id' => CashRegister::query()->where('user_id', $user->id)->value('id'),
            'subtotal' => $subtotal,
            'discount' => 0,
            'total' => $subtotal,
            'cost_total' => $costTotal,
            'profit' => $subtotal - $costTotal,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);

        foreach ($items as [$product, $quantity]) {
            $sale->items()->create([
                'product_id' => $product->id,
                'quantity' => $quantity,
                'unit_cost' => $product->cost_price,
                'unit_price' => $product->sale_price,
                'total' => (float) $product->sale_price * $quantity,
                'profit' => ((float) $product->sale_price - (float) $product->cost_price) * $quantity,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }

        return $sale;
    }
}
