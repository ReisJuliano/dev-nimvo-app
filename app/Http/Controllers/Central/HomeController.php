<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

class HomeController extends Controller
{
    public function __invoke(): View
    {
        return view('central.home', [
            'centralDatabase' => config('database.connections.'.config('database.default').'.database'),
            'centralDomains' => [],
        ]);
    }
}
