<?php

namespace Tests\Feature;

use App\Models\Tenant\AuditLog;
use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\User;
use App\Services\Tenant\DiscountAuthorizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class AuditLogTest extends TestCase
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

    public function test_authorizing_a_discount_records_an_audit_log_entry(): void
    {
        $manager = $this->createUser('Gerente', 'gerente', 'manager');
        $this->createUser('Operador', 'operador', 'operator');

        $service = app(DiscountAuthorizationService::class);
        $authorized = $service->authorize($manager->id, 'password', ['sale_context' => 'pdv']);

        $this->assertSame($manager->id, $authorized->id);

        $log = AuditLog::query()->latest('occurred_at')->first();

        $this->assertNotNull($log);
        $this->assertSame('venda.desconto_autorizado', $log->action);
        $this->assertSame($manager->id, $log->metadata['authorizer_id']);
        $this->assertSame('pdv', $log->metadata['sale_context']);
    }

    public function test_admin_can_view_the_audit_page_and_operator_cannot(): void
    {
        $admin = $this->createUser('Dono', 'dono', 'admin');
        $operator = $this->createUser('Operador', 'operador2', 'operator');

        $this->actingAs($admin)->get('/auditoria')->assertOk();
        $this->actingAs($operator)->get('/auditoria')->assertForbidden();
    }

    public function test_audit_log_entries_cannot_be_updated_or_deleted(): void
    {
        $log = AuditLog::query()->create([
            'action' => 'registro.excluido',
            'occurred_at' => now(),
        ]);

        $log->action = 'algo.diferente';

        $this->expectException(RuntimeException::class);
        $log->save();
    }

    protected function createUser(string $name, string $username, string $baseRole): User
    {
        $group = PermissionGroup::query()->where('base_role', $baseRole)->first();

        return User::query()->create([
            'name' => $name,
            'username' => $username,
            'password' => Hash::make('password'),
            'role' => $baseRole,
            'permission_group_id' => $group?->id,
            'active' => true,
            'must_change_password' => false,
        ]);
    }
}
