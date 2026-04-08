<?php

namespace Tests\Feature;

use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class PosPendingSaleApiTest extends TestCase
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

    public function test_it_discards_the_saved_pending_sale(): void
    {
        $user = $this->actingOperator();

        $this->postJson('/api/pdv/pending-sale', [
            'cart_payload' => [
                [
                    'id' => 123,
                    'qty' => 1,
                ],
            ],
            'notes' => 'Rascunho teste',
            'status' => 'draft',
        ])->assertOk();

        $this->assertDatabaseHas('pending_sales', [
            'user_id' => $user->id,
            'status' => 'draft',
        ]);

        $this->deleteJson('/api/pdv/pending-sale')
            ->assertOk()
            ->assertJsonPath('message', 'Venda pendente descartada com sucesso.');

        $this->assertDatabaseMissing('pending_sales', [
            'user_id' => $user->id,
        ]);

        $this->getJson('/api/pdv/pending-sale')
            ->assertOk()
            ->assertJsonPath('pending_sale', null);
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
