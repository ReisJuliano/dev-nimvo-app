<?php

namespace App\Support;

use DOMDocument;
use Illuminate\Support\Carbon;
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
        protected Pkcs12CertificateReader $certificateReader,
        protected EscposConnectorFactory $connectorFactory,
    ) {
    }

    public function emit(array $payload, array $agentConfig): array
    {
        $documentModel = $this->documentModel($payload);
        $tools = $this->makeTools($payload, $agentConfig, $documentModel === '65');
        $tools->model($documentModel);

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
            return $this->failedResult(
                $requestXml,
                $signedXml,
                $responseXml,
                $this->extractAccessKey($signedXml),
                $statusCode,
                $statusReason,
                "Retorno da SEFAZ inesperado [{$statusCode}] {$statusReason}",
            );
        }

        $protocolInfo = $response->protNFe->infProt ?? null;

        if (! $protocolInfo) {
            return $this->failedResult(
                $requestXml,
                $signedXml,
                $responseXml,
                $this->extractAccessKey($signedXml),
                $statusCode,
                $statusReason,
                'A SEFAZ nao retornou o protocolo do documento fiscal.',
            );
        }

        $protocolStatus = (string) ($protocolInfo->cStat ?? '');
        $protocolReason = (string) ($protocolInfo->xMotivo ?? '');
        $accessKey = $this->extractAccessKey($signedXml);

        if (! in_array($protocolStatus, ['100', '150'], true)) {
            return [
                'status' => 'rejected',
                'request_xml' => $requestXml,
                'signed_xml' => $signedXml,
                'response_xml' => $responseXml,
                'authorized_xml' => null,
                'access_key' => $accessKey,
                'receipt' => (string) ($response->infRec->nRec ?? ''),
                'protocol' => (string) ($protocolInfo->nProt ?? ''),
                'sefaz_status_code' => $protocolStatus,
                'sefaz_status_reason' => $protocolReason,
                'message' => "Documento fiscal rejeitado [{$protocolStatus}] {$protocolReason}",
                'printed_at' => null,
            ];
        }

        $authorizedXml = Complements::toAuthorize($signedXml, $responseXml);
        $printedAt = null;

        if ($documentModel === '65' && ($agentConfig['printer']['enabled'] ?? true) === true) {
            $this->print($authorizedXml, $agentConfig['printer'] ?? []);
            $printedAt = Carbon::now()->toIso8601String();
        }

        $accessKey = $this->extractAccessKey($authorizedXml) ?: $accessKey;

        return [
            'status' => 'authorized',
            'document_model' => $documentModel,
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
        $documentModel = $this->documentModel($payload);

        if ($documentModel !== '65') {
            throw new RuntimeException('O ensaio local sem SEFAZ esta disponivel apenas para NFC-e modelo 65.');
        }

        $tools = $this->makeTools($payload, $agentConfig, false);
        $tools->model($documentModel);

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
        $logoPath = (string) ($printer['logo_path'] ?? '');
        $danfce = new DanfcePos($this->connectorFactory->make($printer));

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
        $certificate = $this->certificateReader->readCertificate($certificatePath, $certificatePassword);

        if ($certificate->getCnpj() !== ($payload['profile']['cnpj'] ?? null)) {
            throw new RuntimeException('O certificado configurado no agente nao pertence ao mesmo CNPJ do emitente fiscal.');
        }

        return new Tools($configJson, $certificate);
    }

    protected function documentModel(array $payload): string
    {
        return (string) ($payload['flags']['document_model'] ?? ($payload['sale']['requested_document_model'] ?? '65'));
    }

    protected function failedResult(
        string $requestXml,
        string $signedXml,
        ?string $responseXml,
        ?string $accessKey,
        ?string $statusCode,
        ?string $statusReason,
        string $message,
    ): array {
        return [
            'status' => 'failed',
            'request_xml' => $requestXml,
            'signed_xml' => $signedXml,
            'response_xml' => $responseXml,
            'authorized_xml' => null,
            'access_key' => $accessKey,
            'receipt' => null,
            'protocol' => null,
            'sefaz_status_code' => $statusCode,
            'sefaz_status_reason' => $statusReason,
            'message' => $message,
            'printed_at' => null,
        ];
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
