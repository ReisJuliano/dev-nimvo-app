<?php

namespace App\Support\Tenant;

class PaymentMethod
{
    public const CASH = 'cash';
    public const PIX = 'pix';
    public const DEBIT_CARD = 'debit_card';
    public const CREDIT_CARD = 'credit_card';
    public const CREDIT = 'credit';
    public const MIXED = 'mixed';

    public static function normalize(?string $method): string
    {
        return match ($method) {
            'dinheiro' => self::CASH,
            'cartao_debito' => self::DEBIT_CARD,
            'cartao_credito' => self::CREDIT_CARD,
            'fiado', 'a_prazo', 'a-prazo', 'a prazo' => self::CREDIT,
            'misto' => self::MIXED,
            null, '' => self::CASH,
            default => (string) $method,
        };
    }

    public static function label(?string $method): string
    {
        return match (self::normalize($method)) {
            self::CASH => 'Dinheiro',
            self::PIX => 'Pix',
            self::DEBIT_CARD => 'Cartao de debito',
            self::CREDIT_CARD => 'Cartao de credito',
            self::CREDIT => 'A Prazo',
            self::MIXED => 'Misto',
            default => ucfirst(str_replace('_', ' ', (string) $method)),
        };
    }

    public static function all(): array
    {
        return [
            self::CASH,
            self::PIX,
            self::DEBIT_CARD,
            self::CREDIT_CARD,
            self::CREDIT,
            self::MIXED,
        ];
    }
}
