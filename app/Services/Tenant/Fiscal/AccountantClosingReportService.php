<?php

namespace App\Services\Tenant\Fiscal;

use App\Support\Tenant\PaymentMethod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use NFePHP\DA\Legacy\FPDF\Fpdf;

class AccountantClosingReportService
{
    /**
     * Matriz dia x forma de pagamento (só vendas finalizadas) pro fechamento mensal do contador.
     */
    public function dailyTotalsByPaymentMethod(int $year, int $month): array
    {
        [$from, $to] = $this->monthRange($year, $month);

        $rows = DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to])
            ->selectRaw('DATE(sales.created_at) as day, sale_payments.payment_method as payment_method, SUM(sale_payments.amount) as total')
            ->groupBy('day', 'sale_payments.payment_method')
            ->orderBy('day')
            ->get();

        $days = [];

        foreach ($rows as $row) {
            $days[$row->day][$row->payment_method] = (float) $row->total;
        }

        ksort($days);

        return $days;
    }

    public function buildPdf(int $year, int $month): string
    {
        $days = $this->dailyTotalsByPaymentMethod($year, $month);
        $methods = collect($days)->flatMap(fn (array $totals) => array_keys($totals))->unique()->values()->all();

        $pdf = new Fpdf('P', 'mm', 'A4');
        $pdf->setAutoPageBreak(true, 12);
        $pdf->setMargins(10, 10, 10);
        $pdf->addPage();

        $pdf->setFont('Arial', 'B', 14);
        $pdf->cell(0, 8, $this->pdfText(sprintf('Fechamento mensal - %02d/%04d', $month, $year)), 0, 1);
        $pdf->setFont('Arial', '', 9);
        $pdf->cell(0, 5, $this->pdfText('Gerado em: '.Carbon::now()->format('d/m/Y H:i')), 0, 1);
        $pdf->ln(3);

        if ($methods === []) {
            $pdf->setFont('Arial', '', 10);
            $pdf->cell(0, 6, 'Nenhuma venda finalizada no período.', 0, 1);

            return $pdf->output('', 'S');
        }

        $dayWidth = 25;
        $columnWidth = min(30, (190 - $dayWidth) / (count($methods) + 1));

        $pdf->setFont('Arial', 'B', 8);
        $pdf->setFillColor(226, 232, 240);
        $pdf->cell($dayWidth, 6, 'Dia', 1, 0, 'C', true);

        foreach ($methods as $method) {
            $pdf->cell($columnWidth, 6, $this->pdfText(PaymentMethod::label($method)), 1, 0, 'C', true);
        }

        $pdf->cell($columnWidth, 6, 'Total do dia', 1, 1, 'C', true);

        $pdf->setFont('Arial', '', 8);
        $grandTotalsByMethod = array_fill_keys($methods, 0.0);
        $grandTotal = 0.0;

        foreach ($days as $day => $totals) {
            $pdf->cell($dayWidth, 6, Carbon::parse($day)->format('d/m/Y'), 1, 0, 'C');
            $dayTotal = 0.0;

            foreach ($methods as $method) {
                $amount = (float) ($totals[$method] ?? 0);
                $dayTotal += $amount;
                $grandTotalsByMethod[$method] += $amount;
                $pdf->cell($columnWidth, 6, number_format($amount, 2, ',', '.'), 1, 0, 'R');
            }

            $grandTotal += $dayTotal;
            $pdf->setFont('Arial', 'B', 8);
            $pdf->cell($columnWidth, 6, number_format($dayTotal, 2, ',', '.'), 1, 1, 'R');
            $pdf->setFont('Arial', '', 8);
        }

        $pdf->setFont('Arial', 'B', 8);
        $pdf->setFillColor(248, 250, 252);
        $pdf->cell($dayWidth, 6, 'Total', 1, 0, 'C', true);

        foreach ($methods as $method) {
            $pdf->cell($columnWidth, 6, number_format($grandTotalsByMethod[$method], 2, ',', '.'), 1, 0, 'R', true);
        }

        $pdf->cell($columnWidth, 6, number_format($grandTotal, 2, ',', '.'), 1, 1, 'R', true);

        return $pdf->output('', 'S');
    }

    protected function pdfText(string $value): string
    {
        return iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $value) ?: $value;
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function monthRange(int $year, int $month): array
    {
        $from = Carbon::create($year, $month, 1)->startOfDay();
        $to = $from->copy()->endOfMonth()->endOfDay();

        return [$from, $to];
    }
}
