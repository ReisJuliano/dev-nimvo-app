<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\Auth\LoginController;
use App\Http\Controllers\Tenant\Auth\PasswordChangeController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterApiController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPageController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\Fashion\FashionModuleApiController;
use App\Http\Controllers\Tenant\Fashion\FashionModulePageController;
use App\Http\Controllers\Tenant\Operations\OperationsPageController;
use App\Http\Controllers\Tenant\Orders\OrdersApiController;
use App\Http\Controllers\Tenant\Orders\OrdersPageController;
use App\Http\Controllers\Tenant\Pos\PosApiController;
use App\Http\Controllers\Tenant\Pos\PosPageController;
use App\Http\Controllers\Tenant\Products\ProductsApiController;
use App\Http\Controllers\Tenant\Products\ProductsPageController;
use App\Http\Controllers\Tenant\Settings\SettingsApiController;
use App\Http\Controllers\Tenant\Settings\SettingsPageController;
use App\Http\Controllers\Tenant\Shop\ShopApiController;
use App\Http\Controllers\Tenant\Shop\ShopPageController;
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

Route::get('/shop', ShopPageController::class)->name('shop.index');
Route::post('/shop/api/checkout', [ShopApiController::class, 'checkout'])->name('shop.checkout');

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
        Route::get('/pedidos', OrdersPageController::class)->name('orders.index');
        Route::get('/producao', OperationsPageController::class)->defaults('module', 'producao')->name('production.index');
        Route::get('/fichas-tecnicas', OperationsPageController::class)->defaults('module', 'fichas-tecnicas')->name('recipes.index');
        Route::get('/cozinha', OperationsPageController::class)->defaults('module', 'cozinha')->name('kitchen.index');
        Route::get('/perdas', OperationsPageController::class)->defaults('module', 'perdas')->name('losses.index');
        Route::get('/pesagem', OperationsPageController::class)->defaults('module', 'pesagem')->name('weighing.index');
        Route::get('/delivery', OperationsPageController::class)->defaults('module', 'delivery')->name('delivery.index');
        Route::get('/compras', OperationsPageController::class)->defaults('module', 'compras')->name('purchases.index');
        Route::get('/ordens-servico', OperationsPageController::class)->defaults('module', 'ordens-servico')->name('service-orders.index');
        Route::get('/fiado', OperationsPageController::class)->defaults('module', 'fiado')->name('credit.index');
        Route::get('/trocas-devolucoes', FashionModulePageController::class)->defaults('module', 'returns')->name('returns.index');
        Route::get('/promocoes', FashionModulePageController::class)->defaults('module', 'promotions')->name('promotions.index');
        Route::get('/clientes', OperationsPageController::class)->defaults('module', 'clientes')->name('customers.index');
        Route::get('/fornecedores', OperationsPageController::class)->defaults('module', 'fornecedores')->name('suppliers.index');
        Route::get('/produtores', OperationsPageController::class)->defaults('module', 'produtores')->name('producers.index');
        Route::get('/categorias', OperationsPageController::class)->defaults('module', 'categorias')->name('categories.index');
        Route::get('/entrada-estoque', OperationsPageController::class)->defaults('module', 'entrada-estoque')->name('stock.inbound');
        Route::get('/ajuste-estoque', OperationsPageController::class)->defaults('module', 'ajuste-estoque')->name('stock.adjustments');
        Route::get('/movimentacao-estoque', OperationsPageController::class)->defaults('module', 'movimentacao-estoque')->name('stock.history');
        Route::get('/catalogo-online', FashionModulePageController::class)->defaults('module', 'catalog')->name('online-catalog.index');
        Route::get('/pedidos-online', FashionModulePageController::class)->defaults('module', 'online-orders')->name('online-orders.index');
        Route::get('/whatsapp', FashionModulePageController::class)->defaults('module', 'whatsapp')->name('whatsapp.index');
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
            Route::get('/orders', [OrdersApiController::class, 'index'])->name('api.orders.index');
            Route::get('/orders/pending-checkout', [OrdersApiController::class, 'pendingCheckout'])->name('api.orders.pending-checkout');
            Route::post('/orders', [OrdersApiController::class, 'store'])->name('api.orders.store');
            Route::get('/orders/{orderDraft}', [OrdersApiController::class, 'show'])->name('api.orders.show');
            Route::put('/orders/{orderDraft}', [OrdersApiController::class, 'update'])->name('api.orders.update');
            Route::post('/orders/{orderDraft}/send-to-cashier', [OrdersApiController::class, 'sendToCashier'])->name('api.orders.send-to-cashier');
            Route::put('/settings', [SettingsApiController::class, 'update'])->name('api.settings.update');
            Route::post('/fashion/promotions', [FashionModuleApiController::class, 'storePromotion'])->name('api.fashion.promotions.store');
            Route::put('/fashion/promotions/{promotion}', [FashionModuleApiController::class, 'updatePromotion'])->name('api.fashion.promotions.update');
            Route::delete('/fashion/promotions/{promotion}', [FashionModuleApiController::class, 'destroyPromotion'])->name('api.fashion.promotions.destroy');
            Route::post('/fashion/returns', [FashionModuleApiController::class, 'storeReturn'])->name('api.fashion.returns.store');
            Route::put('/fashion/returns/{returnExchange}', [FashionModuleApiController::class, 'updateReturn'])->name('api.fashion.returns.update');
            Route::delete('/fashion/returns/{returnExchange}', [FashionModuleApiController::class, 'destroyReturn'])->name('api.fashion.returns.destroy');
            Route::put('/fashion/catalog/settings', [FashionModuleApiController::class, 'updateCatalogSettings'])->name('api.fashion.catalog.settings');
            Route::put('/fashion/catalog/products/{product}', [FashionModuleApiController::class, 'updateCatalogProduct'])->name('api.fashion.catalog.products.update');
            Route::post('/fashion/online-orders', [FashionModuleApiController::class, 'storeOnlineOrder'])->name('api.fashion.online-orders.store');
            Route::put('/fashion/online-orders/{orderDraft}', [FashionModuleApiController::class, 'updateOnlineOrder'])->name('api.fashion.online-orders.update');
            Route::post('/fashion/online-orders/{orderDraft}/send-to-cashier', [FashionModuleApiController::class, 'sendOnlineOrderToCashier'])->name('api.fashion.online-orders.send-to-cashier');
            Route::put('/fashion/whatsapp/settings', [FashionModuleApiController::class, 'updateWhatsAppSettings'])->name('api.fashion.whatsapp.settings');
        });
    });
});
