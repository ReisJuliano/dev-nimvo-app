<?php

namespace App\Services\Tenant\Purchases;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use NFePHP\Common\Keys;
use NFePHP\Common\Signer;
use RuntimeException;
use Throwable;

class IncomingNfeXmlParser
{
    public function parse(string $xml): array
    {
        $document = $this->loadXml($xml);
        $xpath = new DOMXPath($document);
        $infNfe = $xpath->query('//*[local-name()="infNFe"]')->item(0);

        if (!$infNfe instanceof DOMElement) {
            throw new RuntimeException('O XML informado não cont?m uma NF-e válida.');
        }

        $accessKey = $this->extractAccessKey($xpath, $infNfe);

        if (!Keys::isValid($accessKey)) {
            throw new RuntimeException('A chave de acesso extraida do XML da NF-e e invalida.');
        }

        $protocol = $this->extractProtocol($xpath, $infNfe);
        $signature = $this->inspectSignature($xml, $document);
        $items = [];

        foreach ($xpath->query('.//*[local-name()="det"]', $infNfe) as $index => $detNode) {
            $prodNode = $xpath->query('./*[local-name()="prod"]', $detNode)->item(0);
            $impostoNode = $xpath->query('./*[local-name()="imposto"]', $detNode)->item(0);

            if (!$prodNode instanceof DOMElement) {
                continue;
            }

            $taxes = $this->extractTaxes($xpath, $impostoNode instanceof DOMElement ? $impostoNode : null);
            $items[] = [
                'item_number' => (int) ($detNode->attributes->getNamedItem('nItem')?->nodeValue ?: ($index + 1)),
                'supplier_code' => $this->cleanValue($this->value($xpath, './*[local-name()="cProd"]', $prodNode)),
                'barcode' => $this->normalizeBarcode(
                    $this->cleanValue($this->value($xpath, './*[local-name()="cEAN"]', $prodNode))
                        ?: $this->cleanValue($this->value($xpath, './*[local-name()="cEANTrib"]', $prodNode))
                ),
                'description' => $this->cleanValue($this->value($xpath, './*[local-name()="xProd"]', $prodNode)),
                'purchase_order_reference' => $this->cleanValue($this->value($xpath, './*[local-name()="xPed"]', $prodNode)),
                'purchase_order_item' => $this->nullableInteger($this->value($xpath, './*[local-name()="nItemPed"]', $prodNode)),
                'ncm' => $this->digits($this->value($xpath, './*[local-name()="NCM"]', $prodNode), 8),
                'cest' => $this->digits($this->value($xpath, './*[local-name()="CEST"]', $prodNode), 7),
                'cfop' => $this->digits($this->value($xpath, './*[local-name()="CFOP"]', $prodNode), 4),
                'origin_code' => $taxes['origin_code'],
                'icms_cst_csosn' => $taxes['icms_cst_csosn'],
                'icms_base' => $taxes['icms_base'],
                'icms_rate' => $taxes['icms_rate'],
                'icms_amount' => $taxes['icms_amount'],
                'icms_st_base' => $taxes['icms_st_base'],
                'icms_st_rate' => $taxes['icms_st_rate'],
                'icms_st_amount' => $taxes['icms_st_amount'],
                'icms_mva_rate' => $taxes['icms_mva_rate'],
                'difal_amount' => $taxes['difal_amount'],
                'fcp_st_amount' => $taxes['fcp_st_amount'],
                'ipi_cst' => $taxes['ipi_cst'],
                'ipi_base' => $taxes['ipi_base'],
                'ipi_rate' => $taxes['ipi_rate'],
                'ipi_amount' => $taxes['ipi_amount'],
                'pis_cst' => $taxes['pis_cst'],
                'pis_base' => $taxes['pis_base'],
                'pis_rate' => $taxes['pis_rate'],
                'pis_amount' => $taxes['pis_amount'],
                'cofins_cst' => $taxes['cofins_cst'],
                'cofins_base' => $taxes['cofins_base'],
                'cofins_rate' => $taxes['cofins_rate'],
                'cofins_amount' => $taxes['cofins_amount'],
                'unit' => Str::upper((string) $this->cleanValue($this->value($xpath, './*[local-name()="uCom"]', $prodNode))),
                'quantity' => round((float) ($this->value($xpath, './*[local-name()="qCom"]', $prodNode) ?: 0), 3),
                'unit_price' => round((float) ($this->value($xpath, './*[local-name()="vUnCom"]', $prodNode) ?: 0), 4),
                'total_price' => round((float) ($this->value($xpath, './*[local-name()="vProd"]', $prodNode) ?: 0), 2),
                'metadata' => [
                    'tributable_barcode' => $this->normalizeBarcode($this->cleanValue($this->value($xpath, './*[local-name()="cEANTrib"]', $prodNode))),
                    'tributable_unit' => $this->cleanValue($this->value($xpath, './*[local-name()="uTrib"]', $prodNode)),
                    'tributable_quantity' => round((float) ($this->value($xpath, './*[local-name()="qTrib"]', $prodNode) ?: 0), 3),
                    'tributable_unit_price' => round((float) ($this->value($xpath, './*[local-name()="vUnTrib"]', $prodNode) ?: 0), 4),
                    'additional_info' => $this->cleanValue($this->value($xpath, './*[local-name()="infAdProd"]', $prodNode)),
                    'tax_groups' => $taxes['groups'],
                ],
            ];
        }

        return [
            'schema' => 'procNFe',
            'access_key' => $accessKey,
            'environment' => (int) ($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="tpAmb"]', $infNfe) ?: 0),
            'document_model' => $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="mod"]', $infNfe)),
            'number' => (int) ($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="nNF"]', $infNfe) ?: 0),
            'series' => (int) ($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="serie"]', $infNfe) ?: 0),
            'operation_nature' => $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="natOp"]', $infNfe)),
            'issued_at' => $this->parseDate($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="dhEmi"]', $infNfe) ?: $this->value($xpath, './/*[local-name()="ide"]/*[local-name()="dEmi"]', $infNfe)),
            'authorized_at' => $protocol['received_at'],
            'fiscal_status' => $this->resolveProtocolFiscalStatus($protocol['status_code']),
            'sefaz_status_code' => $protocol['status_code'],
            'sefaz_status_reason' => $protocol['status_reason'],
            'sefaz_protocol' => $protocol['protocol'],
            'signature_status' => $signature['status'],
            'signature_subject' => $signature['subject'],
            'authenticity_status' => $this->resolveAuthenticityStatus($signature['status'], $protocol['status_code']),
            'supplier' => [
                'name' => $this->cleanValue($this->value($xpath, './/*[local-name()="emit"]/*[local-name()="xNome"]', $infNfe)),
                'trade_name' => $this->cleanValue($this->value($xpath, './/*[local-name()="emit"]/*[local-name()="xFant"]', $infNfe)),
                'document' => $this->normalizeDocument(
                    $this->value($xpath, './/*[local-name()="emit"]/*[local-name()="CNPJ"]', $infNfe)
                        ?: $this->value($xpath, './/*[local-name()="emit"]/*[local-name()="CPF"]', $infNfe)
                ),
                'state_registration' => $this->cleanValue($this->value($xpath, './/*[local-name()="emit"]/*[local-name()="IE"]', $infNfe)),
                'city_name' => $this->cleanValue($this->value($xpath, './/*[local-name()="emit"]//*[local-name()="xMun"]', $infNfe)),
                'state' => Str::upper((string) $this->cleanValue($this->value($xpath, './/*[local-name()="emit"]//*[local-name()="UF"]', $infNfe))),
            ],
            'recipient' => [
                'name' => $this->cleanValue($this->value($xpath, './/*[local-name()="dest"]/*[local-name()="xNome"]', $infNfe)),
                'document' => $this->normalizeDocument(
                    $this->value($xpath, './/*[local-name()="dest"]/*[local-name()="CNPJ"]', $infNfe)
                        ?: $this->value($xpath, './/*[local-name()="dest"]/*[local-name()="CPF"]', $infNfe)
                ),
                'state' => Str::upper((string) $this->cleanValue($this->value($xpath, './/*[local-name()="dest"]//*[local-name()="UF"]', $infNfe))),
                'city_name' => $this->cleanValue($this->value($xpath, './/*[local-name()="dest"]//*[local-name()="xMun"]', $infNfe)),
            ],
            'totals' => [
                'products_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vProd"]', $infNfe) ?: 0), 2),
                'freight_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vFrete"]', $infNfe) ?: 0), 2),
                'insurance_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vSeg"]', $infNfe) ?: 0), 2),
                'discount_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vDesc"]', $infNfe) ?: 0), 2),
                'other_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vOutro"]', $infNfe) ?: 0), 2),
                'invoice_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vNF"]', $infNfe) ?: 0), 2),
                'icms_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vICMS"]', $infNfe) ?: 0), 2),
                'icms_st_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vST"]', $infNfe) ?: 0), 2),
                'ipi_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vIPI"]', $infNfe) ?: 0), 2),
                'pis_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vPIS"]', $infNfe) ?: 0), 2),
                'cofins_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vCOFINS"]', $infNfe) ?: 0), 2),
            ],
            'items' => $items,
            'metadata' => [
                'model' => $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="mod"]', $infNfe)),
                'xml_version' => $document->xmlVersion,
                'key_valid' => true,
                'protocol_received_at' => $protocol['received_at'],
                'additional_info' => $this->cleanValue($this->value($xpath, './/*[local-name()="infAdic"]/*[local-name()="infAdFisco"]', $infNfe)),
                'complementary_info' => $this->cleanValue($this->value($xpath, './/*[local-name()="infAdic"]/*[local-name()="infCpl"]', $infNfe)),
                'signature_message' => $signature['message'],
            ],
        ];
    }

    public function parseSummary(string $xml): array
    {
        $document = $this->loadXml($xml);
        $xpath = new DOMXPath($document);
        $root = $document->documentElement;

        if (!$root instanceof DOMElement || $root->localName !== 'resNFe') {
            throw new RuntimeException('O resumo recebido da NF-e não está no formato esperado.');
        }

        return [
            'schema' => 'resNFe',
            'access_key' => $this->digits($this->value($xpath, '//*[local-name()="chNFe"]'), 44),
            'environment' => null,
            'document_model' => '55',
            'number' => (int) ($this->value($xpath, '//*[local-name()="nNF"]') ?: 0),
            'series' => (int) ($this->value($xpath, '//*[local-name()="serie"]') ?: 0),
            'operation_nature' => 'Resumo distribuido pela SEFAZ',
            'issued_at' => $this->parseDate($this->value($xpath, '//*[local-name()="dhEmi"]')),
            'authorized_at' => null,
            'fiscal_status' => $this->resolveSummaryFiscalStatus($this->cleanValue($this->value($xpath, '//*[local-name()="cSitNFe"]'))),
            'sefaz_status_code' => $this->cleanValue($this->value($xpath, '//*[local-name()="cSitNFe"]')),
            'sefaz_status_reason' => 'Resumo distribuido pela SEFAZ.',
            'sefaz_protocol' => null,
            'signature_status' => 'summary_unavailable',
            'signature_subject' => null,
            'authenticity_status' => 'summary_only',
            'supplier' => [
                'name' => $this->cleanValue($this->value($xpath, '//*[local-name()="xNome"]')),
                'trade_name' => null,
                'document' => $this->normalizeDocument(
                    $this->value($xpath, '//*[local-name()="CNPJ"]')
                        ?: $this->value($xpath, '//*[local-name()="CPF"]')
                ),
                'state_registration' => $this->cleanValue($this->value($xpath, '//*[local-name()="IE"]')),
                'city_name' => null,
                'state' => null,
            ],
            'recipient' => [
                'name' => null,
                'document' => null,
            ],
            'totals' => [
                'products_total' => round((float) ($this->value($xpath, '//*[local-name()="vNF"]') ?: 0), 2),
                'freight_total' => 0,
                'insurance_total' => 0,
                'discount_total' => 0,
                'other_total' => 0,
                'invoice_total' => round((float) ($this->value($xpath, '//*[local-name()="vNF"]') ?: 0), 2),
                'icms_total' => 0,
                'icms_st_total' => 0,
                'ipi_total' => 0,
                'pis_total' => 0,
                'cofins_total' => 0,
            ],
            'items' => [],
            'metadata' => [
                'summary_only' => true,
                'situation_code' => $this->cleanValue($this->value($xpath, '//*[local-name()="cSitNFe"]')),
                'key_valid' => true,
            ],
        ];
    }

    protected function loadXml(string $xml): DOMDocument
    {
        $document = new DOMDocument('1.0', 'UTF-8');
        $document->preserveWhiteSpace = false;

        if (!$document->loadXML(trim($xml))) {
            throw new RuntimeException('Nao foi possivel ler o XML da NF-e.');
        }

        return $document;
    }

    protected function extractAccessKey(DOMXPath $xpath, DOMElement $infNfe): string
    {
        $id = $infNfe->getAttribute('Id');

        if (Str::startsWith($id, 'NFe')) {
            return substr($id, 3);
        }

        return $this->digits($this->value($xpath, '//*[local-name()="chNFe"]'), 44)
            ?? throw new RuntimeException('Nao foi possivel identificar a chave de acesso da NF-e.');
    }

    protected function extractProtocol(DOMXPath $xpath, DOMElement $infNfe): array
    {
        $statusCode = $this->cleanValue($this->value($xpath, '//*[local-name()="protNFe"]//*[local-name()="cStat"]'));
        $statusReason = $this->cleanValue($this->value($xpath, '//*[local-name()="protNFe"]//*[local-name()="xMotivo"]'));
        $protocol = $this->cleanValue($this->value($xpath, '//*[local-name()="protNFe"]//*[local-name()="nProt"]'));
        $receivedAt = $this->parseDate($this->value($xpath, '//*[local-name()="protNFe"]//*[local-name()="dhRecbto"]'));

        if (!$statusCode) {
            $statusCode = $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="cStat"]', $infNfe));
            $statusReason = $statusReason ?: $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="xMotivo"]', $infNfe));
        }

        return [
            'status_code' => $statusCode,
            'status_reason' => $statusReason,
            'protocol' => $protocol,
            'received_at' => $receivedAt,
        ];
    }

    protected function inspectSignature(string $xml, DOMDocument $document): array
    {
        $signatureNode = $document->getElementsByTagName('Signature')->item(0);

        if (!$signatureNode instanceof DOMElement) {
            return [
                'status' => 'missing',
                'subject' => null,
                'message' => 'XML sem assinatura digital embutida.',
            ];
        }

        try {
            Signer::isSigned($xml);

            return [
                'status' => 'valid',
                'subject' => $this->extractCertificateSubject($signatureNode),
                'message' => 'Assinatura digital validada localmente.',
            ];
        } catch (Throwable $exception) {
            return [
                'status' => 'invalid',
                'subject' => $this->extractCertificateSubject($signatureNode),
                'message' => $exception->getMessage(),
            ];
        }
    }

    protected function extractCertificateSubject(DOMElement $signatureNode): ?string
    {
        $certificateContent = $signatureNode->getElementsByTagName('X509Certificate')->item(0)?->nodeValue;
        $normalized = trim((string) $certificateContent);

        if ($normalized === '') {
            return null;
        }

        $pem = "-----BEGIN CERTIFICATE-----\n"
            . chunk_split(str_replace(["\r", "\n"], '', $normalized), 64, "\n")
            . "-----END CERTIFICATE-----\n";
        $parsed = openssl_x509_parse($pem, false);

        if (!is_array($parsed)) {
            return null;
        }

        $subject = $parsed['subject'] ?? [];
        $name = $subject['CN'] ?? $subject['O'] ?? null;

        if (!is_string($name) || trim($name) === '') {
            return null;
        }

        return trim($name);
    }

    protected function value(DOMXPath $xpath, string $expression, ?DOMElement $context = null): ?string
    {
        $nodes = $xpath->query($expression, $context);
        $value = $nodes?->item(0)?->textContent;

        return $this->cleanValue($value);
    }

    protected function cleanValue(?string $value): ?string
    {
        $clean = trim((string) $value);

        return $clean === '' ? null : $clean;
    }

    protected function digits(?string $value, int $length): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $value);

        if ($digits === '') {
            return null;
        }

        return strlen($digits) > $length
            ? substr($digits, 0, $length)
            : $digits;
    }

    protected function normalizeDocument(?string $value): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $value);

        return $digits === '' ? null : $digits;
    }

    protected function normalizeBarcode(?string $value): ?string
    {
        $normalized = $this->cleanValue($value);

        if (!$normalized || in_array(Str::upper($normalized), ['SEM GTIN', 'NO GTIN'], true)) {
            return null;
        }

        return preg_replace('/\s+/', '', $normalized);
    }

    protected function nullableInteger(?string $value): ?int
    {
        $value = $this->cleanValue($value);

        return $value === null ? null : (int) $value;
    }

    protected function parseDate(?string $value): ?string
    {
        if (!filled($value)) {
            return null;
        }

        return Carbon::parse((string) $value)->toIso8601String();
    }

    protected function decimal(?string $value, int $precision = 2): ?float
    {
        $value = $this->cleanValue($value);

        if ($value === null) {
            return null;
        }

        return round((float) $value, $precision);
    }

    protected function extractTaxes(DOMXPath $xpath, ?DOMElement $impostoNode): array
    {
        $empty = [
            'origin_code' => null,
            'icms_cst_csosn' => null,
            'icms_base' => null,
            'icms_rate' => null,
            'icms_amount' => null,
            'icms_st_base' => null,
            'icms_st_rate' => null,
            'icms_st_amount' => null,
            'icms_mva_rate' => null,
            'difal_amount' => null,
            'fcp_st_amount' => null,
            'ipi_cst' => null,
            'ipi_base' => null,
            'ipi_rate' => null,
            'ipi_amount' => null,
            'pis_cst' => null,
            'pis_base' => null,
            'pis_rate' => null,
            'pis_amount' => null,
            'cofins_cst' => null,
            'cofins_base' => null,
            'cofins_rate' => null,
            'cofins_amount' => null,
            'groups' => [],
        ];

        if (!$impostoNode instanceof DOMElement) {
            return $empty;
        }

        $icmsParent = $xpath->query('./*[local-name()="ICMS"]', $impostoNode)->item(0);
        $ipiParent = $xpath->query('./*[local-name()="IPI"]', $impostoNode)->item(0);
        $pisParent = $xpath->query('./*[local-name()="PIS"]', $impostoNode)->item(0);
        $cofinsParent = $xpath->query('./*[local-name()="COFINS"]', $impostoNode)->item(0);
        $icmsUFDestNode = $xpath->query('./*[local-name()="ICMSUFDest"]', $impostoNode)->item(0);

        $icmsNode = $this->firstElementChild($icmsParent instanceof DOMElement ? $icmsParent : null);
        $ipiNode = $this->firstElementChild($ipiParent instanceof DOMElement ? $ipiParent : null);
        $pisNode = $this->firstElementChild($pisParent instanceof DOMElement ? $pisParent : null);
        $cofinsNode = $this->firstElementChild($cofinsParent instanceof DOMElement ? $cofinsParent : null);

        return [
            'origin_code' => $this->cleanValue($this->value($xpath, './*[local-name()="orig"]', $icmsNode)),
            'icms_cst_csosn' => $this->cleanValue(
                $this->value($xpath, './*[local-name()="CST"]', $icmsNode)
                    ?: $this->value($xpath, './*[local-name()="CSOSN"]', $icmsNode)
            ),
            'icms_base' => $this->decimal($this->value($xpath, './*[local-name()="vBC"]', $icmsNode)),
            'icms_rate' => $this->decimal($this->value($xpath, './*[local-name()="pICMS"]', $icmsNode), 4),
            'icms_amount' => $this->decimal($this->value($xpath, './*[local-name()="vICMS"]', $icmsNode)),
            'icms_st_base' => $this->decimal(
                $this->value($xpath, './*[local-name()="vBCST"]', $icmsNode)
                    ?: $this->value($xpath, './*[local-name()="vBCSTRet"]', $icmsNode)
            ),
            'icms_st_rate' => $this->decimal($this->value($xpath, './*[local-name()="pICMSST"]', $icmsNode), 4),
            'icms_st_amount' => $this->decimal(
                $this->value($xpath, './*[local-name()="vICMSST"]', $icmsNode)
                    ?: $this->value($xpath, './*[local-name()="vICMSSTRet"]', $icmsNode)
            ),
            'icms_mva_rate' => $this->decimal($this->value($xpath, './*[local-name()="pMVAST"]', $icmsNode), 4),
            'difal_amount' => $this->decimal($this->value($xpath, './*[local-name()="vICMSUFDest"]', $icmsUFDestNode instanceof DOMElement ? $icmsUFDestNode : null)),
            'fcp_st_amount' => $this->decimal(
                $this->value($xpath, './*[local-name()="vFCPST"]', $icmsNode)
                    ?: $this->value($xpath, './*[local-name()="vFCPSTRet"]', $icmsNode)
                    ?: $this->value($xpath, './*[local-name()="vFCPUFDest"]', $icmsUFDestNode instanceof DOMElement ? $icmsUFDestNode : null)
            ),
            'ipi_cst' => $this->cleanValue($this->value($xpath, './*[local-name()="CST"]', $ipiNode)),
            'ipi_base' => $this->decimal($this->value($xpath, './*[local-name()="vBC"]', $ipiNode)),
            'ipi_rate' => $this->decimal(
                $this->value($xpath, './*[local-name()="pIPI"]', $ipiNode)
                    ?: $this->value($xpath, './*[local-name()="vAliqProd"]', $ipiNode),
                4
            ),
            'ipi_amount' => $this->decimal($this->value($xpath, './*[local-name()="vIPI"]', $ipiNode)),
            'pis_cst' => $this->cleanValue($this->value($xpath, './*[local-name()="CST"]', $pisNode)),
            'pis_base' => $this->decimal(
                $this->value($xpath, './*[local-name()="vBC"]', $pisNode)
                    ?: $this->value($xpath, './*[local-name()="qBCProd"]', $pisNode)
            ),
            'pis_rate' => $this->decimal(
                $this->value($xpath, './*[local-name()="pPIS"]', $pisNode)
                    ?: $this->value($xpath, './*[local-name()="vAliqProd"]', $pisNode),
                4
            ),
            'pis_amount' => $this->decimal($this->value($xpath, './*[local-name()="vPIS"]', $pisNode)),
            'cofins_cst' => $this->cleanValue($this->value($xpath, './*[local-name()="CST"]', $cofinsNode)),
            'cofins_base' => $this->decimal(
                $this->value($xpath, './*[local-name()="vBC"]', $cofinsNode)
                    ?: $this->value($xpath, './*[local-name()="qBCProd"]', $cofinsNode)
            ),
            'cofins_rate' => $this->decimal(
                $this->value($xpath, './*[local-name()="pCOFINS"]', $cofinsNode)
                    ?: $this->value($xpath, './*[local-name()="vAliqProd"]', $cofinsNode),
                4
            ),
            'cofins_amount' => $this->decimal($this->value($xpath, './*[local-name()="vCOFINS"]', $cofinsNode)),
            'groups' => array_filter([
                'icms' => $icmsNode?->localName,
                'ipi' => $ipiNode?->localName,
                'pis' => $pisNode?->localName,
                'cofins' => $cofinsNode?->localName,
                'difal' => $icmsUFDestNode instanceof DOMElement ? $icmsUFDestNode->localName : null,
            ]),
        ];
    }

    protected function firstElementChild(?DOMElement $parent): ?DOMElement
    {
        if (!$parent instanceof DOMElement) {
            return null;
        }

        foreach ($parent->childNodes as $child) {
            if ($child instanceof DOMElement) {
                return $child;
            }
        }

        return null;
    }

    protected function resolveProtocolFiscalStatus(?string $statusCode): string
    {
        return match ($statusCode) {
            '100', '150' => 'authorized',
            '101', '151', '155' => 'cancelled',
            '110', '301', '302', '303' => 'denied',
            '204' => 'duplicate',
            default => 'pending_review',
        };
    }

    protected function resolveSummaryFiscalStatus(?string $statusCode): string
    {
        return match ($statusCode) {
            '1', '100', '150' => 'authorized',
            '2', '101', '151', '155' => 'cancelled',
            '3', '110', '301', '302', '303' => 'denied',
            default => 'summary_only',
        };
    }

    protected function resolveAuthenticityStatus(string $signatureStatus, ?string $statusCode): string
    {
        if ($signatureStatus === 'invalid') {
            return 'invalid_signature';
        }

        if ($signatureStatus === 'missing') {
            return 'missing_signature';
        }

        return in_array($statusCode, ['100', '150', '101', '151', '155', '110', '301', '302', '303'], true)
            ? 'locally_verified'
            : 'pending_sefaz';
    }
}
