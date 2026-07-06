<?php

namespace App\Services\Tenant;

use NFePHP\DA\Legacy\FPDF\Fpdf;
use Symfony\Component\HttpFoundation\Response;

class LabelSheetPdfService
{
    /**
     * Presets de folha de etiqueta adesiva A4 (medidas em mm, aproximadas —
     * ajustar conforme a folha real do lojista).
     */
    public const PRESETS = [
        'pimaco_6180' => ['columns' => 3, 'rows' => 9, 'label_width' => 66.7, 'label_height' => 25.4, 'margin_left' => 4.5, 'margin_top' => 13.5, 'gap_x' => 3, 'gap_y' => 0],
        'pimaco_6081' => ['columns' => 2, 'rows' => 5, 'label_width' => 99.6, 'label_height' => 57.0, 'margin_left' => 5, 'margin_top' => 13, 'gap_x' => 5, 'gap_y' => 0],
    ];

    public function __construct(
        protected LabelPayloadService $labelPayloadService,
    ) {
    }

    public function build(array $products, string $template, string $preset = 'pimaco_6180', int $copiesPerProduct = 1): Response
    {
        $grid = self::PRESETS[$preset] ?? self::PRESETS['pimaco_6180'];

        $labels = collect($products)
            ->flatMap(fn ($product) => array_fill(0, max(1, $copiesPerProduct), $this->labelPayloadService->build($product, $template)))
            ->values();

        $pdf = new Fpdf('P', 'mm', 'A4');
        $pdf->setAutoPageBreak(false);
        $pdf->setMargins(0, 0, 0);
        $pdf->addPage();

        $perPage = $grid['columns'] * $grid['rows'];
        $labels->chunk($perPage)->each(function ($pageLabels, int $pageIndex) use ($pdf, $grid) {
            if ($pageIndex > 0) {
                $pdf->addPage();
            }

            foreach ($pageLabels->values() as $index => $label) {
                $column = $index % $grid['columns'];
                $row = intdiv($index, $grid['columns']);

                $x = $grid['margin_left'] + ($column * ($grid['label_width'] + $grid['gap_x']));
                $y = $grid['margin_top'] + ($row * ($grid['label_height'] + $grid['gap_y']));

                $this->drawLabel($pdf, $label, $x, $y, $grid['label_width'], $grid['label_height']);
            }
        });

        return response($pdf->output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="etiquetas.pdf"',
        ]);
    }

    protected function drawLabel(Fpdf $pdf, array $label, float $x, float $y, float $width, float $height): void
    {
        $pdf->rect($x, $y, $width, $height);

        $pdf->setXY($x + 2, $y + 1.5);
        $pdf->setFont('Arial', 'B', 8);
        $pdf->multiCell($width - 4, 3.2, $this->pdfText($label['name']), 0, 'L');

        if ($label['promo_new_price'] !== null) {
            $pdf->setXY($x + 2, $y + $height - 12);
            $pdf->setFont('Arial', '', 7);
            $pdf->cell($width - 4, 3, 'De: '.$this->pdfText($this->formatMoney($label['promo_old_price'])), 0, 2);
            $pdf->setFont('Arial', 'B', 14);
            $pdf->cell($width - 4, 6, 'Por: '.$this->pdfText($this->formatMoney($label['promo_new_price'])), 0, 2);
        } else {
            $pdf->setXY($x + 2, $y + $height - 10);
            $pdf->setFont('Arial', 'B', 14);
            $unitSuffix = $label['unit_label'] ? '/'.$label['unit_label'] : '';
            $pdf->cell($width - 4, 6, $this->pdfText($this->formatMoney($label['price']).$unitSuffix), 0, 2);
        }

        $pdf->setXY($x + 2, $y + $height - 4);
        $pdf->setFont('Arial', '', 7);
        $pdf->cell($width - 4, 3, $this->pdfText($label['barcode']), 0, 0, 'C');
    }

    protected function formatMoney(float $value): string
    {
        return 'R$ '.number_format($value, 2, ',', '.');
    }

    protected function pdfText(string $value): string
    {
        return iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $value) ?: $value;
    }
}
