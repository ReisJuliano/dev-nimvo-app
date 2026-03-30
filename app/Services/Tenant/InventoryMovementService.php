<?php

namespace App\Services\Tenant;

use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class InventoryMovementService
{
    public function apply(
        Product $product,
        float $quantityDelta,
        string $type,
        array $context = [],
    ): Product {
        $before = round((float) $product->stock_quantity, 3);
        $after = round($before + $quantityDelta, 3);

        if (($context['allow_negative'] ?? false) !== true && $after < 0) {
            throw ValidationException::withMessages([
                'stock' => "Estoque insuficiente para {$product->name}.",
            ]);
        }

        $product->forceFill([
            'stock_quantity' => $after,
        ])->save();

        $reference = $context['reference'] ?? null;

        InventoryMovement::query()->create([
            'product_id' => $product->id,
            'user_id' => $context['user_id'] ?? null,
            'type' => $type,
            'reference_type' => $reference instanceof Model ? $reference->getMorphClass() : null,
            'reference_id' => $reference instanceof Model ? $reference->getKey() : null,
            'quantity_delta' => round($quantityDelta, 3),
            'stock_before' => $before,
            'stock_after' => $after,
            'unit_cost' => round((float) ($context['unit_cost'] ?? $product->cost_price ?? 0), 2),
            'notes' => $context['notes'] ?? null,
            'occurred_at' => $this->resolveOccurredAt($context['occurred_at'] ?? null),
        ]);

        return $product->fresh();
    }

    protected function resolveOccurredAt(mixed $occurredAt): ?Carbon
    {
        if ($occurredAt instanceof Carbon) {
            return $occurredAt;
        }

        if (filled($occurredAt)) {
            return Carbon::parse((string) $occurredAt);
        }

        return now();
    }
}
