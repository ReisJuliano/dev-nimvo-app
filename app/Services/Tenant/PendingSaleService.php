<?php

namespace App\Services\Tenant;

use App\Models\Tenant\PendingSale;
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

        $pendingSale = PendingSale::query()->firstOrNew(['user_id' => $userId]);

        $pendingSale->fill([
            'cash_register_id' => $payload['cash_register_id'] ?? null,
            'order_draft_id' => $payload['order_draft_id'] ?? null,
            'customer_id' => $payload['customer_id'] ?? null,
            'company_id' => $payload['company_id'] ?? null,
            'cart_payload' => $payload['cart_payload'] ?? [],
            'discount_payload' => $payload['discount_payload'] ?? null,
            'payment_payload' => $payload['payment_payload'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'status' => $payload['status'] ?? 'draft',
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
            'cart' => $pendingSale->cart_payload ?? [],
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
