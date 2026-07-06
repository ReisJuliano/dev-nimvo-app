<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use App\Models\Tenant\ProductExpiry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExpiryService
{
    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
        protected AuditLogService $auditLogService,
    ) {
    }

    public function recordEntry(Product $product, float $quantity, string $expiresAt, ?Model $source = null, ?int $userId = null): ?ProductExpiry
    {
        if (!$product->track_expiry || $quantity <= 0) {
            return null;
        }

        return ProductExpiry::query()->create([
            'product_id' => $product->id,
            'expires_at' => $expiresAt,
            'quantity' => round($quantity, 3),
            'source_type' => $source?->getMorphClass(),
            'source_id' => $source?->getKey(),
            'created_by' => $userId,
        ]);
    }

    /**
     * Aproximação FEFO: consome as validades mais antigas primeiro após uma
     * venda. É estimativa gerencial — nunca deve travar a venda.
     */
    public function consumeFefo(Product $product, float $quantity): void
    {
        if ($quantity <= 0) {
            return;
        }

        $remaining = $quantity;

        $lots = ProductExpiry::query()
            ->where('product_id', $product->id)
            ->where('quantity', '>', 0)
            ->orderBy('expires_at')
            ->get();

        foreach ($lots as $lot) {
            if ($remaining <= 0) {
                break;
            }

            $consumed = min($remaining, (float) $lot->quantity);
            $lot->update(['quantity' => round((float) $lot->quantity - $consumed, 3)]);
            $remaining = round($remaining - $consumed, 3);
        }
    }

    public function registerLoss(Product $product, float $quantity, string $reason, ?int $userId, ?ProductExpiry $lot = null): void
    {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Informe uma quantidade de perda maior que zero.']);
        }

        $this->inventoryMovementService->apply($product, -$quantity, 'loss', [
            'user_id' => $userId,
            'notes' => $reason,
            'reference' => $lot,
            'allow_negative' => true,
        ]);

        if ($lot) {
            $lot->update(['quantity' => max(0.0, round((float) $lot->quantity - $quantity, 3))]);
        } else {
            $this->consumeFefo($product, $quantity);
        }

        $this->auditLogService->record(AuditActions::STOCK_LOSS_REGISTERED, $product, after: [
            'quantity' => $quantity,
            'reason' => $reason,
        ], userId: $userId);
    }

    public function expiringSoon(int $days, ?int $categoryId = null): Collection
    {
        $today = Carbon::today();
        $limit = $today->copy()->addDays($days);

        return ProductExpiry::query()
            ->with('product:id,name,code,category_id,cost_price')
            ->with('product.category:id,name')
            ->where('quantity', '>', 0)
            ->whereBetween('expires_at', [$today, $limit])
            ->when($categoryId, fn ($query) => $query->whereHas('product', fn ($inner) => $inner->where('category_id', $categoryId)))
            ->orderBy('expires_at')
            ->get();
    }

    public function expiringSoonCount(int $days): int
    {
        return ProductExpiry::query()
            ->where('quantity', '>', 0)
            ->whereBetween('expires_at', [Carbon::today(), Carbon::today()->addDays($days)])
            ->count();
    }

    public function expiringSoonCostAtRisk(int $days): float
    {
        return round((float) ProductExpiry::query()
            ->join('products', 'products.id', '=', 'product_expiries.product_id')
            ->where('product_expiries.quantity', '>', 0)
            ->whereBetween('product_expiries.expires_at', [Carbon::today(), Carbon::today()->addDays($days)])
            ->sum(DB::raw('product_expiries.quantity * products.cost_price')), 2);
    }
}
