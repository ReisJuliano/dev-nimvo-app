<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Fiscal\AccountantExportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AccountantExportController extends Controller
{
    public function download(Request $request, AccountantExportService $service): BinaryFileResponse
    {
        abort_unless(auth()->user()?->hasPermission('relatorios.exportar'), 403);

        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $path = $service->buildZip((int) $validated['year'], (int) $validated['month']);

        return response()->download(
            Storage::disk('local')->path($path),
            sprintf('contador-%04d-%02d.zip', $validated['year'], $validated['month']),
        );
    }
}
