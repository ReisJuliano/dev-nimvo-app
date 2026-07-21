<?php

declare(strict_types=1);

require __DIR__.'/bootstrap.php';

use App\Support\Pkcs12CertificateReader;
use App\Support\SpedNfeNfceEmitter;

function bridgeReadJson(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException("Arquivo nao encontrado: {$path}");
    }

    $content = file_get_contents($path);

    if ($content === false) {
        throw new RuntimeException("Nao foi possivel ler o arquivo: {$path}");
    }

    $decoded = json_decode($content, true);

    if (!is_array($decoded)) {
        throw new RuntimeException("JSON invalido em: {$path}");
    }

    return $decoded;
}

function bridgeOutput(array $payload, int $status = 0): never
{
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    echo PHP_EOL;

    exit($status);
}

function bridgeExecuteFiscalCommand(array $arguments): array
{
    if (count($arguments) < 3) {
        throw new RuntimeException('Uso: bridge.php command <config> <type> <payloadFile>.');
    }

    [$configPath, $type, $payloadPath] = $arguments;
    $agentConfig = bridgeReadJson($configPath);
    $payload = bridgeReadJson($payloadPath);
    $emitter = new SpedNfeNfceEmitter(
        new App\Support\NfceLayoutBuilder(),
        new App\Support\ThermalSaleReceiptPrinter(new App\Support\EscposConnectorFactory()),
        new Pkcs12CertificateReader(),
        new App\Support\EscposConnectorFactory(),
    );

    return match ($type) {
        'emit_nfce' => match (true) {
            (bool) data_get($payload, 'flags.local_test', false)
                => $emitter->emitLocalTest($payload, $agentConfig),
            (bool) data_get($payload, 'flags.offline_contingency', false)
                && data_get($payload, 'flags.offline_contingency_stage') === 'issue'
                => $emitter->emitOfflineContingency($payload, $agentConfig),
            (bool) data_get($payload, 'flags.offline_contingency', false)
                => $emitter->transmitOfflineContingency($payload, $agentConfig),
            default => $emitter->emit($payload, $agentConfig),
        },
        'cancel_fiscal_document' => $emitter->cancel($payload, $agentConfig),
        'send_correction_letter' => $emitter->correct($payload, $agentConfig),
        'invalidate_fiscal_range' => $emitter->invalidateRange($payload, $agentConfig),
        default => throw new RuntimeException("Tipo de comando nao suportado pelo bridge fiscal local: {$type}"),
    };
}

function bridgeInspectCertificate(array $arguments): array
{
    if (count($arguments) < 2) {
        throw new RuntimeException('Uso: bridge.php inspect-certificate <path> <password>.');
    }

    [$path, $password] = $arguments;
    $inspection = (new Pkcs12CertificateReader())->inspect($path, $password);

    return [
        'company_name' => $inspection['company_name'] ?? null,
        'cnpj' => $inspection['cnpj'] ?? null,
        'valid_from' => $inspection['valid_from'] ?? null,
        'valid_to' => $inspection['valid_to'] ?? null,
    ];
}

try {
    $arguments = array_slice($_SERVER['argv'] ?? [], 1);
    $mode = array_shift($arguments);

    $result = match ($mode) {
        'command' => bridgeExecuteFiscalCommand($arguments),
        'inspect-certificate' => bridgeInspectCertificate($arguments),
        default => throw new RuntimeException('Modo do bridge fiscal invalido.'),
    };

    bridgeOutput($result);
} catch (Throwable $exception) {
    bridgeOutput([
        'status' => 'failed',
        'message' => $exception->getMessage(),
        'error' => $exception->getMessage(),
    ], 1);
}
