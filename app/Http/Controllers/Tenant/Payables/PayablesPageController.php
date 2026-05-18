<?php

namespace App\Http\Controllers\Tenant\Payables;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsWorkspaceService;
use Inertia\Inertia;
use Inertia\Response;

class PayablesPageController extends Controller
{
    public function __invoke(OperationsWorkspaceService $workspaceService): Response
    {
        $workspace = $workspaceService->build('contas-a-pagar');

        return Inertia::render('Payables/Index', [
            'moduleTitle' => data_get($workspace, 'moduleTitle', 'Contas a pagar'),
            'payload' => data_get($workspace, 'payload', []),
        ]);
    }
}
