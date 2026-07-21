<?php

namespace App\Http\Controllers\Tenant\Purchases;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PurchaseReturnPageController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('Purchases/ReturnWizard', [
            'canIssueFiscal' => (bool) $request->user()?->hasPermission('fiscal.emitir_devolucao'),
        ]);
    }
}
