<?php

namespace App\Http\Controllers\Tenant\Purchases;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsWorkspaceService;
use Inertia\Inertia;
use Inertia\Response;

class PurchasesPageController extends Controller
{
    public function __invoke(OperationsWorkspaceService $workspaceService): Response
    {
        $workspace = $workspaceService->build('compras');

        return Inertia::render('Purchases/Index', [
            'moduleTitle' => data_get($workspace, 'moduleTitle', 'Compras'),
            'payload' => data_get($workspace, 'payload', []),
        ]);
    }
}
