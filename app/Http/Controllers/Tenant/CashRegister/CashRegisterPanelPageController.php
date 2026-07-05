<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Services\Tenant\TillService;
use Inertia\Inertia;
use Inertia\Response;

class CashRegisterPanelPageController extends Controller
{
    public function __invoke(TillService $tillService): Response
    {
        abort_unless(in_array(auth()->user()?->role, ['admin', 'manager'], true), 403);

        $tills = $tillService->activeTills()->map(fn ($till) => [
            'id' => $till->id,
            'name' => $till->name,
        ])->values();

        return Inertia::render('CashRegister/Panel', [
            'tills' => $tills,
        ]);
    }
}
