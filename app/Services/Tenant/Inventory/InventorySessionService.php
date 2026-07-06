<?php

namespace App\Services\Tenant\Inventory;

use App\Models\Tenant\InventoryCount;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\InventorySession;
use App\Models\Tenant\InventorySessionItem;
use App\Models\Tenant\Product;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class InventorySessionService
{
    protected const EPSILON = 0.0009;

    public function create(array $data, int $userId): InventorySession
    {
        return InventorySession::query()->create([
            'code' => $this->nextCode(),
            'type' => $data['type'],
            'mode' => $data['mode'],
            'count_resolution' => $data['count_resolution'],
            'status' => 'draft',
            'filters' => $data['filters'] ?? null,
            'created_by' => $userId,
            'notes' => $data['notes'] ?? null,
        ]);
    }

    public function start(InventorySession $session): InventorySession
    {
        if ($session->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Esta sessão já foi iniciada.']);
        }

        $products = $this->resolveProducts($session);

        if ($products->isEmpty()) {
            throw ValidationException::withMessages(['filters' => 'Nenhum produto encontrado para os filtros selecionados.']);
        }

        $now = now();

        $rows = $products->map(fn (Product $product) => [
            'inventory_session_id' => $session->id,
            'product_id' => $product->id,
            'snapshot_quantity' => round((float) $product->stock_quantity, 3),
            'unit_cost' => round((float) $product->cost_price, 2),
            'status' => 'pending',
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        foreach (array_chunk($rows, 500) as $chunk) {
            InventorySessionItem::query()->insert($chunk);
        }

        $session->update(['status' => 'counting', 'started_at' => $now]);

        return $session->fresh();
    }

    public function resolveProducts(InventorySession $session): Collection
    {
        $query = Product::query()->where('active', true);

        if ($session->type === 'partial') {
            $filters = (array) $session->filters;
            $hasFilter = false;

            $query->where(function ($inner) use ($filters, &$hasFilter) {
                if (!empty($filters['category_ids'])) {
                    $inner->orWhereIn('category_id', $filters['category_ids']);
                    $hasFilter = true;
                }

                if (!empty($filters['supplier_ids'])) {
                    $inner->orWhereIn('supplier_id', $filters['supplier_ids']);
                    $hasFilter = true;
                }

                if (!empty($filters['product_ids'])) {
                    $inner->orWhereIn('id', $filters['product_ids']);
                    $hasFilter = true;
                }
            });

            if (!$hasFilter) {
                return collect();
            }
        }

        return $query->get();
    }

    public function recordCount(InventorySessionItem $item, float $quantity, string $source, ?int $userId): InventorySessionItem
    {
        if (in_array($item->status, ['resolved', 'skipped'], true)) {
            throw ValidationException::withMessages(['item' => 'Este item já foi resolvido e não aceita novas contagens.']);
        }

        $round = $item->status === 'recount'
            ? (int) $item->counts()->max('count_round') + 1
            : max(1, (int) $item->counts()->max('count_round'));

        InventoryCount::query()->create([
            'inventory_session_item_id' => $item->id,
            'count_round' => $round,
            'quantity' => round($quantity, 3),
            'source' => $source,
            'counted_by' => $userId,
            'counted_at' => now(),
        ]);

        return $this->resolveItemCounts($item->fresh());
    }

    public function resolveItemCounts(InventorySessionItem $item): InventorySessionItem
    {
        $round1 = $this->roundTotal($item, 1);

        if ($round1 === null) {
            return $item;
        }

        $round2 = $this->roundTotal($item, 2);
        $round3 = $this->roundTotal($item, 3);

        if ($round2 === null && $round3 === null) {
            return $this->settleItem($item, $round1);
        }

        $session = $item->session;

        $resolved = match ($session->count_resolution) {
            'last_count_wins' => $round3 ?? $round2,
            'two_matching_counts' => $this->resolveTwoMatchingCounts($round1, $round2, $round3),
            default => null,
        };

        if ($resolved !== null) {
            return $this->settleItem($item, $resolved);
        }

        $item->counted_quantity = $round3 ?? $round2 ?? $round1;
        $item->status = 'recount';
        $item->save();

        return $item;
    }

    protected function resolveTwoMatchingCounts(float $round1, ?float $round2, ?float $round3): ?float
    {
        if ($round2 !== null && $this->approximatelyEqual($round1, $round2)) {
            return $round1;
        }

        if ($round3 !== null) {
            if ($this->approximatelyEqual($round1, $round3)) {
                return $round1;
            }

            if ($round2 !== null && $this->approximatelyEqual($round2, $round3)) {
                return $round2;
            }
        }

        return null;
    }

    protected function settleItem(InventorySessionItem $item, float $countedQuantity): InventorySessionItem
    {
        $item->counted_quantity = $countedQuantity;
        $item->status = $this->approximatelyEqual($countedQuantity, $this->expectedQuantityForCount($item))
            ? 'counted'
            : 'divergent';
        $item->save();

        return $item;
    }

    protected function expectedQuantityForCount(InventorySessionItem $item): float
    {
        $session = $item->session;

        if ($session?->mode !== 'snapshot' || ! $session->started_at) {
            return (float) $item->snapshot_quantity;
        }

        $interimDelta = InventoryMovement::query()
            ->where('product_id', $item->product_id)
            ->where('occurred_at', '>=', $session->started_at)
            ->sum('quantity_delta');

        return round((float) $item->snapshot_quantity + (float) $interimDelta, 3);
    }

    protected function roundTotal(InventorySessionItem $item, int $round): ?float
    {
        if (!$item->counts()->where('count_round', $round)->exists()) {
            return null;
        }

        return round((float) $item->counts()->where('count_round', $round)->sum('quantity'), 3);
    }

    protected function approximatelyEqual(float $a, float $b): bool
    {
        return abs($a - $b) <= self::EPSILON;
    }

    public function sendToRecount(InventorySession $session, array $itemIds): int
    {
        return $session->items()
            ->whereIn('id', $itemIds)
            ->whereNotIn('status', ['resolved', 'skipped'])
            ->update(['status' => 'recount']);
    }

    public function markUncountedAsZero(InventorySession $session, array $itemIds, ?int $userId): int
    {
        $items = $session->items()->whereIn('id', $itemIds)->whereNull('counted_quantity')->get();

        foreach ($items as $item) {
            $this->recordCount($item, 0.0, 'manual', $userId);
        }

        return $items->count();
    }

    public function markUncountedAsSkipped(InventorySession $session, array $itemIds): int
    {
        return $session->items()
            ->whereIn('id', $itemIds)
            ->whereNull('counted_quantity')
            ->update(['status' => 'skipped']);
    }

    public function resolveItem(InventorySessionItem $item, string $resolution, ?string $reason, int $userId): InventorySessionItem
    {
        if ($item->status === 'divergent' || $item->status === 'recount') {
            if (blank($reason)) {
                throw ValidationException::withMessages(['resolution_reason' => 'Informe o motivo da divergência para resolver este item.']);
            }
        }

        $item->update([
            'resolution' => $resolution,
            'resolution_reason' => $reason,
            'resolved_by' => $userId,
            'status' => 'resolved',
        ]);

        return $item->fresh();
    }

    public function finishCounting(InventorySession $session): InventorySession
    {
        if ($session->status !== 'counting') {
            throw ValidationException::withMessages(['status' => 'A sessão precisa estar em contagem.']);
        }

        $session->update(['status' => 'review', 'counting_finished_at' => now()]);

        return $session->fresh();
    }

    public function cancel(InventorySession $session): InventorySession
    {
        if (!in_array($session->status, ['draft', 'counting', 'review'], true)) {
            throw ValidationException::withMessages(['status' => 'Esta sessão não pode mais ser cancelada.']);
        }

        $session->update(['status' => 'cancelled']);

        return $session->fresh();
    }

    /**
     * IDs de produtos bloqueados para venda por estarem em sessão de inventário
     * no modo "frozen" ainda em andamento.
     *
     * @return array<int>
     */
    public function frozenProductIds(): array
    {
        return InventorySessionItem::query()
            ->whereHas('session', fn ($query) => $query
                ->where('mode', 'frozen')
                ->whereIn('status', ['counting', 'review', 'adjusting']))
            ->pluck('product_id')
            ->unique()
            ->values()
            ->all();
    }

    public function divergenceSummary(InventorySession $session): array
    {
        $items = $session->items()->whereNotNull('counted_quantity')->get();

        $surplusValue = 0.0;
        $shortageValue = 0.0;
        $divergentCount = 0;
        $maxAbsQuantityDelta = 0.0;
        $matchingCount = 0;

        foreach ($items as $item) {
            $delta = $item->delta();
            $value = round($delta * (float) $item->unit_cost, 2);

            if (abs($delta) <= self::EPSILON) {
                $matchingCount++;

                continue;
            }

            $divergentCount++;
            $maxAbsQuantityDelta = max($maxAbsQuantityDelta, abs($delta));

            if ($value > 0) {
                $surplusValue += $value;
            } else {
                $shortageValue += abs($value);
            }
        }

        $countedTotal = $items->count();

        return [
            'counted_items' => $countedTotal,
            'divergent_items' => $divergentCount,
            'surplus_value' => round($surplusValue, 2),
            'shortage_value' => round($shortageValue, 2),
            'net_value' => round($surplusValue - $shortageValue, 2),
            'max_abs_quantity_delta' => round($maxAbsQuantityDelta, 3),
            'accuracy_percent' => $countedTotal > 0 ? round(($matchingCount / $countedTotal) * 100, 2) : 100.0,
        ];
    }

    public function requiresSupervisorApproval(InventorySession $session, array $settings): bool
    {
        $summary = $this->divergenceSummary($session);
        $valueThreshold = (float) data_get($settings, 'inventory.supervisor_threshold_value', 200);
        $quantityThreshold = (float) data_get($settings, 'inventory.supervisor_threshold_quantity', 20);

        return abs($summary['net_value']) > $valueThreshold || $summary['max_abs_quantity_delta'] > $quantityThreshold;
    }

    protected function nextCode(): string
    {
        $year = now()->format('Y');
        $sequence = InventorySession::query()->whereYear('created_at', $year)->count() + 1;

        do {
            $code = sprintf('INV-%s-%04d', $year, $sequence);
            $sequence++;
        } while (InventorySession::query()->where('code', $code)->exists());

        return $code;
    }
}
