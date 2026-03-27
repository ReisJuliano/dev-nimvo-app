<?php

use App\Http\Controllers\Central\HomeController;
use Illuminate\Support\Facades\Route;

foreach (config('tenancy.central_domains', []) as $domain) {
    Route::domain($domain)->middleware('web')->group(function () {
        Route::get('/', HomeController::class);
    });
}
