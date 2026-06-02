<?php

namespace Tests\Feature;

use App\Models\Tenant\PendingSale;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class PosPendingSaleApiTest extends TestCase
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

    public function test_it_discards_the_saved_pending_sale(): void
    {
        $user = $this->actingOperator();
        $product = $this->createProduct();

        $this->postJson('/api/pdv/pending-sale', [
            'cart_payload' => [
                [
                    'id' => $product->id,
                    'qty' => 1,
                ],
            ],
            'notes' => 'Rascunho teste',
            'status' => 'draft',
        ])->assertOk();

        $this->assertDatabaseHas('pending_sales', [
            'user_id' => $user->id,
            'status' => 'draft',
        ]);

        $this->deleteJson('/api/pdv/pending-sale')
            ->assertOk()
            ->assertJsonPath('message', 'Venda pendente descartada com sucesso.');

        $this->assertDatabaseMissing('pending_sales', [
            'user_id' => $user->id,
        ]);

        $this->getJson('/api/pdv/pending-sale')
            ->assertOk()
            ->assertJsonPath('pending_sale', null);
    }

    public function test_it_persists_the_full_pending_sale_snapshot(): void
    {
        $user = $this->actingOperator();
        $product = $this->createProduct();

        $response = $this->postJson('/api/pdv/pending-sale', [
            'cart_payload' => [
                [
                    'id' => $product->id,
                    'qty' => 2,
                    'code' => $product->code,
                    'barcode' => $product->barcode,
                    'name' => 'Cafe coado',
                    'description' => 'Garrafa 500ml',
                    'unit' => 'UN',
                    'cost_price' => 8.5,
                    'sale_price' => 13.9,
                    'stock_quantity' => 12,
                    'lineSubtotal' => 27.8,
                    'lineDiscount' => 2.8,
                    'lineTotal' => 25,
                ],
            ],
            'discount_payload' => [
                'config' => ['type' => 'item', 'itemId' => $product->id, 'itemDiscountType' => 'value', 'value' => 2.8],
                'authorizer' => null,
            ],
            'payment_payload' => [
                'payment_method' => 'cash',
            ],
            'notes' => 'Venda em andamento',
            'status' => 'draft',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('pending_sale.cart.0.id', $product->id)
            ->assertJsonPath('pending_sale.cart.0.name', 'Cafe coado')
            ->assertJsonPath('pending_sale.cart.0.description', 'Garrafa 500ml')
            ->assertJsonPath('pending_sale.cart.0.sale_price', 13.9)
            ->assertJsonPath('pending_sale.cart.0.lineTotal', 25)
            ->assertJsonPath('pending_sale.payment.payment_method', 'cash');

        $pendingSale = PendingSale::query()->where('user_id', $user->id)->firstOrFail();

        $this->assertSame('Cafe coado', data_get($pendingSale->cart_payload, '0.name'));
        $this->assertSame('Garrafa 500ml', data_get($pendingSale->cart_payload, '0.description'));
        $this->assertSame(13.9, (float) data_get($pendingSale->cart_payload, '0.sale_price'));
        $this->assertSame(25.0, (float) data_get($pendingSale->cart_payload, '0.lineTotal'));
    }

    public function test_it_rejects_empty_pending_sale_carts(): void
    {
        $user = $this->actingOperator();

        $this->postJson('/api/pdv/pending-sale', [
            'cart_payload' => [],
            'status' => 'draft',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('cart_payload');

        $this->assertDatabaseMissing('pending_sales', [
            'user_id' => $user->id,
        ]);
    }

    public function test_it_hydrates_existing_pending_sales_with_product_snapshot_fallback(): void
    {
        $user = $this->actingOperator();
        $product = $this->createProduct([
            'name' => 'Bolo simples',
            'description' => 'Fatia',
            'sale_price' => 7.5,
            'stock_quantity' => 9,
        ]);

        PendingSale::query()->create([
            'user_id' => $user->id,
            'cart_payload' => [
                [
                    'id' => $product->id,
                    'qty' => 2,
                ],
            ],
            'status' => 'draft',
        ]);

        $this->postJson('/api/pdv/pending-sale/restore')
            ->assertOk()
            ->assertJsonPath('pending_sale.cart.0.id', $product->id)
            ->assertJsonPath('pending_sale.cart.0.name', 'Bolo simples')
            ->assertJsonPath('pending_sale.cart.0.description', 'Fatia')
            ->assertJsonPath('pending_sale.cart.0.sale_price', 7.5)
            ->assertJsonPath('pending_sale.cart.0.lineSubtotal', 15)
            ->assertJsonPath('pending_sale.cart.0.lineTotal', 15);

        $this->assertDatabaseMissing('pending_sales', [
            'user_id' => $user->id,
        ]);
    }

    public function test_it_drops_deleted_product_items_without_snapshot_and_reports_warning(): void
    {
        $user = $this->actingOperator();

        PendingSale::query()->create([
            'user_id' => $user->id,
            'cart_payload' => [
                [
                    'id' => 999999,
                    'qty' => 1,
                ],
                [
                    'id' => 888888,
                    'qty' => 2,
                    'name' => 'Produto com snapshot',
                    'sale_price' => 11.5,
                ],
            ],
            'status' => 'draft',
        ]);

        $this->getJson('/api/pdv/pending-sale')
            ->assertOk()
            ->assertJsonPath('pending_sale.has_dropped_items', true)
            ->assertJsonCount(1, 'pending_sale.cart')
            ->assertJsonPath('pending_sale.cart.0.name', 'Produto com snapshot')
            ->assertJsonPath('pending_sale.cart.0.lineTotal', 23);
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function createProduct(array $attributes = []): Product
    {
        return Product::query()->create(array_merge([
            'code' => 'PRD-'.str()->upper(str()->random(6)),
            'barcode' => '7890000000011',
            'name' => 'Produto teste',
            'description' => 'Descricao teste',
            'unit' => 'UN',
            'cost_price' => 5,
            'sale_price' => 10,
            'stock_quantity' => 20,
            'min_stock' => 0,
            'active' => true,
        ], $attributes));
    }
}
