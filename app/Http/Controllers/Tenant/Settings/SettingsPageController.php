<?php

namespace App\Http\Controllers\Tenant\Settings;

use App\Http\Controllers\Controller;
use App\Services\Tenant\TenantSettingsService;
use Inertia\Inertia;
use Inertia\Response;

class SettingsPageController extends Controller
{
    public function __invoke(TenantSettingsService $settingsService): Response
    {
        abort_unless(auth()->user()?->hasPermission('configuracoes.editar'), 403);

        $centralDomain = config('tenancy.central_domains')[0] ?? request()->getHost();
        $storeQuery = 'store='.urlencode(request()->getHost());
        $baseUrl = sprintf('%s://%s/app/baixar', request()->getScheme(), $centralDomain);

        return Inertia::render('Settings/Index', [
            'settings' => $settingsService->get(),
            'businessPresets' => $settingsService->businessPresets(),
            'generalOptions' => $settingsService->generalOptions(),
            'moduleSections' => $settingsService->moduleDefinitions(),
            'appDownloadUrl' => "{$baseUrl}?{$storeQuery}",
            'appDownloadQrUrl' => "{$baseUrl}/qr.svg?{$storeQuery}",
        ]);
    }
}
