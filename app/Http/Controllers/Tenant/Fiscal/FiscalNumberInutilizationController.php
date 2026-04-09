<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Fiscal\FiscalNumberInutilizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FiscalNumberInutilizationController extends Controller
{
    public function __invoke(Request $request, FiscalNumberInutilizationService $service): RedirectResponse
    {
        $validated = $request->validate([
            'document_model' => ['required', 'string', 'in:55,65'],
            'series' => ['required', 'integer', 'min:1', 'max:999'],
            'number_start' => ['required', 'integer', 'min:1'],
            'number_end' => ['required', 'integer', 'min:1'],
            'justification' => ['required', 'string', 'min:15', 'max:255'],
        ]);

        $service->queue(
            (string) $validated['document_model'],
            (int) $validated['series'],
            (int) $validated['number_start'],
            (int) $validated['number_end'],
            (string) $validated['justification'],
            auth()->id(),
        );

        return back()->with('info', 'Inutilizacao fiscal enviada para o agente local.');
    }
}
