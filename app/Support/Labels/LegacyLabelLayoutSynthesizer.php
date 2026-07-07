<?php

namespace App\Support\Labels;

use App\Models\Tenant\LabelTemplate;

/**
 * Reconstrói, em memória, um array de elementos equivalente à geometria hoje
 * hardcoded em LabelSheetPdfService::drawLegacyLabel(), a partir dos campos
 * flat de um LabelTemplate. Usado para backfill de templates sem `layout` e
 * como fallback defensivo em runtime.
 */
class LegacyLabelLayoutSynthesizer
{
    public function fromTemplate(LabelTemplate $template): array
    {
        $width = (float) $template->label_width_mm;
        $height = (float) $template->label_height_mm;
        $showPromo = (bool) $template->show_promo;

        $elements = [
            $this->border($width, $height),
        ];

        if ($template->show_name) {
            $elements[] = $this->nameElement($width, $height, $showPromo);
        }

        if ($template->show_price) {
            if ($showPromo) {
                $elements[] = $this->promoOldPriceElement($width, $height);
                $elements[] = $this->promoNewPriceElement($width, $height);
            }

            $elements[] = $this->priceElement($width, $height, $showPromo);
        }

        if ($template->barcode_mode !== 'none') {
            $elements[] = $this->barcodeElement($width, $height, $template->barcode_mode);
        }

        return [
            'version' => 1,
            'elements' => $elements,
        ];
    }

    protected function border(float $width, float $height): array
    {
        return [
            'id' => 'legacy_border',
            'type' => 'shape',
            'shape' => 'rectangle',
            'x_mm' => 0,
            'y_mm' => 0,
            'width_mm' => $width,
            'height_mm' => $height,
            'fill_color' => null,
            'stroke_color' => '#000000',
            'stroke_width_mm' => 0.2,
        ];
    }

    protected function nameElement(float $width, float $height, bool $showPromo): array
    {
        $priceStart = $showPromo ? $height - 12 : $height - 10;

        return [
            'id' => 'legacy_name',
            'type' => 'text',
            'binding' => 'name',
            'prefix' => '',
            'x_mm' => 2,
            'y_mm' => 1.5,
            'width_mm' => max(1, $width - 4),
            'height_mm' => max(3, $priceStart - 1.5),
            'font_family' => 'helvetica',
            'font_size_pt' => 8,
            'bold' => true,
            'italic' => false,
            'underline' => false,
            'color' => '#000000',
            'align' => 'left',
            'valign' => 'top',
        ];
    }

    protected function promoOldPriceElement(float $width, float $height): array
    {
        return [
            'id' => 'legacy_price_de',
            'type' => 'text',
            'binding' => 'promo_old_price',
            'prefix' => 'De: ',
            'x_mm' => 2,
            'y_mm' => $height - 12,
            'width_mm' => max(1, $width - 4),
            'height_mm' => 3,
            'font_family' => 'helvetica',
            'font_size_pt' => 7,
            'bold' => false,
            'italic' => false,
            'underline' => false,
            'color' => '#000000',
            'align' => 'left',
            'valign' => 'top',
        ];
    }

    protected function promoNewPriceElement(float $width, float $height): array
    {
        return [
            'id' => 'legacy_price_por',
            'type' => 'text',
            'binding' => 'promo_new_price',
            'prefix' => 'Por: ',
            'x_mm' => 2,
            'y_mm' => $height - 9,
            'width_mm' => max(1, $width - 4),
            'height_mm' => 6,
            'font_family' => 'helvetica',
            'font_size_pt' => 14,
            'bold' => true,
            'italic' => false,
            'underline' => false,
            'color' => '#000000',
            'align' => 'left',
            'valign' => 'top',
        ];
    }

    protected function priceElement(float $width, float $height, bool $showPromo): array
    {
        return [
            'id' => 'legacy_price',
            'type' => 'text',
            'binding' => 'price',
            'prefix' => '',
            'show_unit_suffix' => true,
            'hide_when_promo_active' => $showPromo,
            'x_mm' => 2,
            'y_mm' => $height - 10,
            'width_mm' => max(1, $width - 4),
            'height_mm' => 6,
            'font_family' => 'helvetica',
            'font_size_pt' => 14,
            'bold' => true,
            'italic' => false,
            'underline' => false,
            'color' => '#000000',
            'align' => 'left',
            'valign' => 'top',
        ];
    }

    protected function barcodeElement(float $width, float $height, string $barcodeMode): array
    {
        return [
            'id' => 'legacy_barcode',
            'type' => 'barcode',
            'barcode_type' => $barcodeMode,
            'show_human_readable' => true,
            'x_mm' => 2,
            'y_mm' => $height - 4,
            'width_mm' => max(1, $width - 4),
            'height_mm' => 3,
            'color' => '#000000',
        ];
    }
}
