<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\Auth\LoginController;
use App\Http\Controllers\Tenant\Auth\PasswordChangeController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterApiController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPageController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\Pos\PosApiController;
use App\Http\Controllers\Tenant\Pos\PosPageController;
use App\Http\Controllers\Tenant\Products\ProductsApiController;
use App\Http\Controllers\Tenant\Products\ProductsPageController;
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
            Route::get('/pdv', PosPageController::class)->name('pos.index');
            Route::get('/caixa', CashRegisterPageController::class)->name('cash-register.index');
            Route::get('/produtos', ProductsPageController::class)->name('products.index');

            Route::prefix('/api')->group(function () {
                Route::get('/pdv/products', [PosApiController::class, 'searchProducts'])->name('api.pos.products');
                Route::get('/pdv/customers/{customer}/credit', [PosApiController::class, 'customerCredit'])->name('api.pos.customers.credit');
                Route::post('/pdv/customers/quick', [PosApiController::class, 'quickCustomer'])->name('api.pos.customers.quick');
                Route::post('/pdv/sales', [PosApiController::class, 'finalize'])->name('api.pos.sales.store');

                Route::post('/cash-registers', [CashRegisterApiController::class, 'open'])->name('api.cash-registers.open');
                Route::post('/cash-registers/{cashRegister}/movements', [CashRegisterApiController::class, 'movement'])->name('api.cash-registers.movements.store');
                Route::post('/cash-registers/{cashRegister}/close', [CashRegisterApiController::class, 'close'])->name('api.cash-registers.close');
                Route::get('/cash-registers/{cashRegister}/report', [CashRegisterApiController::class, 'report'])->name('api.cash-registers.report');

                Route::post('/products', [ProductsApiController::class, 'store'])->name('api.products.store');
                Route::get('/products/{product}', [ProductsApiController::class, 'show'])->name('api.products.show');
                Route::put('/products/{product}', [ProductsApiController::class, 'update'])->name('api.products.update');
                Route::delete('/products/{product}', [ProductsApiController::class, 'destroy'])->name('api.products.destroy');
            });
        });
    });
});
