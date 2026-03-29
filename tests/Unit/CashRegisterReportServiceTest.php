<?php

namespace Tests\Unit;

use App\Models\Tenant\CashRegister;
use App\Services\Tenant\CashRegisterReportService;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class CashRegisterReportServiceTest extends TestCase
{
    public function test_it_builds_a_closing_snapshot_with_breakdown_per_payment_method(): void
    {
        $service = new CashRegisterReportService();
        $cashRegister = new CashRegister([
            'id' => 12,
            'status' => 'open',
            'opening_amount' => 100,
        ]);

        $closedAt = Carbon::parse('2026-03-28 22:00:00');
        $report = [
            'cashRegister' => [
                'id' => 12,
                'status' => 'open',
                'opening_amount' => 100,
                'opened_at' => '2026-03-28T12:00:00-03:00',
                'closed_at' => null,
            ],
            'payments' => [
                ['payment_method' => 'cash', 'label' => 'Dinheiro', 'qtd' => 2, 'total' => 80],
                ['payment_method' => 'pix', 'label' => 'Pix', 'qtd' => 1, 'total' => 50],
            ],
            'payment_totals' => [
                'cash' => 80,
                'pix' => 50,
            ],
            'movements' => [],
            'total_sales' => 130,
            'sales_count' => 3,
            'total_withdrawals' => 20,
            'total_supplies' => 10,
            'cash_sales' => 80,
            'expected_cash' => 170,
            'difference' => 0,
            'closing_breakdown' => [],
        ];

        $snapshot = $service->buildClosingSnapshot(
            $cashRegister,
            $report,
            [
                'cash' => 168,
                'pix' => 50,
                'debit_card' => 0,
                'credit_card' => 0,
                'credit' => 0,
            ],
            'Conferencia final sem observacoes.',
            $closedAt,
        );

        $this->assertSame('closed', $snapshot['cashRegister']['status']);
        $this->assertSame(168.0, $snapshot['cashRegister']['closing_amount']);
        $this->assertSame(-2.0, $snapshot['difference']);
        $this->assertCount(5, $snapshot['closing_breakdown']);
        $this->assertSame(170.0, $snapshot['closing_breakdown'][0]['expected']);
        $this->assertSame(168.0, $snapshot['closing_breakdown'][0]['informed']);
        $this->assertSame(-2.0, $snapshot['closing_breakdown'][0]['difference']);
        $this->assertSame(50.0, $snapshot['closing_breakdown'][1]['expected']);
        $this->assertSame(0.0, $snapshot['closing_breakdown'][1]['difference']);
        $this->assertSame($closedAt->toIso8601String(), $snapshot['closing_breakdown'][0]['recorded_at']);
    }

    public function test_it_returns_the_stored_snapshot_for_closed_registers(): void
    {
        $service = new CashRegisterReportService();
        $snapshot = [
            'cashRegister' => [
                'id' => 9,
                'status' => 'closed',
                'opening_amount' => 50,
                'closing_amount' => 45,
                'closing_notes' => 'Fechamento auditado.',
                'opened_at' => '2026-03-28T09:00:00-03:00',
                'closed_at' => '2026-03-28T18:00:00-03:00',
            ],
            'payments' => [
                ['payment_method' => 'cash', 'label' => 'Dinheiro', 'qtd' => 1, 'total' => 20],
            ],
            'movements' => [],
            'total_sales' => 20,
            'sales_count' => 1,
            'total_withdrawals' => 5,
            'total_supplies' => 0,
            'cash_sales' => 20,
            'expected_cash' => 65,
            'difference' => -20,
            'closing_breakdown' => [
                [
                    'payment_method' => 'cash',
                    'label' => 'Dinheiro',
                    'expected' => 65,
                    'informed' => 45,
                    'difference' => -20,
                    'recorded_at' => '2026-03-28T18:00:00-03:00',
                ],
            ],
        ];

        $cashRegister = new CashRegister([
            'id' => 9,
            'status' => 'closed',
            'closing_snapshot' => $snapshot,
            'closing_breakdown' => $snapshot['closing_breakdown'],
        ]);

        $report = $service->build($cashRegister);

        $this->assertSame('Fechamento auditado.', $report['cashRegister']['closing_notes']);
        $this->assertSame(-20, $report['difference']);
        $this->assertSame(20.0, $report['payment_totals']['cash']);
        $this->assertSame(45, $report['cashRegister']['closing_amount']);
    }
}
