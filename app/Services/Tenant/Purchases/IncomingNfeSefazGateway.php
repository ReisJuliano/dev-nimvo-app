<?php

namespace App\Services\Tenant\Purchases;

use App\Models\Tenant\FiscalProfile;
use DOMDocument;
use DOMXPath;
use NFePHP\Common\Certificate;
use NFePHP\NFe\Tools;
use RuntimeException;

class IncomingNfeSefazGateway
{
    public function status(?FiscalProfile $profile): array
    {
        $config = $this->config();
        $hasCertificate = filled($config['certificate_path'] ?? null) && filled($config['certificate_password'] ?? null);
        $enabled = (bool) ($config['enabled'] ?? false);

        return [
            'enabled' => $enabled,
            'configured' => $enabled && $hasCertificate && $profile !== null,
            'has_certificate' => $hasCertificate,
            'recipient_document' => $profile?->cnpj,
            'recipient_name' => $profile?->company_name,
            'message' => !$enabled
                ? 'Sincronizacao SEFAZ desabilitada nas configuracoes do sistema.'
                : (!$hasCertificate
                    ? 'Informe o caminho e a senha do certificado A1 para consultar NF-e recebida.'
                    : ($profile ? 'Integracao pronta para sincronizar NF-e recebida.' : 'Ative um perfil fiscal para consultar NF-e recebida.')),
        ];
    }

    public function syncByLastNsu(FiscalProfile $profile, int $lastNsu = 0): array
    {
        $tools = $this->makeTools($profile);
        $tools->model('55');

        return $this->parseDistributionResponse(
            $tools->sefazDistDFe($lastNsu),
        );
    }

    public function downloadByAccessKey(FiscalProfile $profile, string $accessKey): array
    {
        $tools = $this->makeTools($profile);
        $tools->model('55');

        if ((bool) ($this->config()['manifest_on_download'] ?? true)) {
            $tools->sefazManifesta($accessKey, Tools::EVT_CIENCIA);
        }

        return $this->parseDistributionResponse(
            $tools->sefazDownload($accessKey),
        );
    }

    protected function makeTools(FiscalProfile $profile): Tools
    {
        $config = $this->config();
        $certificatePath = (string) ($config['certificate_path'] ?? '');
        $certificatePassword = (string) ($config['certificate_password'] ?? '');

        if (!((bool) ($config['enabled'] ?? false))) {
            throw new RuntimeException('A integracao de NF-e recebida esta desabilitada.');
        }

        if ($certificatePath === '' || $certificatePassword === '') {
            throw new RuntimeException('O certificado A1 da consulta de NF-e recebida nao foi configurado.');
        }

        if (!is_file($certificatePath)) {
            throw new RuntimeException("Certificado A1 nao encontrado em {$certificatePath}.");
        }

        $pfx = file_get_contents($certificatePath);

        if ($pfx === false) {
            throw new RuntimeException('Nao foi possivel ler o certificado configurado para NF-e recebida.');
        }

        $payload = [
            'atualizacao' => now()->format('Y-m-d H:i:s'),
            'tpAmb' => (int) ($config['environment'] ?? $profile->environment ?? 2),
            'razaosocial' => $profile->company_name,
            'siglaUF' => $profile->state,
            'cnpj' => $profile->cnpj,
            'schemes' => 'PL_009_V4',
            'versao' => '4.00',
        ];

        $certificate = Certificate::readPfx($pfx, $certificatePassword);

        return new Tools((string) json_encode($payload, JSON_UNESCAPED_UNICODE), $certificate);
    }

    protected function parseDistributionResponse(string $xml): array
    {
        $document = new DOMDocument('1.0', 'UTF-8');

        if (!$document->loadXML($xml)) {
            throw new RuntimeException('A SEFAZ retornou um XML invalido na distribuicao de documentos.');
        }

        $xpath = new DOMXPath($document);
        $statusCode = trim((string) $xpath->evaluate('string(//*[local-name()="cStat"][1])'));
        $reason = trim((string) $xpath->evaluate('string(//*[local-name()="xMotivo"][1])'));
        $documents = [];

        foreach ($xpath->query('//*[local-name()="docZip"]') as $docNode) {
            $content = trim((string) $docNode->textContent);
            $decoded = base64_decode($content, true);

            if ($decoded === false) {
                continue;
            }

            $unzipped = gzdecode($decoded);

            if ($unzipped === false) {
                continue;
            }

            $documents[] = [
                'schema' => (string) $docNode->attributes?->getNamedItem('schema')?->nodeValue,
                'nsu' => (string) $docNode->attributes?->getNamedItem('NSU')?->nodeValue,
                'xml' => $unzipped,
            ];
        }

        return [
            'status_code' => $statusCode,
            'reason' => $reason,
            'last_nsu' => trim((string) $xpath->evaluate('string(//*[local-name()="ultNSU"][1])')),
            'max_nsu' => trim((string) $xpath->evaluate('string(//*[local-name()="maxNSU"][1])')),
            'documents' => $documents,
        ];
    }

    protected function config(): array
    {
        return (array) config('services.nfe_receiving', []);
    }
}
