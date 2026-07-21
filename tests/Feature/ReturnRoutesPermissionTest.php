<?php

namespace Tests\Feature;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\IncomingNfeItem;
use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\PurchaseItem;
use App\Models\Tenant\Sale;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class ReturnRoutesPermissionTest extends TestCase
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

        app(TenantSettingsService::class)->update([
            'business' => ['preset' => TenantSettingsService::CUSTOM_PRESET],
            'modules' => [
                'compras' => true,
                'entrada_estoque_avancado' => true,
            ],
        ]);
    }

    public function test_operator_without_grant_cannot_register_a_sale_return(): void
    {
        $operator = $this->actingOperatorWithoutGrants();
        $sale = $this->makeSaleWithItem($operator);

        $response = $this->postJson("/api/sales/{$sale['sale']->id}/returns", [
            'items' => [['sale_item_id' => $sale['item']->id, 'quantity' => 1]],
            'reason' => 'Produto com defeito.',
            'refund_method' => 'none',
        ]);

        $response->assertForbidden();
    }

    public function test_admin_can_register_and_the_default_operator_can_register_a_sale_return(): void
    {
        $admin = $this->actingAdmin();
        $sale = $this->makeSaleWithItem($admin);

        $response = $this->postJson("/api/sales/{$sale['sale']->id}/returns", [
            'items' => [['sale_item_id' => $sale['item']->id, 'quantity' => 1]],
            'reason' => 'Produto com defeito.',
            'refund_method' => 'none',
        ]);

        $response->assertStatus(201);
    }

    public function test_operator_without_grant_cannot_register_a_purchase_return(): void
    {
        $operator = $this->actingOperatorWithoutGrants();
        $purchase = $this->makePurchaseWithIncomingItem();

        $response = $this->postJson("/api/purchases/{$purchase['purchase']->id}/returns", [
            'items' => [['purchase_item_id' => $purchase['item']->id, 'quantity' => 1]],
            'reason' => 'Item avariado.',
        ]);

        $response->assertForbidden();
    }

    public function test_admin_can_register_a_purchase_return_and_view_it(): void
    {
        $this->actingAdmin();
        $purchase = $this->makePurchaseWithIncomingItem();

        $store = $this->postJson("/api/purchases/{$purchase['purchase']->id}/returns", [
            'items' => [['purchase_item_id' => $purchase['item']->id, 'quantity' => 1]],
            'reason' => 'Item avariado na conferência.',
        ]);

        $store->assertStatus(201);

        $purchaseReturnId = $store->json('purchase_return.id');

        $this->getJson("/api/purchase-returns/{$purchaseReturnId}")
            ->assertOk()
            ->assertJsonPath('purchase_return.reason', 'Item avariado na conferência.');
    }

    public function test_operator_without_fiscal_emitir_devolucao_cannot_issue_fiscal_document(): void
    {
        $admin = $this->actingAdmin();
        $purchase = $this->makePurchaseWithIncomingItem();

        $store = $this->postJson("/api/purchases/{$purchase['purchase']->id}/returns", [
            'items' => [['purchase_item_id' => $purchase['item']->id, 'quantity' => 1]],
            'reason' => 'Item avariado na conferência.',
        ])->assertStatus(201);

        $purchaseReturnId = $store->json('purchase_return.id');

        $this->actingOperatorWithoutGrants();

        $this->postJson("/api/purchase-returns/{$purchaseReturnId}/issue-fiscal")
            ->assertForbidden();
    }

    protected function actingAdmin(): User
    {
        $group = PermissionGroup::query()->where('base_role', 'admin')->first();

        $user = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'admin',
            'permission_group_id' => $group?->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    protected function actingOperatorWithoutGrants(): User
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $user = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_'.str()->random(6),
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($user);

        return $user;
    }

    /**
     * @return array{sale: Sale, item: \App\Models\Tenant\SaleItem}
     */
    protected function makeSaleWithItem(User $user): array
    {
        $cashRegister = CashRegister::query()->create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_amount' => 0,
            'opened_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'PROD-ROUTE-VENDA',
            'barcode' => '7891234500033',
            'name' => 'Produto Rota Venda',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $sale = Sale::query()->create([
            'sale_number' => 'VND-ROTA-'.str()->random(6),
            'customer_id' => null,
            'user_id' => $user->id,
            'cash_register_id' => $cashRegister->id,
            'subtotal' => 20,
            'discount' => 0,
            'total' => 20,
            'cost_total' => 10,
            'profit' => 10,
            'payment_method' => 'cash',
            'status' => 'finalized',
            'notes' => 'Venda de teste de rota',
        ]);

        $item = $sale->items()->create([
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_cost' => 10,
            'unit_price' => 20,
            'total' => 20,
            'profit' => 10,
        ]);

        return ['sale' => $sale, 'item' => $item];
    }

    /**
     * @return array{purchase: Purchase, item: PurchaseItem}
     */
    protected function makePurchaseWithIncomingItem(): array
    {
        $supplier = Supplier::query()->create([
            'name' => 'Fornecedor Rota',
            'document' => '12345678000199',
        ]);

        $product = Product::query()->create([
            'code' => 'PROD-ROUTE-COMPRA',
            'barcode' => '7891234500044',
            'name' => 'Produto Rota Compra',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $purchase = Purchase::query()->create([
            'supplier_id' => $supplier->id,
            'code' => 'COMPRA-ROTA-'.str()->random(6),
            'status' => 'received',
            'subtotal' => 100,
            'total' => 100,
            'stock_applied_at' => now(),
        ]);

        $item = PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 10,
            'unit_cost' => 10,
            'total' => 100,
        ]);

        $document = IncomingNfeDocument::query()->create([
            'purchase_id' => $purchase->id,
            'supplier_id' => $supplier->id,
            'access_key' => '3526041234567800019955001000000001100000'.rand(10, 99),
            'status' => 'processed',
            'supplier_name' => $supplier->name,
            'recipient_name' => 'Loja Rota',
            'recipient_document' => '12345678000123',
        ]);

        IncomingNfeItem::query()->create([
            'document_id' => $document->id,
            'purchase_item_id' => $item->id,
            'product_id' => $product->id,
            'item_number' => 1,
            'description' => $product->name,
            'cfop' => '1102',
            'quantity' => 10,
            'unit_price' => 10,
            'total_price' => 100,
        ]);

        return ['purchase' => $purchase, 'item' => $item];
    }
}
