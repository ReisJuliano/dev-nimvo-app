<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Customer;
use App\Services\Tenant\Fiscal\FiscalDocumentBrowserService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FiscalDocumentsPageController extends Controller
{
    public function __invoke(Request $request, FiscalDocumentBrowserService $browserService): Response
    {
        return Inertia::render('Fiscal/NfeNfce', [
            ...$browserService->list($request->all()),
            'customers' => Customer::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'document', 'phone']),
            'canEmitManual' => (bool) $request->user()?->hasPermission('fiscal.emitir_manual'),
            'canRequestCorrection' => (bool) $request->user()?->hasPermission('fiscal.eventos'),
            'canExportAccountantPackage' => (bool) $request->user()?->hasPermission('relatorios.exportar'),
        ]);
    }
}
