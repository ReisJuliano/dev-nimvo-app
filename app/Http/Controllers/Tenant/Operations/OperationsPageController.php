<?php

namespace App\Http\Controllers\Tenant\Operations;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsOverviewService;
use App\Services\Tenant\OperationsWorkspaceService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OperationsPageController extends Controller
{
    public function __invoke(
        Request $request,
        OperationsOverviewService $overviewService,
        OperationsWorkspaceService $workspaceService,
        TenantSettingsService $settingsService,
        string $module,
    ): Response
    {
        if ($workspaceService->isWorkspaceModule($module)) {
            return Inertia::render('Operations/Workspace', $workspaceService->build($module));
        }

        return Inertia::render('Operations/Overview', [
            'module' => $overviewService->build($module, [
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'product' => $request->query('product'),
                'section' => $request->query('section'),
            ], [
                'enabledModules' => data_get($settingsService->get(), 'modules', []),
            ]),
        ]);
    }
}
