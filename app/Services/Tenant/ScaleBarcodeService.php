<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Product;
use App\Support\Tenant\ScaleBarcodeResult;

class ScaleBarcodeService
{
    public function __construct(
        protected TenantSettingsService $settingsService,
    ) {
    }

    public function parse(string $barcode): ?ScaleBarcodeResult
    {
        $settings = (array) data_get($this->settingsService->get(), 'scale_barcode', []);
        $decoded = $this->decode($barcode, $settings);

        if ($decoded === null) {
            return null;
        }

        $product = Product::query()
            ->where('scale_code', $decoded['scale_code'])
            ->where('sold_by', 'weight')
            ->where('active', true)
            ->first();

        if (!$product) {
            return null;
        }

        $salePrice = (float) $product->sale_price;

        if ($decoded['type'] === 'weight_embedded') {
            $quantity = round($decoded['raw_value'] / 1000, 3);
            $totalPrice = round($quantity * $salePrice, 2);
        } else {
            $totalPrice = round($decoded['raw_value'] / 100, 2);
            $quantity = $salePrice > 0 ? round($totalPrice / $salePrice, 3) : 0.0;
        }

        return new ScaleBarcodeResult($product, $quantity, $totalPrice);
    }

    /**
     * Decodifica um EAN-13 de balança a partir das configurações do tenant,
     * sem tocar o banco de dados (extraído para ser testável isoladamente).
     *
     * @return array{scale_code: int, raw_value: int, type: string}|null
     */
    public function decode(string $barcode, array $settings): ?array
    {
        $digits = preg_replace('/\D/', '', $barcode) ?? '';

        if (strlen($digits) !== 13 || !$this->isValidEan13($digits)) {
            return null;
        }

        $prefix = (string) ($settings['prefix'] ?? '2');

        if ($prefix === '' || !str_starts_with($digits, $prefix)) {
            return null;
        }

        $codeLength = max(1, (int) ($settings['code_length'] ?? 6));
        $valueLength = max(1, (int) ($settings['value_length'] ?? 5));

        if (strlen($prefix) + $codeLength + $valueLength + 1 !== 13) {
            return null;
        }

        $scaleCode = (int) substr($digits, strlen($prefix), $codeLength);
        $rawValue = (int) substr($digits, strlen($prefix) + $codeLength, $valueLength);
        $type = ($settings['type'] ?? 'price_embedded') === 'weight_embedded' ? 'weight_embedded' : 'price_embedded';

        return [
            'scale_code' => $scaleCode,
            'raw_value' => $rawValue,
            'type' => $type,
        ];
    }

    public function isValidEan13(string $digits): bool
    {
        if (strlen($digits) !== 13 || !ctype_digit($digits)) {
            return false;
        }

        $sum = 0;

        for ($i = 0; $i < 12; $i++) {
            $digit = (int) $digits[$i];
            $sum += ($i % 2 === 0) ? $digit : $digit * 3;
        }

        $checkDigit = (10 - ($sum % 10)) % 10;

        return $checkDigit === (int) $digits[12];
    }
}
