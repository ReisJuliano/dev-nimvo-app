<?php

namespace App\Http\Controllers\Tenant\Labels;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use Inertia\Inertia;
use Inertia\Response;

class LabelsPageController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(auth()->user()?->hasPermission('produtos.imprimir_etiquetas'), 403);

        return Inertia::render('Labels/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
