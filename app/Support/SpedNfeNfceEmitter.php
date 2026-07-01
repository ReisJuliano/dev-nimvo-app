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

        return $this->authorizeSignedXml(
            $tools,
            $requestXml,
            $signedXml,
            $documentModel,
            $agentConfig,
        );
    }

    public function emitLocalTest(array $payload, array $agentConfig): array
    {
        $documentModel = $this->documentModel($payload);

        if ($documentModel !== '65') {
            throw new RuntimeException('O ensaio local sem SEFAZ está disponível apenas para NFC-e modelo 65.');
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

    public function emitOfflineContingency(array $payload, array $agentConfig): array
    {
        $documentModel = $this->documentModel($payload);

        if ($documentModel !== '65') {
            throw new RuntimeException('A contingência offline legal está disponível apenas para NFC-e modelo 65.');
        }

        $tools = $this->makeTools($payload, $agentConfig, true);
        $tools->model($documentModel);

        $requestXml = $this->layoutBuilder->build($payload);
        $signedXml = $tools->signNFe($requestXml);
        $accessKey = $this->extractAccessKey($signedXml);
        $printedAt = null;

        if (($agentConfig['printer']['enabled'] ?? true) === true) {
            $this->print($signedXml, $agentConfig['printer'] ?? []);
            $printedAt = Carbon::now()->toIso8601String();
        }

        return [
            'status' => $printedAt ? 'contingency_offline_printed' : 'contingency_offline_signed',
            'document_model' => $documentModel,
            'request_xml' => $requestXml,
            'signed_xml' => $signedXml,
            'response_xml' => null,
            'authorized_xml' => null,
            'access_key' => $accessKey,
            'receipt' => null,
            'protocol' => null,
            'sefaz_status_code' => null,
            'sefaz_status_reason' => 'NFC-e emitida em contingencia offline legal e pendente de transmissao posterior.',
            'printed_at' => $printedAt,
        ];
    }

    public function transmitOfflineContingency(array $payload, array $agentConfig): array
    {
        $documentModel = $this->documentModel($payload);

        if ($documentModel !== '65') {
            throw new RuntimeException('A transmissão de contingência offline está disponível apenas para NFC-e modelo 65.');
        }

        $tools = $this->makeTools($payload, $agentConfig, true);
        $tools->model($documentModel);

        $requestXml = (string) data_get($payload, 'existing_document.request_xml', '');
        $signedXml = (string) data_get($payload, 'existing_document.signed_xml', '');
        $printedAt = data_get($payload, 'existing_document.printed_at');

        if ($requestXml === '') {
            $requestXml = $this->layoutBuilder->build($payload);
        }

        if ($signedXml === '') {
            $signedXml = $tools->signNFe($requestXml);
        }

        return $this->authorizeSignedXml(
            $tools,
            $requestXml,
            $signedXml,
            $documentModel,
            $agentConfig,
            printAfterAuthorization: false,
            printedAt: filled($printedAt) ? (string) $printedAt : null,
            successStatus: 'contingency_transmitted',
        );
    }

    public function cancel(array $payload, array $agentConfig): array
    {
        $documentModel = $this->documentModel($payload);
        $tools = $this->makeTools($payload, $agentConfig, $documentModel === '65');
        $tools->model($documentModel);

        $accessKey = (string) data_get($payload, 'cancellation.access_key', '');
        $reason = trim((string) data_get($payload, 'cancellation.reason', ''));
        $protocol = (string) data_get($payload, 'cancellation.protocol', '');
        $authorizedXml = (string) data_get($payload, 'cancellation.authorized_xml', '');

        if ($accessKey === '' || $protocol === '' || $reason === '' || $authorizedXml === '') {
            throw new RuntimeException('Os dados do cancelamento fiscal estao incompletos no comando enviado ao agente.');
        }

        $responseXml = $tools->sefazCancela($accessKey, $reason, $protocol);
        $requestXml = $tools->lastRequest;
        $response = (new Standardize($responseXml))->toStd();
        $batchStatus = (string) ($response->cStat ?? '');
        $batchReason = (string) ($response->xMotivo ?? '');
        $eventInfo = data_get($response, 'retEvento.infEvento');
        $eventStatus = (string) data_get($eventInfo, 'cStat', '');
        $eventReason = (string) data_get($eventInfo, 'xMotivo', $batchReason);
        $eventProtocol = (string) data_get($eventInfo, 'nProt', '');

        if ($batchStatus !== '128') {
            return [
                'status' => 'failed',
                'cancellation_request_xml' => $requestXml,
                'cancellation_response_xml' => $responseXml,
                'cancelled_xml' => null,
                'access_key' => $accessKey,
                'cancellation_protocol' => $eventProtocol,
                'cancellation_reason' => $reason,
                'sefaz_status_code' => $batchStatus,
                'sefaz_status_reason' => $batchReason,
                'message' => "Retorno de cancelamento inesperado [{$batchStatus}] {$batchReason}",
                'cancelled_at' => null,
            ];
        }

        if (! in_array($eventStatus, ['135', '136', '155'], true)) {
            return [
                'status' => 'rejected',
                'cancellation_request_xml' => $requestXml,
                'cancellation_response_xml' => $responseXml,
                'cancelled_xml' => null,
                'access_key' => $accessKey,
                'cancellation_protocol' => $eventProtocol,
                'cancellation_reason' => $reason,
                'sefaz_status_code' => $eventStatus,
                'sefaz_status_reason' => $eventReason,
                'message' => "Cancelamento rejeitado [{$eventStatus}] {$eventReason}",
                'cancelled_at' => null,
            ];
        }

        return [
            'status' => 'cancelled',
            'cancellation_request_xml' => $requestXml,
            'cancellation_response_xml' => $responseXml,
            'cancelled_xml' => Complements::cancelRegister($authorizedXml, $responseXml),
            'access_key' => $accessKey,
            'cancellation_protocol' => $eventProtocol,
            'cancellation_reason' => $reason,
            'sefaz_status_code' => $eventStatus,
            'sefaz_status_reason' => $eventReason,
            'cancelled_at' => Carbon::now()->toIso8601String(),
        ];
    }

    public function invalidateRange(array $payload, array $agentConfig): array
    {
        $documentModel = (string) data_get($payload, 'inutilization.document_model', '65');
        $tools = $this->makeTools($payload, $agentConfig, false);
        $tools->model($documentModel);

        $series = (int) data_get($payload, 'inutilization.series');
        $numberStart = (int) data_get($payload, 'inutilization.number_start');
        $numberEnd = (int) data_get($payload, 'inutilization.number_end');
        $justification = trim((string) data_get($payload, 'inutilization.justification', ''));
        $year = (string) data_get($payload, 'inutilization.year', now()->format('y'));

        if ($series < 1 || $numberStart < 1 || $numberEnd < $numberStart || $justification === '') {
            throw new RuntimeException('Os dados da inutilizacao fiscal estao incompletos no comando enviado ao agente.');
        }

        $responseXml = $tools->sefazInutiliza($series, $numberStart, $numberEnd, $justification, null, $year);
        $requestXml = $tools->lastRequest;
        $response = (new Standardize($responseXml))->toStd();
        $statusCode = (string) ($response->infInut->cStat ?? $response->cStat ?? '');
        $statusReason = (string) ($response->infInut->xMotivo ?? $response->xMotivo ?? '');
        $protocol = (string) ($response->infInut->nProt ?? '');

        if ($statusCode !== '102') {
            return [
                'status' => in_array($statusCode, ['204', '241', '563'], true) ? 'rejected' : 'failed',
                'request_xml' => $requestXml,
                'response_xml' => $responseXml,
                'protocol' => $protocol,
                'sefaz_status_code' => $statusCode,
                'sefaz_status_reason' => $statusReason,
                'message' => "Inutilização não concluída [{$statusCode}] {$statusReason}",
            ];
        }

        return [
            'status' => 'processed',
            'request_xml' => $requestXml,
            'response_xml' => $responseXml,
            'protocol' => $protocol,
            'sefaz_status_code' => $statusCode,
            'sefaz_status_reason' => $statusReason,
        ];
    }

    protected function print(string $xml, array $printer): void
    {
        $logoPath = (string) ($printer['logo_path'] ?? '');
        $danfce = new DanfcePos($this->connectorFactory->make($printer));

        if ($logoPath !== '' && is_file($logoPath)) {
            $danfce->logo($logoPath);
        }

        $danfce->loadNFCe($xml);
        $danfce->imprimir();
    }

    protected function authorizeSignedXml(
        Tools $tools,
        string $requestXml,
        string $signedXml,
        string $documentModel,
        array $agentConfig,
        bool $printAfterAuthorization = true,
        ?string $printedAt = null,
        string $successStatus = 'authorized',
    ): array {
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
                'A SEFAZ não retornou o protocolo do documento fiscal.',
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
                'printed_at' => $printedAt,
            ];
        }

        $authorizedXml = Complements::toAuthorize($signedXml, $responseXml);

        if ($documentModel === '65' && $printAfterAuthorization && ($agentConfig['printer']['enabled'] ?? true) === true) {
            $this->print($authorizedXml, $agentConfig['printer'] ?? []);
            $printedAt = Carbon::now()->toIso8601String();
        }

        $accessKey = $this->extractAccessKey($authorizedXml) ?: $accessKey;

        return [
            'status' => $successStatus,
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

    protected function makeTools(array $payload, array $agentConfig, bool $includeCsc): Tools
    {
        $certificatePath = (string) ($agentConfig['certificate']['path'] ?? '');
        $certificatePassword = (string) ($agentConfig['certificate']['password'] ?? '');

        if ($certificatePath === '' || $certificatePassword === '') {
            throw new RuntimeException('O caminho e a senha do certificado precisam estar configurados no agente.');
        }

        if (!is_file($certificatePath)) {
            throw new RuntimeException("Certificado não encontrado em {$certificatePath}.");
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
            throw new RuntimeException('O certificado configurado no agente não pertence ao mesmo CNPJ do emitente fiscal.');
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
