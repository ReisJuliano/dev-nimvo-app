<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class OrderPartialCheckoutTest extends TestCase
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

    public function test_it_allows_partial_checkout_and_keeps_remaining_items_in_order(): void
    {
        $user = User::query()->create([
            'name' => 'Operator',
            'username' => 'operator',
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

        $pizza = Product::query()->create([
            'code' => 'PIZZA',
            'barcode' => null,
            'name' => 'Pizza',
            'description' => null,
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 30,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $soda = Product::query()->create([
            'code' => 'SODA',
            'barcode' => null,
            'name' => 'Refrigerante',
            'description' => null,
            'unit' => 'UN',
            'cost_price' => 2,
            'sale_price' => 5,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $draft = OrderDraft::query()->create([
            'user_id' => $user->id,
            'type' => 'mesa',
            'reference' => '10',
            'status' => OrderDraft::STATUS_SENT_TO_CASHIER,
            'subtotal' => 40,
            'total' => 40,
            'cost_total' => 0,
            'profit' => 0,
        ]);

        $draft->items()->create([
            'product_id' => $pizza->id,
            'product_name' => $pizza->name,
            'product_code' => $pizza->code,
            'product_barcode' => $pizza->barcode,
            'unit' => $pizza->unit,
            'quantity' => 1,
            'unit_cost' => $pizza->cost_price,
            'unit_price' => $pizza->sale_price,
            'total' => 30,
        ]);

        $draft->items()->create([
            'product_id' => $soda->id,
            'product_name' => $soda->name,
            'product_code' => $soda->code,
            'product_barcode' => $soda->barcode,
            'unit' => $soda->unit,
            'quantity' => 2,
            'unit_cost' => $soda->cost_price,
            'unit_price' => $soda->sale_price,
            'total' => 10,
        ]);

        $response = $this->postJson("/api/orders/{$draft->id}/partial-checkout", [
            'customer_id' => null,
            'discount' => 0,
            'notes' => null,
            'items' => [
                ['id' => $soda->id, 'qty' => 1, 'discount' => 0],
            ],
            'payments' => [
                ['method' => 'cash', 'amount' => 5],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('order.id', $draft->id);

        $draft->refresh()->load('items');

        $this->assertCount(2, $draft->items);
        $remainingSoda = $draft->items->firstWhere('product_id', $soda->id);
        $this->assertNotNull($remainingSoda);
        $this->assertEquals(1.0, (float) $remainingSoda->quantity);

        $this->assertEquals(30.0 + 5.0, (float) $draft->total);
        $this->assertEquals(9.0, (float) $soda->fresh()->stock_quantity);
    }
}

