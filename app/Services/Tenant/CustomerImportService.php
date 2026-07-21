<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Customer;
use App\Models\Tenant\Sale;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CustomerImportService
{
    protected const HEADER_ALIASES = [
        'nome' => 'name',
        'cliente' => 'name',
        'name' => 'name',
        'documento' => 'document',
        'cpf' => 'document',
        'cpf_cnpj' => 'document',
        'cpfcnpj' => 'document',
        'document' => 'document',
        'telefone' => 'phone',
        'celular' => 'phone',
        'phone' => 'phone',
        'email' => 'email',
        'limite_credito' => 'credit_limit',
        'limitecredito' => 'credit_limit',
        'credit_limit' => 'credit_limit',
        'saldo_fiado_inicial' => 'initial_credit_balance',
        'saldo_fiado' => 'initial_credit_balance',
        'saldo_devedor_inicial' => 'initial_credit_balance',
        'initial_credit_balance' => 'initial_credit_balance',
    ];

    public function preview(UploadedFile $file): array
    {
        $rows = $this->parseCsv($file);
        $existingByDocument = Customer::query()
            ->whereNotNull('document')
            ->where('document', '!=', '')
            ->get(['id', 'document'])
            ->keyBy(fn (Customer $customer) => $this->normalizeDocument((string) $customer->document));

        return array_map(
            fn (array $row, int $index) => $this->validateRow($row, $index + 2, $existingByDocument),
            $rows,
            array_keys($rows),
        );
    }

    public function commit(array $rows, ?int $userId = null): array
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
                DB::transaction(function () use ($row, $userId, &$created, &$updated) {
                    $isNew = blank($row['customer_id'] ?? null);
                    $customer = $isNew
                        ? new Customer()
                        : Customer::query()->findOrFail($row['customer_id']);

                    $customer->fill($row['data'])->save();

                    $initialBalance = round((float) ($row['initial_credit_balance'] ?? 0), 2);

                    if ($isNew && $initialBalance > 0) {
                        $this->registerInitialCreditBalance($customer, $initialBalance, $userId);
                    }

                    $isNew ? $created++ : $updated++;
                });
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

    protected function registerInitialCreditBalance(Customer $customer, float $balance, ?int $userId): void
    {
        $sale = Sale::query()->create([
            'sale_number' => $this->nextMigrationSaleNumber(),
            'customer_id' => $customer->id,
            'user_id' => $userId,
            'cash_register_id' => null,
            'origin' => 'migration',
            'subtotal' => $balance,
            'discount' => 0,
            'total' => $balance,
            'cost_total' => 0,
            'profit' => 0,
            'payment_method' => PaymentMethod::CREDIT,
            'status' => 'finalized',
            'notes' => 'Saldo de fiado migrado de outro sistema.',
        ]);

        $sale->payments()->create([
            'payment_method' => PaymentMethod::CREDIT,
            'amount' => $balance,
        ]);
    }

    protected function nextMigrationSaleNumber(): string
    {
        $prefix = now()->format('Ymd');
        $count = Sale::query()
            ->where('origin', 'migration')
            ->whereDate('created_at', now())
            ->count() + 1;

        return sprintf('MIG-%s-%04d', $prefix, $count);
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
        $customerId = $document !== '' ? $existingByDocument->get($document)?->id : null;

        return [
            'row_number' => $rowNumber,
            'customer_id' => $customerId,
            'action' => $customerId ? 'update' : 'create',
            'errors' => $errors,
            'warnings' => [],
            'preview' => [
                'name' => $name,
                'document' => $documentRaw ?: null,
                'phone' => $row['phone'] ?? null,
                'credit_limit' => $this->normalizeDecimal($row['credit_limit'] ?? ''),
                'initial_credit_balance' => $this->normalizeDecimal($row['initial_credit_balance'] ?? ''),
            ],
            'initial_credit_balance' => $this->normalizeDecimal($row['initial_credit_balance'] ?? '') ?? 0,
            'data' => [
                'name' => $name,
                'document' => $document !== '' ? $document : null,
                'document_type' => strlen($document) > 11 ? 'cnpj' : ($document !== '' ? 'cpf' : null),
                'phone' => trim((string) ($row['phone'] ?? '')) ?: null,
                'email' => trim((string) ($row['email'] ?? '')) ?: null,
                'credit_limit' => $this->normalizeDecimal($row['credit_limit'] ?? '') ?? 0,
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

    protected function normalizeDecimal(string $value): ?float
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (str_contains($value, ',')) {
            $value = str_replace('.', '', $value);
            $value = str_replace(',', '.', $value);
        }

        return is_numeric($value) ? round((float) $value, 2) : null;
    }
}
