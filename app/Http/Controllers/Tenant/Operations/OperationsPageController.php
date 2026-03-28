<?php

namespace App\Http\Controllers\Tenant\Operations;

use App\Http\Controllers\Controller;
use App\Services\Tenant\OperationsOverviewService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OperationsPageController extends Controller
{
    public function __invoke(Request $request, OperationsOverviewService $service, string $module): Response
    {
        return Inertia::render('Operations/Overview', [
            'module' => $service->build($module, [
                'from' => $request->query('from'),
                'to' => $request->query('to'),
            ]),
        ]);
    }
}
