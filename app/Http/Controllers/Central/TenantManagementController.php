<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Http\Requests\Central\StoreTenantRequest;
use App\Http\Requests\Central\UpdateTenantSettingsRequest;
use App\Http\Requests\Central\UpdateTenantStatusRequest;
use App\Models\Central\Client;
use App\Models\Tenant;
use App\Services\Central\ProvisionTenantService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;

class TenantManagementController extends Controller
{
    public function store(
        StoreTenantRequest $request,
        ProvisionTenantService $provisionTenantService,
    ): JsonResponse {
        $tenant = $provisionTenantService->handle($request->validated());

        return response()->json([
            'message' => 'Tenant criado com sucesso.',
            'tenant' => [
                'id' => (string) $tenant->id,
            ],
        ]);
    }

    public function updateStatus(
        UpdateTenantStatusRequest $request,
        Tenant $tenant,
    ): JsonResponse {
        $client = Client::query()->firstWhere('tenant_id', $tenant->id);

        if ($client) {
            $client->update([
                'active' => $request->boolean('active'),
            ]);
        }

        return response()->json([
            'message' => $request->boolean('active')
                ? 'Tenant ativado com sucesso.'
                : 'Tenant desativado com sucesso.',
        ]);
    }

    public function updateSettings(
        UpdateTenantSettingsRequest $request,
        Tenant $tenant,
        TenantSettingsService $settingsService,
    ): JsonResponse {
        $settings = $settingsService->update($request->validated(), (string) $tenant->id);

        return response()->json([
            'message' => 'Configuracoes salvas.',
            'settings' => $settings,
        ]);
    }
}
