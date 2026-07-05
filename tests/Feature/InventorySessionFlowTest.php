<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\InventorySession;
use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use App\Services\Tenant\Inventory\InventoryAdjustmentService;
use App\Services\Tenant\Inventory\InventorySessionService;
use App\Services\Tenant\InventoryMovementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class InventorySessionFlowTest extends TestCase
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

    public function test_a_sale_during_snapshot_counting_does_not_create_a_false_divergence(): void
    {
        $admin = $this->createUser('admin');

        $product = Product::query()->create([
            'code' => 'ARROZ',
            'name' => 'Arroz 5kg',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 100,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sessionService = app(InventorySessionService::class);

        $session = $sessionService->create([
            'type' => 'general',
            'mode' => 'snapshot',
            'count_resolution' => 'manual_review',
        ], $admin->id);

        $session = $sessionService->start($session);
        $item = $session->items()->where('product_id', $product->id)->first();

        $this->assertSame(100.0, (float) $item->snapshot_quantity);

        // Uma venda de 10 unidades acontece durante a contagem.
        $movementService = app(InventoryMovementService::class);
        $movementService->apply($product, -10, 'sale', ['occurred_at' => now()]);

        // Operador conta 90 (100 - 10 vendidas) -> nao deveria ser divergencia real.
        $item = $sessionService->recordCount($item->fresh(), 90, 'manual', $admin->id);
        $this->assertSame('counted', $item->status);

        $sessionService->finishCounting($session->fresh());

        $adjustmentService = app(InventoryAdjustmentService::class);
        $completed = $adjustmentService->approve($session->fresh(), $admin->id);

        $this->assertSame('completed', $completed->status);

        $finalItem = $completed->items()->where('product_id', $product->id)->first();
        $this->assertSame(0.0, (float) $finalItem->final_delta);
        $this->assertSame(90.0, (float) $product->fresh()->stock_quantity);
    }

    public function test_frozen_session_blocks_selling_the_product_in_the_pos(): void
    {
        $admin = $this->createUser('admin');

        $product = Product::query()->create([
            'code' => 'FEIJAO',
            'name' => 'Feijao 1kg',
            'unit' => 'UN',
            'cost_price' => 5,
            'sale_price' => 9,
            'stock_quantity' => 50,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sessionService = app(InventorySessionService::class);
        $session = $sessionService->create(['type' => 'general', 'mode' => 'frozen', 'count_resolution' => 'manual_review'], $admin->id);
        $sessionService->start($session);

        $this->actingAs($admin);
        CashRegister::query()->create(['user_id' => $admin->id, 'status' => 'open', 'opening_amount' => 0, 'opened_at' => now()]);

        $this->expectException(ValidationException::class);

        app(\App\Services\Tenant\PosService::class)->finalize([
            'items' => [['id' => $product->id, 'qty' => 1]],
            'payments' => [['method' => 'cash', 'amount' => 9]],
        ], $admin->id);
    }

    protected function createUser(string $baseRole): User
    {
        $group = PermissionGroup::query()->where('base_role', $baseRole)->first();

        return User::query()->create([
            'name' => 'Usuario Teste',
            'username' => 'usuario-'.$baseRole,
            'password' => Hash::make('password'),
            'role' => $baseRole,
            'permission_group_id' => $group?->id,
            'is_supervisor' => true,
            'active' => true,
            'must_change_password' => false,
        ]);
    }
}
