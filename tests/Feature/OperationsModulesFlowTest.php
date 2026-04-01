<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use App\Services\Tenant\OperationsWorkspaceService;
use App\Services\Tenant\PosService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OperationsModulesFlowTest extends TestCase
{
    use RefreshDatabase;

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
