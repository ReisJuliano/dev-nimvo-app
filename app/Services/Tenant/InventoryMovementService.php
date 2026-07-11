<?php

namespace App\Services\Tenant;

use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\Product;
use App\Support\Tenant\AuditActions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class InventoryMovementService
{
    public function __construct(
        protected AuditLogService $auditLogService,
    ) {
    }

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
                'stock' => "Não tem quantidade suficiente em estoque para {$product->name}.",
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

        if ($type === 'manual_adjustment') {
            $this->auditLogService->record(
                AuditActions::STOCK_MANUAL_ADJUSTMENT,
                $product,
                before: ['stock_quantity' => $before],
                after: ['stock_quantity' => $after],
                metadata: [
                    'reason' => $context['reason'] ?? null,
                    'notes' => $context['notes'] ?? null,
                ],
                userId: $context['user_id'] ?? null,
            );
        }

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
