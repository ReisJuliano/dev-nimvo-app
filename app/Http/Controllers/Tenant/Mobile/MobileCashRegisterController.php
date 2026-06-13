<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Models\Tenant\CashRegister;
use Illuminate\Http\JsonResponse;

class MobileCashRegisterController extends Controller
{
    use FormatsMobileResponses;

    public function status(): JsonResponse
    {
        $registers = CashRegister::query()
            ->with('user:id,name')
            ->where('status', 'open')
            ->latest('opened_at')
            ->get()
            ->map(fn (CashRegister $register) => [
                'id' => $register->id,
                'name' => 'Caixa #'.$register->id,
                'opened_at' => $register->opened_at?->toIso8601String(),
                'opened_by' => $register->user?->name,
                'opening_balance' => (float) $register->opening_amount,
            ])
            ->values();

        return response()->json($this->success([
            'open_registers' => $registers,
        ]));
    }
}
