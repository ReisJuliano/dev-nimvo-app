<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Sale;
use App\Services\Tenant\Fiscal\FiscalContingencyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FiscalSaleContingencyController extends Controller
{
    public function __invoke(Request $request, Sale $sale, FiscalContingencyService $service): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:15', 'max:255'],
        ]);

        $result = $service->queueSale((int) $sale->id, (string) $validated['reason']);

        return back()->with('warning', $result['message']);
    }
}
