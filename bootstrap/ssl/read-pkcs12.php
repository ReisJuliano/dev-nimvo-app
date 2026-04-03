<?php

$input = json_decode((string) stream_get_contents(STDIN), true);

if (!is_array($input)) {
    fwrite(STDERR, 'Entrada invalida para o leitor PKCS12.'.PHP_EOL);

    exit(1);
}

$path = (string) ($input['path'] ?? '');
$password = (string) ($input['password'] ?? '');

if ($path === '' || !is_file($path)) {
    fwrite(STDERR, "Certificado nao encontrado em {$path}.".PHP_EOL);

    exit(1);
}

$content = file_get_contents($path);

if ($content === false) {
    fwrite(STDERR, 'Nao foi possivel ler o certificado PFX.'.PHP_EOL);

    exit(1);
}

$certs = [];

if (!openssl_pkcs12_read($content, $certs, $password)) {
    fwrite(STDERR, 'Nao foi possivel abrir o PFX com a senha informada.'.PHP_EOL);

    exit(1);
}

echo json_encode([
    'cert' => $certs['cert'] ?? null,
    'pkey' => $certs['pkey'] ?? null,
    'extracerts' => $certs['extracerts'] ?? [],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
