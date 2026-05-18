<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Services\Tenant\ConsultationsPageService;
use App\Services\Tenant\Fiscal\FiscalContingencyService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FiscalConsultationsPageController extends Controller
{
    public function __invoke(
        Request $request,
        ConsultationsPageService $service,
        FiscalContingencyService $contingencyService,
    ): Response
    {
        $contingencyService->retryPending();

        return Inertia::render('Consultations/Index', $service->build($request->all()));
    }
}
