<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\Auth\LoginController;
use App\Http\Controllers\Tenant\Auth\PasswordChangeController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterApiController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPageController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\Delivery\DeliveryApiController;
use App\Http\Controllers\Tenant\Fiscal\FiscalDocumentsApiController;
use App\Http\Controllers\Tenant\Operations\OperationsApiController;
use App\Http\Controllers\Tenant\Operations\OperationsPageController;
use App\Http\Controllers\Tenant\Orders\OrdersApiController;
use App\Http\Controllers\Tenant\Orders\OrdersPageController;
use App\Http\Controllers\Tenant\Pos\PosApiController;
use App\Http\Controllers\Tenant\Pos\PosPageController;
use App\Http\Controllers\Tenant\Products\ProductsApiController;
use App\Http\Controllers\Tenant\Products\ProductsPageController;
use App\Http\Controllers\Tenant\Settings\SettingsApiController;
use App\Http\Controllers\Tenant\Settings\SettingsPageController;
use App\Http\Middleware\Tenant\EnsurePasswordIsChanged;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

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

    Route::middleware([EnsurePasswordIsChanged::class, 'tenant.license', 'module.enabled'])->group(function () {
        Route::get('/dashboard', DashboardController::class)->name('dashboard');
        Route::get('/pdv', PosPageController::class)->name('pos.index');
        Route::get('/caixa', CashRegisterPageController::class)->name('cash-register.index');
        Route::get('/produtos', ProductsPageController::class)->name('products.index');
        Route::get('/pedidos', OrdersPageController::class)->name('orders.index');
        Route::get('/delivery', OperationsPageController::class)->defaults('module', 'delivery')->name('delivery.index');
        Route::get('/compras', OperationsPageController::class)->defaults('module', 'compras')->name('purchases.index');
        Route::get('/a-prazo', OperationsPageController::class)->defaults('module', 'a-prazo')->name('credit.index');
        Route::get('/fiado', function (Request $request) {
            return redirect()->route('credit.index', array_filter([
                'from' => $request->query('from'),
                'to' => $request->query('to'),
            ], fn ($value) => filled($value)));
        });
        Route::get('/clientes', OperationsPageController::class)->defaults('module', 'clientes')->name('customers.index');
        Route::get('/fornecedores', OperationsPageController::class)->defaults('module', 'fornecedores')->name('suppliers.index');
        Route::get('/categorias', OperationsPageController::class)->defaults('module', 'categorias')->name('categories.index');
        Route::get('/entrada-estoque', OperationsPageController::class)->defaults('module', 'entrada-estoque')->name('stock.inbound');
        Route::get('/ajuste-estoque', OperationsPageController::class)->defaults('module', 'ajuste-estoque')->name('stock.adjustments');
        Route::get('/movimentacao-estoque', OperationsPageController::class)->defaults('module', 'movimentacao-estoque')->name('stock.history');
        Route::get('/relatorios', OperationsPageController::class)->defaults('module', 'relatorios')->name('reports.index');
        Route::get('/vendas', function (Request $request) {
            return redirect()->route('reports.index', array_filter([
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'product' => $request->query('product'),
                'section' => 'sales',
            ], fn ($value) => filled($value)));
        })->name('sales.index');
        Route::get('/demanda', function (Request $request) {
            return redirect()->route('reports.index', array_filter([
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'product' => $request->query('product'),
                'section' => 'products',
            ], fn ($value) => filled($value)));
        })->name('demand.index');
        Route::get('/faltas', OperationsPageController::class)->defaults('module', 'faltas')->name('shortages.index');
        Route::get('/usuarios', OperationsPageController::class)->defaults('module', 'usuarios')->name('users.index');
        Route::get('/configuracoes', SettingsPageController::class)->name('settings.index');
        Route::prefix('/api')->group(function () {
            Route::get('/pdv/products', [PosApiController::class, 'searchProducts'])->name('api.pos.products');
            Route::get('/pdv/recommendations', [PosApiController::class, 'recommendations'])->name('api.pos.recommendations');
            Route::get('/pdv/customers/{customer}/credit', [PosApiController::class, 'customerCredit'])->name('api.pos.customers.credit');
            Route::post('/pdv/customers/quick', [PosApiController::class, 'quickCustomer'])->name('api.pos.customers.quick');
            Route::post('/pdv/companies/quick', [PosApiController::class, 'quickCompany'])->name('api.pos.companies.quick');
            Route::post('/pdv/discounts/authorize', [PosApiController::class, 'authorizeDiscount'])->name('api.pos.discounts.authorize');
            Route::get('/pdv/pending-sale', [PosApiController::class, 'currentPendingSale'])->name('api.pos.pending-sale.show');
            Route::post('/pdv/pending-sale', [PosApiController::class, 'savePendingSale'])->name('api.pos.pending-sale.store');
            Route::post('/pdv/pending-sale/restore', [PosApiController::class, 'restorePendingSale'])->name('api.pos.pending-sale.restore');
            Route::delete('/pdv/pending-sale', [PosApiController::class, 'discardPendingSale'])->name('api.pos.pending-sale.destroy');
            Route::post('/pdv/sales', [PosApiController::class, 'finalize'])->name('api.pos.sales.store');
            Route::post('/pdv/sales/{sale}/issue-fiscal', [PosApiController::class, 'issueFiscalDocument'])->name('api.pos.sales.issue-fiscal');
            Route::post('/fiscal/documents', [FiscalDocumentsApiController::class, 'store'])->name('api.fiscal.documents.store');
            Route::get('/fiscal/documents/{fiscalDocument}', [FiscalDocumentsApiController::class, 'show'])->name('api.fiscal.documents.show');
            Route::post('/fiscal/documents/{fiscalDocument}/retry', [FiscalDocumentsApiController::class, 'retry'])->name('api.fiscal.documents.retry');
            Route::get('/fiscal/documents/{fiscalDocument}/preview', [FiscalDocumentsApiController::class, 'preview'])->name('api.fiscal.documents.preview');
            Route::get('/fiscal/documents/{fiscalDocument}/signed-xml', [FiscalDocumentsApiController::class, 'signedXml'])->name('api.fiscal.documents.signed-xml');

            Route::get('/delivery/orders', [DeliveryApiController::class, 'index'])->name('api.delivery.orders.index');
            Route::post('/delivery/orders/{orderDraft}/from-draft', [DeliveryApiController::class, 'storeFromDraft'])->name('api.delivery.orders.from-draft');
            Route::post('/delivery/orders/{deliveryOrder}/status', [DeliveryApiController::class, 'updateStatus'])->name('api.delivery.orders.status');

            Route::post('/cash-registers', [CashRegisterApiController::class, 'open'])->name('api.cash-registers.open');
            Route::post('/cash-registers/{cashRegister}/movements', [CashRegisterApiController::class, 'movement'])->name('api.cash-registers.movements.store');
            Route::post('/cash-registers/supervisor-authorize', [CashRegisterApiController::class, 'authorizeSupervisor'])->name('api.cash-registers.supervisor-authorize');
            Route::post('/cash-registers/{cashRegister}/close', [CashRegisterApiController::class, 'close'])->name('api.cash-registers.close');
            Route::get('/cash-registers/{cashRegister}/report', [CashRegisterApiController::class, 'report'])->name('api.cash-registers.report');

            Route::post('/products', [ProductsApiController::class, 'store'])->name('api.products.store');
            Route::get('/products/{product}', [ProductsApiController::class, 'show'])->name('api.products.show');
            Route::put('/products/{product}', [ProductsApiController::class, 'update'])->name('api.products.update');
            Route::delete('/products/{product}', [ProductsApiController::class, 'destroy'])->name('api.products.destroy');
            Route::get('/orders', [OrdersApiController::class, 'index'])->name('api.orders.index');
            Route::get('/orders/pending-checkout', [OrdersApiController::class, 'pendingCheckout'])->name('api.orders.pending-checkout');
            Route::post('/orders', [OrdersApiController::class, 'store'])->name('api.orders.store');
            Route::get('/orders/{orderDraft}', [OrdersApiController::class, 'show'])->name('api.orders.show');
            Route::put('/orders/{orderDraft}', [OrdersApiController::class, 'update'])->name('api.orders.update');
            Route::delete('/orders/{orderDraft}', [OrdersApiController::class, 'destroy'])->name('api.orders.destroy');
            Route::post('/orders/{orderDraft}/send-to-cashier', [OrdersApiController::class, 'sendToCashier'])->name('api.orders.send-to-cashier');
            Route::post('/orders/{orderDraft}/partial-checkout', [OrdersApiController::class, 'partialCheckout'])->name('api.orders.partial-checkout');
            Route::put('/settings', [SettingsApiController::class, 'update'])->name('api.settings.update');
            Route::get('/operations/{module}/records', [OperationsApiController::class, 'index'])->name('api.operations.index');
            Route::post('/operations/{module}/records', [OperationsApiController::class, 'store'])->name('api.operations.store');
            Route::put('/operations/{module}/records/{record}', [OperationsApiController::class, 'update'])->whereNumber('record')->name('api.operations.update');
            Route::delete('/operations/{module}/records/{record}', [OperationsApiController::class, 'destroy'])->whereNumber('record')->name('api.operations.destroy');
        });
    });
});
