<?php

namespace App\Support;

use NFePHP\DA\NFe\Danfce;
use RuntimeException;

class DanfcePdfRenderer
{
    public function render(string $authorizedXml, string $logoPath = ''): string
    {
        if (trim($authorizedXml) === '') {
            throw new RuntimeException('Nao existe XML autorizado para gerar o DANFCe.');
        }

        $danfce = new Danfce($authorizedXml);

        return $danfce->render($logoPath);
    }
}
