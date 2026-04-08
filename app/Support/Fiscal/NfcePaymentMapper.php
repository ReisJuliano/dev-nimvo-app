<?php

namespace App\Support\Fiscal;

use App\Support\Tenant\PaymentMethod;

class NfcePaymentMapper
{
    public function toTpag(string $method): array
    {
        return match (PaymentMethod::normalize($method)) {
            PaymentMethod::CASH => ['tPag' => '01', 'xPag' => null, 'indPag' => 0, 'requires_zero_value' => false],
            PaymentMethod::CREDIT_CARD => ['tPag' => '03', 'xPag' => null, 'indPag' => 0, 'requires_zero_value' => false],
            PaymentMethod::DEBIT_CARD => ['tPag' => '04', 'xPag' => null, 'indPag' => 0, 'requires_zero_value' => false],
            PaymentMethod::CREDIT => ['tPag' => '91', 'xPag' => null, 'indPag' => 1, 'requires_zero_value' => true],
            PaymentMethod::PIX => ['tPag' => '17', 'xPag' => null, 'indPag' => 0, 'requires_zero_value' => false],
            default => ['tPag' => '99', 'xPag' => ucfirst(str_replace('_', ' ', $method)), 'indPag' => 0, 'requires_zero_value' => false],
        };
    }
}
