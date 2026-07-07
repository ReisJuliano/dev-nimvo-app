<?php

namespace App\Http\Controllers\Tenant\Labels;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class LabelTemplatesPageController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->hasPermission('produtos.imprimir_etiquetas'), 403);

        return Inertia::render('Labels/Templates/Index');
    }
}
