<?php

namespace App\Http\Controllers\Tenant\Receivables;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use Inertia\Inertia;
use Inertia\Response;

class ReceivablesPageController extends Controller
{
    public function __invoke(): Response
    {
        $userId = auth()->id();

        $openRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        return Inertia::render('Receivables/Index', [
            'openCashRegisterId' => $openRegister?->id,
        ]);
    }
}
