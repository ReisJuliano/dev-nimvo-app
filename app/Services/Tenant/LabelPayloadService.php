<?php

namespace App\Services\Tenant;

use App\Models\Tenant\LabelTemplate;
use App\Models\Tenant\Product;

class LabelPayloadService
{
    public function __construct(
        protected PromotionEngine $promotionEngine,
    ) {
    }

    public function build(Product $product, LabelTemplate $template, int $copies = 1): array
    {
        $isWeighable = $product->sold_by === 'weight';
        $salePrice = (float) $product->sale_price;

        $data = [
            'template_id' => $template->id,
            'product_id' => $product->id,
            'show_name' => $template->show_name,
            'name' => (string) $product->name,
            'internal_code' => (string) $product->code,
            'barcode' => (string) ($product->barcode ?: $product->code),
            'barcode_type' => $this->barcodeType($product, $template),
            'show_price' => $template->show_price,
            'price' => $salePrice,
            'unit_label' => $isWeighable ? 'KG' : null,
            'weighable' => $isWeighable,
            'copies' => max(1, $copies),
            'promo_old_price' => null,
            'promo_new_price' => null,
            'promo_valid_until' => null,
        ];

        if ($template->show_promo) {
            $promotion = $this->promotionEngine->evaluateLine($product, 1.0, $salePrice);

            if ($promotion['promotion_id']) {
                $data['promo_old_price'] = $salePrice;
                $data['promo_new_price'] = $promotion['promotion_effective_unit_price'];
                $data['promo_valid_until'] = null;
            }
        }

        return $data;
    }

    protected function barcodeType(Product $product, LabelTemplate $template): string
    {
        if ($template->barcode_mode !== 'auto') {
            return $template->barcode_mode;
        }

        $barcode = (string) ($product->barcode ?: '');

        return preg_match('/^\d{13}$/', $barcode) ? 'ean13' : 'code128';
    }
}
