<?php

namespace App\Services\Tenant;

use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\OrderDraftItem;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderDraftService
{
    public function activeDrafts(array $channels = [OrderDraft::CHANNEL_STORE]): array
    {
        return OrderDraft::query()
            ->with(['customer:id,name', 'user:id,name'])
            ->whereIn('status', [OrderDraft::STATUS_DRAFT, OrderDraft::STATUS_SENT_TO_CASHIER])
            ->when($channels !== [], fn ($query) => $query->whereIn('channel', $channels))
            ->orderByRaw("CASE WHEN status = ? THEN 0 ELSE 1 END", [OrderDraft::STATUS_DRAFT])
            ->latest('updated_at')
            ->get()
            ->map(fn (OrderDraft $draft) => $this->toSummary($draft))
            ->values()
            ->all();
    }

    public function pendingCheckoutDrafts(?array $channels = null): array
    {
        return OrderDraft::query()
            ->with(['customer:id,name', 'user:id,name'])
            ->where('status', OrderDraft::STATUS_SENT_TO_CASHIER)
            ->whereNull('sale_id')
            ->when(is_array($channels), fn ($query) => $query->whereIn('channel', $channels))
            ->latest('sent_to_cashier_at')
            ->get()
            ->map(fn (OrderDraft $draft) => $this->toSummary($draft))
            ->values()
            ->all();
    }

    public function channelDrafts(array $channels, bool $detailed = false): array
    {
        return OrderDraft::query()
            ->with([
                'customer:id,name,phone',
                'user:id,name',
                'items' => fn ($query) => $query->with('product:id,stock_quantity')->orderBy('id'),
            ])
            ->whereIn('channel', $channels)
            ->whereIn('status', [OrderDraft::STATUS_DRAFT, OrderDraft::STATUS_SENT_TO_CASHIER])
            ->latest('updated_at')
            ->get()
            ->map(fn (OrderDraft $draft) => $detailed ? $this->toDetail($draft) : $this->toSummary($draft))
            ->values()
            ->all();
    }

    public function findForEditing(int $draftId): ?OrderDraft
    {
        return OrderDraft::query()
            ->with([
                'customer:id,name,phone',
                'user:id,name',
                'items' => fn ($query) => $query->with('product:id,stock_quantity')->orderBy('id'),
            ])
            ->find($draftId);
    }

    public function findForCheckout(int $draftId): ?OrderDraft
    {
        return OrderDraft::query()
            ->with([
                'customer:id,name,phone',
                'user:id,name',
                'items' => fn ($query) => $query->with('product:id,stock_quantity')->orderBy('id'),
            ])
            ->where('status', OrderDraft::STATUS_SENT_TO_CASHIER)
            ->whereNull('sale_id')
            ->find($draftId);
    }

    public function create(int $userId, array $attributes = []): OrderDraft
    {
        return OrderDraft::query()->create([
            'user_id' => $userId,
            'type' => $attributes['type'] ?? 'comanda',
            'channel' => $attributes['channel'] ?? OrderDraft::CHANNEL_STORE,
            'reference' => $this->normalizeReference($attributes['reference'] ?? null),
            'customer_id' => $attributes['customer_id'] ?? null,
            'notes' => $attributes['notes'] ?? null,
            'status' => OrderDraft::STATUS_DRAFT,
            'subtotal' => 0,
            'total' => 0,
            'cost_total' => 0,
            'profit' => 0,
        ])->load(['customer:id,name,phone', 'user:id,name', 'items']);
    }

    public function save(OrderDraft $draft, array $payload): OrderDraft
    {
        if ($draft->status === OrderDraft::STATUS_COMPLETED) {
            throw ValidationException::withMessages([
                'order' => 'Este pedido ja foi concluido e nao pode mais ser alterado.',
            ]);
        }

        return DB::transaction(function () use ($draft, $payload) {
            $itemsPayload = collect($payload['items'] ?? []);
            $products = Product::query()
                ->whereIn('id', $itemsPayload->pluck('id')->all())
                ->get()
                ->keyBy('id');
            $nextStatus = $itemsPayload->isEmpty() ? OrderDraft::STATUS_DRAFT : $draft->status;

            if ($products->count() !== $itemsPayload->pluck('id')->unique()->count()) {
                throw ValidationException::withMessages([
                    'items' => 'Um ou mais produtos informados nao existem mais.',
                ]);
            }

            $draft->forceFill([
                'type' => $payload['type'],
                'channel' => $payload['channel'] ?? $draft->channel ?? OrderDraft::CHANNEL_STORE,
                'reference' => $this->normalizeReference($payload['reference'] ?? null),
                'customer_id' => $payload['customer_id'] ?? null,
                'notes' => $payload['notes'] ?? null,
                'status' => $draft->status === OrderDraft::STATUS_COMPLETED ? OrderDraft::STATUS_COMPLETED : ($nextStatus ?: OrderDraft::STATUS_DRAFT),
                'sent_to_cashier_at' => $nextStatus === OrderDraft::STATUS_SENT_TO_CASHIER ? $draft->sent_to_cashier_at : null,
            ])->save();

            $draft->items()->delete();

            $subtotal = 0.0;
            $costTotal = 0.0;

            foreach ($itemsPayload as $item) {
                /** @var Product $product */
                $product = $products->get($item['id']);
                $quantity = round((float) $item['qty'], 3);
                $unitPrice = round((float) $product->sale_price, 2);
                $unitCost = round((float) $product->cost_price, 2);
                $lineTotal = round($unitPrice * $quantity, 2);

                $subtotal += $lineTotal;
                $costTotal += $unitCost * $quantity;

                $draft->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_code' => $product->code,
                    'product_barcode' => $product->barcode,
                    'unit' => $product->unit,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                ]);
            }

            $subtotal = round($subtotal, 2);
            $costTotal = round($costTotal, 2);

            $draft->forceFill([
                'subtotal' => $subtotal,
                'total' => $subtotal,
                'cost_total' => $costTotal,
                'profit' => round($subtotal - $costTotal, 2),
            ])->save();

            return $draft->fresh(['customer:id,name,phone', 'user:id,name', 'items']);
        });
    }

    public function sendToCashier(OrderDraft $draft): OrderDraft
    {
        if ($draft->status === OrderDraft::STATUS_COMPLETED) {
            throw ValidationException::withMessages([
                'order' => 'Este pedido ja foi concluido e nao pode ser enviado novamente.',
            ]);
        }

        if (!$draft->items()->exists()) {
            throw ValidationException::withMessages([
                'items' => 'Adicione ao menos um produto antes de enviar para o caixa.',
            ]);
        }

        $draft->forceFill([
            'status' => OrderDraft::STATUS_SENT_TO_CASHIER,
            'sent_to_cashier_at' => now(),
        ])->save();

        return $draft->fresh(['customer:id,name,phone', 'user:id,name', 'items']);
    }

    public function markAsCompleted(OrderDraft $draft, Sale $sale): void
    {
        $draft->forceFill([
            'sale_id' => $sale->id,
            'status' => OrderDraft::STATUS_COMPLETED,
            'completed_at' => now(),
        ])->save();
    }

    public function toSummary(OrderDraft $draft): array
    {
        $itemsCount = $draft->relationLoaded('items')
            ? $draft->items->count()
            : OrderDraftItem::query()->where('order_draft_id', $draft->id)->count();

        return [
            'id' => $draft->id,
            'type' => $draft->type,
            'channel' => $draft->channel,
            'reference' => $draft->reference,
            'label' => $this->displayLabel($draft),
            'status' => $draft->status,
            'subtotal' => (float) $draft->subtotal,
            'total' => (float) $draft->total,
            'items_count' => $itemsCount,
            'customer' => $draft->customer ? [
                'id' => $draft->customer->id,
                'name' => $draft->customer->name,
            ] : null,
            'created_by' => $draft->user?->name,
            'sent_to_cashier_at' => $draft->sent_to_cashier_at?->toIso8601String(),
            'updated_at' => $draft->updated_at?->toIso8601String(),
        ];
    }

    public function toDetail(OrderDraft $draft): array
    {
        return [
            ...$this->toSummary($draft),
            'notes' => $draft->notes,
            'customer' => $draft->customer ? [
                'id' => $draft->customer->id,
                'name' => $draft->customer->name,
                'phone' => $draft->customer->phone,
            ] : null,
            'items' => $draft->items
                ->sortBy('id')
                ->values()
                ->map(function (OrderDraftItem $item) {
                    return [
                        'id' => $item->product_id,
                        'product_id' => $item->product_id,
                        'name' => $item->product_name,
                        'code' => $item->product_code,
                        'barcode' => $item->product_barcode,
                        'unit' => $item->unit,
                        'qty' => (float) $item->quantity,
                        'cost_price' => (float) $item->unit_cost,
                        'sale_price' => (float) $item->unit_price,
                        'lineTotal' => (float) $item->total,
                        'stock_quantity' => (float) optional($item->product)->stock_quantity,
                    ];
                })
                ->all(),
        ];
    }

    protected function displayLabel(OrderDraft $draft): string
    {
        $prefix = match ($draft->type) {
            'mesa' => 'Mesa',
            'pedido' => 'Pedido',
            default => 'Comanda',
        };

        $reference = $this->normalizeReference($draft->reference);

        return $reference ? "{$prefix} {$reference}" : "{$prefix} #{$draft->id}";
    }

    protected function normalizeReference(?string $reference): ?string
    {
        $reference = trim((string) $reference);

        return $reference !== '' ? $reference : null;
    }
}
