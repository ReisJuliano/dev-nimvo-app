<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\OperationsWorkspaceService;
use App\Services\Tenant\PosService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationsModulesFlowTest extends TestCase
{
    use RefreshDatabase;

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
