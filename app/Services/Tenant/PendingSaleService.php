<?php

namespace App\Services\Tenant;

use App\Models\Tenant\PendingSale;
use App\Models\Tenant\Product;
use Illuminate\Support\Facades\Schema;

class PendingSaleService
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function currentForUser(int $userId): ?PendingSale
    {
        if (!$this->hasTable('pending_sales')) {
            return null;
        }

        return PendingSale::query()
            ->with($this->pendingSaleRelations())
            ->where('user_id', $userId)
            ->first();
    }

    public function save(int $userId, array $payload): ?PendingSale
    {
        if (!$this->hasTable('pending_sales')) {
            return null;
        }

        $normalizedPayload = $this->normalizePayload($payload);
        $pendingSale = PendingSale::query()->firstOrNew(['user_id' => $userId]);

        $pendingSale->fill([
            'cash_register_id' => $normalizedPayload['cash_register_id'] ?? null,
            'order_draft_id' => $normalizedPayload['order_draft_id'] ?? null,
            'customer_id' => $normalizedPayload['customer_id'] ?? null,
            'company_id' => $normalizedPayload['company_id'] ?? null,
            'cart_payload' => $normalizedPayload['cart_payload'] ?? [],
            'discount_payload' => $normalizedPayload['discount_payload'] ?? null,
            'payment_payload' => $normalizedPayload['payment_payload'] ?? null,
            'notes' => $normalizedPayload['notes'] ?? null,
            'status' => $normalizedPayload['status'] ?? 'draft',
        ])->save();

        return $this->currentForUser($userId) ?? $pendingSale;
    }

    public function discard(int $userId): void
    {
        if (!$this->hasTable('pending_sales')) {
            return;
        }

        PendingSale::query()->where('user_id', $userId)->delete();
    }

    public function markRestored(PendingSale $pendingSale): PendingSale
    {
        if (!$this->hasTable('pending_sales')) {
            return $pendingSale;
        }

        $pendingSale->forceFill([
            'restored_at' => now(),
        ])->save();

        return $pendingSale->fresh($this->pendingSaleRelations()) ?? $pendingSale;
    }

    public function serialize(?PendingSale $pendingSale): ?array
    {
        if (!$pendingSale) {
            return null;
        }

        return [
            'id' => $pendingSale->id,
            'customer_id' => $pendingSale->customer_id,
            'company_id' => $pendingSale->company_id,
            'order_draft_id' => $pendingSale->order_draft_id,
            'cash_register_id' => $pendingSale->cash_register_id,
            'cart' => $this->normalizeCartPayload($pendingSale->cart_payload ?? []),
            'discount' => $pendingSale->discount_payload,
            'payment' => $pendingSale->payment_payload,
            'notes' => $pendingSale->notes,
            'status' => $pendingSale->status,
            'restored_at' => $pendingSale->restored_at?->toIso8601String(),
            'updated_at' => $pendingSale->updated_at?->toIso8601String(),
            'customer' => $pendingSale->customer ? [
                'id' => $pendingSale->customer->id,
                'name' => $pendingSale->customer->name,
                'document' => $pendingSale->customer->document,
                'phone' => $pendingSale->customer->phone,
            ] : null,
            'company' => $this->hasTable('companies') && $pendingSale->company ? [
                'id' => $pendingSale->company->id,
                'name' => $pendingSale->company->name,
                'document' => $pendingSale->company->document,
                'phone' => $pendingSale->company->phone,
            ] : null,
        ];
    }

    protected function normalizePayload(array $payload): array
    {
        return [
            ...$payload,
            'cart_payload' => $this->normalizeCartPayload($payload['cart_payload'] ?? []),
        ];
    }

    protected function normalizeCartPayload(array $cartPayload): array
    {
        if ($cartPayload === []) {
            return [];
        }

        $products = $this->productsForPendingSale($cartPayload);
        $normalizedItems = [];

        foreach ($cartPayload as $item) {
            $normalizedItem = $this->normalizeCartItem($item, $products);

            if ($normalizedItem) {
                $normalizedItems[] = $normalizedItem;
            }
        }

        return $normalizedItems;
    }

    protected function normalizeCartItem(mixed $item, array $products): ?array
    {
        if (! is_array($item)) {
            return null;
        }

        $productId = (int) ($item['id'] ?? 0);

        if ($productId <= 0) {
            return null;
        }

        /** @var Product|null $product */
        $product = $products[$productId] ?? null;
        $qty = max(0.001, $this->normalizeNumber($item['qty'] ?? null, 1, 3));
        $costPrice = max(0, $this->normalizeNumber($item['cost_price'] ?? null, (float) ($product?->cost_price ?? 0), 2));
        $salePrice = max(0, $this->normalizeNumber($item['sale_price'] ?? null, (float) ($product?->sale_price ?? 0), 2));
        $stockQuantity = $this->normalizeNumber($item['stock_quantity'] ?? null, (float) ($product?->stock_quantity ?? 0), 3);
        $lineSubtotal = max(0, $this->normalizeNumber(
            $this->firstPresentValue($item, ['lineSubtotal', 'line_subtotal']),
            $salePrice * $qty,
            2,
        ));
        $providedLineTotal = $this->firstPresentValue($item, ['lineTotal', 'line_total']);
        $providedLineDiscount = $this->firstPresentValue($item, ['lineDiscount', 'line_discount']);
        $lineDiscount = $providedLineDiscount !== null
            ? $this->normalizeNumber($providedLineDiscount, 0, 2)
            : ($providedLineTotal !== null ? max(0, round($lineSubtotal - (float) $providedLineTotal, 2)) : 0);
        $lineDiscount = min($lineSubtotal, max(0, $lineDiscount));
        $lineTotal = $providedLineTotal !== null
            ? $this->normalizeNumber($providedLineTotal, max(0, $lineSubtotal - $lineDiscount), 2)
            : round(max(0, $lineSubtotal - $lineDiscount), 2);
        $lineTotal = min($lineSubtotal, max(0, $lineTotal));

        return [
            'id' => $productId,
            'code' => $this->normalizeString($item['code'] ?? $product?->code),
            'barcode' => $this->normalizeString($item['barcode'] ?? $product?->barcode),
            'name' => $this->normalizeString($item['name'] ?? $product?->name),
            'description' => $this->normalizeString($item['description'] ?? $product?->description),
            'unit' => $this->normalizeString($item['unit'] ?? $product?->unit),
            'qty' => $qty,
            'cost_price' => $costPrice,
            'sale_price' => $salePrice,
            'stock_quantity' => $stockQuantity,
            'lineSubtotal' => $lineSubtotal,
            'lineDiscount' => $lineDiscount,
            'lineTotal' => $lineTotal,
        ];
    }

    protected function productsForPendingSale(array $cartPayload): array
    {
        if (! $this->hasTable('products')) {
            return [];
        }

        $productIds = collect($cartPayload)
            ->map(fn (mixed $item) => is_array($item) ? (int) ($item['id'] ?? 0) : 0)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($productIds === []) {
            return [];
        }

        $columns = $this->availableColumns('products', [
            'id',
            'code',
            'barcode',
            'name',
            'description',
            'unit',
            'cost_price',
            'sale_price',
            'stock_quantity',
        ]);

        return Product::query()
            ->whereKey($productIds)
            ->get($columns)
            ->keyBy(fn (Product $product) => (int) $product->getKey())
            ->all();
    }

    protected function pendingSaleRelations(): array
    {
        $relations = [];

        if ($this->hasTable('customers')) {
            $customerColumns = $this->availableColumns('customers', ['id', 'name', 'document', 'phone']);
            $relations['customer'] = fn ($query) => $query->select($customerColumns);
        }

        if ($this->hasTable('companies')) {
            $companyColumns = $this->availableColumns('companies', ['id', 'name', 'document', 'phone']);
            $relations['company'] = fn ($query) => $query->select($companyColumns);
        }

        if ($this->hasTable('order_drafts')) {
            $orderDraftColumns = $this->availableColumns('order_drafts', ['id', 'reference', 'status']);
            $relations['orderDraft'] = fn ($query) => $query->select($orderDraftColumns);
        }

        return $relations;
    }

    protected function firstPresentValue(array $item, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $item) && $item[$key] !== '') {
                return $item[$key];
            }
        }

        return null;
    }

    protected function normalizeNumber(mixed $value, float $fallback = 0, int $precision = 2): float
    {
        if ($value === null || $value === '') {
            return round($fallback, $precision);
        }

        return round((float) $value, $precision);
    }

    protected function normalizeString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    protected function availableColumns(string $table, array $columns): array
    {
        return array_values(array_filter($columns, fn (string $column) => $this->hasColumn($table, $column)));
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new PendingSale())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new PendingSale())->getConnectionName())->hasColumn($table, $column);
    }
}
