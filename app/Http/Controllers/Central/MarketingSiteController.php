<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

class MarketingSiteController extends Controller
{
    public function show(): View
    {
        return view('site.home');
    }
}
