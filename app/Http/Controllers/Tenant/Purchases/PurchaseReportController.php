<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant\Purchases;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Purchases\PurchaseReportPdfService;
use Symfony\Component\HttpFoundation\Response;

class PurchaseReportController extends Controller
{
    public function __invoke(PurchaseReportPdfService $reportService, int $purchase): Response
    {
        return $reportService->download($purchase);
    }
}
