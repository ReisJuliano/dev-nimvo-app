<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Mike42\Escpos\EscposImage;
use Mike42\Escpos\Printer;

class LocalAgentReceiptPrinter
{
    public function __construct(
        protected EscposConnectorFactory $connectorFactory,
    ) {
    }

    public function printTest(array $printerConfig, array $payload = []): void
    {
        $printer = $this->openPrinter($printerConfig);

        try {
            $this->applyLogo($printer, (string) ($printerConfig['logo_path'] ?? ''));

            $printer->setJustification(Printer::JUSTIFY_CENTER);
            $printer->setEmphasis(true);
            $printer->text($this->headline($payload['store_name'] ?? 'Nimvo')."\n");
            $printer->setEmphasis(false);
            $printer->text("TESTE DE IMPRESSAO LOCAL\n");
            $printer->text("API DO AGENTE GO\n");
            $printer->text(str_repeat('=', 48)."\n");

            $printer->setJustification(Printer::JUSTIFY_LEFT);
            $printer->text(sprintf("Data: %s\n", $this->formatDateTime($payload['issued_at'] ?? null)));
            $printer->text(sprintf("Conector: %s\n", strtoupper((string) ($printerConfig['connector'] ?? 'windows'))));

            $target = trim((string) ($printerConfig['name'] ?? ($printerConfig['host'] ?? '')));
            if ($target !== '') {
                $printer->text(sprintf("Destino: %s\n", $target));
            }

            $message = trim((string) ($payload['message'] ?? 'Se este cupom saiu corretamente, a ponte local do Nimvo com o agente em Go esta operacional.'));
            $printer->text(str_repeat('-', 48)."\n");
            $printer->text($message."\n");
            $printer->text(str_repeat('-', 48)."\n");
            $printer->text("Sem valor fiscal.\n");
            $printer->feed(2);
            $printer->cut();
        } finally {
            $printer->close();
        }
    }

    public function printPaymentReceipt(array $payload, array $printerConfig): void
    {
        $printer = $this->openPrinter($printerConfig);

        try {
            $this->applyLogo($printer, (string) ($printerConfig['logo_path'] ?? ''));

            $storeName = trim((string) ($payload['store_name'] ?? 'Nimvo'));
            $saleNumber = trim((string) ($payload['sale_number'] ?? ''));
            $customerName = trim((string) data_get($payload, 'customer.name', ''));
            $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
            $payments = is_array($payload['payments'] ?? null) ? $payload['payments'] : [];
            $total = (float) ($payload['total'] ?? 0);
            $change = (float) ($payload['change_amount'] ?? 0);
            $notes = trim((string) ($payload['notes'] ?? ''));

            $printer->setJustification(Printer::JUSTIFY_CENTER);
            $printer->setEmphasis(true);
            $printer->text($this->headline($storeName)."\n");
            $printer->setEmphasis(false);
            $printer->text("COMPROVANTE DE PAGAMENTO\n");
            $printer->text(str_repeat('=', 48)."\n");

            $printer->setJustification(Printer::JUSTIFY_LEFT);
            if ($saleNumber !== '') {
                $printer->text(sprintf("Venda: %s\n", $saleNumber));
            }

            $printer->text(sprintf("Emissao: %s\n", $this->formatDateTime($payload['issued_at'] ?? null)));

            if ($customerName !== '') {
                $printer->text(sprintf("Cliente: %s\n", $customerName));
            }

            if ($items !== []) {
                $printer->text(str_repeat('-', 48)."\n");
                $printer->setEmphasis(true);
                $printer->text("Descricao             Qt  VlrUn   Total\n");
                $printer->setEmphasis(false);

                foreach ($items as $item) {
                    $name = $this->pad((string) ($item['name'] ?? ''), 20);
                    $qty = $this->pad(number_format((float) ($item['quantity'] ?? 0), 0, ',', '.'), 3, STR_PAD_LEFT);
                    $unit = $this->pad(number_format((float) ($item['unit_price'] ?? 0), 2, ',', '.'), 7, STR_PAD_LEFT);
                    $lineTotal = $this->pad(number_format((float) ($item['total'] ?? 0), 2, ',', '.'), 8, STR_PAD_LEFT);

                    $printer->text("{$name} {$qty} {$unit} {$lineTotal}\n");
                }
            }

            $printer->text(str_repeat('-', 48)."\n");
            $printer->text($this->line('Total', number_format($total, 2, ',', '.')));

            if ($change > 0) {
                $printer->text($this->line('Troco', number_format($change, 2, ',', '.')));
            }

            foreach ($payments as $payment) {
                $label = trim((string) ($payment['label'] ?? $payment['method'] ?? 'Pagamento'));
                $amount = number_format((float) ($payment['amount'] ?? 0), 2, ',', '.');
                $printer->text($this->line($label, $amount));
            }

            if ($notes !== '') {
                $printer->text(str_repeat('-', 48)."\n");
                $printer->text($notes."\n");
            }

            $printer->feed(2);
            $printer->cut();
        } finally {
            $printer->close();
        }
    }

    protected function openPrinter(array $printerConfig): Printer
    {
        return new Printer($this->connectorFactory->make($printerConfig));
    }

    protected function applyLogo(Printer $printer, string $logoPath): void
    {
        if ($logoPath === '' || !is_file($logoPath)) {
            return;
        }

        $printer->setJustification(Printer::JUSTIFY_CENTER);
        $printer->bitImage(EscposImage::load($logoPath));
        $printer->feed();
    }

    protected function headline(?string $value): string
    {
        return $this->pad((string) $value, 48);
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

    protected function formatDateTime(mixed $value): string
    {
        if ($value instanceof CarbonInterface) {
            return $value->format('d/m/Y H:i:s');
        }

        if (is_string($value) && trim($value) !== '') {
            try {
                return Carbon::parse($value)->format('d/m/Y H:i:s');
            } catch (\Throwable) {
                return $value;
            }
        }

        return now()->format('d/m/Y H:i:s');
    }
}
