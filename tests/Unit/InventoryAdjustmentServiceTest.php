<?php

namespace Tests\Unit;

use App\Services\Tenant\AuditLogService;
use App\Services\Tenant\Inventory\InventoryAdjustmentService;
use App\Services\Tenant\InventoryMovementService;
use PHPUnit\Framework\TestCase;

class InventoryAdjustmentServiceTest extends TestCase
{
    protected function service(): InventoryAdjustmentService
    {
        return new InventoryAdjustmentService(new InventoryMovementService(new AuditLogService()), new AuditLogService());
    }

    public function test_final_delta_is_zero_when_counted_matches_snapshot_plus_interim_movements(): void
    {
        // Snapshot de 100, vendeu 10 durante a contagem (interim -10), contou 90 -> sem divergencia real.
        $finalDelta = $this->service()->computeFinalDelta(countedQuantity: 90, snapshotQuantity: 100, interimDelta: -10);

        $this->assertSame(0.0, $finalDelta);
    }

    public function test_final_delta_reflects_a_real_shortage_even_with_sales_in_between(): void
    {
        // Snapshot 100, vendeu 10 (interim -10), mas contou 85 -> falta real de 5 unidades.
        $finalDelta = $this->service()->computeFinalDelta(countedQuantity: 85, snapshotQuantity: 100, interimDelta: -10);

        $this->assertSame(-5.0, $finalDelta);
    }

    public function test_final_delta_reflects_a_real_surplus(): void
    {
        $finalDelta = $this->service()->computeFinalDelta(countedQuantity: 55, snapshotQuantity: 50, interimDelta: 0);

        $this->assertSame(5.0, $finalDelta);
    }

    public function test_final_delta_accounts_for_inbound_movements_during_counting(): void
    {
        // Snapshot 20, entrou uma compra de +30 durante a contagem (interim +30), contou 50 -> sem divergencia.
        $finalDelta = $this->service()->computeFinalDelta(countedQuantity: 50, snapshotQuantity: 20, interimDelta: 30);

        $this->assertSame(0.0, $finalDelta);
    }
}
