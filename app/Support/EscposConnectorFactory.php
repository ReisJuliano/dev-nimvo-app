<?php

namespace App\Support;

use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use Mike42\Escpos\PrintConnectors\PrintConnector;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;

class EscposConnectorFactory
{
    public function make(array $printerConfig): PrintConnector
    {
        $connectorType = strtolower(trim((string) ($printerConfig['connector'] ?? 'windows')));

        return match ($connectorType) {
            'tcp', 'network' => new NetworkPrintConnector(
                (string) ($printerConfig['host'] ?? '127.0.0.1'),
                (int) ($printerConfig['port'] ?? 9100),
            ),
            default => new WindowsPrintConnector((string) ($printerConfig['name'] ?? '')),
        };
    }
}
