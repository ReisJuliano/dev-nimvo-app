<?php

namespace Tests\Feature;

use App\Http\Controllers\Tenant\Reports\ReportPageController;
use App\Models\Tenant\User;
use App\Services\Tenant\Reports\ReportBrowserService;
use App\Services\Tenant\Reports\ReportExportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Response as InertiaResponse;
use Mockery;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

class ReportPageControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Auth::setUser(new User(['role' => 'admin']));
    }

    public function test_controller_allows_inertia_report_response(): void
    {
        $controller = new ReportPageController();
        $request = Request::create('/relatorios/ver/sales-daily', 'GET', [
            'applied' => '1',
            'scope' => 'month',
            'month' => '2026-04',
            'sort_by' => 'reference_date',
            'sort_direction' => 'desc',
        ]);

        $reportBrowser = Mockery::mock(ReportBrowserService::class);
        $reportExport = Mockery::mock(ReportExportService::class);

        $reportBrowser
            ->shouldReceive('show')
            ->once()
            ->with('sales-daily', Mockery::subset([
                'applied' => '1',
                'scope' => 'month',
                'month' => '2026-04',
                'sort_by' => 'reference_date',
                'sort_direction' => 'desc',
            ]))
            ->andReturn([
                'report' => [
                    'title' => 'Faturamento por dia',
                ],
            ]);

        $response = $controller($request, $reportBrowser, $reportExport, 'sales-daily');

        $this->assertInstanceOf(InertiaResponse::class, $response);
    }

    public function test_controller_keeps_export_response_path(): void
    {
        $controller = new ReportPageController();
        $request = Request::create('/relatorios/ver/sales-daily', 'GET', [
            'applied' => '1',
            'scope' => 'month',
            'month' => '2026-04',
            'export' => 'pdf',
        ]);

        $reportBrowser = Mockery::mock(ReportBrowserService::class);
        $reportExport = Mockery::mock(ReportExportService::class);
        $downloadResponse = response('pdf');

        $reportExport
            ->shouldReceive('download')
            ->once()
            ->with('sales-daily', Mockery::subset([
                'applied' => '1',
                'scope' => 'month',
                'month' => '2026-04',
                'export' => 'pdf',
            ]), 'pdf')
            ->andReturn($downloadResponse);

        $response = $controller($request, $reportBrowser, $reportExport, 'sales-daily');

        $this->assertInstanceOf(Response::class, $response);
        $this->assertSame('pdf', $response->getContent());
    }
}
