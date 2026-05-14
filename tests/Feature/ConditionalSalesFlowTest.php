<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\ConditionalSale;
use App\Models\Tenant\ConditionalSaleItem;
use App\Models\Tenant\Customer;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\ConditionalSaleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ConditionalSalesFlowTest extends TestCase
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

    public function test_create_conditional_moves_stock_and_stores_item_snapshot(): void
    {
        $user = $this->makeUser();
        $customer = $this->makeCustomer();
        $product = $this->makeProduct([
            'code' => 'COND-PRD-001',
            'name' => 'Vestido Midi',
            'cost_price' => 70,
            'sale_price' => 149.9,
            'stock_quantity' => 5,
        ]);

        $service = app(ConditionalSaleService::class);

        $conditionalSale = $service->create([
            'customer_id' => $customer->id,
            'withdrawn_at' => now()->toDateTimeString(),
            'due_at' => now()->addDays(3)->toDateString(),
            'notes' => 'Cliente vai provar no fim de semana.',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 149.9,
                ],
            ],
        ], $user->id);

        $item = $conditionalSale->items()->first();

        $this->assertNotNull($item);
        $this->assertSame(3.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame('Vestido Midi', $item->product_name);
        $this->assertSame('COND-PRD-001', $item->product_code);
        $this->assertSame(299.8, (float) $conditionalSale->subtotal);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'conditional_outbound',
        ]);
    }

    public function test_partial_return_restores_only_returned_quantity(): void
    {
        $user = $this->makeUser();
        $customer = $this->makeCustomer();
        $product = $this->makeProduct([
            'code' => 'COND-PRD-002',
            'name' => 'Blazer Linho',
            'cost_price' => 90,
            'sale_price' => 189.9,
            'stock_quantity' => 4,
        ]);

        $service = app(ConditionalSaleService::class);

        $conditionalSale = $service->create([
            'customer_id' => $customer->id,
            'withdrawn_at' => now()->toDateTimeString(),
            'due_at' => now()->addDays(2)->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 189.9,
                ],
            ],
        ], $user->id);

        $returned = $service->registerReturn($conditionalSale, [
            'returned_at' => now()->addDay()->toDateTimeString(),
            'notes' => 'Cliente devolveu uma peca.',
            'items' => [
                [
                    'id' => $conditionalSale->items()->first()->id,
                    'returned_quantity' => 1,
                ],
            ],
        ], $user->id);

        /** @var ConditionalSaleItem $item */
        $item = $returned->items()->first();

        $this->assertSame(3.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame(1.0, (float) $item->quantity_returned);
        $this->assertNull($returned->closed_at);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'conditional_return',
        ]);
    }

    public function test_finalize_converts_billed_items_without_double_stock_reduction(): void
    {
        $user = $this->makeUser();
        $customer = $this->makeCustomer();
        $productA = $this->makeProduct([
            'code' => 'COND-PRD-003',
            'name' => 'Saia Midi',
            'cost_price' => 40,
            'sale_price' => 99.9,
            'stock_quantity' => 6,
        ]);
        $productB = $this->makeProduct([
            'code' => 'COND-PRD-004',
            'name' => 'Camisa Seda',
            'cost_price' => 55,
            'sale_price' => 129.9,
            'stock_quantity' => 3,
        ]);

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 150,
            'opened_at' => now(),
        ]);

        $service = app(ConditionalSaleService::class);

        $conditionalSale = $service->create([
            'customer_id' => $customer->id,
            'withdrawn_at' => now()->toDateTimeString(),
            'due_at' => now()->addDays(5)->toDateString(),
            'items' => [
                [
                    'product_id' => $productA->id,
                    'quantity' => 2,
                    'unit_price' => 99.9,
                ],
                [
                    'product_id' => $productB->id,
                    'quantity' => 1,
                    'unit_price' => 129.9,
                ],
            ],
        ], $user->id);

        $items = $conditionalSale->items()->get()->keyBy('product_code');

        $result = $service->finalize($conditionalSale, [
            'resolved_at' => now()->addDays(2)->toDateTimeString(),
            'notes' => 'Cliente ficou com uma saia e avariou uma camisa.',
            'items' => [
                [
                    'id' => $items['COND-PRD-003']->id,
                    'returned_quantity' => 1,
                    'kept_quantity' => 1,
                    'lost_quantity' => 0,
                    'damaged_quantity' => 0,
                ],
                [
                    'id' => $items['COND-PRD-004']->id,
                    'returned_quantity' => 0,
                    'kept_quantity' => 0,
                    'lost_quantity' => 0,
                    'damaged_quantity' => 1,
                ],
            ],
            'payments' => [
                [
                    'method' => 'pix',
                ],
            ],
        ], $user->id);

        /** @var ConditionalSale $resolvedConditional */
        $resolvedConditional = $result['conditional_sale'];
        /** @var Sale $sale */
        $sale = $result['sale'];

        $this->assertNotNull($sale);
        $this->assertNotNull($resolvedConditional->closed_at);
        $this->assertSame(5.0, (float) $productA->fresh()->stock_quantity);
        $this->assertSame(2.0, (float) $productB->fresh()->stock_quantity);
        $this->assertSame(229.8, (float) $sale->total);
        $this->assertSame(3, InventoryMovement::query()->count());
        $this->assertSame(0, InventoryMovement::query()->where('type', 'sale')->count());
        $this->assertSame(2, $sale->items()->count());
    }

    public function test_customer_with_overdue_conditional_cannot_open_new_one(): void
    {
        $user = $this->makeUser();
        $customer = $this->makeCustomer();
        $product = $this->makeProduct([
            'code' => 'COND-PRD-005',
            'name' => 'Calca Reta',
            'sale_price' => 89.9,
            'stock_quantity' => 8,
        ]);

        $service = app(ConditionalSaleService::class);

        $service->create([
            'customer_id' => $customer->id,
            'withdrawn_at' => now()->subDays(4)->toDateTimeString(),
            'due_at' => now()->subDay()->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'unit_price' => 89.9,
                ],
            ],
        ], $user->id);

        $this->expectException(ValidationException::class);

        $service->create([
            'customer_id' => $customer->id,
            'withdrawn_at' => now()->toDateTimeString(),
            'due_at' => now()->addDays(2)->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'unit_price' => 89.9,
                ],
            ],
        ], $user->id);
    }

    public function test_page_data_keeps_conditional_closed_until_the_user_selects_one(): void
    {
        $user = $this->makeUser();
        $customer = $this->makeCustomer();
        $product = $this->makeProduct([
            'code' => 'COND-PRD-006',
            'name' => 'Jaqueta Jeans',
            'sale_price' => 159.9,
            'stock_quantity' => 3,
        ]);

        $service = app(ConditionalSaleService::class);

        $conditionalSale = $service->create([
            'customer_id' => $customer->id,
            'withdrawn_at' => now()->toDateTimeString(),
            'due_at' => now()->addDays(2)->toDateString(),
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 1,
                    'unit_price' => 159.9,
                ],
            ],
        ], $user->id);

        $defaultPayload = $service->pageData([
            'status' => 'open',
            'search' => '',
        ]);

        $selectedPayload = $service->pageData([
            'status' => 'open',
            'search' => '',
            'conditional' => $conditionalSale->id,
        ]);

        $this->assertNull($defaultPayload['selectedConditionalId']);
        $this->assertSame($conditionalSale->id, $selectedPayload['selectedConditionalId']);
    }

    protected function makeUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'condicional_'.str()->random(6),
            'password' => bcrypt('secret'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    protected function makeCustomer(): Customer
    {
        return Customer::query()->create([
            'name' => 'Cliente Condicional',
            'document' => '12345678901',
            'document_type' => 'cpf',
            'phone' => '11999990000',
            'email' => 'cliente@example.com',
            'credit_limit' => 1200,
            'active' => true,
        ]);
    }

    protected function makeProduct(array $attributes = []): Product
    {
        $supplier = Supplier::query()->first() ?? Supplier::query()->create([
            'name' => 'Fornecedor Condicional',
            'active' => true,
        ]);

        return Product::query()->create(array_merge([
            'code' => 'PRD-'.str()->random(6),
            'name' => 'Produto teste',
            'barcode' => null,
            'description' => null,
            'category_id' => null,
            'supplier_id' => $supplier->id,
            'unit' => 'UN',
            'cost_price' => 20,
            'sale_price' => 50,
            'stock_quantity' => 0,
            'min_stock' => 0,
            'active' => true,
        ], $attributes));
    }
}
