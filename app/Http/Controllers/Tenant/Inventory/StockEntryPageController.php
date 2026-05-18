<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsWorkspaceService;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class StockEntryPageController extends Controller
{
    public function __invoke(OperationsWorkspaceService $workspaceService): Response
    {
        $stockWorkspace = $workspaceService->build('entrada-estoque');
        $purchasesWorkspace = $workspaceService->build('compras');

        return Inertia::render('StockEntry/Index', [
            'moduleTitle' => data_get($stockWorkspace, 'moduleTitle', 'Entrada de estoque'),
            'payload' => array_merge(
                data_get($stockWorkspace, 'payload', []),
                Arr::only(data_get($purchasesWorkspace, 'payload', []), ['incoming_nfe_documents', 'incoming_nfe_status', 'cost_methods']),
            ),
        ]);
    }
}
