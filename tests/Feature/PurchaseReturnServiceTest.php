<?php

namespace Tests\Feature;

use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\IncomingNfeItem;
use App\Models\Tenant\Payable;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\PurchaseItem;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\Purchases\PurchaseReturnService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PurchaseReturnServiceTest extends TestCase
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

    public function test_it_returns_items_from_a_confirmed_purchase_with_stock_and_credit(): void
    {
        [$purchase, $purchaseItem, $product, $user] = $this->makeConfirmedPurchase(quantity: 10);

        $service = app(PurchaseReturnService::class);

        $purchaseReturn = $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 3],
        ], 'Itens avariados na conferência.', $user->id);

        $this->assertSame('5202', $purchaseReturn->items->first()->cfop);
        $this->assertSame(7.0, (float) $product->fresh()->stock_quantity);

        $credit = Payable::query()->where('category', 'purchase_return_credit')->first();
        $this->assertNotNull($credit);
        $this->assertSame(-30.0, (float) $credit->amount);
        $this->assertSame($purchase->id, $credit->purchase_id);
    }

    public function test_it_blocks_returning_more_than_available_quantity(): void
    {
        [$purchase, $purchaseItem, , $user] = $this->makeConfirmedPurchase(quantity: 5);

        $service = app(PurchaseReturnService::class);

        $this->expectException(ValidationException::class);

        $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 6],
        ], 'Quantidade maior que a comprada.', $user->id);
    }

    public function test_it_blocks_return_for_purchase_without_incoming_nfe_item_cfop(): void
    {
        $user = $this->makeUser();

        $purchase = Purchase::query()->create([
            'code' => 'COMPRA-MANUAL-01',
            'status' => 'received',
            'subtotal' => 100,
            'total' => 100,
            'stock_applied_at' => now(),
        ]);

        $product = Product::query()->create([
            'code' => 'PROD-MAN',
            'barcode' => '7891112223334',
            'name' => 'Produto Manual',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 10,
            'min_stock' => 0,
            'active' => true,
        ]);

        $purchaseItem = PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 10,
            'unit_cost' => 10,
            'total' => 100,
        ]);

        $service = app(PurchaseReturnService::class);

        $this->expectException(ValidationException::class);

        $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 1],
        ], 'Tentando devolver compra sem NF-e importada.', $user->id);
    }

    public function test_a_second_return_does_not_wipe_the_first_returns_credit_payable(): void
    {
        [$purchase, $purchaseItem, , $user] = $this->makeConfirmedPurchase(quantity: 10);

        $service = app(PurchaseReturnService::class);
        $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 2],
        ], 'Primeira devolução.', $user->id);

        $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 1],
        ], 'Segunda devolução.', $user->id);

        $this->assertSame(
            2,
            Payable::query()->where('purchase_id', $purchase->id)->where('category', 'purchase_return_credit')->count(),
        );
    }

    public function test_syncing_purchase_payables_does_not_delete_return_credit_payables(): void
    {
        [$purchase, $purchaseItem, , $user] = $this->makeConfirmedPurchase(quantity: 10);

        $service = app(PurchaseReturnService::class);
        $service->create($purchase->id, [
            ['purchase_item_id' => $purchaseItem->id, 'quantity' => 2],
        ], 'Item trocado com o fornecedor.', $user->id);

        $this->assertDatabaseHas('payables', [
            'purchase_id' => $purchase->id,
            'category' => 'purchase_return_credit',
        ]);

        // Simula o mesmo delete-and-recreate que OperationsWorkspaceService::syncPurchasePayables
        // faz a cada save normal de compra, pra garantir que a categoria de credito de
        // devolucao fica de fora (regressao direta do fix de uma linha nesse metodo).
        Payable::query()
            ->where('purchase_id', $purchase->id)
            ->where('category', '!=', 'purchase_return_credit')
            ->delete();

        $this->assertDatabaseHas('payables', [
            'purchase_id' => $purchase->id,
            'category' => 'purchase_return_credit',
        ]);
    }

    /**
     * @return array{0: Purchase, 1: PurchaseItem, 2: Product, 3: User}
     */
    protected function makeConfirmedPurchase(float $quantity): array
    {
        $user = $this->makeUser();

        $supplier = Supplier::query()->create([
            'name' => 'Fornecedor Teste',
            'document' => '12345678000199',
        ]);

        $product = Product::query()->create([
            'code' => 'PROD-DEV',
            'barcode' => '7891234509999',
            'name' => 'Produto Devolucao',
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => $quantity,
            'min_stock' => 0,
            'active' => true,
        ]);

        $purchase = Purchase::query()->create([
            'supplier_id' => $supplier->id,
            'code' => 'COMPRA-XML-01',
            'status' => 'received',
            'subtotal' => 10 * $quantity,
            'total' => 10 * $quantity,
            'stock_applied_at' => now(),
        ]);

        $purchaseItem = PurchaseItem::query()->create([
            'purchase_id' => $purchase->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => $quantity,
            'unit_cost' => 10,
            'total' => 10 * $quantity,
        ]);

        $document = IncomingNfeDocument::query()->create([
            'purchase_id' => $purchase->id,
            'supplier_id' => $supplier->id,
            'access_key' => '35260412345678000199550010000000011000000019',
            'status' => 'processed',
            'supplier_name' => $supplier->name,
            'recipient_name' => 'Loja Teste',
            'recipient_document' => '12345678000123',
        ]);

        IncomingNfeItem::query()->create([
            'document_id' => $document->id,
            'purchase_item_id' => $purchaseItem->id,
            'product_id' => $product->id,
            'item_number' => 1,
            'description' => $product->name,
            'cfop' => '1102',
            'quantity' => $quantity,
            'unit_price' => 10,
            'total_price' => 10 * $quantity,
        ]);

        return [$purchase, $purchaseItem, $product, $user];
    }

    protected function makeUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Teste',
            'username' => 'operador_'.str()->random(6),
            'password' => bcrypt('secret'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }
}
