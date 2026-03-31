<?php

namespace Tests\Feature;

use App\Models\Tenant\KitchenTicket;
use App\Models\Tenant\Product;
use App\Models\Tenant\User;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OrderKitchenIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_syncs_only_products_that_require_preparation_to_kitchen(): void
    {
        $this->enableKitchenModule();

        $user = $this->makeUser();
        $preparedProduct = $this->makeProduct([
            'code' => 'COZ-001',
            'name' => 'Lasanha da casa',
            'requires_preparation' => true,
        ]);
        $readyProduct = $this->makeProduct([
            'code' => 'COZ-002',
            'name' => 'Refrigerante lata',
            'requires_preparation' => false,
        ]);

        $service = app(OrderDraftService::class);
        $draft = $service->create($user->id, [
            'type' => 'comanda',
            'reference' => '22',
        ]);

        $service->save($draft, [
            'type' => 'comanda',
            'channel' => 'store',
            'reference' => '22',
            'customer_id' => null,
            'notes' => null,
            'items' => [
                ['id' => $preparedProduct->id, 'qty' => 2],
                ['id' => $readyProduct->id, 'qty' => 1],
            ],
        ]);

        $ticket = KitchenTicket::query()->where('order_draft_id', $draft->id)->first();

        $this->assertNotNull($ticket);
        $this->assertDatabaseHas('kitchen_ticket_items', [
            'kitchen_ticket_id' => $ticket->id,
            'product_id' => $preparedProduct->id,
        ]);
        $this->assertDatabaseMissing('kitchen_ticket_items', [
            'kitchen_ticket_id' => $ticket->id,
            'product_id' => $readyProduct->id,
        ]);
    }

    public function test_it_removes_kitchen_ticket_when_no_preparation_items_remain(): void
    {
        $this->enableKitchenModule();

        $user = $this->makeUser();
        $preparedProduct = $this->makeProduct([
            'code' => 'COZ-101',
            'name' => 'Prato executivo',
            'requires_preparation' => true,
        ]);
        $readyProduct = $this->makeProduct([
            'code' => 'COZ-102',
            'name' => 'Suco pronto',
            'requires_preparation' => false,
        ]);

        $service = app(OrderDraftService::class);
        $draft = $service->create($user->id, [
            'type' => 'comanda',
            'reference' => '77',
        ]);

        $service->save($draft, [
            'type' => 'comanda',
            'channel' => 'store',
            'reference' => '77',
            'customer_id' => null,
            'notes' => null,
            'items' => [
                ['id' => $preparedProduct->id, 'qty' => 1],
            ],
        ]);

        $ticketId = KitchenTicket::query()
            ->where('order_draft_id', $draft->id)
            ->value('id');

        $this->assertNotNull($ticketId);

        $service->save($draft->fresh(), [
            'type' => 'comanda',
            'channel' => 'store',
            'reference' => '77',
            'customer_id' => null,
            'notes' => null,
            'items' => [
                ['id' => $readyProduct->id, 'qty' => 1],
            ],
        ]);

        $this->assertDatabaseMissing('kitchen_tickets', ['id' => $ticketId]);
    }

    public function test_it_syncs_kitchen_items_when_done_at_column_is_missing(): void
    {
        $this->enableKitchenModule();
        Schema::table('kitchen_ticket_items', fn ($table) => $table->dropColumn('done_at'));

        $user = $this->makeUser();
        $preparedProduct = $this->makeProduct([
            'code' => 'COZ-201',
            'name' => 'Batata frita',
            'requires_preparation' => true,
        ]);

        $service = app(OrderDraftService::class);
        $draft = $service->create($user->id, [
            'type' => 'comanda',
            'reference' => '90',
        ]);

        $service->save($draft, [
            'type' => 'comanda',
            'channel' => 'store',
            'reference' => '90',
            'customer_id' => null,
            'notes' => null,
            'items' => [
                ['id' => $preparedProduct->id, 'qty' => 1],
            ],
        ]);

        $ticket = KitchenTicket::query()->where('order_draft_id', $draft->id)->first();

        $this->assertNotNull($ticket);
        $this->assertDatabaseHas('kitchen_ticket_items', [
            'kitchen_ticket_id' => $ticket->id,
            'product_id' => $preparedProduct->id,
        ]);
    }

    protected function enableKitchenModule(): void
    {
        $settingsService = app(TenantSettingsService::class);
        $settings = $settingsService->get();
        $settings['modules']['cozinha'] = true;
        $settingsService->update($settings);
    }

    protected function makeUser(): User
    {
        return User::query()->create([
            'name' => 'Operador Cozinha',
            'username' => 'cozinha_'.str()->random(6),
            'password' => bcrypt('secret'),
            'role' => 'admin',
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    protected function makeProduct(array $attributes = []): Product
    {
        return Product::query()->create(array_merge([
            'code' => 'PRD-'.str()->random(6),
            'name' => 'Produto teste',
            'barcode' => null,
            'description' => null,
            'category_id' => null,
            'supplier_id' => null,
            'unit' => 'UN',
            'cost_price' => 10,
            'sale_price' => 20,
            'stock_quantity' => 0,
            'min_stock' => 0,
            'active' => true,
            'requires_preparation' => true,
        ], $attributes));
    }
}
