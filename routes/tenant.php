<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\Auth\LoginController;
use App\Http\Controllers\Tenant\Auth\PasswordChangeController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterApiController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPageController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\Operations\OperationsPageController;
use App\Http\Controllers\Tenant\Pos\PosApiController;
use App\Http\Controllers\Tenant\Pos\PosPageController;
use App\Http\Controllers\Tenant\Products\ProductsApiController;
use App\Http\Controllers\Tenant\Products\ProductsPageController;
use App\Http\Controllers\Tenant\Settings\SettingsApiController;
use App\Http\Controllers\Tenant\Settings\SettingsPageController;
use App\Http\Middleware\Tenant\EnsurePasswordIsChanged;
use Illuminate\Support\Facades\Route;

Route::middleware('web')->group(function () {
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

        Route::middleware([EnsurePasswordIsChanged::class, 'module.enabled'])->group(function () {
            Route::get('/dashboard', DashboardController::class)->name('dashboard');
            Route::get('/pdv', PosPageController::class)->name('pos.index');
            Route::get('/caixa', CashRegisterPageController::class)->name('cash-register.index');
            Route::get('/produtos', ProductsPageController::class)->name('products.index');
            Route::get('/pedidos', OperationsPageController::class)->defaults('module', 'pedidos')->name('orders.index');
            Route::get('/fiado', OperationsPageController::class)->defaults('module', 'fiado')->name('credit.index');
            Route::get('/clientes', OperationsPageController::class)->defaults('module', 'clientes')->name('customers.index');
            Route::get('/fornecedores', OperationsPageController::class)->defaults('module', 'fornecedores')->name('suppliers.index');
            Route::get('/categorias', OperationsPageController::class)->defaults('module', 'categorias')->name('categories.index');
            Route::get('/entrada-estoque', OperationsPageController::class)->defaults('module', 'entrada-estoque')->name('stock.inbound');
            Route::get('/ajuste-estoque', OperationsPageController::class)->defaults('module', 'ajuste-estoque')->name('stock.adjustments');
            Route::get('/movimentacao-estoque', OperationsPageController::class)->defaults('module', 'movimentacao-estoque')->name('stock.history');
            Route::get('/relatorios', OperationsPageController::class)->defaults('module', 'relatorios')->name('reports.index');
            Route::get('/vendas', OperationsPageController::class)->defaults('module', 'vendas')->name('sales.index');
            Route::get('/demanda', OperationsPageController::class)->defaults('module', 'demanda')->name('demand.index');
            Route::get('/faltas', OperationsPageController::class)->defaults('module', 'faltas')->name('shortages.index');
            Route::get('/usuarios', OperationsPageController::class)->defaults('module', 'usuarios')->name('users.index');
            Route::get('/configuracoes', SettingsPageController::class)->name('settings.index');

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
                Route::put('/settings', [SettingsApiController::class, 'update'])->name('api.settings.update');
            });
        });
    });
});
