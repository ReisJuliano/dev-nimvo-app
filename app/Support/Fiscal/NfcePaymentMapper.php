<?php

namespace App\Support\Fiscal;

use App\Support\Tenant\PaymentMethod;

class NfcePaymentMapper
{
    public function toTpag(string $method): array
    {
        return match (PaymentMethod::normalize($method)) {
            PaymentMethod::CASH => ['tPag' => '01', 'xPag' => null],
            PaymentMethod::CREDIT_CARD => ['tPag' => '03', 'xPag' => null],
            PaymentMethod::DEBIT_CARD => ['tPag' => '04', 'xPag' => null],
            PaymentMethod::CREDIT => ['tPag' => '99', 'xPag' => 'A Prazo'],
            PaymentMethod::PIX => ['tPag' => '17', 'xPag' => null],
            default => ['tPag' => '99', 'xPag' => ucfirst(str_replace('_', ' ', $method))],
        };
    }
}
