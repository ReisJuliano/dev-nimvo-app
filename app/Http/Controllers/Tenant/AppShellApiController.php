<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\Tenant\TenantNavigationService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;

class AppShellApiController extends Controller
{
    public function __invoke(
        TenantSettingsService $settingsService,
        TenantNavigationService $navigationService,
    ): JsonResponse {
        return response()->json([
            'settings' => $settingsService->get(),
            'navigationCatalog' => $navigationService->catalog(),
        ]);
    }
}
