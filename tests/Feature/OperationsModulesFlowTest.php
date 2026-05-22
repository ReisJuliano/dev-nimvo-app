<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\OperationsWorkspaceService;
use App\Services\Tenant\PosService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class OperationsModulesFlowTest extends TestCase
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

    public function test_stock_inbound_entry_creates_received_purchase_and_updates_stock(): void
    {
        $user = $this->makeUser();
        $supplier = $this->makeSupplier();
        $product = $this->makeProduct([
            'code' => 'ENT-001',
            'barcode' => '7890001112223',
            'name' => 'Arroz 5kg',
            'supplier_id' => $supplier->id,
            'cost_price' => 22,
            'sale_price' => 34,
            'stock_quantity' => 4,
        ]);

        $service = app(OperationsWorkspaceService::class);

        $response = $service->store('entrada-estoque', [
            'supplier_id' => $supplier->id,
            'invoice_number' => 'NF-2026-001',
            'billing_barcode' => '34191790010104351004791020150008291070026000',
            'billing_amount' => 145.67,
            'billing_due_date' => '2026-04-20',
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 6,
                    'unit_cost' => 21.5,
                ],
            ],
        ], $user->id);

        $this->assertSame(10.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame('received', $response['record']['status']);
        $this->assertSame('NF-2026-001', $response['record']['invoice_number']);
        $this->assertSame('34191790010104351004791020150008291070026000', $response['record']['billing_barcode']);
        $this->assertSame(145.67, (float) $response['record']['billing_amount']);
        $this->assertDatabaseHas('purchases', [
            'supplier_id' => $supplier->id,
            'status' => 'received',
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'purchase',
        ]);
    }

    public function test_received_purchase_updates_stock_and_logs_movement(): void
    {
        $user = $this->makeUser();
        $product = $this->makeProduct([
            'code' => 'CMP-001',
            'name' => 'Racao premium',
            'cost_price' => 18,
            'sale_price' => 29,
            'stock_quantity' => 3,
        ]);

        $service = app(OperationsWorkspaceService::class);

        $response = $service->store('compras', [
            'status' => 'received',
            'freight' => 12.5,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5,
                    'unit_cost' => 17.2,
                ],
            ],
        ], $user->id);

        $this->assertSame(8.0, (float) $product->fresh()->stock_quantity);
        $this->assertNotEmpty($response['record']['stock_applied_at']);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'purchase',
        ]);
    }

    public function test_draft_purchase_can_be_created_without_items(): void
    {
        $user = $this->makeUser();
        $service = app(OperationsWorkspaceService::class);

        $response = $service->store('compras', [
            'custom_name' => 'Reposicao de sabado',
            'status' => 'draft',
            'items' => [],
        ], $user->id);

        $this->assertSame('draft', $response['record']['status']);
        $this->assertSame('Reposicao de sabado', $response['record']['custom_name']);
        $this->assertSame(0, $response['record']['items_count']);
        $this->assertSame(0.0, (float) $response['record']['total']);
        $this->assertDatabaseHas('purchases', [
            'status' => 'draft',
            'subtotal' => 0,
            'total' => 0,
        ]);
    }

    public function test_delivery_records_require_filters_and_support_precise_search(): void
    {
        $customer = $this->makeCustomer(['name' => 'Maria Entrega']);
        $otherCustomer = $this->makeCustomer(['name' => 'Joao Retirada']);

        DeliveryOrder::query()->create([
            'customer_id' => $customer->id,
            'reference' => 'DEL-001',
            'status' => 'pending',
            'channel' => 'delivery',
            'recipient_name' => 'Maria Entrega',
            'phone' => '11999990000',
            'courier_name' => 'Carlos',
            'address' => 'Rua A, 100',
            'neighborhood' => 'Centro',
            'delivery_fee' => 8.50,
            'order_total' => 41.50,
            'scheduled_for' => '2026-05-20 18:30:00',
            'notes' => 'Casa azul',
        ]);

        DeliveryOrder::query()->create([
            'customer_id' => $customer->id,
            'reference' => 'DEL-002',
            'status' => 'delivered',
            'channel' => 'delivery',
            'recipient_name' => 'Maria Entrega',
            'phone' => '11999990000',
            'courier_name' => 'Carlos',
            'address' => 'Rua A, 100',
            'neighborhood' => 'Centro',
            'delivery_fee' => 5.00,
            'order_total' => 20.00,
            'scheduled_for' => '2026-05-21 12:00:00',
            'notes' => null,
        ]);

        DeliveryOrder::query()->create([
            'customer_id' => $otherCustomer->id,
            'reference' => 'DEL-003',
            'status' => 'pending',
            'channel' => 'retirada',
            'recipient_name' => 'Joao Retirada',
            'phone' => '11888880000',
            'courier_name' => null,
            'address' => '',
            'neighborhood' => null,
            'delivery_fee' => 0,
            'order_total' => 50.00,
            'scheduled_for' => '2026-05-20 19:00:00',
            'notes' => null,
        ]);

        $service = app(OperationsWorkspaceService::class);

        $this->assertSame([], $service->records('delivery')['records']);

        $customerOnly = $service->records('delivery', [
            'customer_id' => (string) $customer->id,
        ]);

        $this->assertCount(2, $customerOnly['records']);

        $customerAndStatus = $service->records('delivery', [
            'customer_id' => (string) $customer->id,
            'status' => 'pending',
        ]);

        $this->assertCount(1, $customerAndStatus['records']);

        $customerAndValue = $service->records('delivery', [
            'customer_id' => (string) $customer->id,
            'value' => '50.00',
        ]);

        $this->assertCount(1, $customerAndValue['records']);

        $customerAndDate = $service->records('delivery', [
            'customer_id' => (string) $customer->id,
            'date' => '2026-05-20',
        ]);

        $this->assertCount(1, $customerAndDate['records']);

        $response = $service->records('delivery', [
            'customer_id' => (string) $customer->id,
            'value' => '50.00',
            'date' => '2026-05-20',
            'from' => '2026-05-19',
            'to' => '2026-05-20',
            'status' => 'pending',
        ]);

        $this->assertCount(1, $response['records']);
        $this->assertSame('DEL-001', $response['records'][0]['reference']);
        $this->assertSame('Maria Entrega', $response['records'][0]['customer_name']);
    }

    public function test_purchase_records_require_period_and_filter_by_created_date(): void
    {
        $user = $this->makeUser();
        $service = app(OperationsWorkspaceService::class);

        Carbon::setTestNow('2026-05-20 09:00:00');
        $service->store('compras', [
            'custom_name' => 'Compra 20',
            'status' => 'draft',
            'items' => [],
        ], $user->id);

        Carbon::setTestNow('2026-05-21 10:00:00');
        $service->store('compras', [
            'custom_name' => 'Compra 21',
            'status' => 'draft',
            'items' => [],
        ], $user->id);

        Carbon::setTestNow();

        $this->assertSame([], $service->records('compras')['records']);

        $sameDay = $service->records('compras', [
            'from' => '2026-05-20',
            'to' => '2026-05-20',
        ]);

        $this->assertCount(1, $sameDay['records']);
        $this->assertSame('Compra 20', $sameDay['records'][0]['custom_name']);

        $exactDate = $service->records('compras', [
            'date' => '2026-05-21',
        ]);

        $this->assertCount(1, $exactDate['records']);
        $this->assertSame('Compra 21', $exactDate['records'][0]['custom_name']);
    }

    public function test_stock_movement_workspace_updates_product_to_informed_balance(): void
    {
        $user = $this->makeUser();
        $product = $this->makeProduct([
            'code' => 'MOV-001',
            'name' => 'Feijao preto',
            'stock_quantity' => 11,
        ]);

        $service = app(OperationsWorkspaceService::class);

        $response = $service->store('movimentacao-estoque', [
            'product_id' => $product->id,
            'counted_quantity' => 7,
            'reason' => 'Ajuste do corredor',
        ], $user->id);

        $this->assertSame(7.0, (float) $product->fresh()->stock_quantity);
        $this->assertSame('manual_adjustment', $response['record']['type']);
        $this->assertSame(-4.0, (float) $response['record']['quantity_delta']);
        $this->assertSame(7.0, (float) $response['record']['counted_quantity']);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'manual_adjustment',
        ]);
    }

    public function test_pos_finalize_creates_sale_and_inventory_movement(): void
    {
        $user = $this->makeUser();
        $product = $this->makeProduct([
            'code' => 'PDV-001',
            'name' => 'Cafe torrado',
            'cost_price' => 6,
            'sale_price' => 12,
            'stock_quantity' => 10,
        ]);

        CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 100,
            'opened_at' => now(),
        ]);

        $service = app(PosService::class);

        $sale = $service->finalize([
            'discount' => 0,
            'items' => [
                [
                    'id' => $product->id,
                    'qty' => 2,
                    'discount' => 0,
                ],
            ],
            'payments' => [
                [
                    'method' => 'cash',
                ],
            ],
        ], $user->id);

        $this->assertSame(8.0, (float) $product->fresh()->stock_quantity);
        $this->assertArrayHasKey('sale_number', $sale);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'type' => 'sale',
        ]);
        $this->assertSame(1, InventoryMovement::query()->count());
    }

    protected function makeUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_'.str()->random(6),
            'password' => bcrypt('secret'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    protected function makeSupplier(): Supplier
    {
        return Supplier::query()->create([
            'name' => 'Fornecedor Teste',
            'active' => true,
        ]);
    }

    protected function makeCustomer(array $attributes = []): Customer
    {
        return Customer::query()->create(array_merge([
            'name' => 'Cliente Teste',
            'phone' => null,
            'active' => true,
        ], $attributes));
    }

    protected function makeProduct(array $attributes = []): Product
    {
        return Product::query()->create(array_merge([
            'code' => 'PRD-'.str()->random(6),
            'name' => 'Produto teste',
            'barcode' => null,
            'description' => null,
            'category_id' => null,
            'supplier_id' => null,
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 0,
            'min_stock' => 0,
            'active' => true,
        ], $attributes));
    }
}
