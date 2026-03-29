<?php

namespace App\Http\Controllers\Tenant\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tenant\Settings\UpdateSettingsRequest;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;

class SettingsApiController extends Controller
{
    public function update(
        UpdateSettingsRequest $request,
        TenantSettingsService $settingsService,
    ): JsonResponse {
        $settings = $settingsService->update($request->validated());

        return response()->json([
            'message' => 'Configuracoes atualizadas com sucesso.',
            'settings' => $settings,
        ]);
    }
}
