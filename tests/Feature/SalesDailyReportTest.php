<?php

namespace Tests\Feature;

use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use App\Services\Tenant\Reports\ReportBrowserService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SalesDailyReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();
    }

    public function test_sales_daily_report_defaults_scope_to_month_when_request_scope_is_missing(): void
    {
        $payload = app(ReportBrowserService::class)->show('sales-daily', []);

        $this->assertFalse($payload['filtersApplied']);
        $this->assertSame('month', $payload['filters']['scope']);
    }

    public function test_sales_daily_report_supports_year_scope_with_reference_date_sorting(): void
    {
        $user = User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_vendas_diarias',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);

        Sale::query()->forceCreate([
            'sale_number' => 'VND-DIA-001',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => null,
            'subtotal' => 120,
            'discount' => 0,
            'total' => 120,
            'cost_total' => 80,
            'profit' => 40,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'created_at' => '2026-02-10 10:00:00',
            'updated_at' => '2026-02-10 10:00:00',
        ]);

        Sale::query()->forceCreate([
            'sale_number' => 'VND-DIA-002',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => null,
            'subtotal' => 180,
            'discount' => 0,
            'total' => 180,
            'cost_total' => 110,
            'profit' => 70,
            'payment_method' => 'pix',
            'status' => 'finalized',
            'created_at' => '2026-04-08 15:00:00',
            'updated_at' => '2026-04-08 15:00:00',
        ]);

        Sale::query()->forceCreate([
            'sale_number' => 'VND-DIA-003',
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => null,
            'subtotal' => 90,
            'discount' => 0,
            'total' => 90,
            'cost_total' => 65,
            'profit' => 25,
            'payment_method' => 'credit_card',
            'status' => 'finalized',
            'created_at' => '2025-12-31 22:00:00',
            'updated_at' => '2025-12-31 22:00:00',
        ]);

        $payload = app(ReportBrowserService::class)->show('sales-daily', [
            'scope' => 'year',
            'year' => '2026',
            'sort_by' => 'reference_date',
            'sort_direction' => 'desc',
            'per_page' => 20,
            'page' => 1,
        ]);

        $this->assertTrue($payload['filtersApplied']);
        $this->assertSame('year', $payload['filters']['scope']);
        $this->assertSame('2026-01-01', $payload['filters']['from']);
        $this->assertSame('2026-12-31', $payload['filters']['to']);
        $this->assertSame(2, $payload['pagination']['total']);
        $this->assertSame('2026-04-08', $payload['rows'][0]['reference_date']);
        $this->assertSame('2026-02-10', $payload['rows'][1]['reference_date']);
    }
}
