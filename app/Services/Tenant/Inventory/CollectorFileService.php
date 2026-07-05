<?php

namespace App\Services\Tenant\Inventory;

use App\Models\Tenant\InventoryCollectorLayout;
use App\Models\Tenant\InventoryCount;
use App\Models\Tenant\InventoryImportBatch;
use App\Models\Tenant\InventorySession;
use App\Models\Tenant\Product;
use App\Services\Tenant\ScaleBarcodeService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CollectorFileService
{
    public const MAX_FILE_BYTES = 5 * 1024 * 1024;

    public const MAX_LINES = 50000;

    public function __construct(
        protected ScaleBarcodeService $scaleBarcodeService,
        protected TenantSettingsService $settingsService,
        protected InventorySessionService $sessionService,
    ) {
    }

    /**
     * Parseia o conteúdo bruto do arquivo de acordo com o config do layout.
     * Método puro (sem acesso a banco), usado tanto na importação real
     * quanto na tela de preview de layouts.
     *
     * @return array{lines: array<int, array{line_number:int, barcode:string, internal_code:?string, quantity:float}>, total_lines:int, skipped_lines:int}
     */
    public function parseLines(string $contents, array $config): array
    {
        $contents = $this->normalizeEncoding($contents, (string) ($config['encoding'] ?? 'UTF-8'));

        $rawLines = preg_split('/\r\n|\r|\n/', $contents) ?: [];

        if ($rawLines !== [] && end($rawLines) === '') {
            array_pop($rawLines);
        }

        if (($config['has_header'] ?? false) && $rawLines !== []) {
            array_shift($rawLines);
        }

        $fields = (array) ($config['fields'] ?? []);
        $format = (string) ($config['format'] ?? 'delimited');
        $delimiter = $this->resolveDelimiter((string) ($config['delimiter'] ?? ';'));
        $decimalSeparator = (string) ($config['decimal_separator'] ?? '.');
        $quantityField = $this->fieldConfig($fields, 'quantity');

        $lines = [];
        $skipped = 0;

        foreach ($rawLines as $index => $rawLine) {
            if (trim($rawLine) === '') {
                continue;
            }

            $values = $format === 'fixed_width'
                ? $this->extractFixedWidthValues($rawLine, $fields)
                : $this->extractDelimitedValues($rawLine, $fields, $delimiter);

            $barcode = trim((string) ($values['barcode'] ?? ''));
            $internalCode = array_key_exists('internal_code', $values) ? trim((string) $values['internal_code']) : null;
            $quantity = $this->parseQuantity((string) ($values['quantity'] ?? ''), $quantityField, $decimalSeparator);

            if (($barcode === '' && blank($internalCode)) || $quantity === null) {
                $skipped++;

                continue;
            }

            $lines[] = [
                'line_number' => $index + 1,
                'barcode' => $barcode,
                'internal_code' => $internalCode,
                'quantity' => $quantity,
            ];
        }

        return [
            'lines' => $lines,
            'total_lines' => count($rawLines),
            'skipped_lines' => $skipped,
        ];
    }

    /**
     * Agrega linhas repetidas do mesmo produto somando a quantidade
     * (comportamento padrão de coletor: bipar o mesmo item em corredores diferentes).
     */
    public function aggregateLines(array $lines): array
    {
        $grouped = [];

        foreach ($lines as $line) {
            $code = $line['barcode'] !== '' ? $line['barcode'] : (string) $line['internal_code'];
            $key = $this->normalizeCode($code);

            if (!isset($grouped[$key])) {
                $grouped[$key] = [
                    'key' => $key,
                    'barcode' => $line['barcode'],
                    'internal_code' => $line['internal_code'],
                    'quantity' => 0.0,
                    'line_count' => 0,
                ];
            }

            $grouped[$key]['quantity'] = round($grouped[$key]['quantity'] + $line['quantity'], 3);
            $grouped[$key]['line_count']++;
        }

        return array_values($grouped);
    }

    public function normalizeCode(string $code): string
    {
        $code = trim($code);
        $stripped = ltrim($code, '0');

        return $stripped === '' ? '0' : $stripped;
    }

    /**
     * Identifica se o código bipado é um EAN de balança (prefixo configurável) e,
     * nesse caso, resolve a chave de casamento pelo scale_code em vez do código literal.
     *
     * @return array{type: 'scale_code'|'code', value: int|string}
     */
    public function resolveMatchKey(string $barcode, array $scaleSettings): array
    {
        if (preg_match('/^\d{13}$/', $barcode)) {
            $decoded = $this->scaleBarcodeService->decode($barcode, $scaleSettings);

            if ($decoded !== null) {
                return ['type' => 'scale_code', 'value' => $decoded['scale_code']];
            }
        }

        return ['type' => 'code', 'value' => $this->normalizeCode($barcode)];
    }

    public function preview(array $config, array $sampleLines): array
    {
        return $this->parseLines(implode("\n", $sampleLines), $config)['lines'];
    }

    public function export(InventorySession $session, InventoryCollectorLayout $layout): string
    {
        $config = $layout->config;
        $fields = (array) ($config['fields'] ?? []);
        $lineEnding = strtoupper((string) ($config['line_ending'] ?? 'CRLF')) === 'LF' ? "\n" : "\r\n";

        $lines = $session->items()
            ->with('product:id,code,barcode,name,stock_quantity')
            ->get()
            ->map(function ($item) use ($layout, $fields) {
                $product = $item->product;
                $values = [
                    'barcode' => (string) ($product->barcode ?: $product->code),
                    'internal_code' => (string) $product->code,
                    'description' => (string) $product->name,
                    'quantity' => (float) $item->snapshot_quantity,
                ];

                return $layout->format === 'fixed_width'
                    ? $this->renderFixedWidthLine($values, $fields)
                    : $this->renderDelimitedLine($values, $fields, $this->resolveDelimiter((string) ($layout->config['delimiter'] ?? ';')));
            })
            ->all();

        $contents = implode($lineEnding, $lines).$lineEnding;

        $encoding = strtoupper((string) ($config['encoding'] ?? 'UTF-8'));

        if ($encoding !== 'UTF-8' && $encoding !== '') {
            $converted = @mb_convert_encoding($contents, $encoding, 'UTF-8');
            $contents = $converted !== false ? $converted : $contents;
        }

        return $contents;
    }

    public function import(
        InventorySession $session,
        string $filename,
        string $contents,
        InventoryCollectorLayout $layout,
        int $countRound,
        int $userId,
    ): InventoryImportBatch {
        if (strlen($contents) > self::MAX_FILE_BYTES) {
            throw ValidationException::withMessages(['file' => 'O arquivo excede o limite de 5 MB.']);
        }

        $config = array_merge((array) $layout->config, ['format' => $layout->format]);
        $parsed = $this->parseLines($contents, $config);

        if ($parsed['total_lines'] > self::MAX_LINES) {
            throw ValidationException::withMessages(['file' => 'O arquivo excede o limite de 50.000 linhas.']);
        }

        $scaleSettings = (array) data_get($this->settingsService->get(), 'scale_barcode', []);
        $aggregated = $this->aggregateLines($parsed['lines']);

        return DB::transaction(function () use ($session, $filename, $layout, $countRound, $userId, $aggregated, $parsed, $scaleSettings) {
            $batch = InventoryImportBatch::query()->create([
                'inventory_session_id' => $session->id,
                'filename' => $filename,
                'layout_id' => $layout->id,
                'count_round' => $countRound,
                'total_lines' => $parsed['total_lines'],
                'status' => 'processed',
                'imported_by' => $userId,
            ]);

            $matched = 0;
            $duplicateLines = 0;
            $unmatchedPayload = [];

            foreach ($aggregated as $entry) {
                if ($entry['line_count'] > 1) {
                    $duplicateLines += $entry['line_count'] - 1;
                }

                $product = $this->matchProduct($entry, $scaleSettings);

                if (!$product) {
                    $unmatchedPayload[] = [
                        'barcode' => $entry['barcode'],
                        'internal_code' => $entry['internal_code'],
                        'quantity' => $entry['quantity'],
                        'line_count' => $entry['line_count'],
                    ];

                    continue;
                }

                $sessionItem = $session->items()->where('product_id', $product->id)->first();

                if (!$sessionItem) {
                    $unmatchedPayload[] = [
                        'barcode' => $entry['barcode'],
                        'internal_code' => $entry['internal_code'],
                        'quantity' => $entry['quantity'],
                        'line_count' => $entry['line_count'],
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'out_of_session' => true,
                    ];

                    continue;
                }

                InventoryCount::query()
                    ->where('inventory_session_item_id', $sessionItem->id)
                    ->where('count_round', $countRound)
                    ->where('source', 'collector_import')
                    ->delete();

                InventoryCount::query()->create([
                    'inventory_session_item_id' => $sessionItem->id,
                    'count_round' => $countRound,
                    'quantity' => $entry['quantity'],
                    'source' => 'collector_import',
                    'import_batch_id' => $batch->id,
                    'counted_by' => $userId,
                    'counted_at' => now(),
                ]);

                $this->sessionService->resolveItemCounts($sessionItem->fresh());

                $matched++;
            }

            $batch->update([
                'matched_lines' => $matched,
                'unmatched_lines' => count($unmatchedPayload),
                'duplicate_lines' => $duplicateLines,
                'unmatched_payload' => $unmatchedPayload,
                'status' => $unmatchedPayload === [] ? 'processed' : 'partially_processed',
            ]);

            return $batch->fresh();
        });
    }

    protected function matchProduct(array $entry, array $scaleSettings): ?Product
    {
        $matchKey = $this->resolveMatchKey($entry['barcode'], $scaleSettings);

        if ($matchKey['type'] === 'scale_code') {
            return Product::query()->where('scale_code', $matchKey['value'])->where('active', true)->first();
        }

        $candidates = array_filter([$entry['barcode'], $entry['internal_code']], fn ($value) => filled($value));

        if ($candidates === []) {
            return null;
        }

        return Product::query()
            ->where('active', true)
            ->where(function ($query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    $query->orWhere('barcode', $candidate)->orWhere('code', $candidate);
                }
            })
            ->first();
    }

    protected function parseQuantity(string $raw, ?array $quantityField, string $decimalSeparator): ?float
    {
        $raw = trim($raw);

        if ($raw === '') {
            return null;
        }

        if (($quantityField['implied_decimals'] ?? null) !== null) {
            $digits = preg_replace('/\D/', '', $raw);

            if ($digits === '' || $digits === null) {
                return null;
            }

            $decimals = (int) $quantityField['implied_decimals'];

            return round(((float) $digits) / (10 ** $decimals), 3);
        }

        $thousandsSeparator = $decimalSeparator === ',' ? '.' : ',';
        $normalized = str_replace($thousandsSeparator, '', $raw);
        $normalized = str_replace($decimalSeparator, '.', $normalized);
        $normalized = preg_replace('/[^0-9.\-]/', '', $normalized) ?? '';

        if ($normalized === '' || $normalized === '-' || $normalized === '.') {
            return null;
        }

        return round((float) $normalized, 3);
    }

    protected function extractDelimitedValues(string $rawLine, array $fields, string $delimiter): array
    {
        $columns = explode($delimiter, $rawLine);
        $values = [];

        foreach ($fields as $field) {
            $position = (int) ($field['position'] ?? 0);

            if ($position < 1) {
                continue;
            }

            $values[$field['name']] = $columns[$position - 1] ?? '';
        }

        return $values;
    }

    protected function extractFixedWidthValues(string $rawLine, array $fields): array
    {
        $values = [];

        foreach ($fields as $field) {
            $start = (int) ($field['start'] ?? 0);
            $length = (int) ($field['length'] ?? 0);

            if ($start < 1 || $length < 1) {
                continue;
            }

            $values[$field['name']] = trim(mb_substr($rawLine, $start - 1, $length));
        }

        return $values;
    }

    protected function renderDelimitedLine(array $values, array $fields, string $delimiter): string
    {
        $ordered = collect($fields)
            ->sortBy(fn (array $field) => (int) ($field['position'] ?? 0))
            ->map(fn (array $field) => (string) ($values[$field['name']] ?? ''))
            ->all();

        return implode($delimiter, $ordered);
    }

    protected function renderFixedWidthLine(array $values, array $fields): string
    {
        $line = '';

        foreach (collect($fields)->sortBy(fn (array $field) => (int) ($field['start'] ?? 0)) as $field) {
            $length = (int) ($field['length'] ?? 0);
            $value = (string) ($values[$field['name']] ?? '');

            if ($field['name'] === 'quantity' && array_key_exists('decimals', $field)) {
                $value = number_format((float) $value, (int) $field['decimals'], '.', '');
            }

            $isNumeric = in_array($field['name'], ['quantity'], true);
            $line .= $isNumeric ? str_pad($value, $length, '0', STR_PAD_LEFT) : str_pad(mb_substr($value, 0, $length), $length, ' ', STR_PAD_RIGHT);
        }

        return $line;
    }

    protected function resolveDelimiter(string $delimiter): string
    {
        return match (strtoupper($delimiter)) {
            'TAB' => "\t",
            default => $delimiter,
        };
    }

    protected function fieldConfig(array $fields, string $name): ?array
    {
        foreach ($fields as $field) {
            if (($field['name'] ?? null) === $name) {
                return $field;
            }
        }

        return null;
    }

    public function normalizeEncoding(string $contents, string $encoding): string
    {
        $encoding = strtoupper(trim($encoding)) ?: 'UTF-8';

        if ($encoding === 'UTF-8') {
            return $contents;
        }

        $converted = @mb_convert_encoding($contents, 'UTF-8', $encoding);

        return $converted !== false ? $converted : $contents;
    }
}
