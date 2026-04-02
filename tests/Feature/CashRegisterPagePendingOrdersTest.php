<?php

namespace Tests\Feature;

use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class CashRegisterPagePendingOrdersTest extends TestCase
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

    public function test_it_preloads_pending_orders_in_cash_register_page_payload(): void
    {
        $user = $this->actingOperator();

        $pendingDraft = $this->makeDraft($user, [
            'type' => 'comanda',
            'reference' => 'A12',
            'status' => OrderDraft::STATUS_SENT_TO_CASHIER,
            'subtotal' => 24,
            'total' => 24,
            'sent_to_cashier_at' => now()->subMinutes(5),
        ]);

        $pendingDraft->items()->create([
            'product_id' => null,
            'product_name' => 'Suco natural',
            'product_code' => 'SUC-01',
            'product_barcode' => null,
            'unit' => 'UN',
            'quantity' => 2,
            'unit_cost' => 5,
            'unit_price' => 12,
            'total' => 24,
        ]);

        $draftOnly = $this->makeDraft($user, [
            'type' => 'comanda',
            'reference' => 'B15',
            'status' => OrderDraft::STATUS_DRAFT,
            'subtotal' => 12,
            'total' => 12,
        ]);

        $draftOnly->items()->create([
            'product_id' => null,
            'product_name' => 'Agua',
            'product_code' => 'AGUA-01',
            'product_barcode' => null,
            'unit' => 'UN',
            'quantity' => 1,
            'unit_cost' => 2,
            'unit_price' => 12,
            'total' => 12,
        ]);

        $response = $this->get('/caixa');

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('CashRegister/Index')
            ->has('pendingOrderDrafts', 1)
            ->where('pendingOrderDrafts.0.id', $pendingDraft->id)
            ->where('pendingOrderDrafts.0.reference', 'A12')
            ->where('pendingOrderDrafts.0.status', OrderDraft::STATUS_SENT_TO_CASHIER)
            ->where('pendingOrderDrafts.0.total', 24)
        );
    }

    protected function actingOperator(): User
    {
        $user = User::query()->create([
            'name' => 'Operador do caixa',
            'username' => 'caixa_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'operator',
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function makeDraft(User $user, array $attributes = []): OrderDraft
    {
        return OrderDraft::query()->create(array_merge([
            'user_id' => $user->id,
            'type' => 'comanda',
            'reference' => null,
            'status' => OrderDraft::STATUS_DRAFT,
            'subtotal' => 0,
            'total' => 0,
            'cost_total' => 0,
            'profit' => 0,
            'notes' => null,
            'sent_to_cashier_at' => null,
            'completed_at' => null,
        ], $attributes));
    }
}
