<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant\Reports;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Reports\ReportBrowserService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportPageController extends Controller
{
    public function __invoke(
        Request $request,
        ReportBrowserService $reportBrowser,
        string $report,
    ): Response {
        return Inertia::render('Reports/Show', $reportBrowser->show($report, [
            'scope' => $request->query('scope'),
            'date' => $request->query('date'),
            'month' => $request->query('month'),
            'year' => $request->query('year'),
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'page' => $request->query('page'),
            'per_page' => $request->query('per_page'),
        ]));
    }
}
