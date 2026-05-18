<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsWorkspaceService;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

class StockEntryMaintenancePageController extends Controller
{
    public function __invoke(OperationsWorkspaceService $workspaceService): Response
    {
        $stockWorkspace = $workspaceService->build('entrada-estoque');
        $purchasesWorkspace = $workspaceService->build('compras');

        return Inertia::render('StockEntry/Maintenance', [
            'moduleTitle' => 'Manutencao de entradas',
            'payload' => array_merge(
                Arr::only(data_get($stockWorkspace, 'payload', []), ['records']),
                Arr::only(data_get($purchasesWorkspace, 'payload', []), ['incoming_nfe_documents']),
            ),
        ]);
    }
}
