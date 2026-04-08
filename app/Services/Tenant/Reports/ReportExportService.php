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
        $gap = 2.0;
        $cardHeight = 17.0;
        $cardWidth = (277 - (($columns - 1) * $gap)) / $columns;
        $startX = 10.0;
        $startY = $pdf->getY();

        $pdf->setFont('Arial', 'B', 8);

        foreach ($summary as $index => $item) {
            $columnIndex = $index % $columns;
            $rowIndex = intdiv($index, $columns);
            $x = $startX + ($columnIndex * ($cardWidth + $gap));
            $y = $startY + ($rowIndex * ($cardHeight + $gap));

            $this->renderPdfSummaryCard($pdf, $item, $x, $y, $cardWidth);
        }

        $rows = (int) ceil(count($summary) / $columns);
        $pdf->setXY($startX, $startY + ($rows * ($cardHeight + $gap)));
    }

    protected function renderPdfSummaryCard(Fpdf $pdf, array $item, float $x, float $y, float $width): void
    {
        $label = $this->pdfText((string) data_get($item, 'label', '-'));
        $value = $this->pdfText($this->formattedValue(data_get($item, 'value'), (string) data_get($item, 'format', 'text')));
        $meta = $this->pdfText((string) data_get($item, 'meta', ''));

        $pdf->setFillColor(248, 250, 252);

        $pdf->setFont('Arial', 'B', 8);
        $pdf->setXY($x, $y);
        $pdf->cell($width, 6, $label, 1, 0, 'L', true);

        $pdf->setFont('Arial', '', 9);
        $pdf->setXY($x, $y + 6);
        $pdf->cell($width, 6, $value, 1, 0, 'L');

        $pdf->setFont('Arial', '', 7);
        $pdf->setXY($x, $y + 12);
        $pdf->cell($width, 5, $meta, 1, 0, 'L');
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

        $this->renderPdfTableTitle($pdf, $payload);

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
            $cells = array_map(
                fn (array $column) => [
                    'text' => $this->formattedValue(data_get($row, $column['key']), (string) data_get($column, 'format', 'text')),
                    'align' => $this->pdfColumnAlign((string) data_get($column, 'format', 'text')),
                ],
                $columns,
            );

            $rowHeight = $this->pdfRowHeight($pdf, $cells, $widths, 4.2, 6);

            if (($pdf->getY() + $rowHeight) > 198) {
                $pdf->addPage();
                $this->renderPdfHeader($pdf, $payload);
                $this->renderPdfTableTitle($pdf, $payload);
                $this->renderPdfTableHeader($pdf, $columns, $widths);
                $pdf->setFont('Arial', '', 7.5);
            }

            $this->renderPdfTableRow($pdf, $cells, $widths, 4.2, $rowHeight);
        }
    }

    protected function renderPdfTableTitle(Fpdf $pdf, array $payload): void
    {
        $pdf->setFont('Arial', 'B', 9);
        $pdf->cell(0, 6, $this->pdfText((string) data_get($payload, 'table.title', 'Detalhamento')), 0, 1);
    }

    protected function renderPdfTableHeader(Fpdf $pdf, array $columns, array $widths): void
    {
        $pdf->setFont('Arial', 'B', 8);
        $pdf->setFillColor(226, 232, 240);

        $this->renderPdfTableRow(
            $pdf,
            array_map(
                fn (array $column) => ['text' => (string) data_get($column, 'label', ''), 'align' => 'L'],
                $columns,
            ),
            $widths,
            4.4,
            null,
            true,
        );
    }

    protected function pdfColumnWidths(array $columns): array
    {
        $count = count($columns);
        $baseWidth = 277 / max(1, $count);
        $widths = array_fill(0, $count, $baseWidth);

        if ($count >= 4) {
            $widths[0] = min(58, $baseWidth + 10);

            if ($count > 1) {
                $widths[1] = min(64, $baseWidth + 12);
            }

            $remaining = 277 - array_sum(array_slice($widths, 0, min(2, $count)));
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

    protected function renderPdfTableRow(
        Fpdf $pdf,
        array $cells,
        array $widths,
        float $lineHeight,
        ?float $rowHeight = null,
        bool $fill = false,
    ): void {
        $startX = $pdf->getX();
        $startY = $pdf->getY();
        $resolvedRowHeight = $rowHeight ?? $this->pdfRowHeight($pdf, $cells, $widths, $lineHeight, 7);

        foreach ($cells as $index => $cell) {
            $x = $pdf->getX();
            $y = $pdf->getY();
            $text = $this->pdfText((string) ($cell['text'] ?? ''));
            $align = (string) ($cell['align'] ?? 'L');

            $pdf->rect($x, $y, $widths[$index], $resolvedRowHeight, $fill ? 'DF' : '');
            $pdf->setXY($x + 1, $y + 1);
            $pdf->multiCell($widths[$index] - 2, $lineHeight, $text, 0, $align);
            $pdf->setXY($x + $widths[$index], $y);
        }

        $pdf->setXY($startX, $startY + $resolvedRowHeight);
    }

    protected function pdfRowHeight(Fpdf $pdf, array $cells, array $widths, float $lineHeight, float $minHeight): float
    {
        $lines = 1;

        foreach ($cells as $index => $cell) {
            $lines = max(
                $lines,
                $this->pdfLineCount(
                    $pdf,
                    (string) ($cell['text'] ?? ''),
                    max(8, $widths[$index] - 2),
                ),
            );
        }

        return max($minHeight, ($lines * $lineHeight) + 2);
    }

    protected function pdfLineCount(Fpdf $pdf, string $text, float $width): int
    {
        $plainText = trim(preg_replace("/\r\n|\r/u", "\n", $text) ?? $text);

        if ($plainText === '') {
            return 1;
        }

        $paragraphs = preg_split("/\n/u", $plainText) ?: [$plainText];
        $lines = 0;

        foreach ($paragraphs as $paragraph) {
            $segments = $this->pdfWrapText($pdf, $paragraph, $width);
            $lines += max(1, count($segments));
        }

        return max(1, $lines);
    }

    protected function pdfWrapText(Fpdf $pdf, string $text, float $width): array
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        if ($normalized === '') {
            return [''];
        }

        $words = preg_split('/ /u', $normalized) ?: [$normalized];
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current.' '.$word;

            if ($pdf->GetStringWidth($this->pdfText($candidate)) <= $width) {
                $current = $candidate;
                continue;
            }

            if ($current !== '') {
                $lines[] = $current;
            }

            if ($pdf->GetStringWidth($this->pdfText($word)) <= $width) {
                $current = $word;
                continue;
            }

            $chunks = $this->pdfSplitWord($pdf, $word, $width);

            if (! empty($chunks)) {
                $lines = array_merge($lines, array_slice($chunks, 0, -1));
                $current = (string) end($chunks);
            }
        }

        if ($current !== '') {
            $lines[] = $current;
        }

        return empty($lines) ? [''] : $lines;
    }

    protected function pdfSplitWord(Fpdf $pdf, string $word, float $width): array
    {
        $chunks = [];
        $current = '';
        $characters = preg_split('//u', $word, -1, PREG_SPLIT_NO_EMPTY) ?: [$word];

        foreach ($characters as $character) {
            $candidate = $current.$character;

            if ($current !== '' && $pdf->GetStringWidth($this->pdfText($candidate)) > $width) {
                $chunks[] = $current;
                $current = $character;
                continue;
            }

            $current = $candidate;
        }

        if ($current !== '') {
            $chunks[] = $current;
        }

        return empty($chunks) ? [$word] : $chunks;
    }

    protected function pdfColumnAlign(string $format): string
    {
        return match ($format) {
            'money', 'percent', 'number', 'decimal' => 'R',
            'date', 'datetime' => 'C',
            default => 'L',
        };
    }
}
