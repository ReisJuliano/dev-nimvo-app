<?php

namespace Tests\Feature;

use App\Mail\AccountantPackageMail;
use App\Models\Tenant as TenantModel;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use Tests\TestCase;

class SendAccountantPackagesCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([
            InitializeTenancyByDomain::class,
            PreventAccessFromCentralDomains::class,
        ]);
    }

    public function test_it_sends_the_package_when_auto_send_is_enabled_with_an_email(): void
    {
        Storage::fake('local');
        Mail::fake();

        $tenant = TenantModel::query()->create([
            'id' => 'tenant-accountant-enabled',
            'name' => 'Loja Com Envio Automatico',
            'email' => 'envio-automatico@example.test',
        ]);

        tenancy()->initialize($tenant);
        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();
        app(TenantSettingsService::class)->update([
            'business' => ['preset' => TenantSettingsService::CUSTOM_PRESET],
            'accountant' => [
                'name' => 'Escritorio Teste',
                'email' => 'contador@example.test',
                'auto_send_enabled' => true,
            ],
        ]);

        $this->artisan('nimvo:send-accountant-packages', [
            '--year' => 2026,
            '--month' => 6,
        ])->assertSuccessful();

        tenancy()->end();

        Mail::assertSent(AccountantPackageMail::class, function (AccountantPackageMail $mail) {
            return $mail->hasTo('contador@example.test') && $mail->year === 2026 && $mail->month === 6;
        });
    }

    public function test_it_does_not_send_when_auto_send_is_disabled(): void
    {
        Storage::fake('local');
        Mail::fake();

        $tenant = TenantModel::query()->create([
            'id' => 'tenant-accountant-disabled',
            'name' => 'Loja Sem Envio Automatico',
            'email' => 'sem-envio@example.test',
        ]);

        tenancy()->initialize($tenant);
        $this->artisan('migrate', [
            '--path' => database_path('migrations/tenant'),
            '--realpath' => true,
        ])->run();
        app(TenantSettingsService::class)->update([
            'business' => ['preset' => TenantSettingsService::CUSTOM_PRESET],
            'accountant' => [
                'email' => 'contador@example.test',
                'auto_send_enabled' => false,
            ],
        ]);

        $this->artisan('nimvo:send-accountant-packages', [
            '--year' => 2026,
            '--month' => 6,
        ])->assertSuccessful();

        tenancy()->end();

        Mail::assertNothingSent();
    }
}
