<?php

namespace Tests\Feature;

use App\Models\Tenant\Payable;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\User;
use App\Services\Tenant\OperationsWorkspaceService;
use App\Services\Tenant\Reports\ReportBrowserService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class CashFlowDreFlowTest extends TestCase
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

    public function test_dre_totals_reconcile_with_sales_and_payables_for_the_month(): void
    {
        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
        $this->actingAs($user);

        $product = Product::query()->create([
            'code' => 'ARROZ',
            'name' => 'Arroz',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 100,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-TEST-1',
            'user_id' => $user->id,
            'subtotal' => 200,
            'discount' => 0,
            'total' => 200,
            'cost_total' => 100,
            'profit' => 100,
            'payment_method' => 'cash',
            'status' => 'finalized',
        ]);

        SaleItem::query()->create([
            'sale_id' => $sale->id,
            'product_id' => $product->id,
            'quantity' => 10,
            'unit_cost' => 10,
            'unit_price' => 20,
            'total' => 200,
            'profit' => 100,
        ]);

        $payable = Payable::query()->create([
            'code' => 'PAG-TEST-1',
            'description' => 'Aluguel',
            'category' => 'rent',
            'status' => 'paid',
            'amount' => 50,
            'amount_paid' => 50,
            'paid_at' => now(),
            'recurrence' => 'monthly',
        ]);

        $report = app(ReportBrowserService::class)->show('dre-simplified', ['scope' => 'month']);

        $rowsByCategory = collect($report['rows'])->keyBy('category');

        $this->assertSame(200.0, $rowsByCategory['Receita bruta']['current']);
        $this->assertSame(-100.0, $rowsByCategory['CMV']['current']);
        $this->assertSame(100.0, $rowsByCategory['Margem bruta']['current']);
        $this->assertSame(-50.0, $rowsByCategory['Despesa: Aluguel']['current']);
        $this->assertSame(50.0, $rowsByCategory['Resultado operacional']['current']);
        $this->assertSame(50.0, $rowsByCategory['Resultado final']['current']);

        // Pagar a conta recorrente deve gerar a proxima automaticamente.
        app(OperationsWorkspaceService::class)->update('contas-a-pagar', $payable->id, [
            'action' => 'register_payment',
            'payment_amount' => 50,
            'payment_date' => now()->toDateString(),
            'payment_method' => 'cash',
        ], $user->id);

        $this->assertSame(2, Payable::query()->count());
        $next = Payable::query()->where('id', '!=', $payable->id)->first();
        $this->assertSame('open', $next->status);
        $this->assertSame(50.0, (float) $next->amount);
    }
}
