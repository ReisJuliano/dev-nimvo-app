<?php

namespace App\Http\Controllers\Tenant\ConditionalSales;

use App\Http\Controllers\Controller;
use App\Services\Tenant\ConditionalSaleService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ConditionalSalesPageController extends Controller
{
    public function __invoke(Request $request, ConditionalSaleService $conditionalSaleService): Response
    {
        return Inertia::render('ConditionalSales/Index', $conditionalSaleService->pageData([
            'applied' => $request->boolean('applied'),
            'status' => $request->query('status', 'open'),
            'search' => $request->query('search', ''),
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'conditional' => $request->query('conditional'),
        ]));
    }
}
