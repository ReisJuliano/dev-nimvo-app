<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalDocumentEvent;
use App\Models\Tenant\FiscalNumberInutilization;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

class AccountantExportService
{
    public function __construct(
        protected FiscalDocumentXmlStorage $xmlStorage,
        protected AccountantClosingReportService $closingReportService,
    ) {
    }

    /**
     * Monta o zip mensal do contador e devolve o caminho relativo no disco 'local'.
     */
    public function buildZip(int $year, int $month): string
    {
        [$from, $to] = $this->monthRange($year, $month);
        $tenantId = (string) tenant('id');

        $authorized = FiscalDocument::query()
            ->whereIn('status', ['authorized', 'printed'])
            ->whereBetween('authorized_at', [$from, $to])
            ->orderBy('authorized_at')
            ->get();

        $cancelled = FiscalDocument::query()
            ->whereIn('status', ['cancelled', 'cancelled_local'])
            ->whereBetween('cancelled_at', [$from, $to])
            ->orderBy('cancelled_at')
            ->get();

        $inutilizations = FiscalNumberInutilization::query()
            ->where('status', 'processed')
            ->whereBetween('processed_at', [$from, $to])
            ->orderBy('processed_at')
            ->get();

        $correctionEvents = FiscalDocumentEvent::query()
            ->where('status', 'correction_registered')
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->get();

        $directory = sprintf('accountant-exports/%s', $tenantId);
        $filename = sprintf('%s/contador-%04d-%02d.zip', $directory, $year, $month);
        $absolutePath = Storage::disk('local')->path($filename);

        if (! is_dir(dirname($absolutePath))) {
            mkdir(dirname($absolutePath), 0755, true);
        }

        $zip = new ZipArchive();

        if ($zip->open($absolutePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Não foi possível criar o arquivo zip do pacote do contador.');
        }

        foreach ($authorized as $document) {
            if (filled($document->authorized_xml)) {
                $zip->addFromString(
                    sprintf('Autorizadas/%s.xml', $document->access_key ?: "documento-{$document->id}"),
                    $document->authorized_xml,
                );
            }
        }

        foreach ($cancelled as $document) {
            $xml = $document->cancelled_xml ?: $document->authorized_xml;

            if (filled($xml)) {
                $zip->addFromString(
                    sprintf('Canceladas/%s.xml', $document->access_key ?: "documento-{$document->id}"),
                    $xml,
                );
            }
        }

        foreach ($inutilizations as $inutilization) {
            $base = sprintf('Inutilizacoes/inutilizacao-%d', $inutilization->id);

            if (filled($inutilization->request_xml)) {
                $zip->addFromString("{$base}-pedido.xml", $inutilization->request_xml);
            }

            if (filled($inutilization->response_xml)) {
                $zip->addFromString("{$base}-retorno.xml", $inutilization->response_xml);
            }
        }

        foreach ($correctionEvents as $event) {
            $sequence = (int) data_get($event->payload, 'sequence', 0);

            if ($sequence <= 0 || ! $event->document) {
                continue;
            }

            $paths = $this->xmlStorage->pathsForCorrection($tenantId, $event->document, $sequence);
            $base = sprintf('Eventos/carta-correcao-documento-%d-seq-%d', $event->fiscal_document_id, $sequence);

            if (isset($paths['correction_request_xml']) && Storage::disk('local')->exists($paths['correction_request_xml'])) {
                $zip->addFromString("{$base}-pedido.xml", Storage::disk('local')->get($paths['correction_request_xml']));
            }

            if (isset($paths['correction_response_xml']) && Storage::disk('local')->exists($paths['correction_response_xml'])) {
                $zip->addFromString("{$base}-retorno.xml", Storage::disk('local')->get($paths['correction_response_xml']));
            }
        }

        $zip->addFromString('resumo.csv', $this->buildSummaryCsv($authorized, $cancelled));
        $zip->addFromString('fechamento.pdf', $this->closingReportService->buildPdf($year, $month));

        $zip->close();

        return $filename;
    }

    protected function buildSummaryCsv($authorized, $cancelled): string
    {
        $rows = collect($authorized)->map(fn (FiscalDocument $document) => $this->summaryRow($document, 'Autorizada'))
            ->concat(collect($cancelled)->map(fn (FiscalDocument $document) => $this->summaryRow($document, 'Cancelada')))
            ->sortBy('data')
            ->values();

        $lines = ['chave;numero;serie;data;destinatario;valor;situacao'];

        foreach ($rows as $row) {
            $lines[] = implode(';', [
                $row['chave'],
                $row['numero'],
                $row['serie'],
                $row['data'],
                str_replace(';', ',', (string) $row['destinatario']),
                number_format((float) $row['valor'], 2, ',', ''),
                $row['situacao'],
            ]);
        }

        return implode("\n", $lines);
    }

    protected function summaryRow(FiscalDocument $document, string $situacao): array
    {
        return [
            'chave' => $document->access_key,
            'numero' => $document->number,
            'serie' => $document->series,
            'data' => optional($document->authorized_at ?: $document->cancelled_at)?->format('Y-m-d H:i:s'),
            'destinatario' => data_get($document->payload, 'consumer.name') ?: 'Consumidor final',
            'valor' => data_get($document->payload, 'sale.total', 0),
            'situacao' => $situacao,
        ];
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function monthRange(int $year, int $month): array
    {
        $from = Carbon::create($year, $month, 1)->startOfDay();
        $to = $from->copy()->endOfMonth()->endOfDay();

        return [$from, $to];
    }
}
