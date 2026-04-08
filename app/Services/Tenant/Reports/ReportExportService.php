<?php

declare(strict_types=1);

namespace App\Services\Tenant\Reports;

use Carbon\Carbon;
use Illuminate\Support\Str;
use NFePHP\DA\Legacy\FPDF\Fpdf;
use Symfony\Component\HttpFoundation\Response;

class ReportExportService
{
    public function __construct(
        protected ReportBrowserService $reportBrowser,
    ) {
    }

    public function download(string $reportKey, array $filters, string $format): Response
    {
        $resolvedFormat = in_array($format, ['pdf', 'excel'], true) ? $format : 'pdf';
        $payload = $this->reportBrowser->show($reportKey, array_merge($filters, [
            'applied' => true,
            'export' => $resolvedFormat,
            'page' => 1,
            'per_page' => 5000,
        ]));

        return match ($resolvedFormat) {
            'excel' => $this->excelResponse($payload),
            default => $this->pdfResponse($payload),
        };
    }

    protected function excelResponse(array $payload): Response
    {
        $content = $this->buildExcelXml($payload);
        $filename = $this->reportFilename($payload, 'xls');

        return response($content, 200, [
            'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $filename),
            'Cache-Control' => 'max-age=0, must-revalidate',
            'Pragma' => 'public',
        ]);
    }

    protected function pdfResponse(array $payload): Response
    {
        $pdf = new Fpdf('L', 'mm', 'A4');
        $pdf->setAutoPageBreak(true, 12);
        $pdf->setMargins(10, 10, 10);
        $pdf->addPage();

        $this->renderPdfHeader($pdf, $payload);
        $this->renderPdfSummary($pdf, $payload);
        $this->renderPdfHighlights($pdf, $payload);
        $this->renderPdfTable($pdf, $payload);

        return response($pdf->output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('attachment; filename="%s"', $this->reportFilename($payload, 'pdf')),
            'Cache-Control' => 'max-age=0, must-revalidate',
            'Pragma' => 'public',
        ]);
    }

    protected function buildExcelXml(array $payload): string
    {
        $summaryRows = '';
        $summaryRows .= $this->xmlRow([
            ['value' => data_get($payload, 'report.title', 'Relatorio'), 'style' => 'title'],
        ]);
        $summaryRows .= $this->xmlRow([
            ['value' => 'Categoria', 'style' => 'header'],
            ['value' => data_get($payload, 'report.category.label', '-')],
        ]);
        $summaryRows .= $this->xmlRow([
            ['value' => 'Periodo', 'style' => 'header'],
            ['value' => $this->periodLabel((array) data_get($payload, 'filters', []), (array) data_get($payload, 'filterSchema', []))],
        ]);
        $summaryRows .= $this->xmlRow([
            ['value' => 'Gerado em', 'style' => 'header'],
            ['value' => Carbon::now()->format('d/m/Y H:i')],
        ]);
        $summaryRows .= $this->xmlRow();
        $summaryRows .= $this->xmlRow([
            ['value' => 'Resumo', 'style' => 'header'],
        ]);

        foreach ((array) data_get($payload, 'summary', []) as $item) {
            $summaryRows .= $this->xmlRow([
                ['value' => (string) data_get($item, 'label', '-')],
                ['value' => $this->formattedValue(data_get($item, 'value'), (string) data_get($item, 'format', 'text'))],
                ['value' => (string) data_get($item, 'meta', '')],
            ]);
        }

        $highlights = array_values(array_filter((array) data_get($payload, 'highlights', [])));

        if (! empty($highlights)) {
            $summaryRows .= $this->xmlRow();
            $summaryRows .= $this->xmlRow([
                ['value' => 'Destaques', 'style' => 'header'],
            ]);

            foreach ($highlights as $item) {
                $summaryRows .= $this->xmlRow([
                    ['value' => (string) data_get($item, 'label', '-')],
                    ['value' => $this->formattedValue(data_get($item, 'value'), (string) data_get($item, 'format', 'text'))],
                    ['value' => (string) data_get($item, 'meta', '')],
                ]);
            }
        }

        $dataRows = '';
        $columns = (array) data_get($payload, 'columns', []);
        $rows = (array) data_get($payload, 'rows', []);

        if (! empty($columns)) {
            $dataRows .= $this->xmlRow(array_map(
                fn (array $column) => ['value' => (string) data_get($column, 'label', ''), 'style' => 'header'],
                $columns,
            ));
        }

        if (! empty($rows)) {
            foreach ($rows as $row) {
                $dataRows .= $this->xmlRow(array_map(
                    fn (array $column) => [
                        'value' => $this->formattedValue(data_get($row, $column['key']), (string) data_get($column, 'format', 'text')),
                    ],
                    $columns,
                ));
            }
        } else {
            $dataRows .= $this->xmlRow([
                ['value' => (string) data_get($payload, 'emptyText', 'Sem dados')],
            ]);
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'
            .'<?mso-application progid="Excel.Sheet"?>'
            .'<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"'
            .' xmlns:o="urn:schemas-microsoft-com:office:office"'
            .' xmlns:x="urn:schemas-microsoft-com:office:excel"'
            .' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
            .'<Styles>'
            .'<Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>'
            .'<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/></Style>'
            .'</Styles>'
            .'<Worksheet ss:Name="Resumo"><Table>'.$summaryRows.'</Table></Worksheet>'
            .'<Worksheet ss:Name="Dados"><Table>'.$dataRows.'</Table></Worksheet>'
            .'</Workbook>';
    }

    protected function renderPdfHeader(Fpdf $pdf, array $payload): void
    {
        $pdf->setFont('Arial', 'B', 15);
        $pdf->cell(0, 8, $this->pdfText((string) data_get($payload, 'report.title', 'Relatorio')), 0, 1);
        $pdf->setFont('Arial', '', 9);
        $pdf->cell(0, 5, $this->pdfText('Categoria: '.(string) data_get($payload, 'report.category.label', '-')), 0, 1);
        $pdf->cell(0, 5, $this->pdfText('Periodo: '.$this->periodLabel((array) data_get($payload, 'filters', []), (array) data_get($payload, 'filterSchema', []))), 0, 1);
        $pdf->cell(0, 5, $this->pdfText('Gerado em: '.Carbon::now()->format('d/m/Y H:i')), 0, 1);
        $pdf->ln(3);
    }

    protected function renderPdfSummary(Fpdf $pdf, array $payload): void
    {
        $summary = (array) data_get($payload, 'summary', []);

        if (empty($summary)) {
            return;
        }

        $columns = min(4, max(1, count($summary)));
        $cardWidth = (277 - (($columns - 1) * 2)) / $columns;

        $pdf->setFont('Arial', 'B', 8);

        foreach ($summary as $index => $item) {
            $x = 10 + (($index % $columns) * ($cardWidth + 2));
            $y = $pdf->getY();

            if ($index > 0 && $index % $columns === 0) {
                $pdf->ln(14);
                $y = $pdf->getY();
                $x = 10;
            }

            $pdf->setXY($x, $y);
            $pdf->setFillColor(248, 250, 252);
            $pdf->cell($cardWidth, 6, $this->pdfText((string) data_get($item, 'label', '-')), 1, 2, 'L', true);
            $pdf->setX($x);
            $pdf->setFont('Arial', '', 9);
            $pdf->cell($cardWidth, 6, $this->pdfText($this->formattedValue(data_get($item, 'value'), (string) data_get($item, 'format', 'text'))), 1, 2);
            $pdf->setX($x);
            $pdf->setFont('Arial', '', 7);
            $pdf->cell($cardWidth, 5, $this->pdfText((string) data_get($item, 'meta', '')), 1, 0);
            $pdf->setFont('Arial', 'B', 8);
        }

        $pdf->ln(16);
    }

    protected function renderPdfHighlights(Fpdf $pdf, array $payload): void
    {
        $highlights = array_values(array_filter((array) data_get($payload, 'highlights', [])));

        if (empty($highlights)) {
            return;
        }

        $pdf->setFont('Arial', 'B', 9);
        $pdf->cell(0, 6, $this->pdfText('Destaques'), 0, 1);
        $pdf->setFont('Arial', '', 8);

        foreach ($highlights as $item) {
            $line = sprintf(
                '%s: %s%s',
                (string) data_get($item, 'label', '-'),
                $this->formattedValue(data_get($item, 'value'), (string) data_get($item, 'format', 'text')),
                data_get($item, 'meta') ? ' | '.(string) data_get($item, 'meta') : '',
            );

            $pdf->cell(0, 5, $this->pdfText($line), 0, 1);
        }

        $pdf->ln(2);
    }

    protected function renderPdfTable(Fpdf $pdf, array $payload): void
    {
        $columns = (array) data_get($payload, 'columns', []);
        $rows = (array) data_get($payload, 'rows', []);

        $pdf->setFont('Arial', 'B', 9);
        $pdf->cell(0, 6, $this->pdfText((string) data_get($payload, 'table.title', 'Detalhamento')), 0, 1);

        if (empty($columns)) {
            $pdf->setFont('Arial', '', 8);
            $pdf->cell(0, 6, $this->pdfText((string) data_get($payload, 'emptyText', 'Sem dados')), 0, 1);
            return;
        }

        $widths = $this->pdfColumnWidths($columns);
        $this->renderPdfTableHeader($pdf, $columns, $widths);

        if (empty($rows)) {
            $pdf->setFont('Arial', '', 8);
            $pdf->cell(array_sum($widths), 6, $this->pdfText((string) data_get($payload, 'emptyText', 'Sem dados')), 1, 1);
            return;
        }

        $pdf->setFont('Arial', '', 7.5);

        foreach ($rows as $row) {
            if ($pdf->getY() > 186) {
                $pdf->addPage();
                $this->renderPdfHeader($pdf, $payload);
                $this->renderPdfTableHeader($pdf, $columns, $widths);
                $pdf->setFont('Arial', '', 7.5);
            }

            foreach ($columns as $index => $column) {
                $value = $this->formattedValue(data_get($row, $column['key']), (string) data_get($column, 'format', 'text'));
                $pdf->cell($widths[$index], 6, $this->pdfText(Str::limit($value, 28, '...')), 1, 0);
            }

            $pdf->ln();
        }
    }

    protected function renderPdfTableHeader(Fpdf $pdf, array $columns, array $widths): void
    {
        $pdf->setFont('Arial', 'B', 8);
        $pdf->setFillColor(226, 232, 240);

        foreach ($columns as $index => $column) {
            $pdf->cell($widths[$index], 7, $this->pdfText((string) data_get($column, 'label', '')), 1, 0, 'L', true);
        }

        $pdf->ln();
    }

    protected function pdfColumnWidths(array $columns): array
    {
        $count = count($columns);
        $baseWidth = 257 / max(1, $count);
        $widths = array_fill(0, $count, $baseWidth);

        if ($count >= 4) {
            $widths[0] = min(48, $baseWidth + 8);

            if ($count > 1) {
                $widths[1] = min(54, $baseWidth + 10);
            }

            $remaining = 257 - array_sum(array_slice($widths, 0, min(2, $count)));
            $restCount = max(1, $count - min(2, $count));

            for ($index = min(2, $count); $index < $count; $index++) {
                $widths[$index] = $remaining / $restCount;
            }
        }

        return $widths;
    }

    protected function reportFilename(array $payload, string $extension): string
    {
        return Str::slug((string) data_get($payload, 'report.title', 'relatorio'))
            .'-'.Carbon::now()->format('Ymd-His')
            .'.'.$extension;
    }

    protected function periodLabel(array $filters, array $schema): string
    {
        if (! in_array('scope', (array) data_get($schema, 'fields', []), true)) {
            return 'Carteira atual';
        }

        return match ($filters['scope'] ?? 'month') {
            'date' => Carbon::parse((string) ($filters['date'] ?? now()->toDateString()))->format('d/m/Y'),
            'year' => (string) ($filters['year'] ?? now()->year),
            'months' => sprintf('%s ate %s', (string) ($filters['month_from'] ?? '-'), (string) ($filters['month_to'] ?? '-')),
            'range' => sprintf(
                '%s ate %s',
                Carbon::parse((string) ($filters['from'] ?? now()->toDateString()))->format('d/m/Y'),
                Carbon::parse((string) ($filters['to'] ?? now()->toDateString()))->format('d/m/Y'),
            ),
            default => (string) ($filters['month'] ?? now()->format('Y-m')),
        };
    }

    protected function formattedValue(mixed $value, string $format): string
    {
        return match ($format) {
            'money' => 'R$ '.number_format((float) $value, 2, ',', '.'),
            'percent' => number_format((float) $value, 1, ',', '.').'%',
            'number' => number_format((float) $value, 0, ',', '.'),
            'decimal' => number_format((float) $value, 3, ',', '.'),
            'date' => filled($value) ? Carbon::parse((string) $value)->format('d/m/Y') : '-',
            'datetime' => filled($value) ? Carbon::parse((string) $value)->format('d/m/Y H:i') : '-',
            default => filled($value) ? (string) $value : '-',
        };
    }

    protected function xmlRow(array $cells = []): string
    {
        if (empty($cells)) {
            return '<Row/>';
        }

        $xml = '<Row>';

        foreach ($cells as $cell) {
            $style = filled($cell['style'] ?? null) ? ' ss:StyleID="'.$this->xml((string) $cell['style']).'"' : '';
            $xml .= '<Cell'.$style.'><Data ss:Type="String">'.$this->xml((string) ($cell['value'] ?? '')).'</Data></Cell>';
        }

        return $xml.'</Row>';
    }

    protected function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    protected function pdfText(string $value): string
    {
        return iconv('UTF-8', 'windows-1252//TRANSLIT//IGNORE', $value) ?: $value;
    }
}
