<?php

namespace App\Support;

use Mike42\Escpos\EscposImage;
use Mike42\Escpos\Printer;
use RuntimeException;

class ThermalSaleReceiptPrinter
{
    public function __construct(
        protected EscposConnectorFactory $connectorFactory,
    ) {
    }

    public function print(array $payload, array $printerConfig, ?string $accessKey = null): void
    {
        $printer = new Printer($this->connectorFactory->make($printerConfig));
        $logoPath = (string) ($printerConfig['logo_path'] ?? '');

        if ($logoPath !== '' && is_file($logoPath)) {
            $printer->setJustification(Printer::JUSTIFY_CENTER);
            $printer->bitImage(EscposImage::load($logoPath));
            $printer->feed();
        }

        $profile = $payload['profile'] ?? [];
        $sale = $payload['sale'] ?? [];
        $items = $payload['items'] ?? [];
        $payments = $payload['payments'] ?? [];

        if ($items === []) {
            $printer->close();
            throw new RuntimeException('Nao ha itens para imprimir no comprovante termico local.');
        }

        $printer->setJustification(Printer::JUSTIFY_CENTER);
        $printer->setEmphasis(true);
        $printer->text(($profile['trade_name'] ?: $profile['company_name'] ?? 'Emitente')."\n");
        $printer->setEmphasis(false);
        $printer->text("Documento Auxiliar da Nota Fiscal de Consumidor Eletronica\n");

        $cnpj = trim((string) ($profile['cnpj'] ?? ''));
        $ie = trim((string) ($profile['ie'] ?? ''));
        if ($cnpj !== '' || $ie !== '') {
            $printer->text(trim(implode('   ', array_filter([
                $cnpj !== '' ? 'CNPJ: '.$this->formatCnpj($cnpj) : '',
                $ie !== '' ? 'IE: '.$ie : '',
            ])))."\n");
        }

        $address = $this->formatAddress($profile);
        if ($address !== '') {
            $printer->text($address."\n");
        }

        $printer->setEmphasis(true);
        $printer->text("ENSAIO LOCAL - SEM TRANSMISSAO SEFAZ\n");
        $printer->setEmphasis(false);
        $printer->text(str_repeat('=', 48)."\n");

        $printer->setJustification(Printer::JUSTIFY_LEFT);
        $printer->text(sprintf("Venda: %s\n", $sale['sale_number'] ?? ''));
        $printer->text(sprintf("Emissao: %s\n", date('d/m/Y H:i:s', strtotime((string) ($sale['issued_at'] ?? 'now')))));
        $printer->text(str_repeat('-', 48)."\n");

        $printer->setEmphasis(true);
        $printer->text("Codigo  Descricao                  Qtde  Vl Unit\n");
        $printer->setEmphasis(false);

        $totalDiscount = 0.0;
        foreach ($items as $item) {
            $code = $this->pad((string) ($item['code'] ?? ''), 7);
            $name = (string) ($item['name'] ?? '');
            $rawQuantity = (float) ($item['quantity'] ?? 0);
            $qtyDecimals = fmod($rawQuantity, 1.0) !== 0.0 ? 3 : 0;
            $qty = $this->pad(number_format($rawQuantity, $qtyDecimals, ',', '.'), 6, STR_PAD_LEFT);
            $unit = $this->pad(number_format((float) ($item['unit_price'] ?? 0), 2, ',', '.'), 8, STR_PAD_LEFT);

            $printer->text("{$code} ".$this->pad($name, 26)." {$qty} {$unit}\n");

            $lineTotal = number_format((float) ($item['line_subtotal'] ?? $item['total'] ?? 0), 2, ',', '.');
            $discount = (float) ($item['discount_amount'] ?? 0);
            $totalDiscount += $discount;
            $liquid = number_format((float) ($item['total'] ?? 0), 2, ',', '.');

            $printer->text($this->pad('  Vl.Total R$ '.$lineTotal, 24)
                .$this->pad($discount > 0 ? 'Desc. R$ '.number_format($discount, 2, ',', '.') : '', 18)
                ."\n");
            $printer->text($this->pad('  Vl.Liquido R$ '.$liquid, 48)."\n");
        }

        $printer->text(str_repeat('-', 48)."\n");
        $printer->text($this->line('Qtde. total de itens', (string) count($items)));
        $printer->text($this->line('Valor Total R$', number_format((float) ($sale['subtotal'] ?? 0), 2, ',', '.')));
        if ($totalDiscount > 0) {
            $printer->text($this->line('Desconto(s) R$', number_format($totalDiscount, 2, ',', '.')));
        }
        $printer->setEmphasis(true);
        $printer->text($this->line('VALOR A PAGAR R$', number_format((float) ($sale['total'] ?? 0), 2, ',', '.')));
        $printer->setEmphasis(false);

        $printer->text(str_repeat('-', 48)."\n");
        $printer->setEmphasis(true);
        $printer->text("FORMA DE PAGAMENTO\n");
        $printer->setEmphasis(false);
        foreach ($payments as $payment) {
            $label = $payment['xPag'] ?: ($payment['method'] ?? 'Pagamento');
            $printer->text($this->line($label, number_format((float) ($payment['amount'] ?? 0), 2, ',', '.')));
        }
        if ((float) ($sale['change_amount'] ?? 0) > 0) {
            $printer->text($this->line('Troco R$', number_format((float) $sale['change_amount'], 2, ',', '.')));
        }

        $printer->text(str_repeat('-', 48)."\n");

        if ($accessKey) {
            $printer->text("Chave assinada localmente (sem SEFAZ):\n");
            $printer->text($this->formatAccessKey($accessKey)."\n");
        }

        $consumer = $payload['consumer'] ?? [];
        $consumerName = trim((string) ($consumer['name'] ?? ''));
        $consumerDocument = trim((string) ($consumer['document'] ?? ''));
        $printer->text($consumerName === '' && $consumerDocument === ''
            ? "Consumidor: CONSUMIDOR NAO IDENTIFICADO\n"
            : "Consumidor: ".trim($consumerName.' '.$consumerDocument)."\n");

        $printer->text(sprintf("NFC-e local: %s Serie %s\n", $sale['number'] ?? '', $sale['series'] ?? ''));
        $printer->text(str_repeat('-', 48)."\n");
        $printer->text("XML assinado com certificado local A1.\n");
        $printer->text("Use este comprovante apenas para ensaio do emissor.\n");

        $notes = trim((string) ($payload['additional_info'] ?? ''));
        if ($notes !== '') {
            $printer->text(str_repeat('-', 48)."\n");
            $printer->text($notes."\n");
        }

        $printer->feed(2);
        $printer->cut();
        $printer->close();
    }

    protected function formatAddress(array $profile): string
    {
        $line = trim(implode(', ', array_filter([
            trim((string) ($profile['street'] ?? '')),
            trim((string) ($profile['number'] ?? '')),
        ])));

        $district = trim((string) ($profile['district'] ?? ''));
        if ($district !== '') {
            $line = trim(implode(', ', array_filter([$line, $district])));
        }

        $cityState = trim(implode(' - ', array_filter([
            trim((string) ($profile['city_name'] ?? '')),
            trim((string) ($profile['state'] ?? '')),
        ])));

        return trim(implode(' - ', array_filter([$line, $cityState])));
    }

    protected function formatCnpj(string $cnpj): string
    {
        $digits = preg_replace('/\D/', '', $cnpj) ?? '';

        if (strlen($digits) !== 14) {
            return $cnpj;
        }

        return sprintf(
            '%s.%s.%s/%s-%s',
            substr($digits, 0, 2),
            substr($digits, 2, 3),
            substr($digits, 5, 3),
            substr($digits, 8, 4),
            substr($digits, 12, 2),
        );
    }

    protected function formatAccessKey(string $accessKey): string
    {
        $digits = preg_replace('/\D/', '', $accessKey) ?? $accessKey;
        $groups = str_split($digits, 4);

        return implode(' ', $groups);
    }

    protected function line(string $label, string $value): string
    {
        return $this->pad($label, 30).$this->pad($value, 18, STR_PAD_LEFT)."\n";
    }

    protected function pad(string $value, int $length, int $type = STR_PAD_RIGHT): string
    {
        $value = mb_substr($value, 0, $length);
        $diff = strlen($value) - mb_strlen($value);

        return str_pad($value, $length + $diff, ' ', $type);
    }
}
