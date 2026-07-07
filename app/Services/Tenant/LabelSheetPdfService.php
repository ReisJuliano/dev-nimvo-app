<?php

namespace App\Services\Tenant;

use App\Models\Tenant\LabelTemplate;
use NFePHP\DA\Legacy\FPDF\Fpdf;
use Symfony\Component\HttpFoundation\Response;

class LabelSheetPdfService
{
    public function __construct(
        protected LabelPayloadService $labelPayloadService,
    ) {
    }

    public function build(iterable $products, LabelTemplate $template, int $copiesPerProduct = 1): Response
    {
        $grid = [
            'columns' => $template->columns,
            'rows' => $template->rows,
            'label_width' => (float) $template->label_width_mm,
            'label_height' => (float) $template->label_height_mm,
            'margin_left' => (float) $template->margin_left_mm,
            'margin_top' => (float) $template->margin_top_mm,
            'gap_x' => (float) $template->gap_x_mm,
            'gap_y' => (float) $template->gap_y_mm,
        ];

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

                $this->drawLabel($pdf, $label, $template, $x, $y, $grid['label_width'], $grid['label_height']);
            }
        });

        return response($pdf->output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="etiquetas.pdf"',
        ]);
    }

    protected function drawLabel(Fpdf $pdf, array $label, LabelTemplate $template, float $x, float $y, float $width, float $height): void
    {
        if ($template->hasLayout()) {
            $this->drawLayoutLabel($pdf, $label, $template->layout, $x, $y);

            return;
        }

        $this->drawLegacyLabel($pdf, $label, $x, $y, $width, $height);
    }

    protected function drawLayoutLabel(Fpdf $pdf, array $label, array $layout, float $x, float $y): void
    {
        foreach ($layout['elements'] as $element) {
            match ($element['type']) {
                'shape' => $this->drawShapeElement($pdf, $element, $x, $y),
                'text' => $this->drawTextElement($pdf, $element, $label, $x, $y),
                'barcode' => $this->drawBarcodeElement($pdf, $element, $label, $x, $y),
                default => null,
            };
        }
    }

    protected function drawShapeElement(Fpdf $pdf, array $element, float $x, float $y): void
    {
        $style = 'D';

        if (! empty($element['fill_color'])) {
            [$r, $g, $b] = $this->hexToRgb($element['fill_color']);
            $pdf->setFillColor($r, $g, $b);
            $style = 'DF';
        }

        [$r, $g, $b] = $this->hexToRgb($element['stroke_color'] ?? '#000000');
        $pdf->setDrawColor($r, $g, $b);
        $pdf->setLineWidth((float) ($element['stroke_width_mm'] ?? 0.2));

        $pdf->rect($x + $element['x_mm'], $y + $element['y_mm'], $element['width_mm'], $element['height_mm'], $style);
    }

    protected function drawTextElement(Fpdf $pdf, array $element, array $label, float $x, float $y): void
    {
        $value = $this->resolveTextValue($element, $label);

        if ($value === null || $value === '') {
            return;
        }

        $fontSize = (float) ($element['font_size_pt'] ?? 8);
        $style = ($element['bold'] ?? false ? 'B' : '').($element['italic'] ?? false ? 'I' : '').($element['underline'] ?? false ? 'U' : '');

        [$r, $g, $b] = $this->hexToRgb($element['color'] ?? '#000000');
        $pdf->setTextColor($r, $g, $b);
        $pdf->setFont($this->pdfFont($element['font_family'] ?? 'helvetica'), $style, $fontSize);
        $pdf->setXY($x + $element['x_mm'], $y + $element['y_mm']);

        $lineHeight = $fontSize * 0.3528 * 1.15;
        $pdf->multiCell($element['width_mm'], $lineHeight, $this->pdfText($value), 0, $this->pdfAlign($element['align'] ?? 'left'));
    }

    protected function resolveTextValue(array $element, array $label): ?string
    {
        if (($element['hide_when_promo_active'] ?? false) && $label['promo_new_price'] !== null) {
            return null;
        }

        $raw = match ($element['binding'] ?? null) {
            'name' => $label['show_name'] ? $label['name'] : null,
            'price' => $label['show_price'] ? $this->formatMoney($label['price']).(($element['show_unit_suffix'] ?? false) && $label['unit_label'] ? '/'.$label['unit_label'] : '') : null,
            'promo_old_price' => $label['show_price'] && $label['promo_old_price'] !== null ? $this->formatMoney($label['promo_old_price']) : null,
            'promo_new_price' => $label['show_price'] && $label['promo_new_price'] !== null ? $this->formatMoney($label['promo_new_price']) : null,
            default => null,
        };

        if ($raw === null) {
            return null;
        }

        return ($element['prefix'] ?? '').$raw;
    }

    protected function drawBarcodeElement(Fpdf $pdf, array $element, array $label, float $x, float $y): void
    {
        if ($label['barcode_type'] === 'none' || ! ($element['show_human_readable'] ?? true)) {
            return;
        }

        [$r, $g, $b] = $this->hexToRgb($element['color'] ?? '#000000');
        $pdf->setTextColor($r, $g, $b);
        $pdf->setFont('Arial', '', 7);
        $pdf->setXY($x + $element['x_mm'], $y + $element['y_mm']);
        $pdf->multiCell($element['width_mm'], $element['height_mm'], $this->pdfText($label['barcode']), 0, 'C');
    }

    protected function pdfFont(string $fontFamily): string
    {
        return match (strtolower($fontFamily)) {
            'times' => 'Times',
            'courier' => 'Courier',
            default => 'Arial',
        };
    }

    protected function pdfAlign(string $align): string
    {
        return match ($align) {
            'center' => 'C',
            'right' => 'R',
            default => 'L',
        };
    }

    protected function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        return [
            hexdec(substr($hex, 0, 2)),
            hexdec(substr($hex, 2, 2)),
            hexdec(substr($hex, 4, 2)),
        ];
    }

    protected function drawLegacyLabel(Fpdf $pdf, array $label, float $x, float $y, float $width, float $height): void
    {
        $pdf->rect($x, $y, $width, $height);

        if ($label['show_name']) {
            $pdf->setXY($x + 2, $y + 1.5);
            $pdf->setFont('Arial', 'B', 8);
            $pdf->multiCell($width - 4, 3.2, $this->pdfText($label['name']), 0, 'L');
        }

        if ($label['show_price']) {
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
        }

        if ($label['barcode_type'] !== 'none') {
            $pdf->setXY($x + 2, $y + $height - 4);
            $pdf->setFont('Arial', '', 7);
            $pdf->cell($width - 4, 3, $this->pdfText($label['barcode']), 0, 0, 'C');
        }
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
