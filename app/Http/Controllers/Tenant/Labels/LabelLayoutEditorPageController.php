<?php

namespace App\Http\Controllers\Tenant\Labels;

use App\Http\Controllers\Controller;
use App\Models\Tenant\LabelTemplate;
use Inertia\Inertia;
use Inertia\Response;

class LabelLayoutEditorPageController extends Controller
{
    public function __invoke(LabelTemplate $labelTemplate): Response
    {
        abort_unless(auth()->user()?->hasPermission('produtos.imprimir_etiquetas'), 403);

        return Inertia::render('Labels/Templates/LayoutEditor', ['templateId' => $labelTemplate->id]);
    }
}
