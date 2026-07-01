<?php

namespace App\Http\Controllers\Tenant\Fiscal;

use App\Http\Controllers\Controller;
use App\Services\Tenant\Fiscal\FiscalContingencyService;
use Illuminate\Http\RedirectResponse;

class FiscalContingencyRetryController extends Controller
{
    public function __invoke(FiscalContingencyService $service): RedirectResponse
    {
        $count = $service->retryPending();

        return back()->with(
            $count > 0 ? 'info' : 'warning',
            $count > 0
                ? sprintf('%d documento(s) foram reenfileirados a partir da contingência.', $count)
                : 'Não existem documentos pendentes em contingência para reenfileirar.'
        );
    }
}
