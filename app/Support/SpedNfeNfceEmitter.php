<?php

namespace App\Support;

use DOMDocument;
use Illuminate\Support\Carbon;
use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use Mike42\Escpos\PrintConnectors\WindowsPrintConnector;
use NFePHP\Common\Certificate;
use NFePHP\NFe\Common\Standardize;
use NFePHP\NFe\Complements;
use NFePHP\NFe\Tools;
use NFePHP\POS\DanfcePos;
use RuntimeException;

class SpedNfeNfceEmitter
{
    public function __construct(
        protected NfceLayoutBuilder $layoutBuilder,
        protected ThermalSaleReceiptPrinter $thermalReceiptPrinter,
    ) {
    }

    public function emit(array $payload, array $agentConfig): array
    {
        $tools = $this->makeTools($payload, $agentConfig, true);
        $tools->model('65');

        $requestXml = $this->layoutBuilder->build($payload);
        $signedXml = $tools->signNFe($requestXml);
        $responseXml = $tools->sefazEnviaLote(
            [$signedXml],
            str_pad((string) random_int(1, 999999999999999), 15, '0', STR_PAD_LEFT),
            1,
        );

        $response = (new Standardize($responseXml))->toStd();
        $statusCode = (string) ($response->cStat ?? '');
        $statusReason = (string) ($response->xMotivo ?? '');

        if ($statusCode !== '104') {
            throw new RuntimeException("Retorno da SEFAZ inesperado [{$statusCode}] {$statusReason}");
        }

        $protocolInfo = $response->protNFe->infProt ?? null;

        if (!$protocolInfo) {
            throw new RuntimeException('A SEFAZ nao retornou o protocolo da NFC-e.');
        }

        $protocolStatus = (string) ($protocolInfo->cStat ?? '');
        $protocolReason = (string) ($protocolInfo->xMotivo ?? '');

        if (!in_array($protocolStatus, ['100', '150'], true)) {
            throw new RuntimeException("NFC-e rejeitada [{$protocolStatus}] {$protocolReason}");
        }

        $authorizedXml = Complements::toAuthorize($signedXml, $responseXml);
        $printedAt = null;

        if (($agentConfig['printer']['enabled'] ?? true) === true) {
            $this->print($authorizedXml, $agentConfig['printer'] ?? []);
            $printedAt = Carbon::now()->toIso8601String();
        }

        $accessKey = $this->extractAccessKey($authorizedXml);

        return [
            'status' => 'authorized',
            'request_xml' => $requestXml,
            'signed_xml' => $signedXml,
            'response_xml' => $responseXml,
            'authorized_xml' => $authorizedXml,
            'access_key' => $accessKey,
            'receipt' => (string) ($response->infRec->nRec ?? ''),
            'protocol' => (string) ($protocolInfo->nProt ?? ''),
            'sefaz_status_code' => $protocolStatus,
            'sefaz_status_reason' => $protocolReason,
            'printed_at' => $printedAt,
        ];
    }

    public function emitLocalTest(array $payload, array $agentConfig): array
    {
        $tools = $this->makeTools($payload, $agentConfig, false);
        $tools->model('65');

        $requestXml = $this->layoutBuilder->build($payload);
        $signedXml = $tools->signNFe($requestXml);
        $accessKey = $this->extractAccessKey($signedXml);
        $printedAt = null;

        if (($agentConfig['printer']['enabled'] ?? true) === true) {
            $this->thermalReceiptPrinter->print($payload, $agentConfig['printer'] ?? [], $accessKey);
            $printedAt = Carbon::now()->toIso8601String();
        }

        return [
            'status' => 'local_test',
            'request_xml' => $requestXml,
            'signed_xml' => $signedXml,
            'response_xml' => null,
            'authorized_xml' => null,
            'access_key' => $accessKey,
            'receipt' => null,
            'protocol' => null,
            'sefaz_status_code' => null,
            'sefaz_status_reason' => 'Ensaio local sem transmissao para a SEFAZ.',
            'printed_at' => $printedAt,
        ];
    }

    protected function print(string $authorizedXml, array $printer): void
    {
        $connectorType = strtolower((string) ($printer['connector'] ?? 'windows'));
        $logoPath = (string) ($printer['logo_path'] ?? '');

        $connector = match ($connectorType) {
            'network' => new NetworkPrintConnector(
                (string) ($printer['host'] ?? '127.0.0.1'),
                (int) ($printer['port'] ?? 9100),
            ),
            default => new WindowsPrintConnector((string) ($printer['name'] ?? '')),
        };

        $danfce = new DanfcePos($connector);

        if ($logoPath !== '' && is_file($logoPath)) {
            $danfce->logo($logoPath);
        }

        $danfce->loadNFCe($authorizedXml);
        $danfce->imprimir();
    }

    protected function makeTools(array $payload, array $agentConfig, bool $includeCsc): Tools
    {
        $certificatePath = (string) ($agentConfig['certificate']['path'] ?? '');
        $certificatePassword = (string) ($agentConfig['certificate']['password'] ?? '');

        if ($certificatePath === '' || $certificatePassword === '') {
            throw new RuntimeException('O caminho e a senha do certificado precisam estar configurados no agente.');
        }

        if (!is_file($certificatePath)) {
            throw new RuntimeException("Certificado nao encontrado em {$certificatePath}.");
        }

        $pfx = file_get_contents($certificatePath);

        if ($pfx === false) {
            throw new RuntimeException('Nao foi possivel ler o certificado PFX.');
        }

        $config = [
            'atualizacao' => now()->format('Y-m-d H:i:s'),
            'tpAmb' => (int) $payload['profile']['environment'],
            'razaosocial' => $payload['profile']['company_name'],
            'siglaUF' => $payload['profile']['state'],
            'cnpj' => $payload['profile']['cnpj'],
            'schemes' => 'PL_009_V4',
            'versao' => '4.00',
        ];

        if ($includeCsc) {
            $config['CSC'] = $payload['profile']['csc_token'] ?? null;
            $config['CSCid'] = $payload['profile']['csc_id'] ?? null;
        }

        $configJson = json_encode($config, JSON_THROW_ON_ERROR);
        $certificate = Certificate::readPfx($pfx, $certificatePassword);

        return new Tools($configJson, $certificate);
    }

    protected function extractAccessKey(string $xml): ?string
    {
        $document = new DOMDocument('1.0', 'UTF-8');
        $document->loadXML($xml);
        $infNFe = $document->getElementsByTagName('infNFe')->item(0);
        $accessKey = $infNFe?->getAttribute('Id');

        return $accessKey ? substr($accessKey, 3) : null;
    }
}
