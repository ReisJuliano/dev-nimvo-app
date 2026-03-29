<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

class CashRegisterPageController extends Controller
{
    public function __invoke(): RedirectResponse
    {
        return redirect()->route('pos.index');
    }
}
