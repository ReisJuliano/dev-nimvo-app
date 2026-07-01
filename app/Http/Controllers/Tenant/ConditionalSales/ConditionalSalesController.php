<?php

namespace App\Http\Controllers\Tenant\ConditionalSales;

use App\Http\Controllers\Controller;
use App\Models\Tenant\ConditionalSale;
use App\Services\Tenant\ConditionalSaleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ConditionalSalesController extends Controller
{
    public function store(Request $request, ConditionalSaleService $conditionalSaleService): RedirectResponse
    {
        $conditionalSale = $conditionalSaleService->create($request->all(), (int) auth()->id());

        return to_route('conditional-sales.index', [
            'conditional' => $conditionalSale->id,
            'status' => 'open',
        ])->with('success', 'Condicional criada com sucesso.');
    }

    public function returnItems(
        Request $request,
        ConditionalSale $conditionalSale,
        ConditionalSaleService $conditionalSaleService,
    ): RedirectResponse {
        $conditionalSale = $conditionalSaleService->registerReturn($conditionalSale, $request->all(), (int) auth()->id());

        return to_route('conditional-sales.index', [
            'conditional' => $conditionalSale->id,
            'status' => $conditionalSale->closed_at ? 'closed' : 'open',
        ])->with('success', 'Devolução registrada com sucesso.');
    }

    public function finalize(
        Request $request,
        ConditionalSale $conditionalSale,
        ConditionalSaleService $conditionalSaleService,
    ): RedirectResponse {
        $result = $conditionalSaleService->finalize($conditionalSale, $request->all(), (int) auth()->id());
        /** @var \App\Models\Tenant\ConditionalSale $resolvedConditional */
        $resolvedConditional = $result['conditional_sale'];
        $saleNumber = $result['sale']?->sale_number;

        return to_route('conditional-sales.index', [
            'conditional' => $resolvedConditional->id,
            'status' => 'closed',
        ])->with(
            'success',
            $saleNumber
                ? "Condicional encerrada e convertida na venda {$saleNumber}."
                : 'Condicional encerrada com devolução total.',
        );
    }
}
