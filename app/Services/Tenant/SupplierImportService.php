<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Supplier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class SupplierImportService
{
    protected const HEADER_ALIASES = [
        'nome' => 'name',
        'fornecedor' => 'name',
        'name' => 'name',
        'documento' => 'document',
        'cnpj' => 'document',
        'cpf_cnpj' => 'document',
        'document' => 'document',
        'telefone' => 'phone',
        'phone' => 'phone',
        'email' => 'email',
        'nome_fantasia' => 'trade_name',
        'nomefantasia' => 'trade_name',
        'trade_name' => 'trade_name',
    ];

    public function preview(UploadedFile $file): array
    {
        $rows = $this->parseCsv($file);
        $existingByDocument = Supplier::query()
            ->whereNotNull('document')
            ->where('document', '!=', '')
            ->get(['id', 'document'])
            ->keyBy(fn (Supplier $supplier) => $this->normalizeDocument((string) $supplier->document));

        return array_map(
            fn (array $row, int $index) => $this->validateRow($row, $index + 2, $existingByDocument),
            $rows,
            array_keys($rows),
        );
    }

    public function commit(array $rows): array
    {
        $created = 0;
        $updated = 0;
        $skipped = 0;
        $failures = [];

        foreach ($rows as $row) {
            if (! empty($row['errors'])) {
                $skipped++;
                continue;
            }

            try {
                $isNew = blank($row['supplier_id'] ?? null);
                $supplier = $isNew
                    ? new Supplier()
                    : Supplier::query()->findOrFail($row['supplier_id']);

                $supplier->fill($row['data'])->save();

                $isNew ? $created++ : $updated++;
            } catch (\Throwable $exception) {
                $skipped++;
                $failures[] = [
                    'row' => $row['row_number'],
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'failures' => $failures,
        ];
    }

    protected function validateRow(array $row, int $rowNumber, \Illuminate\Support\Collection $existingByDocument): array
    {
        $errors = [];
        $name = trim((string) ($row['name'] ?? ''));

        if ($name === '') {
            $errors[] = 'Nome é obrigatório.';
        }

        $documentRaw = trim((string) ($row['document'] ?? ''));
        $document = $this->normalizeDocument($documentRaw);
        $supplierId = $document !== '' ? $existingByDocument->get($document)?->id : null;

        return [
            'row_number' => $rowNumber,
            'supplier_id' => $supplierId,
            'action' => $supplierId ? 'update' : 'create',
            'errors' => $errors,
            'warnings' => [],
            'preview' => [
                'name' => $name,
                'document' => $documentRaw ?: null,
                'phone' => $row['phone'] ?? null,
            ],
            'data' => [
                'name' => $name,
                'document' => $document !== '' ? $document : null,
                'document_type' => strlen($document) > 11 ? 'cnpj' : ($document !== '' ? 'cpf' : null),
                'trade_name' => trim((string) ($row['trade_name'] ?? '')) ?: null,
                'phone' => trim((string) ($row['phone'] ?? '')) ?: null,
                'email' => trim((string) ($row['email'] ?? '')) ?: null,
            ],
        ];
    }

    protected function normalizeDocument(string $document): string
    {
        return preg_replace('/\D+/', '', $document) ?? '';
    }

    protected function parseCsv(UploadedFile $file): array
    {
        $contents = file_get_contents($file->getRealPath());
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', (string) $contents);
        $lines = preg_split('/\r\n|\r|\n/', trim((string) $contents));
        $lines = array_values(array_filter($lines, fn ($line) => trim((string) $line) !== ''));

        if (count($lines) < 1) {
            return [];
        }

        $delimiter = substr_count($lines[0], ';') > substr_count($lines[0], ',') ? ';' : ',';
        $header = str_getcsv(array_shift($lines), $delimiter);
        $normalizedHeader = array_map(fn ($column) => $this->normalizeHeader($column), $header);

        $rows = [];

        foreach ($lines as $line) {
            $values = str_getcsv($line, $delimiter);
            $row = [];

            foreach ($normalizedHeader as $index => $key) {
                if ($key === null) {
                    continue;
                }

                $row[$key] = trim((string) ($values[$index] ?? ''));
            }

            $rows[] = $row;
        }

        return $rows;
    }

    protected function normalizeHeader(string $column): ?string
    {
        $normalized = Str::of($column)
            ->trim()
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->toString();

        return self::HEADER_ALIASES[$normalized] ?? null;
    }
}
