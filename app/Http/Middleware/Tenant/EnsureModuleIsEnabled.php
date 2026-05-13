<?php

namespace App\Http\Middleware\Tenant;

use App\Services\Tenant\TenantSettingsService;
use App\Services\Tenant\TenantNavigationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleIsEnabled
{
    public function __construct(
        protected TenantSettingsService $settingsService,
        protected TenantNavigationService $navigationService,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $navigationItem = $this->navigationService->resolveItem($request);
        $moduleKey = $this->navigationService->resolveModuleAccessKey($request);

        abort_unless($this->navigationService->userHasRequiredRole($request, $navigationItem), 403);

        abort_unless($this->settingsService->isModuleEnabled($moduleKey), 404);

        return $next($request);
    }
}
