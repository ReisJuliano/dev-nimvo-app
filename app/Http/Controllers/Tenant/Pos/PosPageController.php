<?php

namespace App\Http\Controllers\Tenant\Pos;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use Inertia\Inertia;
use Inertia\Response;

class PosPageController extends Controller
{
    public function __invoke(): Response
    {
        $cashRegister = CashRegister::query()
            ->where('user_id', auth()->id())
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        return Inertia::render('Pos/Index', [
            'categories' => Category::query()->where('active', true)->orderBy('name')->get(['id', 'name']),
            'customers' => Customer::query()
                ->where('active', true)
                ->orderBy('name')
                ->get(['id', 'name', 'phone', 'credit_limit']),
            'cashRegister' => $cashRegister ? [
                'id' => $cashRegister->id,
                'status' => $cashRegister->status,
                'opened_at' => $cashRegister->opened_at?->toIso8601String(),
                'opening_amount' => (float) $cashRegister->opening_amount,
            ] : null,
        ]);
    }
}
