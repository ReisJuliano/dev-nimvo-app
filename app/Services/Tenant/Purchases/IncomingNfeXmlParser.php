<?php

namespace App\Services\Tenant\Purchases;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use RuntimeException;

class IncomingNfeXmlParser
{
    public function parse(string $xml): array
    {
        $document = $this->loadXml($xml);
        $xpath = new DOMXPath($document);
        $infNfe = $xpath->query('//*[local-name()="infNFe"]')->item(0);

        if (!$infNfe instanceof DOMElement) {
            throw new RuntimeException('O XML informado nao contem uma NF-e valida.');
        }

        $items = [];

        foreach ($xpath->query('.//*[local-name()="det"]', $infNfe) as $index => $detNode) {
            $prodNode = $xpath->query('./*[local-name()="prod"]', $detNode)->item(0);

            if (!$prodNode instanceof DOMElement) {
                continue;
            }

            $items[] = [
                'item_number' => (int) ($detNode->attributes?->getNamedItem('nItem')?->nodeValue ?: ($index + 1)),
                'supplier_code' => $this->cleanValue($this->value($xpath, './*[local-name()="cProd"]', $prodNode)),
                'barcode' => $this->normalizeBarcode(
                    $this->cleanValue($this->value($xpath, './*[local-name()="cEAN"]', $prodNode))
                        ?: $this->cleanValue($this->value($xpath, './*[local-name()="cEANTrib"]', $prodNode))
                ),
                'description' => $this->cleanValue($this->value($xpath, './*[local-name()="xProd"]', $prodNode)),
                'ncm' => $this->digits($this->value($xpath, './*[local-name()="NCM"]', $prodNode), 8),
                'cfop' => $this->digits($this->value($xpath, './*[local-name()="CFOP"]', $prodNode), 4),
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
                ],
            ];
        }

        return [
            'schema' => 'procNFe',
            'access_key' => $this->extractAccessKey($xpath, $infNfe),
            'environment' => (int) ($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="tpAmb"]', $infNfe) ?: 0),
            'number' => (int) ($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="nNF"]', $infNfe) ?: 0),
            'series' => (int) ($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="serie"]', $infNfe) ?: 0),
            'operation_nature' => $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="natOp"]', $infNfe)),
            'issued_at' => $this->parseDate($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="dhEmi"]', $infNfe) ?: $this->value($xpath, './/*[local-name()="ide"]/*[local-name()="dEmi"]', $infNfe)),
            'authorized_at' => $this->parseDate($this->value($xpath, '//*[local-name()="protNFe"]//*[local-name()="dhRecbto"]')),
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
            ],
            'totals' => [
                'products_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vProd"]', $infNfe) ?: 0), 2),
                'freight_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vFrete"]', $infNfe) ?: 0), 2),
                'invoice_total' => round((float) ($this->value($xpath, './/*[local-name()="ICMSTot"]/*[local-name()="vNF"]', $infNfe) ?: 0), 2),
            ],
            'items' => $items,
            'metadata' => [
                'model' => $this->cleanValue($this->value($xpath, './/*[local-name()="ide"]/*[local-name()="mod"]', $infNfe)),
                'xml_version' => $document->xmlVersion,
            ],
        ];
    }

    public function parseSummary(string $xml): array
    {
        $document = $this->loadXml($xml);
        $xpath = new DOMXPath($document);
        $root = $document->documentElement;

        if (!$root instanceof DOMElement || $root->localName !== 'resNFe') {
            throw new RuntimeException('O resumo recebido da NF-e nao esta no formato esperado.');
        }

        return [
            'schema' => 'resNFe',
            'access_key' => $this->digits($this->value($xpath, '//*[local-name()="chNFe"]'), 44),
            'environment' => null,
            'number' => (int) ($this->value($xpath, '//*[local-name()="nNF"]') ?: 0),
            'series' => (int) ($this->value($xpath, '//*[local-name()="serie"]') ?: 0),
            'operation_nature' => 'Resumo distribuido pela SEFAZ',
            'issued_at' => $this->parseDate($this->value($xpath, '//*[local-name()="dhEmi"]')),
            'authorized_at' => null,
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
                'invoice_total' => round((float) ($this->value($xpath, '//*[local-name()="vNF"]') ?: 0), 2),
            ],
            'items' => [],
            'metadata' => [
                'summary_only' => true,
                'situation_code' => $this->cleanValue($this->value($xpath, '//*[local-name()="cSitNFe"]')),
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

    protected function parseDate(?string $value): ?string
    {
        if (!filled($value)) {
            return null;
        }

        return Carbon::parse((string) $value)->toIso8601String();
    }
}
