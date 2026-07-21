<?php

namespace App\Support;

use RuntimeException;

/**
 * Espelha o CFOP de uma operação original (venda ou compra) para o CFOP
 * correspondente de devolução, conforme a tabela do Convênio SINIEF s/n de 1970.
 */
class CfopMirror
{
    /**
     * @var array<string, string> CFOP original => CFOP de devolução
     */
    protected const SALE_RETURN_MIRROR = [
        // Venda de produção própria / comercialização -> devolução de venda (entrada)
        '5101' => '1201',
        '6101' => '2201',
        '5102' => '1202',
        '6102' => '2202',
        // Venda com substituição tributária -> devolução de venda (entrada)
        '5405' => '1411',
        '6405' => '2411',
    ];

    /**
     * @var array<string, string> CFOP original => CFOP de devolução
     */
    protected const PURCHASE_RETURN_MIRROR = [
        // Compra para industrialização/comercialização -> devolução de compra (saída)
        '1101' => '5201',
        '2101' => '6201',
        '1102' => '5202',
        '2102' => '6202',
        // Compra com substituição tributária -> devolução de compra (saída)
        '1401' => '5411',
        '2401' => '6411',
    ];

    public function mirrorForSaleReturn(string $originalCfop): string
    {
        return self::SALE_RETURN_MIRROR[$originalCfop]
            ?? throw new RuntimeException("Não existe CFOP de devolução mapeado para a venda com CFOP {$originalCfop}.");
    }

    public function mirrorForPurchaseReturn(string $originalCfop): string
    {
        return self::PURCHASE_RETURN_MIRROR[$originalCfop]
            ?? throw new RuntimeException("Não existe CFOP de devolução mapeado para a compra com CFOP {$originalCfop}.");
    }
}
