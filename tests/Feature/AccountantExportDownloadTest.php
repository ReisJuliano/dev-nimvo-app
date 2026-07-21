<?php

namespace Tests\Feature;

use App\Models\Tenant\PermissionGroup;
use App\Models\Tenant\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class AccountantExportDownloadTest extends TestCase
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

    public function test_operator_without_relatorios_exportar_cannot_download_the_package(): void
    {
        $emptyGroup = PermissionGroup::query()->create([
            'name' => 'Sem permissões (teste)',
            'base_role' => null,
        ]);

        $operator = User::query()->create([
            'name' => 'Operador',
            'username' => 'operador_export_download',
            'password' => Hash::make('password'),
            'role' => 'operator',
            'permission_group_id' => $emptyGroup->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($operator)
            ->getJson('/api/fiscal/accountant-export?year=2026&month=7')
            ->assertForbidden();
    }

    public function test_admin_can_download_the_monthly_package(): void
    {
        Storage::fake('local');

        $group = PermissionGroup::query()->where('base_role', 'admin')->first();

        $admin = User::query()->create([
            'name' => 'Dono',
            'username' => 'dono_export_download',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'permission_group_id' => $group?->id,
            'active' => true,
            'must_change_password' => false,
        ]);

        $this->actingAs($admin)
            ->get('/api/fiscal/accountant-export?year=2026&month=7')
            ->assertOk()
            ->assertHeader('content-type', 'application/zip');
    }
}
