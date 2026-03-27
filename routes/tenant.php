<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\Auth\LoginController;
use App\Http\Controllers\Tenant\Auth\PasswordChangeController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Middleware\Tenant\EnsurePasswordIsChanged;
use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;

Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    Route::get('/', function () {
        return auth()->check()
            ? redirect()->route('dashboard')
            : redirect()->route('login');
    })->name('home');

    Route::middleware('guest')->group(function () {
        Route::get('/login', [LoginController::class, 'show'])->name('login');
        Route::post('/login', [LoginController::class, 'store'])->name('login.store');
    });

    Route::middleware('auth')->group(function () {
        Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

        Route::get('/change-password', [PasswordChangeController::class, 'show'])
            ->name('password.change.show');
        Route::put('/change-password', [PasswordChangeController::class, 'update'])
            ->name('password.change.update');

        Route::middleware(EnsurePasswordIsChanged::class)->group(function () {
            Route::get('/dashboard', DashboardController::class)->name('dashboard');
        });
    });
});
