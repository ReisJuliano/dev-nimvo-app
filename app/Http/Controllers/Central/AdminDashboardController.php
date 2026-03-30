<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class AdminDashboardController extends Controller
{
    public function __invoke(TenantSettingsService $settingsService): Response
    {
        $tenants = [];

        if (Schema::hasTable('tenants')) {
            $tenants = Tenant::query()
                ->with(['client', 'domains'])
                ->orderBy('name')
                ->get()
                ->map(function (Tenant $tenant) use ($settingsService): array {
                    $domain = $tenant->domains->first()?->domain ?? $tenant->client?->domain;

                    return [
                        'id' => (string) $tenant->id,
                        'name' => $tenant->name ?: $tenant->client?->name ?: (string) $tenant->id,
                        'email' => $tenant->email ?: $tenant->client?->email,
                        'client_name' => $tenant->client?->name,
                        'document' => $tenant->client?->document,
                        'domain' => $domain,
                        'url' => $this->tenantUrl($domain),
                        'active' => (bool) ($tenant->client?->active ?? true),
                        'created_at' => optional($tenant->created_at)?->format('d/m/Y H:i'),
                        'settings' => $settingsService->get((string) $tenant->id),
                    ];
                })
                ->sortByDesc(fn (array $tenant): int => $tenant['active'] ? 1 : 0)
                ->values()
                ->all();
        }

        return Inertia::render('AdminDashboard', [
            'tenantStats' => [
                'total' => count($tenants),
                'active' => count(array_filter($tenants, fn (array $tenant): bool => $tenant['active'])),
                'inactive' => count(array_filter($tenants, fn (array $tenant): bool => !$tenant['active'])),
            ],
            'tenants' => $tenants,
            'businessPresets' => $settingsService->businessPresets(),
            'generalOptions' => $settingsService->generalOptions(),
            'moduleSections' => $settingsService->moduleDefinitions(),
        ]);
    }

    protected function tenantUrl(?string $domain): ?string
    {
        if (!filled($domain)) {
            return null;
        }

        if (str_starts_with($domain, 'http://') || str_starts_with($domain, 'https://')) {
            return $domain;
        }

        $scheme = request()->isSecure() ? 'https' : 'http';

        return sprintf('%s://%s', $scheme, $domain);
    }
}
