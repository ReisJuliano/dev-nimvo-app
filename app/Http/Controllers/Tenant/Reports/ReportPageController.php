<?php

declare(strict_types=1);

namespace App\Http\Controllers\Tenant\Reports;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Reports\ReportBrowserService;
use App\Services\Tenant\Reports\ReportExportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\Response;

class ReportPageController extends Controller
{
    public function __invoke(
        Request $request,
        ReportBrowserService $reportBrowser,
        ReportExportService $reportExport,
        string $report,
    ): Response|InertiaResponse {
        $filters = $this->requestFilters($request);

        if (in_array($request->query('export'), ['pdf', 'excel'], true)) {
            return $reportExport->download($report, $filters, (string) $request->query('export'));
        }

        return Inertia::render('Reports/Show', $reportBrowser->show($report, $filters));
    }

    protected function requestFilters(Request $request): array
    {
        return [
            'applied' => $request->query('applied'),
            'scope' => $request->query('scope'),
            'date' => $request->query('date'),
            'month' => $request->query('month'),
            'month_from' => $request->query('month_from'),
            'month_to' => $request->query('month_to'),
            'year' => $request->query('year'),
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'query' => $request->query('query'),
            'payment_method' => $request->query('payment_method'),
            'operator_id' => $request->query('operator_id'),
            'customer_id' => $request->query('customer_id'),
            'category_id' => $request->query('category_id'),
            'supplier_id' => $request->query('supplier_id'),
            'stock_status' => $request->query('stock_status'),
            'balance_status' => $request->query('balance_status'),
            'sort_by' => $request->query('sort_by'),
            'sort_direction' => $request->query('sort_direction'),
            'export' => $request->query('export'),
            'page' => $request->query('page'),
            'per_page' => $request->query('per_page'),
        ];
    }
}
