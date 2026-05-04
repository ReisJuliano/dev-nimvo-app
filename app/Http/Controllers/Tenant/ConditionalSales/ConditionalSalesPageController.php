<?php

namespace App\Http\Controllers\Tenant\ConditionalSales;

use App\Http\Controllers\Controller;
use App\Services\Tenant\ConditionalSaleService;
use Inertia\Inertia;
use Inertia\Response;

class ConditionalSalesPageController extends Controller
{
    public function __invoke(ConditionalSaleService $conditionalSaleService): Response
    {
        return Inertia::render('ConditionalSales/Index', $conditionalSaleService->pageData([
            'status' => request()->query('status', 'open'),
            'search' => request()->query('search', ''),
            'conditional' => request()->query('conditional'),
        ]));
    }
}
