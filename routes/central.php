<?php

use App\Http\Controllers\Central\AdminDashboardController;
use App\Http\Controllers\Central\Auth\LoginController;
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
        Route::get('/painel', AdminDashboardController::class)->name('dashboard');
        Route::post('/tenants', [TenantManagementController::class, 'store'])->name('tenants.store');
        Route::patch('/tenants/{tenant}/status', [TenantManagementController::class, 'updateStatus'])->name('tenants.status');
        Route::put('/tenants/{tenant}/settings', [TenantManagementController::class, 'updateSettings'])->name('tenants.settings');
    });
});
