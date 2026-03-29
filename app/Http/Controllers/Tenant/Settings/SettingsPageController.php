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
        abort_unless(auth()->user()?->role === 'admin', 403);

        return Inertia::render('Settings/Index', [
            'settings' => $settingsService->get(),
            'generalOptions' => $settingsService->generalOptions(),
            'moduleSections' => $settingsService->moduleDefinitions(),
        ]);
    }
}
