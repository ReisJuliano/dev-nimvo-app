<?php

namespace Tests\Feature;

use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\User;
use App\Services\Tenant\Reports\ReportBrowserService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DeliveryAndDemographicReportsTest extends TestCase
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

    public function test_customer_segment_products_report_filters_by_age_and_gender(): void
    {
        $user = $this->createUser();
        $customer = Customer::query()->create([
            'name' => 'Cliente Perfil',
            'phone' => null,
            'birth_date' => '1998-05-10',
            'gender' => 'female',
            'credit_limit' => 0,
            'active' => true,
        ]);
        $product = Product::query()->create([
            'code' => 'PRF-001',
            'name' => 'Caneta Perfil',
            'unit' => 'UN',
            'cost_price' => 2,
            'sale_price' => 5,
            'stock_quantity' => 10,
            'min_stock' => 1,
            'active' => true,
        ]);
        $sale = Sale::query()->create([
            'sale_number' => 'VND-PRF-001',
            'customer_id' => $customer->id,
            'user_id' => $user->id,
            'subtotal' => 15,
            'discount' => 0,
            'total' => 15,
            'cost_total' => 6,
            'profit' => 9,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'created_at' => '2026-04-07 10:00:00',
            'updated_at' => '2026-04-07 10:00:00',
        ]);
        SaleItem::query()->create([
            'sale_id' => $sale->id,
            'product_id' => $product->id,
            'quantity' => 3,
            'unit_cost' => 2,
            'unit_price' => 5,
            'total' => 15,
            'profit' => 9,
        ]);

        $payload = app(ReportBrowserService::class)->show('customer-segment-products', [
            'scope' => 'range',
            'from' => '2026-04-01',
            'to' => '2026-04-30',
            'age_bucket' => '25_34',
            'gender' => 'female',
            'per_page' => 10,
            'page' => 1,
        ]);

        $this->assertSame(1, $payload['pagination']['total']);
        $this->assertSame('Caneta Perfil', $payload['rows'][0]['product_name']);
        $this->assertSame('25 a 34 anos / Feminino', $payload['rows'][0]['segment_label']);
        $this->assertSame(3.0, $payload['rows'][0]['quantity_sold']);
        $this->assertStringContainsString('product-drilldown', $payload['rows'][0]['drill_href']);

        $productPayload = app(ReportBrowserService::class)->show('product-drilldown', [
            'scope' => 'range',
            'from' => '2026-04-01',
            'to' => '2026-04-30',
            'product_id' => $product->id,
            'per_page' => 10,
            'page' => 1,
        ]);

        $this->assertSame(1, $productPayload['pagination']['total']);
        $this->assertSame('Cliente Perfil', $productPayload['rows'][0]['customer_name']);

        $customerPayload = app(ReportBrowserService::class)->show('customer-drilldown', [
            'scope' => 'range',
            'from' => '2026-04-01',
            'to' => '2026-04-30',
            'customer_id' => $customer->id,
            'per_page' => 10,
            'page' => 1,
        ]);

        $this->assertSame(1, $customerPayload['pagination']['total']);
        $this->assertSame('Caneta Perfil', $customerPayload['rows'][0]['product_name']);
        $this->assertStringContainsString('product-drilldown', $customerPayload['rows'][0]['product_drill_href']);
    }

    public function test_deliveries_overview_report_groups_orders_by_day(): void
    {
        DeliveryOrder::query()->create([
            'reference' => 'DEL-001',
            'status' => 'delivered',
            'channel' => 'delivery',
            'recipient_name' => 'Cliente Entrega',
            'address' => 'Rua Teste, 10',
            'neighborhood' => 'Centro',
            'courier_name' => 'Motoboy A',
            'delivery_fee' => 7,
            'order_total' => 80,
            'scheduled_for' => '2026-04-08 12:00:00',
            'dispatched_at' => '2026-04-08 12:10:00',
            'delivered_at' => '2026-04-08 12:35:00',
        ]);

        $payload = app(ReportBrowserService::class)->show('deliveries-overview', [
            'scope' => 'range',
            'from' => '2026-04-01',
            'to' => '2026-04-30',
            'per_page' => 10,
            'page' => 1,
        ]);

        $this->assertSame(1, $payload['pagination']['total']);
        $this->assertSame('2026-04-08', $payload['rows'][0]['reference_date']);
        $this->assertSame(1, $payload['rows'][0]['orders_count']);
        $this->assertSame(87.0, $payload['rows'][0]['gross_total']);
        $this->assertSame(25, $payload['rows'][0]['avg_delivery_minutes']);
    }

    protected function createUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_segmento',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }
}
