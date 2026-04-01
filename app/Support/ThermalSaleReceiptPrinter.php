<?php

namespace App\Support;

use Mike42\Escpos\EscposImage;
use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;
use Mike42\Escpos\Printer;
use RuntimeException;

class ThermalSaleReceiptPrinter
{
    public function print(array $payload, array $printerConfig, ?string $accessKey = null): void
    {
        $connectorType = strtolower((string) ($printerConfig['connector'] ?? 'windows'));
        $connector = match ($connectorType) {
            'network' => new NetworkPrintConnector(
                (string) ($printerConfig['host'] ?? '127.0.0.1'),
                (int) ($printerConfig['port'] ?? 9100),
            ),
            default => new WindowsPrintConnector((string) ($printerConfig['name'] ?? '')),
        };

        $printer = new Printer($connector);
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
        $printer->text("ENSAIO LOCAL NFC-E\n");
        $printer->text("SEM TRANSMISSAO SEFAZ\n");
        $printer->text("SEM VALOR FISCAL\n");
        $printer->text(str_repeat('=', 48)."\n");

        $printer->setJustification(Printer::JUSTIFY_LEFT);
        $printer->text(sprintf("Venda: %s\n", $sale['sale_number'] ?? ''));
        $printer->text(sprintf("NFC-e local: %s Serie %s\n", $sale['number'] ?? '', $sale['series'] ?? ''));
        $printer->text(sprintf("Emissao: %s\n", date('d/m/Y H:i:s', strtotime((string) ($sale['issued_at'] ?? 'now')))));
        $printer->text(sprintf("CNPJ: %s   IE: %s\n", $profile['cnpj'] ?? '', $profile['ie'] ?? ''));
        $printer->text(str_repeat('-', 48)."\n");
        $printer->setEmphasis(true);
        $printer->text("Cod   Descricao           Qt  VlrUn   Total\n");
        $printer->setEmphasis(false);

        foreach ($items as $item) {
            $code = $this->pad((string) ($item['code'] ?? ''), 5);
            $name = $this->pad((string) ($item['name'] ?? ''), 18);
            $qty = $this->pad(number_format((float) ($item['quantity'] ?? 0), 0, ',', '.'), 3, STR_PAD_LEFT);
            $unit = $this->pad(number_format((float) ($item['unit_price'] ?? 0), 2, ',', '.'), 7, STR_PAD_LEFT);
            $total = $this->pad(number_format((float) ($item['total'] ?? 0), 2, ',', '.'), 8, STR_PAD_LEFT);

            $printer->text("{$code} {$name} {$qty} {$unit} {$total}\n");
        }

        $printer->text(str_repeat('-', 48)."\n");
        $printer->text($this->line('Total', number_format((float) ($sale['total'] ?? 0), 2, ',', '.')));
        $printer->text($this->line('Troco', number_format((float) ($sale['change_amount'] ?? 0), 2, ',', '.')));

        foreach ($payments as $payment) {
            $label = $payment['xPag'] ?: ($payment['method'] ?? 'Pagamento');
            $printer->text($this->line($label, number_format((float) ($payment['amount'] ?? 0), 2, ',', '.')));
        }

        $printer->text(str_repeat('-', 48)."\n");

        if ($accessKey) {
            $printer->text("Chave assinada localmente:\n");
            $printer->text($accessKey."\n");
        }

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

    protected function line(string $label, string $value): string
    {
        return $this->pad($label, 30).$this->pad('R$ '.$value, 18, STR_PAD_LEFT)."\n";
    }

    protected function pad(string $value, int $length, int $type = STR_PAD_RIGHT): string
    {
        $value = mb_substr($value, 0, $length);
        $diff = strlen($value) - mb_strlen($value);

        return str_pad($value, $length + $diff, ' ', $type);
    }
}
