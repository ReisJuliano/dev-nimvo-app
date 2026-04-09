<?php

namespace App\Support;

use NFePHP\NFe\Make;
use RuntimeException;
use stdClass;

class NfceLayoutBuilder
{
    public function build(array $payload): string
    {
        $profile = $payload['profile'] ?? [];
        $sale = $payload['sale'] ?? [];
        $items = $payload['items'] ?? [];
        $payments = $payload['payments'] ?? [];
        $consumer = $payload['consumer'] ?? [];
        $documentModel = (string) ($payload['flags']['document_model'] ?? ($sale['requested_document_model'] ?? '65'));

        if ($items === []) {
            throw new RuntimeException('Nao existem itens fiscais para montar o documento.');
        }

        if ($payments === []) {
            throw new RuntimeException('Nao existem pagamentos fiscais para montar o documento.');
        }

        $make = new Make();

        $make->taginfNFe($this->std([
            'versao' => '4.00',
        ]));

        $make->tagide($this->std([
            'cUF' => $this->ufCode((string) $profile['state']),
            'cNF' => $sale['random_code'],
            'natOp' => $profile['operation_nature'],
            'mod' => $documentModel,
            'serie' => (string) $sale['series'],
            'nNF' => (string) $sale['number'],
            'dhEmi' => $sale['issued_at'],
            'dhCont' => (int) ($sale['emission_type'] ?? 1) === 9 ? ($sale['dh_contingency'] ?? $sale['issued_at']) : null,
            'xJust' => (int) ($sale['emission_type'] ?? 1) === 9 ? ($sale['contingency_reason'] ?? null) : null,
            'tpNF' => 1,
            'idDest' => (int) ($sale['id_destination'] ?? 1),
            'cMunFG' => $profile['city_code'],
            'tpImp' => (int) ($sale['print_type'] ?? ($documentModel === '65' ? 4 : 1)),
            'tpEmis' => (int) ($sale['emission_type'] ?? 1),
            'cDV' => 0,
            'tpAmb' => (int) $profile['environment'],
            'finNFe' => 1,
            'indFinal' => (int) ($sale['consumer_final'] ?? 1),
            'indPres' => (int) ($sale['presence_indicator'] ?? 1),
            'procEmi' => 0,
            'verProc' => config('app.name', 'nimvo').'-fiscal',
        ]));

        $make->tagemit($this->std([
            'xNome' => $profile['company_name'],
            'xFant' => $profile['trade_name'] ?: $profile['company_name'],
            'IE' => $profile['ie'],
            'IM' => $profile['im'] ?: null,
            'CNAE' => $profile['cnae'] ?: null,
            'CRT' => (int) $profile['crt'],
            'CNPJ' => $profile['cnpj'],
        ]));

        $make->tagenderEmit($this->std([
            'xLgr' => $profile['street'],
            'nro' => $profile['number'],
            'xCpl' => $profile['complement'] ?: null,
            'xBairro' => $profile['district'],
            'cMun' => $profile['city_code'],
            'xMun' => $profile['city_name'],
            'UF' => $profile['state'],
            'CEP' => $profile['zip_code'],
            'cPais' => '1058',
            'xPais' => 'BRASIL',
            'fone' => $profile['phone'] ?: null,
        ]));

        if (($consumer['document'] ?? null) && ($consumer['name'] ?? null)) {
            $make->tagdest($this->std([
                'xNome' => $consumer['name'],
                'indIEDest' => (int) ($consumer['ie_indicator'] ?? 9),
                'IE' => $consumer['state_registration'] ?? null,
                'email' => $consumer['email'] ?? null,
                strlen((string) $consumer['document']) > 11 ? 'CNPJ' : 'CPF' => $consumer['document'],
            ]));

            if ($documentModel === '55') {
                $make->tagenderDest($this->std([
                    'xLgr' => $consumer['street'],
                    'nro' => $consumer['number'],
                    'xCpl' => $consumer['complement'] ?? null,
                    'xBairro' => $consumer['district'],
                    'cMun' => $consumer['city_code'],
                    'xMun' => $consumer['city_name'],
                    'UF' => $consumer['state'],
                    'CEP' => $consumer['zip_code'],
                    'cPais' => '1058',
                    'xPais' => 'BRASIL',
                    'fone' => $consumer['phone'] ?? null,
                ]));
            }
        } elseif ($documentModel === '55') {
            throw new RuntimeException('A NF-e precisa de destinatario identificado para gerar o XML.');
        }

        $totals = [
            'vProd' => 0.0,
            'vDesc' => 0.0,
            'vPIS' => 0.0,
            'vCOFINS' => 0.0,
            'vIPI' => 0.0,
            'vTotTrib' => 0.0,
        ];

        foreach ($items as $index => $item) {
            $line = $index + 1;
            $lineSubtotal = (float) ($item['line_subtotal'] ?? $item['total'] ?? 0);
            $lineDiscount = (float) ($item['discount_amount'] ?? 0);
            $lineTotal = (float) ($item['total'] ?? 0);
            $pisBase = (float) ($item['pis_base'] ?? $lineTotal);
            $pisAmount = (float) ($item['pis_amount'] ?? 0);
            $cofinsBase = (float) ($item['cofins_base'] ?? $lineTotal);
            $cofinsAmount = (float) ($item['cofins_amount'] ?? 0);

            $totals['vProd'] += $lineSubtotal;
            $totals['vDesc'] += $lineDiscount;
            $totals['vPIS'] += $pisAmount;
            $totals['vCOFINS'] += $cofinsAmount;
            $totals['vIPI'] += (float) ($item['ipi_amount'] ?? 0);
            $totals['vTotTrib'] += (float) ($item['tax_total'] ?? 0);

            $make->tagprod($this->std([
                'item' => $line,
                'cProd' => $item['code'],
                'cEAN' => $item['barcode'] ?: 'SEM GTIN',
                'xProd' => $item['name'],
                'NCM' => $item['ncm'],
                'CEST' => $item['cest'] ?: null,
                'CFOP' => $item['cfop'],
                'uCom' => $item['commercial_unit'] ?: $item['unit'],
                'qCom' => $this->decimal($item['quantity'], 3),
                'vUnCom' => $this->decimal($item['unit_price'], 10),
                'vProd' => $this->decimal($lineSubtotal),
                'vDesc' => $lineDiscount > 0 ? $this->decimal($lineDiscount) : null,
                'cEANTrib' => $item['barcode'] ?: 'SEM GTIN',
                'uTrib' => $item['taxable_unit'] ?: $item['unit'],
                'qTrib' => $this->decimal($item['quantity'], 3),
                'vUnTrib' => $this->decimal($item['unit_price'], 10),
                'indTot' => 1,
            ]));

            $make->tagimposto($this->std([
                'item' => $line,
                'vTotTrib' => $this->decimal($item['tax_total'] ?? 0),
            ]));

            $make->tagICMSSN($this->std([
                'item' => $line,
                'orig' => (string) $item['origin_code'],
                'CSOSN' => (string) $item['icms_csosn'],
            ]));

            $make->tagPIS($this->std([
                'item' => $line,
                'CST' => (string) $item['pis_cst'],
                'vBC' => $this->decimal($pisBase),
                'pPIS' => $this->decimal($item['pis_rate'] ?? 0, 4),
                'vPIS' => $this->decimal($pisAmount),
            ]));

            $make->tagCOFINS($this->std([
                'item' => $line,
                'CST' => (string) $item['cofins_cst'],
                'vBC' => $this->decimal($cofinsBase),
                'pCOFINS' => $this->decimal($item['cofins_rate'] ?? 0, 4),
                'vCOFINS' => $this->decimal($cofinsAmount),
            ]));
        }

        $make->tagICMSTot($this->std([
            'vBC' => $this->decimal(0),
            'vICMS' => $this->decimal(0),
            'vICMSDeson' => $this->decimal(0),
            'vFCP' => $this->decimal(0),
            'vBCST' => $this->decimal(0),
            'vST' => $this->decimal(0),
            'vFCPST' => $this->decimal(0),
            'vFCPSTRet' => $this->decimal(0),
            'vProd' => $this->decimal($totals['vProd']),
            'vFrete' => $this->decimal(0),
            'vSeg' => $this->decimal(0),
            'vDesc' => $this->decimal($totals['vDesc']),
            'vII' => $this->decimal(0),
            'vIPI' => $this->decimal($totals['vIPI']),
            'vIPIDevol' => $this->decimal(0),
            'vPIS' => $this->decimal($totals['vPIS']),
            'vCOFINS' => $this->decimal($totals['vCOFINS']),
            'vOutro' => $this->decimal(0),
            'vNF' => $this->decimal($sale['total']),
            'vTotTrib' => $this->decimal($totals['vTotTrib']),
            'vFCPUFDest' => $this->decimal(0),
            'vICMSUFDest' => $this->decimal(0),
            'vICMSUFRemet' => $this->decimal(0),
        ]));

        $make->tagtransp($this->std([
            'modFrete' => 9,
        ]));

        $make->tagpag($this->std([
            'vTroco' => $this->decimal($sale['change_amount'] ?? 0),
        ]));

        foreach ($payments as $payment) {
            $make->tagdetPag($this->std([
                'indPag' => (int) ($payment['indPag'] ?? 0),
                'tPag' => $payment['tPag'],
                'vPag' => $this->decimal($payment['xml_amount'] ?? $payment['amount']),
                'xPag' => $payment['xPag'] ?: null,
            ]));
        }

        $additionalInfo = trim((string) ($payload['additional_info'] ?? ''));

        if ($additionalInfo !== '') {
            $make->taginfAdic($this->std([
                'infCpl' => $additionalInfo,
            ]));
        }

        if (
            ($profile['technical_contact_cnpj'] ?? null)
            && ($profile['technical_contact_name'] ?? null)
            && ($profile['technical_contact_email'] ?? null)
            && ($profile['technical_contact_phone'] ?? null)
        ) {
            $make->taginfRespTec($this->std([
                'CNPJ' => $profile['technical_contact_cnpj'],
                'xContato' => $profile['technical_contact_name'],
                'email' => $profile['technical_contact_email'],
                'fone' => $profile['technical_contact_phone'],
            ]));
        }

        $xml = $make->montaNFe();

        if ($xml === false) {
            throw new RuntimeException(implode(' | ', $make->getErrors()));
        }

        return $make->getXML();
    }

    protected function std(array $data): stdClass
    {
        return json_decode(json_encode($data), false, 512, JSON_THROW_ON_ERROR);
    }

    protected function decimal(float|int|string $value, int $precision = 2): string
    {
        return number_format((float) $value, $precision, '.', '');
    }

    protected function ufCode(string $uf): string
    {
        return match (strtoupper($uf)) {
            'RO' => '11',
            'AC' => '12',
            'AM' => '13',
            'RR' => '14',
            'PA' => '15',
            'AP' => '16',
            'TO' => '17',
            'MA' => '21',
            'PI' => '22',
            'CE' => '23',
            'RN' => '24',
            'PB' => '25',
            'PE' => '26',
            'AL' => '27',
            'SE' => '28',
            'BA' => '29',
            'MG' => '31',
            'ES' => '32',
            'RJ' => '33',
            'SP' => '35',
            'PR' => '41',
            'SC' => '42',
            'RS' => '43',
            'MS' => '50',
            'MT' => '51',
            'GO' => '52',
            'DF' => '53',
            default => throw new RuntimeException("UF fiscal nao suportada: {$uf}."),
        };
    }
}
