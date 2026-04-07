<?php

namespace Tests\Feature;

use App\Models\Tenant\Customer;
use App\Models\Tenant\Sale;
use App\Models\Tenant\User;
use App\Services\Tenant\Reports\ReportBrowserService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerRankingReportTest extends TestCase
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

    public function test_customer_ranking_report_paginates_sales_with_customer_join(): void
    {
        $user = User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_relatorio',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);

        $customer = Customer::query()->create([
            'name' => 'Cliente Frequente',
            'phone' => null,
            'credit_limit' => 0,
            'active' => true,
        ]);

        Sale::query()->create([
            'sale_number' => 'VND-REL-001',
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'cash_register_id' => null,
            'subtotal' => 120,
            'discount' => 0,
            'total' => 120,
            'cost_total' => 80,
            'profit' => 40,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'created_at' => '2026-04-07 10:00:00',
            'updated_at' => '2026-04-07 10:00:00',
        ]);

        $payload = app(ReportBrowserService::class)->show('customer-ranking', [
            'scope' => 'range',
            'from' => '2026-04-01',
            'to' => '2026-04-30',
            'per_page' => 10,
            'page' => 1,
        ]);

        $this->assertSame(1, $payload['pagination']['total']);
        $this->assertSame('Cliente Frequente', $payload['rows'][0]['customer_name']);
        $this->assertSame(1, $payload['rows'][0]['sales_count']);
        $this->assertSame(120.0, $payload['rows'][0]['total']);
    }
}
