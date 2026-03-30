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

    public function test_completed_production_consumes_recipe_items_and_adds_output_stock(): void
    {
        $user = $this->makeUser();
        $ingredient = $this->makeProduct([
            'code' => 'ING-001',
            'name' => 'Farinha especial',
            'cost_price' => 4,
            'sale_price' => 7,
            'stock_quantity' => 20,
        ]);
        $output = $this->makeProduct([
            'code' => 'PRD-001',
            'name' => 'Pao frances',
            'cost_price' => 1.5,
            'sale_price' => 2.5,
            'stock_quantity' => 5,
        ]);

        $service = app(OperationsWorkspaceService::class);

        $recipe = $service->store('fichas-tecnicas', [
            'name' => 'Pao frances',
            'product_id' => $output->id,
            'yield_quantity' => 10,
            'yield_unit' => 'UN',
            'prep_time_minutes' => 45,
            'instructions' => 'Misturar, sovar e assar.',
            'active' => true,
            'items' => [
                [
                    'product_id' => $ingredient->id,
                    'quantity' => 4,
                    'unit' => 'KG',
                ],
            ],
        ], $user->id);

        $service->store('producao', [
            'recipe_id' => $recipe['record']['id'],
            'status' => 'completed',
            'planned_quantity' => 20,
            'produced_quantity' => 20,
            'unit' => 'UN',
            'scheduled_for' => now()->format('Y-m-d'),
            'notes' => 'Lote da manha',
        ], $user->id);

        $this->assertSame(12.0, (float) $ingredient->fresh()->stock_quantity);
        $this->assertSame(25.0, (float) $output->fresh()->stock_quantity);
        $this->assertDatabaseCount('inventory_movements', 2);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $ingredient->id,
            'type' => 'production_consume',
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $output->id,
            'type' => 'production_output',
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
