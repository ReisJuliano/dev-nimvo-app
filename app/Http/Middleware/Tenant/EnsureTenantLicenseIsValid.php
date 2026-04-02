<?php

namespace App\Http\Middleware\Tenant;

use App\Services\Central\TenantLicenseService;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantLicenseIsValid
{
    public function __construct(
        protected TenantLicenseService $licenseService,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $state = $this->licenseService->stateForTenant((string) tenant('id'));

        if (!$state || ($state['can_use'] ?? true)) {
            return $next($request);
        }

        return Inertia::render('License/Blocked', [
            'license' => $state,
        ])->toResponse($request)->setStatusCode(423);
    }
}
