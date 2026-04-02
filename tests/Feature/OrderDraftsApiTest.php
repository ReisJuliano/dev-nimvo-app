<?php

namespace Tests\Feature;

use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class OrderDraftsApiTest extends TestCase
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

    public function test_it_allows_updating_draft_with_empty_items_array(): void
    {
        $user = $this->actingOperator();
        $draft = $this->makeDraft($user, [
            'type' => 'comanda',
            'reference' => '101',
        ]);

        $response = $this->putJson("/api/orders/{$draft->id}", [
            'type' => 'mesa',
            'reference' => '12',
            'customer_id' => null,
            'notes' => 'Atualizacao sem itens',
            'items' => [],
        ]);

        $response->assertOk()
            ->assertJsonPath('order.id', $draft->id)
            ->assertJsonPath('order.type', 'mesa')
            ->assertJsonPath('order.reference', '12')
            ->assertJsonPath('order.items', []);

        $this->assertDatabaseHas('order_drafts', [
            'id' => $draft->id,
            'type' => 'mesa',
            'reference' => '12',
            'notes' => 'Atualizacao sem itens',
        ]);
    }

    public function test_it_deletes_draft(): void
    {
        $user = $this->actingOperator();
        $draft = $this->makeDraft($user, [
            'type' => 'comanda',
            'reference' => '88',
        ]);

        $draft->items()->create([
            'product_id' => null,
            'product_name' => 'Item teste',
            'product_code' => null,
            'product_barcode' => null,
            'unit' => 'UN',
            'quantity' => 1,
            'unit_cost' => 0,
            'unit_price' => 10,
            'total' => 10,
        ]);

        $response = $this->deleteJson("/api/orders/{$draft->id}");

        $response->assertOk()
            ->assertJsonPath('message', 'Atendimento removido com sucesso.');

        $this->assertDatabaseMissing('order_drafts', ['id' => $draft->id]);
        $this->assertDatabaseMissing('order_draft_items', ['order_draft_id' => $draft->id]);
    }

    public function test_it_does_not_delete_completed_draft(): void
    {
        $user = $this->actingOperator();
        $draft = $this->makeDraft($user, [
            'status' => OrderDraft::STATUS_COMPLETED,
            'completed_at' => now(),
        ]);

        $response = $this->deleteJson("/api/orders/{$draft->id}");

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['order']);

        $this->assertDatabaseHas('order_drafts', ['id' => $draft->id]);
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
