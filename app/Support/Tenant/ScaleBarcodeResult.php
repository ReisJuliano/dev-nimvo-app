<?php

namespace App\Support\Tenant;

use App\Models\Tenant\Product;

class ScaleBarcodeResult
{
    public function __construct(
        public readonly Product $product,
        public readonly float $quantity,
        public readonly float $totalPrice,
    ) {
    }
}
