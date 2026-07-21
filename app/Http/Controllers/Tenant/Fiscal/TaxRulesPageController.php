<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class TaxRulesPageController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->hasPermission('fiscal.matriz_tributaria'), 403);

        return Inertia::render('Fiscal/TaxRules/Index');
    }
}
