<?php

namespace Tests\Feature;

use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Models\Tenant\ProductExpiry;
use App\Models\Tenant\User;
use App\Services\Tenant\ExpiryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ExpiryFlowTest extends TestCase
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

    public function test_quick_receive_with_expiry_date_creates_a_lot_that_shows_up_in_alerts(): void
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

        $product = Product::query()->create([
            'code' => 'IOGURTE',
            'name' => 'Iogurte',
            'unit' => 'UN',
            'cost_price' => 3,
            'sale_price' => 6,
            'stock_quantity' => 0,
            'min_stock' => 0,
            'active' => true,
            'track_expiry' => true,
        ]);

        $expiresAt = now()->addDays(10)->toDateString();

        $response = $this->postJson('/api/stock/quick-receive', [
            'product_id' => $product->id,
            'quantity' => 20,
            'expiry_date' => $expiresAt,
        ]);

        $response->assertOk();

        $lot = ProductExpiry::query()->where('product_id', $product->id)->first();
        $this->assertNotNull($lot);
        $this->assertSame(20.0, (float) $lot->quantity);

        $expiryService = app(ExpiryService::class);
        $alerts = $expiryService->expiringSoon(30);
        $this->assertCount(1, $alerts);

        // Registrar perda de metade do lote por vencimento.
        $lossResponse = $this->postJson('/api/stock/register-loss', [
            'product_id' => $product->id,
            'quantity' => 5,
            'reason' => 'vencido',
            'expiry_id' => $lot->id,
        ]);

        $lossResponse->assertOk();

        $this->assertSame(15.0, (float) $lot->fresh()->quantity);
        $this->assertSame(15.0, (float) $product->fresh()->stock_quantity);

        $movement = InventoryMovement::query()->where('type', 'loss')->first();
        $this->assertNotNull($movement);
        $this->assertSame(-5.0, (float) $movement->quantity_delta);
    }
}
