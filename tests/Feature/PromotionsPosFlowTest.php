<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Models\Tenant\User;
use App\Services\Tenant\PosService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class PromotionsPosFlowTest extends TestCase
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

    public function test_buy_3_pay_2_charges_the_correct_total_and_records_the_promotion_on_the_sale_item(): void
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

        $cashRegister = CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'REFRI',
            'name' => 'Refrigerante 2L',
            'unit' => 'UN',
            'cost_price' => 4,
            'sale_price' => 8,
            'stock_quantity' => 100,
            'min_stock' => 0,
            'active' => true,
        ]);

        Promotion::query()->create([
            'name' => 'Leve 3 pague 2',
            'type' => 'buy_x_pay_y',
            'scope' => 'product',
            'product_id' => $product->id,
            'discount_value' => 0,
            'config' => ['buy_quantity' => 3, 'pay_quantity' => 2],
            'active' => true,
        ]);

        $result = app(PosService::class)->finalize([
            'cash_register_id' => $cashRegister->id,
            'items' => [['id' => $product->id, 'qty' => 7]],
            'payments' => [['method' => 'cash', 'amount' => 40]],
        ], $user->id);

        $sale = \App\Models\Tenant\Sale::query()->findOrFail($result['sale_id']);
        $item = $sale->items()->first();

        // 7 unidades: paga 5 (2 grupos de 3 pagando 2, mais 1 avulsa) x R$8 = R$40.
        $this->assertSame(40.0, (float) $sale->total);
        $this->assertSame(16.0, (float) $item->discount_amount);
        $this->assertNotNull($item->promotion_id);
    }
}
