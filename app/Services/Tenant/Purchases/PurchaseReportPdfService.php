<?php

declare(strict_types=1);

namespace App\Services\Tenant\Purchases;

use App\Models\Tenant\Purchase;
use Illuminate\Support\Str;
use NFePHP\DA\Legacy\FPDF\Fpdf;
use Symfony\Component\HttpFoundation\Response;

class PurchaseReportPdfService
{
    public function download(int $purchaseId): Response
    {
        $purchase = Purchase::query()
            ->with(['items.product:id,name,code,barcode,unit', 'user:id,name'])
            ->findOrFail($purchaseId);

        $metadata = $this->decodePurchaseNotes($purchase->notes);
        $displayName = (string) ($metadata['custom_name'] ?? $purchase->code ?? sprintf('Pedido #%d', $purchase->id));
        $notes = $metadata['notes'] ?? null;
        $items = $purchase->items->values();
        $itemsCount = $items->count();
        $quantityTotal = (float) $items->sum(fn ($item) => (float) $item->quantity);

        $pdf = new Fpdf('P', 'mm', 'A4');
        $pdf->SetAutoPageBreak(true, 14);
        $pdf->SetMargins(10, 10, 10);
        $pdf->AddPage();

        $this->renderHeader($pdf, $purchase, $displayName);
        $this->renderSummary($pdf, [
            ['label' => 'Pedido', 'value' => $displayName],
            ['label' => 'Codigo', 'value' => $purchase->code ?: sprintf('#%d', $purchase->id)],
            ['label' => 'Status', 'value' => $this->statusLabel((string) $purchase->status)],
            ['label' => 'Criado em', 'value' => $purchase->created_at?->format('d/m/Y H:i') ?: '-'],
            ['label' => 'Itens', 'value' => (string) $itemsCount],
            ['label' => 'Unidades', 'value' => $this->formatQuantity($quantityTotal)],
        ]);
        $this->renderItemsTable($pdf, $purchase);

        if (filled($notes)) {
            $pdf->Ln(2);
            $pdf->SetFont('Arial', 'B', 9);
            $pdf->Cell(0, 6, $this->pdfText('Observacoes'), 0, 1);
            $pdf->SetFont('Arial', '', 8.5);
            $pdf->MultiCell(0, 5, $this->pdfText((string) $notes), 1);
        }

        return response($pdf->Output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('inline; filename="%s"', $this->filename($purchase, $displayName)),
            'Cache-Control' => 'max-age=0, must-revalidate',
            'Pragma' => 'public',
        ]);
    }

    protected function renderHeader(Fpdf $pdf, Purchase $purchase, string $displayName): void
    {
        $pdf->SetFont('Arial', 'B', 15);
        $pdf->Cell(0, 8, $this->pdfText('Relatorio do pedido'), 0, 1);

        $pdf->SetFont('Arial', '', 9);
        $pdf->Cell(0, 5, $this->pdfText('Pedido: '.$displayName), 0, 1);
        $pdf->Cell(0, 5, $this->pdfText('Gerado em: '.now()->format('d/m/Y H:i')), 0, 1);

        if ($purchase->user?->name) {
            $pdf->Cell(0, 5, $this->pdfText('Responsavel: '.$purchase->user->name), 0, 1);
        }

        $pdf->Ln(3);
    }

    protected function renderSummary(Fpdf $pdf, array $cards): void
    {
        $startX = $pdf->GetX();
        $startY = $pdf->GetY();
        $cardWidth = 60.0;
        $cardHeight = 15.0;
        $gap = 5.0;

        foreach (array_values($cards) as $index => $card) {
            $column = $index % 3;
            $row = intdiv($index, 3);
            $x = $startX + ($column * ($cardWidth + $gap));
            $y = $startY + ($row * ($cardHeight + $gap));

            $pdf->SetFillColor(248, 250, 252);
            $pdf->Rect($x, $y, $cardWidth, $cardHeight, 'DF');
            $pdf->SetXY($x + 2, $y + 2);
            $pdf->SetFont('Arial', 'B', 7.5);
            $pdf->Cell($cardWidth - 4, 4, $this->pdfText((string) ($card['label'] ?? '-')), 0, 2);
            $pdf->SetFont('Arial', '', 9);
            $pdf->MultiCell($cardWidth - 4, 4.2, $this->pdfText((string) ($card['value'] ?? '-')), 0);
        }

        $rows = (int) ceil(count($cards) / 3);
        $pdf->SetY($startY + ($rows * ($cardHeight + $gap)));
    }

    protected function renderItemsTable(Fpdf $pdf, Purchase $purchase): void
    {
        $pdf->SetFont('Arial', 'B', 9);
        $pdf->Cell(0, 7, $this->pdfText('Produtos e quantidades'), 0, 1);

        $this->renderTableHeader($pdf);
        $pdf->SetFont('Arial', '', 8);

        $widths = [84, 38, 20, 22, 26];

        if ($purchase->items->isEmpty()) {
            $pdf->Cell(array_sum($widths), 7, $this->pdfText('Nenhum item registrado.'), 1, 1);
        } else {
            foreach ($purchase->items as $item) {
                if ($pdf->GetY() > 262) {
                    $pdf->AddPage();
                    $this->renderTableHeader($pdf);
                    $pdf->SetFont('Arial', '', 8);
                }

                $productCode = $item->product?->barcode ?: $item->product?->code ?: '-';
                $pdf->Cell($widths[0], 7, $this->pdfText(Str::limit((string) $item->product_name, 44)), 1);
                $pdf->Cell($widths[1], 7, $this->pdfText(Str::limit((string) $productCode, 22)), 1);
                $pdf->Cell($widths[2], 7, $this->pdfText($this->formatQuantity((float) $item->quantity)), 1, 0, 'C');
                $pdf->Cell($widths[3], 7, $this->pdfText($this->formatMoney((float) $item->unit_cost)), 1, 0, 'R');
                $pdf->Cell($widths[4], 7, $this->pdfText($this->formatMoney((float) $item->total)), 1, 1, 'R');
            }
        }

        $pdf->SetFont('Arial', 'B', 9);
        $pdf->Cell(0, 8, $this->pdfText(sprintf(
            'Itens: %d   |   Unidades: %s   |   Total: %s',
            $purchase->items->count(),
            $this->formatQuantity((float) $purchase->items->sum(fn ($item) => (float) $item->quantity)),
            $this->formatMoney((float) $purchase->total),
        )), 0, 1);
    }

    protected function renderTableHeader(Fpdf $pdf): void
    {
        $pdf->SetFont('Arial', 'B', 8);
        $pdf->SetFillColor(226, 232, 240);
        $pdf->Cell(84, 7, $this->pdfText('Produto'), 1, 0, 'L', true);
        $pdf->Cell(38, 7, $this->pdfText('Codigo / EAN'), 1, 0, 'L', true);
        $pdf->Cell(20, 7, $this->pdfText('Qtd'), 1, 0, 'C', true);
        $pdf->Cell(22, 7, $this->pdfText('Custo'), 1, 0, 'R', true);
        $pdf->Cell(26, 7, $this->pdfText('Total'), 1, 1, 'R', true);
    }

    protected function decodePurchaseNotes(?string $notes): array
    {
        if (blank($notes)) {
            return [];
        }

        $decoded = json_decode((string) $notes, true);

        if (! is_array($decoded)) {
            return ['notes' => $notes];
        }

        if (($decoded['schema'] ?? null) === 'ops_purchase_v1') {
            return is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [];
        }

        return ['notes' => $notes];
    }

    protected function statusLabel(string $status): string
    {
        return match ($status) {
            'received' => 'Recebida',
            'ordered' => 'Solicitada',
            default => 'Rascunho',
        };
    }

    protected function formatQuantity(float $value): string
    {
        $formatted = number_format($value, 3, ',', '.');

        return rtrim(rtrim($formatted, '0'), ',');
    }

    protected function formatMoney(float $value): string
    {
        return 'R$ '.number_format($value, 2, ',', '.');
    }

    protected function filename(Purchase $purchase, string $displayName): string
    {
        $baseName = Str::slug($displayName) ?: ($purchase->code ?: sprintf('pedido-%d', $purchase->id));

        return sprintf('%s.pdf', $baseName);
    }

    protected function pdfText(string $value): string
    {
        return iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $value) ?: $value;
    }
}
