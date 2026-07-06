<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Models\Tenant\Product;
use App\Models\Tenant\ProductExpiry;
use App\Services\Tenant\ExpiryService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;

class MobileStockController extends Controller
{
    use FormatsMobileResponses;

    public function alerts(ExpiryService $expiryService, TenantSettingsService $settingsService): JsonResponse
    {
        $stockItems = Product::query()
            ->where('active', true)
            ->whereColumn('stock_quantity', '<=', 'min_stock')
            ->orderBy('stock_quantity')
            ->orderBy('name')
            ->get(['id', 'name', 'stock_quantity', 'min_stock', 'unit'])
            ->map(fn (Product $product) => [
                'type' => 'stock',
                'id' => $product->id,
                'name' => $product->name,
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'unit' => $product->unit,
                'alert_level' => (float) $product->stock_quantity <= 0 ? 'critical' : 'warning',
            ]);

        $alertDays = (int) data_get($settingsService->get(), 'expiry.default_alert_days', 30);

        $expiryItems = $expiryService->expiringSoon($alertDays)
            ->map(fn (ProductExpiry $lot) => [
                'type' => 'expiry',
                'id' => $lot->id,
                'product_id' => $lot->product_id,
                'name' => $lot->product?->name,
                'quantity' => (float) $lot->quantity,
                'expires_at' => $lot->expires_at?->toDateString(),
                'alert_level' => $lot->expires_at?->isPast() ? 'critical' : 'warning',
            ]);

        $items = $stockItems->concat($expiryItems)->values();

        return response()->json($this->success($items));
    }
}
