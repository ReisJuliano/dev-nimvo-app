<?php

namespace App\Http\Controllers\Tenant\Sales;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SaleReturnPageController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('Sales/ReturnWizard', [
            'canIssueFiscal' => (bool) $request->user()?->hasPermission('fiscal.emitir_devolucao'),
        ]);
    }
}
