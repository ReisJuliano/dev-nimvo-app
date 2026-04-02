<?php

namespace App\Http\Middleware;

use App\Services\Central\TenantLicenseService;
use App\Services\Tenant\TenantSettingsService;
use App\Services\Tenant\TenantNavigationService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $tenant = tenant();
        $settings = $tenant ? app(TenantSettingsService::class)->get() : null;
        $navigationCatalog = $tenant ? app(TenantNavigationService::class)->catalog() : null;
        $licenseState = $tenant ? app(TenantLicenseService::class)->stateForTenant((string) $tenant->getTenantKey()) : null;
        $centralAdmin = auth('central_admin')->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id'       => $request->user()->id,
                    'name'     => $request->user()->name,
                    'username' => $request->user()->username,
                    'role'     => $request->user()->role,
                ] : null,
            ],
            'centralAuth' => [
                'user' => $centralAdmin ? [
                    'id' => $centralAdmin->id,
                    'name' => $centralAdmin->name,
                    'username' => $centralAdmin->username,
                ] : null,
            ],
            'tenant' => $tenant ? [
                'id' => $tenant->getTenantKey(),
                'name' => $tenant->name,
                'email' => $tenant->email,
            ] : null,
            'appSettings' => $settings,
            'license' => $licenseState,
            'tenantNavigationCatalog' => $navigationCatalog,
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info' => fn () => $request->session()->get('info'),
            ],
        ];
    }
}
