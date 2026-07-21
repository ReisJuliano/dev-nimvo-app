<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Services\Tenant\InventoryMovementService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class ProductImportService
{
    public function __construct(
        protected ProductService $productService,
        protected InventoryMovementService $inventoryMovementService,
    ) {
    }

    protected const HEADER_ALIASES = [
        'codigo' => 'code',
        'code' => 'code',
        'nome' => 'name',
        'produto' => 'name',
        'name' => 'name',
        'categoria' => 'category',
        'category' => 'category',
        'fornecedor' => 'supplier',
        'supplier' => 'supplier',
        'unidade' => 'unit',
        'unit' => 'unit',
        'vendido_por' => 'sold_by',
        'vendidopor' => 'sold_by',
        'sold_by' => 'sold_by',
        'preco_custo' => 'cost_price',
        'precocusto' => 'cost_price',
        'custo' => 'cost_price',
        'cost_price' => 'cost_price',
        'preco_venda' => 'sale_price',
        'precovenda' => 'sale_price',
        'preco' => 'sale_price',
        'sale_price' => 'sale_price',
        'estoque_inicial' => 'stock_quantity',
        'estoqueinicial' => 'stock_quantity',
        'estoque' => 'stock_quantity',
        'stock_quantity' => 'stock_quantity',
        'estoque_minimo' => 'min_stock',
        'estoqueminimo' => 'min_stock',
        'min_stock' => 'min_stock',
        'codigo_barras' => 'barcode',
        'codigobarras' => 'barcode',
        'barcode' => 'barcode',
    ];

    /**
     * Parses the uploaded CSV and returns validated preview rows, without writing anything.
     */
    public function preview(UploadedFile $file): array
    {
        $rows = $this->parseCsv($file);
        $categories = Category::query()->pluck('id', 'name')
            ->keyBy(fn ($id, $name) => Str::lower(trim((string) $name)));
        $suppliers = Supplier::query()->pluck('id', 'name')
            ->keyBy(fn ($id, $name) => Str::lower(trim((string) $name)));
        $existingByCode = Product::query()->pluck('id', 'code');
        $existingByBarcode = Product::query()->whereNotNull('barcode')->where('barcode', '!=', '')->pluck('id', 'barcode');

        return array_map(
            fn (array $row, int $index) => $this->validateRow($row, $index + 2, $categories, $suppliers, $existingByCode, $existingByBarcode),
            $rows,
            array_keys($rows),
        );
    }

    /**
     * Commits previously previewed rows. Rows with errors are skipped.
     */
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
                $isNew = blank($row['product_id'] ?? null);
                $product = $isNew
                    ? new Product()
                    : Product::query()->findOrFail($row['product_id']);

                $initialStock = round((float) ($row['data']['stock_quantity'] ?? 0), 3);
                $data = $row['data'];

                if ($isNew) {
                    // Estoque inicial passa pelo InventoryMovementService (tipo 'saldo_inicial')
                    // em vez de ser setado direto, pra deixar rastro auditavel de onde o saldo veio.
                    $data['stock_quantity'] = 0;
                }

                $this->productService->save($product, $data);

                if ($isNew && $initialStock > 0) {
                    $this->inventoryMovementService->apply($product->fresh(), $initialStock, 'saldo_inicial', [
                        'user_id' => $userId,
                        'unit_cost' => $data['cost_price'] ?? 0,
                        'notes' => 'Saldo inicial de importação em massa.',
                        'allow_negative' => true,
                    ]);
                }

                $product->wasRecentlyCreated ? $created++ : $updated++;
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

    protected function validateRow(
        array $row,
        int $rowNumber,
        \Illuminate\Support\Collection $categories,
        \Illuminate\Support\Collection $suppliers,
        \Illuminate\Support\Collection $existingByCode,
        \Illuminate\Support\Collection $existingByBarcode,
    ): array {
        $errors = [];
        $warnings = [];

        $name = trim((string) ($row['name'] ?? ''));

        if ($name === '') {
            $errors[] = 'Nome é obrigatório.';
        }

        $salePriceRaw = $this->normalizeDecimal($row['sale_price'] ?? '');

        if ($salePriceRaw === null) {
            $errors[] = 'Preço de venda é obrigatório e deve ser numérico.';
        }

        $costPrice = $this->normalizeDecimal($row['cost_price'] ?? '') ?? 0;
        $stockQuantity = $this->normalizeDecimal($row['stock_quantity'] ?? '') ?? 0;
        $minStock = $this->normalizeDecimal($row['min_stock'] ?? '') ?? 0;

        $soldByRaw = Str::lower(trim((string) ($row['sold_by'] ?? '')));
        $soldBy = in_array($soldByRaw, ['peso', 'weight', 'kg'], true) ? 'weight' : 'unit';

        $code = trim((string) ($row['code'] ?? ''));
        $barcode = trim((string) ($row['barcode'] ?? ''));

        $productId = null;

        if ($code !== '' && $existingByCode->has($code)) {
            $productId = $existingByCode->get($code);
        } elseif ($barcode !== '' && $existingByBarcode->has($barcode)) {
            $productId = $existingByBarcode->get($barcode);
        }

        $categoryName = trim((string) ($row['category'] ?? ''));
        $categoryId = null;

        if ($categoryName !== '') {
            $categoryId = $categories->get(Str::lower($categoryName));

            if (! $categoryId) {
                $warnings[] = sprintf('Categoria "%s" não encontrada — produto será importado sem categoria.', $categoryName);
            }
        }

        $supplierName = trim((string) ($row['supplier'] ?? ''));
        $supplierId = null;

        if ($supplierName !== '') {
            $supplierId = $suppliers->get(Str::lower($supplierName));

            if (! $supplierId) {
                $warnings[] = sprintf('Fornecedor "%s" não encontrado — produto será importado sem fornecedor.', $supplierName);
            }
        }

        return [
            'row_number' => $rowNumber,
            'product_id' => $productId,
            'action' => $productId ? 'update' : 'create',
            'errors' => $errors,
            'warnings' => $warnings,
            'preview' => [
                'code' => $code ?: '(gerado automaticamente)',
                'name' => $name,
                'category' => $categoryName ?: null,
                'supplier' => $supplierName ?: null,
                'sale_price' => $salePriceRaw,
                'cost_price' => $costPrice,
                'stock_quantity' => $stockQuantity,
            ],
            'data' => [
                'code' => $code !== '' ? $code : null,
                'barcode' => $barcode !== '' ? $barcode : null,
                'name' => $name,
                'category_id' => $categoryId,
                'supplier_id' => $supplierId,
                'unit' => $soldBy === 'weight' ? 'KG' : (strtoupper((string) ($row['unit'] ?? 'UN')) ?: 'UN'),
                'sold_by' => $soldBy,
                'cost_price' => $costPrice,
                'sale_price' => $salePriceRaw ?? 0,
                'stock_quantity' => $stockQuantity,
                'min_stock' => $minStock,
            ],
        ];
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

        return is_numeric($value) ? round((float) $value, 3) : null;
    }
}
