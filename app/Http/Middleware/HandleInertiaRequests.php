<?php

namespace App\Http\Middleware;

use App\Services\Central\TenantLicenseService;
use App\Services\Tenant\LocalAgentBridgeService;
use App\Services\Tenant\TenantSettingsService;
use App\Services\Tenant\TenantNavigationService;
use App\Support\Tenant\PermissionRegistry;
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
        $localAgentBridge = $tenant ? app(LocalAgentBridgeService::class)->forCurrentTenant() : null;
        $centralAdmin = auth('central_admin')->user();
        $tenantUser = $request->user();
        $permissions = $tenantUser && method_exists($tenantUser, 'hasPermission')
            ? collect(PermissionRegistry::allKeys())
                ->filter(fn (string $key) => $tenantUser->hasPermission($key))
                ->values()
                ->all()
            : [];

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $tenantUser ? [
                    'id'       => $tenantUser->id,
                    'name'     => $tenantUser->name,
                    'username' => $tenantUser->username,
                    'role'     => $tenantUser->role,
                ] : null,
                'permissions' => $permissions,
                'abilities' => $permissions,
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
            'localAgentBridge' => $localAgentBridge,
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
