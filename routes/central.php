<?php

use App\Http\Controllers\Central\AdminPageController;
use App\Http\Controllers\Central\Api\LocalAgentApiController;
use App\Http\Controllers\Central\Auth\LoginController;
use App\Http\Middleware\Central\AuthenticateLocalAgent;
use App\Http\Controllers\Central\TenantManagementController;
use Illuminate\Support\Facades\Route;

Route::prefix('admin')->name('central.admin.')->group(function () {
    Route::get('/', function () {
        return auth('central_admin')->check()
            ? redirect()->route('central.admin.dashboard')
            : redirect()->route('central.admin.login');
    })->name('home');

    Route::middleware('guest:central_admin')->group(function () {
        Route::get('/login', [LoginController::class, 'show'])->name('login');
        Route::post('/login', [LoginController::class, 'store'])->name('login.store');
    });

    Route::middleware('auth:central_admin')->group(function () {
        Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
        Route::get('/painel', [AdminPageController::class, 'dashboard'])->name('dashboard');
        Route::get('/clientes', [AdminPageController::class, 'clients'])->name('clients');
        Route::get('/feature-flags', [AdminPageController::class, 'featureFlags'])->name('feature-flags');

        Route::get('/usuarios', [AdminPageController::class, 'placeholder'])->defaults('section', 'usuarios')->name('users');
        Route::get('/fornecedores', [AdminPageController::class, 'placeholder'])->defaults('section', 'fornecedores')->name('suppliers');
        Route::get('/categorias', [AdminPageController::class, 'placeholder'])->defaults('section', 'categorias')->name('categories');
        Route::get('/produtos', [AdminPageController::class, 'placeholder'])->defaults('section', 'produtos')->name('products');
        Route::get('/estoque/entrada', [AdminPageController::class, 'placeholder'])->defaults('section', 'estoque-entrada')->name('stock.inbound');
        Route::get('/estoque/conferencia', [AdminPageController::class, 'placeholder'])->defaults('section', 'estoque-conferencia')->name('stock.conference');
        Route::get('/estoque/movimentacao', [AdminPageController::class, 'placeholder'])->defaults('section', 'estoque-movimentacao')->name('stock.movement');
        Route::get('/comandas', [AdminPageController::class, 'placeholder'])->defaults('section', 'comandas')->name('orders');
        Route::get('/vendas', [AdminPageController::class, 'placeholder'])->defaults('section', 'vendas')->name('sales');
        Route::get('/configuracoes', [AdminPageController::class, 'placeholder'])->defaults('section', 'configuracoes')->name('settings');
        Route::get('/integracoes', [AdminPageController::class, 'placeholder'])->defaults('section', 'integracoes')->name('integrations');

        Route::post('/tenants', [TenantManagementController::class, 'store'])->name('tenants.store');
        Route::put('/tenants/{tenant}', [TenantManagementController::class, 'update'])->name('tenants.update');
        Route::delete('/tenants/{tenant}', [TenantManagementController::class, 'destroy'])->name('tenants.destroy');
        Route::patch('/tenants/{tenant}/status', [TenantManagementController::class, 'updateStatus'])->name('tenants.status');
        Route::put('/tenants/{tenant}/settings', [TenantManagementController::class, 'updateSettings'])->name('tenants.settings');
        Route::put('/tenants/{tenant}/license', [TenantManagementController::class, 'updateLicense'])->name('tenants.license.update');
        Route::patch('/tenant-license-invoices/{invoice}/status', [TenantManagementController::class, 'updateLicenseInvoiceStatus'])->name('tenant-license-invoices.status');
    });
});

Route::prefix('api/local-agents')
    ->withoutMiddleware([\Illuminate\Foundation\Http\Middleware\PreventRequestForgery::class])
    ->middleware(AuthenticateLocalAgent::class)
    ->group(function () {
        Route::post('/heartbeat', [LocalAgentApiController::class, 'heartbeat'])->name('central.api.local-agents.heartbeat');
        Route::post('/commands/poll', [LocalAgentApiController::class, 'poll'])->name('central.api.local-agents.commands.poll');
        Route::post('/commands/{command}/complete', [LocalAgentApiController::class, 'complete'])->name('central.api.local-agents.commands.complete');
    });
