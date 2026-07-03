<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Product;
use App\Models\Tenant\SalePayment;
use App\Models\Tenant\User;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class PosPaymentDetailsTest extends TestCase
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

    public function test_it_records_check_payment_details_from_pos_sale(): void
    {
        $user = $this->actingOperator();
        $cashRegister = CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 50,
            'opened_at' => now(),
        ]);
        $product = Product::query()->create([
            'code' => 'CHK-001',
            'barcode' => '7890000000011',
            'name' => 'Produto cheque',
            'description' => 'Teste',
            'unit' => 'UN',
            'cost_price' => 5,
            'sale_price' => 20,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $this->postJson('/api/pdv/sales', [
            'cash_register_id' => $cashRegister->id,
            'discount' => 0,
            'fiscal_decision' => 'close',
            'requested_document_model' => '65',
            'items' => [
                [
                    'id' => $product->id,
                    'qty' => 1,
                    'unit_price' => 20,
                    'discount' => 0,
                ],
            ],
            'payments' => [
                [
                    'method' => PaymentMethod::CHECK,
                    'amount' => 20,
                    'details' => [
                        'bank' => '001',
                        'agency' => '1234',
                        'account' => '98765-0',
                        'check_number' => '456',
                        'issuer_name' => 'Cliente Teste',
                        'issuer_document' => '123.456.789-09',
                        'deposit_date' => '2026-07-10',
                    ],
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('sale.payment_method', PaymentMethod::CHECK);

        $payment = SalePayment::query()->firstOrFail();

        $this->assertSame(PaymentMethod::CHECK, $payment->payment_method);
        $this->assertSame('001', $payment->payment_details['bank']);
        $this->assertSame('12345678909', $payment->payment_details['issuer_document']);
        $this->assertSame('2026-07-10', $payment->payment_details['deposit_date']);
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }
}
