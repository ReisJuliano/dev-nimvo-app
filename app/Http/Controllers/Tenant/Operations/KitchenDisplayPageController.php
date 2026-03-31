<?php

namespace App\Http\Controllers\Tenant\Operations;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsWorkspaceService;
use Inertia\Inertia;
use Inertia\Response;

class KitchenDisplayPageController extends Controller
{
    public function __invoke(OperationsWorkspaceService $workspaceService): Response
    {
        return Inertia::render('Operations/KitchenDisplay', $workspaceService->build('cozinha'));
    }
}
