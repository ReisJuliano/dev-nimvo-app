<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use App\Services\Tenant\PosService;
use App\Services\Tenant\ReceivablesOverviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ReceivablesFlowTest extends TestCase
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

    public function test_credit_sale_over_the_limit_is_blocked_and_a_supervisor_can_override_it(): void
    {
        $supervisor = User::query()->create([
            'name' => 'Gerente',
            'username' => 'gerente',
            'password' => Hash::make('password'),
            'role' => 'manager',
            'is_supervisor' => true,
            'active' => true,
            'must_change_password' => false,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);
        $this->actingAs($operator);

        $cashRegister = CashRegister::query()->create([
            'user_id' => $operator->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $customer = Customer::query()->create(['name' => 'Cliente Fiel', 'credit_limit' => 50]);

        $product = Product::query()->create([
            'code' => 'ARROZ',
            'name' => 'Arroz',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 100,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $payload = [
            'cash_register_id' => $cashRegister->id,
            'customer_id' => $customer->id,
            'items' => [['id' => $product->id, 'qty' => 1]],
            'payments' => [['method' => 'credit', 'amount' => 100]],
        ];

        $blocked = false;

        try {
            app(PosService::class)->finalize($payload, $operator->id);
        } catch (ValidationException) {
            $blocked = true;
        }

        $this->assertTrue($blocked, 'A venda fiado acima do limite deveria ser bloqueada sem autorização.');

        $payload['credit_limit_override'] = [
            'supervisor_user_id' => $supervisor->id,
            'supervisor_password' => 'password',
        ];

        $result = app(PosService::class)->finalize($payload, $operator->id);
        $this->assertNotEmpty($result['sale_id']);

        $overview = app(ReceivablesOverviewService::class)->overview();
        $row = $overview->firstWhere('customer_id', $customer->id);
        $this->assertNotNull($row);
        $this->assertSame(100.0, $row['credit_balance']);
    }
}
