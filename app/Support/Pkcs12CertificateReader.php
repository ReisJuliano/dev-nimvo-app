<?php

namespace App\Support;

use NFePHP\Common\Certificate;
use NFePHP\Common\Certificate\CertificationChain;
use NFePHP\Common\Certificate\PrivateKey;
use NFePHP\Common\Certificate\PublicKey;
use RuntimeException;

class Pkcs12CertificateReader
{
    public function readCertificate(string $path, string $password): Certificate
    {
        if (!is_file($path)) {
            throw new RuntimeException("Certificado nao encontrado em {$path}.");
        }

        $certs = $this->requiresLegacySubprocess()
            ? $this->readWithLegacySubprocess($path, $password)
            : $this->readDirectly($path, $password);

        return $this->makeCertificate($certs);
    }

    public function inspect(string $path, string $password): array
    {
        $certificate = $this->readCertificate($path, $password);
        $parsed = openssl_x509_parse((string) $certificate->publicKey, false);

        if (!is_array($parsed)) {
            throw new RuntimeException('Nao foi possivel interpretar o certificado lido.');
        }

        return [
            'subject' => $parsed['subject'] ?? [],
            'issuer' => $parsed['issuer'] ?? [],
            'valid_from' => $certificate->getValidFrom()?->format('Y-m-d H:i:s'),
            'valid_to' => $certificate->getValidTo()?->format('Y-m-d H:i:s'),
            'company_name' => $certificate->getCompanyName(),
            'cnpj' => $certificate->getCnpj(),
        ];
    }

    protected function readDirectly(string $path, string $password): array
    {
        $content = file_get_contents($path);

        if ($content === false) {
            throw new RuntimeException('Nao foi possivel ler o certificado PFX.');
        }

        $certs = [];

        if (!openssl_pkcs12_read($content, $certs, $password)) {
            throw new RuntimeException('Nao foi possivel abrir o PFX com a senha informada.');
        }

        return $certs;
    }

    protected function readWithLegacySubprocess(string $path, string $password): array
    {
        $phpBinary = $this->resolvePhpBinary();
        $readerScript = base_path('bootstrap/ssl/read-pkcs12.php');

        if (!is_file($readerScript)) {
            throw new RuntimeException('Leitor auxiliar de certificado nao encontrado.');
        }

        $environment = is_array(getenv()) ? getenv() : [];
        $environment['OPENSSL_CONF'] = base_path('bootstrap/ssl/openssl-legacy.cnf');
        $environment['OPENSSL_MODULES'] = $this->resolveModulesPath() ?: '';

        $command = escapeshellarg($phpBinary).' '.escapeshellarg($readerScript);
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($command, $descriptors, $pipes, base_path(), $environment);

        if (!is_resource($process)) {
            throw new RuntimeException('Nao foi possivel iniciar o leitor auxiliar do certificado.');
        }

        fwrite($pipes[0], json_encode([
            'path' => $path,
            'password' => $password,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fclose($pipes[0]);

        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);

        $error = trim((string) stream_get_contents($pipes[2]));
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        if ($exitCode !== 0 || $output === false) {
            throw new RuntimeException($error !== '' ? $error : 'Nao foi possivel ler o certificado PFX.');
        }

        $decoded = json_decode($output, true);

        if (!is_array($decoded) || empty($decoded['cert']) || empty($decoded['pkey'])) {
            throw new RuntimeException('O leitor auxiliar retornou um certificado invalido.');
        }

        return $decoded;
    }

    protected function makeCertificate(array $certs): Certificate
    {
        $chain = '';

        foreach (($certs['extracerts'] ?? []) as $extraCertificate) {
            $chain .= $extraCertificate;
        }

        return new Certificate(
            new PrivateKey($certs['pkey']),
            new PublicKey($certs['cert']),
            new CertificationChain($chain),
        );
    }

    protected function requiresLegacySubprocess(): bool
    {
        return defined('OPENSSL_VERSION_TEXT')
            && str_contains((string) OPENSSL_VERSION_TEXT, 'OpenSSL 3')
            && is_file(base_path('bootstrap/ssl/openssl-legacy.cnf'))
            && $this->resolveModulesPath() !== null;
    }

    protected function resolveModulesPath(): ?string
    {
        $candidates = array_filter([
            getenv('OPENSSL_MODULES') ?: null,
            $this->phpRoot().DIRECTORY_SEPARATOR.'extras'.DIRECTORY_SEPARATOR.'ssl',
            $this->phpRoot().DIRECTORY_SEPARATOR.'lib'.DIRECTORY_SEPARATOR.'ossl-modules',
            $this->phpRoot().DIRECTORY_SEPARATOR.'ossl-modules',
        ]);

        foreach ($candidates as $candidate) {
            if (!is_dir($candidate)) {
                continue;
            }

            foreach (['legacy.dll', 'legacy.so', 'legacy.dylib'] as $module) {
                if (is_file($candidate.DIRECTORY_SEPARATOR.$module)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    protected function phpRoot(): string
    {
        $iniPath = php_ini_loaded_file();

        if (is_string($iniPath) && $iniPath !== '') {
            return dirname($iniPath);
        }

        return dirname(PHP_BINARY);
    }

    protected function resolvePhpBinary(): string
    {
        $candidates = array_filter([
            PHP_BINARY,
            PHP_BINDIR.DIRECTORY_SEPARATOR.'php'.(PHP_OS_FAMILY === 'Windows' ? '.exe' : ''),
        ]);

        foreach ($candidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('php.exe nao encontrado para ler o certificado em subprocesso.');
    }
}
