<?php

namespace App\Services\Tenant\Inventory;

use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\InventorySession;
use App\Models\Tenant\InventorySessionItem;
use App\Models\Tenant\Product;
use App\Services\Tenant\AuditLogService;
use App\Services\Tenant\InventoryMovementService;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryAdjustmentService
{
    protected const CHUNK_SIZE = 200;

    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
        protected AuditLogService $auditLogService,
    ) {
    }

    public function approve(InventorySession $session, int $approverId): InventorySession
    {
        if ($session->status !== 'review') {
            throw ValidationException::withMessages(['status' => 'A sessão precisa estar em conferência para ser aprovada.']);
        }

        $pending = $session->items()
            ->whereNull('counted_quantity')
            ->where('status', '!=', 'skipped')
            ->exists();

        if ($pending) {
            throw ValidationException::withMessages(['items' => 'Existem itens sem contagem ou decisão pendente antes de aprovar.']);
        }

        $session->update(['status' => 'adjusting']);

        $session->items()
            ->where('status', '!=', 'skipped')
            ->where(function ($query) {
                $query->whereNull('resolution')->orWhere('resolution', '!=', 'keep_system');
            })
            ->whereNotNull('counted_quantity')
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($chunk) use ($session, $approverId) {
                DB::transaction(function () use ($chunk, $session, $approverId) {
                    foreach ($chunk as $item) {
                        $this->applyItem($session, $item, $approverId);
                    }
                });
            });

        $countedProductIds = $session->items()->whereNotNull('counted_quantity')->pluck('product_id');

        if ($countedProductIds->isNotEmpty()) {
            Product::query()->whereIn('id', $countedProductIds)->update(['last_counted_at' => now()]);
        }

        $session->update([
            'status' => 'completed',
            'approved_by' => $approverId,
            'approved_at' => now(),
            'completed_at' => now(),
        ]);

        $this->auditLogService->record(AuditActions::INVENTORY_APPROVED, $session, after: [
            'items_count' => $session->items()->count(),
        ], userId: $approverId);

        return $session->fresh();
    }

    protected function applyItem(InventorySession $session, InventorySessionItem $item, int $approverId): void
    {
        $interimDelta = $session->mode === 'snapshot'
            ? $this->calculateInterimDelta($item, $session)
            : 0.0;

        $finalDelta = $this->computeFinalDelta((float) $item->counted_quantity, (float) $item->snapshot_quantity, $interimDelta);

        $item->update([
            'interim_delta' => $interimDelta,
            'final_delta' => $finalDelta,
        ]);

        if (abs($finalDelta) > 0.0009) {
            $this->inventoryMovementService->apply(
                $item->product,
                $finalDelta,
                'inventory_count_adjustment',
                [
                    'reference' => $session,
                    'notes' => $item->resolution_reason,
                    'allow_negative' => true,
                    'unit_cost' => (float) $item->unit_cost,
                    'user_id' => $approverId,
                ],
            );
        }
    }

    /**
     * Soma dos movimentos de estoque do produto ocorridos entre o início da
     * sessão (snapshot) e agora — vendas/entradas durante a contagem não
     * viram divergência falsa em sessões no modo snapshot.
     */
    public function calculateInterimDelta(InventorySessionItem $item, InventorySession $session): float
    {
        $sum = InventoryMovement::query()
            ->where('product_id', $item->product_id)
            ->where('occurred_at', '>=', $session->started_at)
            ->sum('quantity_delta');

        return round((float) $sum, 3);
    }

    public function computeFinalDelta(float $countedQuantity, float $snapshotQuantity, float $interimDelta): float
    {
        return round($countedQuantity - ($snapshotQuantity + $interimDelta), 3);
    }

    /**
     * Abertura do interim_delta de um item por tipo de movimento (venda,
     * entrada, perda...) — alimenta o drawer de reconciliação da revisão.
     */
    public function itemReconciliation(InventorySessionItem $item): array
    {
        $session = $item->session;

        $breakdown = $session->started_at
            ? InventoryMovement::query()
                ->where('product_id', $item->product_id)
                ->where('occurred_at', '>=', $session->started_at)
                ->selectRaw('type, SUM(quantity_delta) as total')
                ->groupBy('type')
                ->pluck('total', 'type')
                ->map(fn ($value) => round((float) $value, 3))
                ->all()
            : [];

        $expected = round((float) $item->snapshot_quantity + array_sum($breakdown), 3);

        return [
            'snapshot_quantity' => (float) $item->snapshot_quantity,
            'movement_breakdown' => $breakdown,
            'expected_quantity' => $expected,
            'counted_quantity' => $item->counted_quantity !== null ? (float) $item->counted_quantity : null,
            'delta' => $item->counted_quantity !== null ? round((float) $item->counted_quantity - $expected, 3) : null,
        ];
    }
}
