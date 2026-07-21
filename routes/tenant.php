<?php

declare(strict_types=1);

use App\Http\Controllers\Tenant\Audit\AuditApiController;
use App\Http\Controllers\Tenant\Audit\AuditPageController;
use App\Http\Controllers\Tenant\Auth\LoginController;
use App\Http\Controllers\Tenant\Auth\PasswordChangeController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterApiController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPageController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPanelApiController;
use App\Http\Controllers\Tenant\CashRegister\CashRegisterPanelPageController;
use App\Http\Controllers\Tenant\ConditionalSales\ConditionalSalesController;
use App\Http\Controllers\Tenant\Customers\CustomerCashbackController;
use App\Http\Controllers\Tenant\ConditionalSales\ConditionalSalesPageController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\Delivery\DeliveryApiController;
use App\Http\Controllers\Tenant\Fashion\FashionModuleApiController;
use App\Http\Controllers\Tenant\Fashion\FashionModulePageController;
use App\Http\Controllers\Tenant\Fiscal\AccountantExportController;
use App\Http\Controllers\Tenant\Fiscal\FiscalConsultationsPageController;
use App\Http\Controllers\Tenant\Fiscal\FiscalDocumentCorrectionController;
use App\Http\Controllers\Tenant\Fiscal\FiscalContingencyRetryController;
use App\Http\Controllers\Tenant\Fiscal\FiscalDocumentsApiController;
use App\Http\Controllers\Tenant\Fiscal\FiscalDocumentsPageController;
use App\Http\Controllers\Tenant\Fiscal\FiscalNumberInutilizationController;
use App\Http\Controllers\Tenant\Fiscal\FiscalSaleContingencyController;
use App\Http\Controllers\Tenant\Fiscal\FiscalSaleCancellationController;
use App\Http\Controllers\Tenant\Mobile\MobileAuthController;
use App\Http\Controllers\Tenant\Mobile\MobileCashRegisterController;
use App\Http\Controllers\Tenant\Mobile\MobileDashboardController;
use App\Http\Controllers\Tenant\Mobile\MobileProductsController;
use App\Http\Controllers\Tenant\Mobile\MobileReportsController;
use App\Http\Controllers\Tenant\Mobile\MobileSalesController;
use App\Http\Controllers\Tenant\Mobile\MobileStockController;
use App\Http\Controllers\Tenant\Operations\OperationsApiController;
use App\Http\Controllers\Tenant\Operations\OperationsPageController;
use App\Http\Controllers\Tenant\Orders\OrdersApiController;
use App\Http\Controllers\Tenant\Orders\OrdersPageController;
use App\Http\Controllers\Tenant\Inventory\InventoryCollectorController;
use App\Http\Controllers\Tenant\Inventory\InventoryPageController;
use App\Http\Controllers\Tenant\Inventory\InventorySessionApiController;
use App\Http\Controllers\Tenant\Inventory\StockEntryMaintenancePageController;
use App\Http\Controllers\Tenant\Inventory\StockEntryPageController;
use App\Http\Controllers\Tenant\Labels\LabelsApiController;
use App\Http\Controllers\Tenant\Labels\LabelsPageController;
use App\Http\Controllers\Tenant\Labels\LabelLayoutEditorPageController;
use App\Http\Controllers\Tenant\Labels\LabelTemplatesApiController;
use App\Http\Controllers\Tenant\Labels\LabelTemplatesPageController;
use App\Http\Controllers\Tenant\Payables\PayablesPageController;
use App\Http\Controllers\Tenant\Pos\PosApiController;
use App\Http\Controllers\Tenant\Pos\PosPageController;
use App\Http\Controllers\Tenant\Products\ProductImportController;
use App\Http\Controllers\Tenant\Products\ProductsApiController;
use App\Http\Controllers\Tenant\Products\ProductsPageController;
use App\Http\Controllers\Tenant\Promotions\PromotionCampaignsApiController;
use App\Http\Controllers\Tenant\Promotions\PromotionsApiController;
use App\Http\Controllers\Tenant\Promotions\PromotionsPageController;
use App\Http\Controllers\Tenant\Purchases\IncomingNfeApiController;
use App\Http\Controllers\Tenant\Purchases\PurchaseReturnController;
use App\Http\Controllers\Tenant\Purchases\PurchaseReturnPageController;
use App\Http\Controllers\Tenant\Receivables\ReceivablesApiController;
use App\Http\Controllers\Tenant\Receivables\ReceivablesPageController;
use App\Http\Controllers\Tenant\Purchases\PurchasesPageController;
use App\Http\Controllers\Tenant\Purchases\PurchaseReportController;
use App\Http\Controllers\Tenant\Sales\SaleReturnController;
use App\Http\Controllers\Tenant\Sales\SaleReturnPageController;
use App\Http\Controllers\Tenant\Reports\ReportPageController;
use App\Http\Controllers\Tenant\Settings\SettingsApiController;
use App\Http\Controllers\Tenant\Settings\LocalAgentSettingsController;
use App\Http\Controllers\Tenant\Settings\SettingsPageController;
use App\Http\Controllers\Tenant\Settings\TillSettingsController;
use App\Http\Controllers\Tenant\Till\TillApiController;
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
Route::post('/shop/api/checkout', [ShopApiController::class, 'checkout'])
    ->middleware('throttle:10,1')
    ->name('shop.checkout');

Route::prefix('mobile-api/v1')->group(function () {
    Route::post('/auth/login', [MobileAuthController::class, 'login'])
        ->middleware('throttle:10,1')
        ->name('mobile.auth.login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [MobileAuthController::class, 'logout'])->name('mobile.auth.logout');
        Route::get('/auth/me', [MobileAuthController::class, 'me'])->name('mobile.auth.me');

        Route::get('/dashboard', [MobileDashboardController::class, 'index'])->name('mobile.dashboard');
        Route::get('/sales', [MobileSalesController::class, 'index'])->name('mobile.sales.index');
        Route::get('/sales/by-seller', [MobileSalesController::class, 'bySeller'])->name('mobile.sales.by-seller');
        Route::get('/reports/cmv', [MobileReportsController::class, 'cmv'])->name('mobile.reports.cmv');
        Route::get('/reports/period', [MobileReportsController::class, 'period'])->name('mobile.reports.period');
        Route::get('/reports/top-products', [MobileReportsController::class, 'topProducts'])->name('mobile.reports.top-products');
        Route::get('/reports/payment-methods', [MobileReportsController::class, 'paymentMethods'])->name('mobile.reports.payment-methods');
        Route::get('/reports/products', [MobileReportsController::class, 'products'])->name('mobile.reports.products');
        Route::get('/products/search', [MobileProductsController::class, 'search'])->name('mobile.products.search');
        Route::get('/stock/alerts', [MobileStockController::class, 'alerts'])->name('mobile.stock.alerts');
        Route::get('/cash-register/status', [MobileCashRegisterController::class, 'status'])->name('mobile.cash-register.status');
    });
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
        Route::get('/caixa/painel', CashRegisterPanelPageController::class)->name('cash-register.panel');
        Route::get('/produtos', ProductsPageController::class)->name('products.index');
        Route::get('/pedidos', OrdersPageController::class)->name('orders.index');
        Route::get('/venda-condicional', ConditionalSalesPageController::class)->name('conditional-sales.index');
        Route::get('/consultas-cancelamentos', FiscalConsultationsPageController::class)->name('fiscal.consultations.index');
        Route::get('/fiscal/notas', FiscalDocumentsPageController::class)->name('fiscal.notas.index');
        Route::get('/delivery', OperationsPageController::class)->defaults('module', 'delivery')->name('delivery.index');
        Route::get('/compras', PurchasesPageController::class)->name('purchases.index');
        Route::get('/compras/devolucoes', PurchaseReturnPageController::class)->name('purchases.returns.index');
        Route::get('/vendas/devolucoes', SaleReturnPageController::class)->name('sales.returns.index');
        Route::get('/contas-a-pagar', PayablesPageController::class)->name('payables.index');
        Route::get('/a-prazo', OperationsPageController::class)->defaults('module', 'a-prazo')->name('credit.index');
        Route::get('/a-receber', ReceivablesPageController::class)->name('receivables.index');
        Route::get('/fiado', function (Request $request) {
            return redirect()->route('credit.index', array_filter([
                'from' => $request->query('from'),
                'to' => $request->query('to'),
            ], fn ($value) => filled($value)));
        });
        Route::get('/clientes', OperationsPageController::class)->defaults('module', 'clientes')->name('customers.index');
        Route::get('/fornecedores', OperationsPageController::class)->defaults('module', 'fornecedores')->name('suppliers.index');
        Route::get('/categorias', OperationsPageController::class)->defaults('module', 'categorias')->name('categories.index');
        Route::get('/estoque', StockEntryPageController::class)->name('stock.view');
        Route::get('/entrada-estoque/manutencao', StockEntryMaintenancePageController::class)->name('stock.inbound.maintenance');
        Route::get('/entrada-estoque', [StockEntryPageController::class, 'entrada'])->name('stock.entry');
        Route::get('/inventario', InventoryPageController::class)->name('inventory.index');
        Route::get('/promocoes', PromotionsPageController::class)->name('promotions.index');
        Route::get('/etiquetas', LabelsPageController::class)->name('labels.index');
        Route::get('/etiquetas/padroes', LabelTemplatesPageController::class)->name('labels.templates.index');
        Route::get('/etiquetas/padroes/{labelTemplate}/layout', LabelLayoutEditorPageController::class)->name('labels.templates.layout.edit');
        Route::get('/relatorios', OperationsPageController::class)->defaults('module', 'relatorios')->name('reports.index');
        Route::get('/relatorios/ver/{report}', ReportPageController::class)->name('reports.show');
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
        Route::get('/faltas', function (Request $request) {
            return redirect()->route('reports.show', array_filter([
                'report' => 'stock-shortages',
                'scope' => $request->query('scope'),
                'date' => $request->query('date'),
                'month' => $request->query('month'),
                'month_from' => $request->query('month_from'),
                'month_to' => $request->query('month_to'),
                'year' => $request->query('year'),
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'per_page' => $request->query('per_page'),
                'page' => $request->query('page'),
            ], fn ($value) => filled($value)));
        })->name('shortages.index');
        Route::get('/usuarios', OperationsPageController::class)->defaults('module', 'usuarios')->name('users.index');
        Route::get('/configuracoes', SettingsPageController::class)->name('settings.index');
        Route::get('/auditoria', AuditPageController::class)->name('audit.index');
        Route::get('/moda/{module}', FashionModulePageController::class)
            ->where('module', 'promotions|returns|catalog|online-orders|whatsapp')
            ->name('fashion.workspace');
        Route::post('/consultas-cancelamentos/vendas/{sale}/cancelar', FiscalSaleCancellationController::class)
            ->name('fiscal.consultations.sales.cancel');
        Route::post('/consultas-cancelamentos/vendas/{sale}/contingencia', FiscalSaleContingencyController::class)
            ->name('fiscal.consultations.sales.contingency');
        Route::post('/venda-condicional', [ConditionalSalesController::class, 'store'])
            ->name('conditional-sales.store');
        Route::post('/venda-condicional/{conditionalSale}/devolver', [ConditionalSalesController::class, 'returnItems'])
            ->name('conditional-sales.return-items');
        Route::post('/venda-condicional/{conditionalSale}/finalizar', [ConditionalSalesController::class, 'finalize'])
            ->name('conditional-sales.finalize');
        Route::post('/consultas-cancelamentos/inutilizacoes', FiscalNumberInutilizationController::class)
            ->name('fiscal.consultations.inutilizations.store');
        Route::post('/consultas-cancelamentos/contingencia/retry', FiscalContingencyRetryController::class)
            ->name('fiscal.consultations.contingency.retry');
        Route::prefix('/api')->group(function () {
            Route::get('/pdv/products', [PosApiController::class, 'searchProducts'])->name('api.pos.products');
            Route::post('/pdv/products/quick', [PosApiController::class, 'quickProduct'])->name('api.pos.products.quick');
            Route::get('/pdv/recommendations', [PosApiController::class, 'recommendations'])->name('api.pos.recommendations');
            Route::get('/pdv/customers/{customer}/credit', [PosApiController::class, 'customerCredit'])->name('api.pos.customers.credit');
            Route::post('/pdv/customers/quick', [PosApiController::class, 'quickCustomer'])->name('api.pos.customers.quick');
            Route::post('/pdv/companies/quick', [PosApiController::class, 'quickCompany'])->name('api.pos.companies.quick');
            Route::post('/pdv/discounts/authorize', [PosApiController::class, 'authorizeDiscount'])->name('api.pos.discounts.authorize');
            Route::post('/pdv/promotions/evaluate', [PosApiController::class, 'evaluatePromotions'])->name('api.pos.promotions.evaluate');

            Route::get('/promotions', [PromotionsApiController::class, 'index'])->name('api.promotions.index');
            Route::post('/promotions', [PromotionsApiController::class, 'store'])->name('api.promotions.store');
            Route::get('/promotions/products/search', [PromotionsApiController::class, 'searchProducts'])->name('api.promotions.products.search');
            Route::put('/promotions/{promotion}', [PromotionsApiController::class, 'update'])->name('api.promotions.update');
            Route::delete('/promotions/{promotion}', [PromotionsApiController::class, 'destroy'])->name('api.promotions.destroy');
            Route::post('/promotions/{promotion}/duplicate', [PromotionsApiController::class, 'duplicate'])->name('api.promotions.duplicate');

            Route::get('/promotion-campaigns', [PromotionCampaignsApiController::class, 'index'])->name('api.promotion-campaigns.index');
            Route::post('/promotion-campaigns', [PromotionCampaignsApiController::class, 'store'])->name('api.promotion-campaigns.store');
            Route::get('/promotion-campaigns/{campaign}', [PromotionCampaignsApiController::class, 'show'])->name('api.promotion-campaigns.show');
            Route::put('/promotion-campaigns/{campaign}', [PromotionCampaignsApiController::class, 'update'])->name('api.promotion-campaigns.update');
            Route::delete('/promotion-campaigns/{campaign}', [PromotionCampaignsApiController::class, 'destroy'])->name('api.promotion-campaigns.destroy');
            Route::post('/promotion-campaigns/{campaign}/duplicate', [PromotionCampaignsApiController::class, 'duplicate'])->name('api.promotion-campaigns.duplicate');
            Route::post('/promotion-campaigns/{campaign}/bulk-items', [PromotionCampaignsApiController::class, 'bulkAddItems'])->name('api.promotion-campaigns.bulk-items');
            Route::get('/promotion-campaigns/{campaign}/performance', [PromotionCampaignsApiController::class, 'performance'])->name('api.promotion-campaigns.performance');
            Route::get('/promotion-campaigns/{campaign}/pdf', [PromotionCampaignsApiController::class, 'pdf'])->name('api.promotion-campaigns.pdf');

            Route::get('/labels', [LabelsApiController::class, 'index'])->name('api.labels.index');
            Route::post('/labels/print', [LabelsApiController::class, 'print'])->name('api.labels.print');
            Route::post('/labels/pdf', [LabelsApiController::class, 'pdf'])->name('api.labels.pdf');

            Route::get('/labels/templates', [LabelTemplatesApiController::class, 'index'])->name('api.labels.templates.index');
            Route::post('/labels/templates', [LabelTemplatesApiController::class, 'store'])->name('api.labels.templates.store');
            Route::get('/labels/templates/{labelTemplate}', [LabelTemplatesApiController::class, 'show'])->name('api.labels.templates.show');
            Route::put('/labels/templates/{labelTemplate}', [LabelTemplatesApiController::class, 'update'])->name('api.labels.templates.update');
            Route::put('/labels/templates/{labelTemplate}/layout', [LabelTemplatesApiController::class, 'updateLayout'])->name('api.labels.templates.layout.update');
            Route::post('/labels/templates/{labelTemplate}/layout/preview', [LabelTemplatesApiController::class, 'previewLayout'])->name('api.labels.templates.layout.preview');
            Route::delete('/labels/templates/{labelTemplate}', [LabelTemplatesApiController::class, 'destroy'])->name('api.labels.templates.destroy');
            Route::get('/pdv/pending-sale', [PosApiController::class, 'currentPendingSale'])->name('api.pos.pending-sale.show');
            Route::post('/pdv/pending-sale', [PosApiController::class, 'savePendingSale'])->name('api.pos.pending-sale.store');
            Route::post('/pdv/pending-sale/restore', [PosApiController::class, 'restorePendingSale'])->name('api.pos.pending-sale.restore');
            Route::delete('/pdv/pending-sale', [PosApiController::class, 'discardPendingSale'])->name('api.pos.pending-sale.destroy');
            Route::post('/pdv/sales', [PosApiController::class, 'finalize'])->name('api.pos.sales.store');
            Route::post('/pdv/sales/{sale}/issue-fiscal', [PosApiController::class, 'issueFiscalDocument'])->name('api.pos.sales.issue-fiscal');
            Route::get('/pdv/local-agent/commands/{command}', [PosApiController::class, 'localAgentCommand'])->name('api.pos.local-agent.commands.show');
            Route::post('/pdv/local-agent/commands/{command}/retry', [PosApiController::class, 'retryLocalAgentCommand'])->name('api.pos.local-agent.commands.retry');
            Route::post('/fiscal/documents', [FiscalDocumentsApiController::class, 'store'])->name('api.fiscal.documents.store');
            Route::post('/fiscal/sales/{sale}/convert-to-nfe', [FiscalDocumentsApiController::class, 'convertToNfe'])->name('api.fiscal.documents.convert-to-nfe');
            Route::post('/fiscal/notas/manual', [FiscalDocumentsApiController::class, 'storeManual'])->name('api.fiscal.notas.manual');
            Route::get('/fiscal/notas/sales/lookup', [FiscalDocumentsApiController::class, 'lookupSale'])->name('api.fiscal.notas.sales.lookup');
            Route::get('/fiscal/documents/{fiscalDocument}', [FiscalDocumentsApiController::class, 'show'])->name('api.fiscal.documents.show');
            Route::post('/fiscal/documents/{fiscalDocument}/retry', [FiscalDocumentsApiController::class, 'retry'])->name('api.fiscal.documents.retry');
            Route::get('/fiscal/documents/{fiscalDocument}/preview', [FiscalDocumentsApiController::class, 'preview'])->name('api.fiscal.documents.preview');
            Route::get('/fiscal/documents/{fiscalDocument}/signed-xml', [FiscalDocumentsApiController::class, 'signedXml'])->name('api.fiscal.documents.signed-xml');
            Route::get('/fiscal/documents/{fiscalDocument}/authorized-xml', [FiscalDocumentsApiController::class, 'authorizedXml'])->name('api.fiscal.documents.authorized-xml');
            Route::get('/fiscal/documents/{fiscalDocument}/response-xml', [FiscalDocumentsApiController::class, 'responseXml'])->name('api.fiscal.documents.response-xml');
            Route::get('/fiscal/documents/{fiscalDocument}/cancellation-request-xml', [FiscalDocumentsApiController::class, 'cancellationRequestXml'])->name('api.fiscal.documents.cancellation-request-xml');
            Route::get('/fiscal/documents/{fiscalDocument}/cancellation-response-xml', [FiscalDocumentsApiController::class, 'cancellationResponseXml'])->name('api.fiscal.documents.cancellation-response-xml');
            Route::get('/fiscal/documents/{fiscalDocument}/cancelled-xml', [FiscalDocumentsApiController::class, 'cancelledXml'])->name('api.fiscal.documents.cancelled-xml');
            Route::post('/fiscal/documents/{fiscalDocument}/correction', FiscalDocumentCorrectionController::class)->name('api.fiscal.documents.correction.store');
            Route::get('/fiscal/documents/{fiscalDocument}/correction/{sequence}/request-xml', [FiscalDocumentsApiController::class, 'correctionRequestXml'])->whereNumber('sequence')->name('api.fiscal.documents.correction.request-xml');
            Route::get('/fiscal/documents/{fiscalDocument}/correction/{sequence}/response-xml', [FiscalDocumentsApiController::class, 'correctionResponseXml'])->whereNumber('sequence')->name('api.fiscal.documents.correction.response-xml');
            Route::get('/fiscal/accountant-export', [AccountantExportController::class, 'download'])->name('api.fiscal.accountant-export.download');

            Route::get('/delivery/orders', [DeliveryApiController::class, 'index'])->name('api.delivery.orders.index');
            Route::post('/delivery/orders/{orderDraft}/from-draft', [DeliveryApiController::class, 'storeFromDraft'])->name('api.delivery.orders.from-draft');
            Route::post('/delivery/orders/{deliveryOrder}/status', [DeliveryApiController::class, 'updateStatus'])->name('api.delivery.orders.status');

            Route::get('/audit/logs', [AuditApiController::class, 'index'])->name('api.audit.logs.index');
            Route::get('/audit/logs/{auditLog}', [AuditApiController::class, 'show'])->name('api.audit.logs.show');

            Route::get('/tills', [TillApiController::class, 'index'])->name('api.tills.index');
            Route::post('/cash-registers', [CashRegisterApiController::class, 'open'])->name('api.cash-registers.open');
            Route::post('/cash-registers/{cashRegister}/movements', [CashRegisterApiController::class, 'movement'])->name('api.cash-registers.movements.store');
            Route::post('/cash-registers/supervisor-authorize', [CashRegisterApiController::class, 'authorizeSupervisor'])->name('api.cash-registers.supervisor-authorize');
            Route::post('/cash-registers/{cashRegister}/close', [CashRegisterApiController::class, 'close'])->name('api.cash-registers.close');
            Route::get('/cash-registers/{cashRegister}/report', [CashRegisterApiController::class, 'report'])->name('api.cash-registers.report');
            Route::get('/cash-registers/panel/open', [CashRegisterPanelApiController::class, 'openRegisters'])->name('api.cash-registers.panel.open');
            Route::get('/cash-registers/panel/closed', [CashRegisterPanelApiController::class, 'closedRegisters'])->name('api.cash-registers.panel.closed');
            Route::post('/stock/quick-receive', [StockEntryPageController::class, 'quickReceive'])->name('api.stock.quick-receive');
            Route::post('/stock/quick-adjust', [StockEntryPageController::class, 'quickAdjust'])->name('api.stock.quick-adjust');
            Route::post('/stock/register-loss', [StockEntryPageController::class, 'registerLoss'])->name('api.stock.register-loss');
            Route::get('/stock/expiring', [StockEntryPageController::class, 'expiring'])->name('api.stock.expiring');
            Route::get('/stock/products/{product}/movements', [StockEntryPageController::class, 'productMovements'])->name('api.stock.product-movements');

            Route::get('/inventory/sessions', [InventorySessionApiController::class, 'index'])->name('api.inventory.sessions.index');
            Route::post('/inventory/sessions', [InventorySessionApiController::class, 'store'])->name('api.inventory.sessions.store');
            Route::get('/inventory/sessions-accuracy-history', [InventorySessionApiController::class, 'accuracyHistory'])->name('api.inventory.sessions.accuracy-history');
            Route::get('/inventory/cycle-count/suggestion', [InventorySessionApiController::class, 'cycleCountSuggestion'])->name('api.inventory.cycle-count.suggestion');
            Route::get('/inventory/sessions/{inventorySession}', [InventorySessionApiController::class, 'show'])->name('api.inventory.sessions.show');
            Route::get('/inventory/sessions/{inventorySession}/progress', [InventorySessionApiController::class, 'progress'])->name('api.inventory.sessions.progress');
            Route::post('/inventory/sessions/{inventorySession}/start', [InventorySessionApiController::class, 'start'])->name('api.inventory.sessions.start');
            Route::post('/inventory/sessions/{inventorySession}/cancel', [InventorySessionApiController::class, 'cancel'])->name('api.inventory.sessions.cancel');
            Route::post('/inventory/sessions/{inventorySession}/finish-counting', [InventorySessionApiController::class, 'finishCounting'])->name('api.inventory.sessions.finish-counting');
            Route::post('/inventory/sessions/{inventorySession}/approve', [InventorySessionApiController::class, 'approve'])->name('api.inventory.sessions.approve');
            Route::get('/inventory/sessions/{inventorySession}/items', [InventorySessionApiController::class, 'items'])->name('api.inventory.sessions.items.index');
            Route::post('/inventory/sessions/{inventorySession}/counts', [InventorySessionApiController::class, 'recordCount'])->name('api.inventory.sessions.counts.store');
            Route::post('/inventory/sessions/{inventorySession}/items/recount', [InventorySessionApiController::class, 'bulkRecount'])->name('api.inventory.sessions.items.recount');
            Route::post('/inventory/sessions/{inventorySession}/items/mark-zero', [InventorySessionApiController::class, 'bulkMarkZero'])->name('api.inventory.sessions.items.mark-zero');
            Route::post('/inventory/sessions/{inventorySession}/items/mark-skipped', [InventorySessionApiController::class, 'bulkMarkSkipped'])->name('api.inventory.sessions.items.mark-skipped');
            Route::post('/inventory/sessions/{inventorySession}/items/{item}/resolve', [InventorySessionApiController::class, 'resolveItem'])->name('api.inventory.sessions.items.resolve');
            Route::get('/inventory/sessions/{inventorySession}/items/{item}/reconciliation', [InventorySessionApiController::class, 'itemReconciliation'])->name('api.inventory.sessions.items.reconciliation');

            Route::get('/inventory/collector-layouts', [InventoryCollectorController::class, 'layouts'])->name('api.inventory.layouts.index');
            Route::post('/inventory/collector-layouts', [InventoryCollectorController::class, 'storeLayout'])->name('api.inventory.layouts.store');
            Route::put('/inventory/collector-layouts/{layout}', [InventoryCollectorController::class, 'updateLayout'])->name('api.inventory.layouts.update');
            Route::delete('/inventory/collector-layouts/{layout}', [InventoryCollectorController::class, 'destroyLayout'])->name('api.inventory.layouts.destroy');
            Route::post('/inventory/collector-layouts/preview', [InventoryCollectorController::class, 'previewLayout'])->name('api.inventory.layouts.preview');
            Route::get('/inventory/sessions/{inventorySession}/export', [InventoryCollectorController::class, 'export'])->name('api.inventory.sessions.export');
            Route::post('/inventory/sessions/{inventorySession}/import', [InventoryCollectorController::class, 'import'])->name('api.inventory.sessions.import');
            Route::post('/inventory/sessions/{inventorySession}/import-batches/{batch}/resolve-line', [InventoryCollectorController::class, 'resolveUnmatchedLine'])->name('api.inventory.sessions.import-batches.resolve-line');

            Route::post('/products', [ProductsApiController::class, 'store'])->name('api.products.store');
            Route::get('/products/{product}', [ProductsApiController::class, 'show'])->name('api.products.show');
            Route::put('/products/{product}', [ProductsApiController::class, 'update'])->name('api.products.update');
            Route::delete('/products/{product}', [ProductsApiController::class, 'destroy'])->name('api.products.destroy');
            Route::post('/products/import/preview', [ProductImportController::class, 'preview'])->name('api.products.import.preview');
            Route::post('/products/import/commit', [ProductImportController::class, 'commit'])->name('api.products.import.commit');
            Route::get('/orders', [OrdersApiController::class, 'index'])->name('api.orders.index');
            Route::get('/orders/pending-checkout', [OrdersApiController::class, 'pendingCheckout'])->name('api.orders.pending-checkout');
            Route::post('/orders', [OrdersApiController::class, 'store'])->name('api.orders.store');
            Route::get('/orders/{orderDraft}', [OrdersApiController::class, 'show'])->name('api.orders.show');
            Route::put('/orders/{orderDraft}', [OrdersApiController::class, 'update'])->name('api.orders.update');
            Route::delete('/orders/{orderDraft}', [OrdersApiController::class, 'destroy'])->name('api.orders.destroy');
            Route::post('/orders/{orderDraft}/send-to-cashier', [OrdersApiController::class, 'sendToCashier'])->name('api.orders.send-to-cashier');
            Route::post('/orders/{orderDraft}/partial-checkout', [OrdersApiController::class, 'partialCheckout'])->name('api.orders.partial-checkout');
            Route::put('/settings', [SettingsApiController::class, 'update'])->name('api.settings.update');
            Route::get('/settings/local-agent', [LocalAgentSettingsController::class, 'index'])->name('api.settings.local-agent.index');
            Route::post('/settings/local-agent', [LocalAgentSettingsController::class, 'store'])->name('api.settings.local-agent.store');
            Route::put('/settings/local-agent/{agent}', [LocalAgentSettingsController::class, 'update'])->name('api.settings.local-agent.update');
            Route::get('/settings/local-agent/{agent}/download', [LocalAgentSettingsController::class, 'download'])->name('api.settings.local-agent.download');
            Route::post('/settings/local-agent/{agent}/activation-code', [LocalAgentSettingsController::class, 'activationCode'])->name('api.settings.local-agent.activation-code');
            Route::get('/settings/tills', [TillSettingsController::class, 'index'])->name('api.settings.tills.index');
            Route::post('/settings/tills', [TillSettingsController::class, 'store'])->name('api.settings.tills.store');
            Route::put('/settings/tills/{till}', [TillSettingsController::class, 'update'])->name('api.settings.tills.update');
            Route::post('/fiado/receber', [OperationsApiController::class, 'receiveCreditPayment'])->name('api.credit.receive');

            Route::get('/receivables', [ReceivablesApiController::class, 'index'])->name('api.receivables.index');
            Route::get('/receivables/customers/{customer}/statement', [ReceivablesApiController::class, 'statement'])->name('api.receivables.statement');
            Route::post('/receivables/receive', [ReceivablesApiController::class, 'receive'])->name('api.receivables.receive');
            Route::post('/receivables/deliveries/{deliveryOrder}/collect', [ReceivablesApiController::class, 'collectDelivery'])->name('api.receivables.deliveries.collect');

            Route::prefix('fashion')->group(function () {
                Route::post('/promotions', [FashionModuleApiController::class, 'storePromotion'])->name('api.fashion.promotions.store');
                Route::put('/promotions/{promotion}', [FashionModuleApiController::class, 'updatePromotion'])->name('api.fashion.promotions.update');
                Route::delete('/promotions/{promotion}', [FashionModuleApiController::class, 'destroyPromotion'])->name('api.fashion.promotions.destroy');
                Route::post('/returns', [FashionModuleApiController::class, 'storeReturn'])->name('api.fashion.returns.store');
                Route::put('/returns/{returnExchange}', [FashionModuleApiController::class, 'updateReturn'])->name('api.fashion.returns.update');
                Route::delete('/returns/{returnExchange}', [FashionModuleApiController::class, 'destroyReturn'])->name('api.fashion.returns.destroy');
                Route::put('/catalog/settings', [FashionModuleApiController::class, 'updateCatalogSettings'])->name('api.fashion.catalog.settings');
                Route::put('/catalog/products/{product}', [FashionModuleApiController::class, 'updateCatalogProduct'])->name('api.fashion.catalog.products.update');
                Route::post('/online-orders', [FashionModuleApiController::class, 'storeOnlineOrder'])->name('api.fashion.online-orders.store');
                Route::put('/online-orders/{orderDraft}', [FashionModuleApiController::class, 'updateOnlineOrder'])->name('api.fashion.online-orders.update');
                Route::post('/online-orders/{orderDraft}/send-to-cashier', [FashionModuleApiController::class, 'sendOnlineOrderToCashier'])->name('api.fashion.online-orders.send-to-cashier');
                Route::put('/whatsapp/settings', [FashionModuleApiController::class, 'updateWhatsAppSettings'])->name('api.fashion.whatsapp.settings');
            });

            Route::post('/purchases/incoming-nfe/sync', [IncomingNfeApiController::class, 'sync'])->name('api.purchases.incoming-nfe.sync');
            Route::post('/purchases/incoming-nfe/import-xml', [IncomingNfeApiController::class, 'importXml'])->name('api.purchases.incoming-nfe.import-xml');
            Route::put('/purchases/incoming-nfe/{document}/mappings', [IncomingNfeApiController::class, 'updateMappings'])->name('api.purchases.incoming-nfe.mappings.update');
            Route::post('/purchases/incoming-nfe/{document}/supplier/quick', [IncomingNfeApiController::class, 'quickCreateSupplier'])->name('api.purchases.incoming-nfe.supplier.quick');
            Route::post('/purchases/incoming-nfe/{document}/validate-sefaz', [IncomingNfeApiController::class, 'validateWithSefaz'])->name('api.purchases.incoming-nfe.validate-sefaz');
            Route::post('/purchases/incoming-nfe/{document}/manifest', [IncomingNfeApiController::class, 'manifest'])->name('api.purchases.incoming-nfe.manifest');
            Route::post('/purchases/incoming-nfe/{document}/physical-receipt', [IncomingNfeApiController::class, 'recordPhysicalReceipt'])->name('api.purchases.incoming-nfe.physical-receipt');
            Route::post('/purchases/incoming-nfe/{document}/confirm', [IncomingNfeApiController::class, 'confirm'])->name('api.purchases.incoming-nfe.confirm');
            Route::post('/purchases/incoming-nfe/{document}/reprocess', [IncomingNfeApiController::class, 'reprocess'])->name('api.purchases.incoming-nfe.reprocess');
            Route::get('/purchases/incoming-nfe/{document}/xml', [IncomingNfeApiController::class, 'xml'])->name('api.purchases.incoming-nfe.xml');
            Route::get('/purchases/incoming-nfe/{document}/danfe', [IncomingNfeApiController::class, 'danfe'])->name('api.purchases.incoming-nfe.danfe');
            Route::get('/purchases/{purchase}/report', PurchaseReportController::class)->whereNumber('purchase')->name('api.purchases.report');
            Route::get('/purchases/returns/lookup', [PurchaseReturnController::class, 'lookup'])->name('api.purchases.returns.lookup');
            Route::get('/purchases/{purchase}/returns', [PurchaseReturnController::class, 'index'])->whereNumber('purchase')->name('api.purchases.returns.index');
            Route::post('/purchases/{purchase}/returns', [PurchaseReturnController::class, 'store'])->whereNumber('purchase')->name('api.purchases.returns.store');
            Route::get('/purchases/{purchase}/returnable-items', [PurchaseReturnController::class, 'returnableItems'])->whereNumber('purchase')->name('api.purchases.returnable-items');
            Route::get('/purchase-returns/{purchaseReturn}', [PurchaseReturnController::class, 'show'])->name('api.purchase-returns.show');
            Route::post('/purchase-returns/{purchaseReturn}/issue-fiscal', [PurchaseReturnController::class, 'issueFiscal'])->name('api.purchase-returns.issue-fiscal');
            Route::get('/sales/{sale}/returns', [SaleReturnController::class, 'index'])->whereNumber('sale')->name('api.sales.returns.index');
            Route::post('/sales/{sale}/returns', [SaleReturnController::class, 'store'])->whereNumber('sale')->name('api.sales.returns.store');
            Route::get('/sales/{sale}/returnable-items', [SaleReturnController::class, 'returnableItems'])->whereNumber('sale')->name('api.sales.returnable-items');
            Route::get('/sale-returns/{saleReturn}', [SaleReturnController::class, 'show'])->name('api.sale-returns.show');
            Route::post('/sale-returns/{saleReturn}/issue-fiscal', [SaleReturnController::class, 'issueFiscal'])->name('api.sale-returns.issue-fiscal');
            Route::get('/operations/{module}/records', [OperationsApiController::class, 'index'])->name('api.operations.index');
            Route::post('/operations/{module}/records', [OperationsApiController::class, 'store'])->name('api.operations.store');
            Route::put('/operations/{module}/records/{record}', [OperationsApiController::class, 'update'])->whereNumber('record')->name('api.operations.update');
            Route::delete('/operations/{module}/records/{record}', [OperationsApiController::class, 'destroy'])->whereNumber('record')->name('api.operations.destroy');
            Route::get('/customers/{customer}/cashback/history', [CustomerCashbackController::class, 'history'])->name('api.customers.cashback.history');
            Route::post('/customers/{customer}/cashback/redeem', [CustomerCashbackController::class, 'redeem'])->name('api.customers.cashback.redeem');
        });
    });
});
