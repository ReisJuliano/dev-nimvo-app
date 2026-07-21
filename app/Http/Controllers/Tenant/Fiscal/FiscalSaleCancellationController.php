<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Sale;
use App\Services\Tenant\Fiscal\FiscalCancellationService;
use App\Services\Tenant\Fiscal\FiscalCancellationRules;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FiscalSaleCancellationController extends Controller
{
    public function __invoke(
        Request $request,
        Sale $sale,
        FiscalCancellationService $service,
        FiscalCancellationRules $rules,
    ): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:'.$rules->minReasonLength(), 'max:255'],
        ]);

        $result = $service->cancelSale((int) $sale->id, (string) $validated['reason'], auth()->id());
        $flashType = $result['mode'] === 'fiscal_queued' ? 'info' : 'success';

        return back()->with($flashType, $result['message']);
    }
}
