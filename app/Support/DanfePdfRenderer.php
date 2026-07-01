<?php

namespace App\Support;

use NFePHP\DA\NFe\Danfe;
use RuntimeException;

class DanfePdfRenderer
{
    public function render(string $xml, string $logoPath = ''): string
    {
        if (trim($xml) === '') {
            throw new RuntimeException('Não existe XML válido para gerar o DANFE.');
        }

        $danfe = new Danfe($xml);

        return $danfe->render($logoPath);
    }
}
