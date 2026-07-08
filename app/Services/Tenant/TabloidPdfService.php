<?php

namespace App\Services\Tenant;

use App\Models\Tenant\PromotionCampaign;
use NFePHP\DA\Legacy\FPDF\Fpdf;
use Symfony\Component\HttpFoundation\Response;

class TabloidPdfService
{
    public function build(PromotionCampaign $campaign): Response
    {
        $promotions = $campaign->promotions()
            ->where('active', true)
            ->with(['product:id,name', 'category:id,name'])
            ->orderBy('name')
            ->get();

        $pdf = new Fpdf('P', 'mm', 'A4');
        $pdf->setAutoPageBreak(true, 14);
        $pdf->setMargins(14, 14, 14);
        $pdf->addPage();

        $this->drawHeader($pdf, $campaign);

        foreach ($promotions as $promotion) {
            $this->drawRow($pdf, $promotion);
        }

        if ($promotions->isEmpty()) {
            $pdf->setFont('Arial', 'I', 10);
            $pdf->cell(0, 8, $this->pdfText('Nenhuma oferta ativa neste tabloide.'), 0, 1);
        }

        return response($pdf->output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$campaign->code.'.pdf"',
        ]);
    }

    protected function drawHeader(Fpdf $pdf, PromotionCampaign $campaign): void
    {
        $pdf->setFont('Arial', 'B', 18);
        $pdf->multiCell(0, 9, $this->pdfText($campaign->name), 0, 'L');

        $vigencia = $this->formatRange($campaign->starts_at, $campaign->ends_at);

        if ($vigencia) {
            $pdf->setFont('Arial', '', 10);
            $pdf->cell(0, 6, $this->pdfText($vigencia), 0, 1);
        }

        if ($campaign->cover_note) {
            $pdf->setFont('Arial', 'I', 10);
            $pdf->multiCell(0, 5, $this->pdfText($campaign->cover_note), 0, 'L');
        }

        $pdf->ln(2);
        $pdf->setDrawColor(79, 70, 229);
        $pdf->setLineWidth(0.6);
        $pdf->line($pdf->getX(), $pdf->getY(), 196, $pdf->getY());
        $pdf->ln(6);
    }

    protected function drawRow(Fpdf $pdf, \App\Models\Tenant\Promotion $promotion): void
    {
        $target = $promotion->scope === 'product'
            ? ($promotion->product?->name ?? $promotion->name)
            : 'Categoria: '.($promotion->category?->name ?? '-');

        $pdf->setFont('Arial', 'B', 11);
        $pdf->cell(0, 6, $this->pdfText($target), 0, 1);

        $pdf->setFont('Arial', '', 10);
        $pdf->setTextColor(79, 70, 229);
        $pdf->cell(0, 6, $this->pdfText($promotion->offerSummary()), 0, 1);
        $pdf->setTextColor(0, 0, 0);

        if ($promotion->highlight_text) {
            $pdf->setFont('Arial', 'I', 9);
            $pdf->cell(0, 5, $this->pdfText($promotion->highlight_text), 0, 1);
        }

        $pdf->ln(3);
    }

    protected function formatRange($startsAt, $endsAt): ?string
    {
        if (!$startsAt && !$endsAt) {
            return null;
        }

        $start = $startsAt ? $startsAt->format('d/m/Y') : null;
        $end = $endsAt ? $endsAt->format('d/m/Y') : null;

        return match (true) {
            $start && $end => "Válido de {$start} até {$end}",
            (bool) $start => "Válido a partir de {$start}",
            default => "Válido até {$end}",
        };
    }

    protected function pdfText(string $value): string
    {
        return iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $value) ?: $value;
    }
}
