<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Fiscal\FiscalConsultationService;
use App\Services\Tenant\Fiscal\FiscalContingencyService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FiscalConsultationsPageController extends Controller
{
    public function __invoke(
        Request $request,
        FiscalConsultationService $service,
        FiscalContingencyService $contingencyService,
    ): Response
    {
        $contingencyService->retryPending();

        return Inertia::render('Fiscal/Consultations', $service->build($request->all()));
    }
}
