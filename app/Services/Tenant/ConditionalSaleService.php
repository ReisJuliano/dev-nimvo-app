<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\ConditionalSale;
use App\Models\Tenant\ConditionalSaleItem;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SalePayment;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ConditionalSaleService
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
        protected TenantSettingsService $settingsService,
    ) {
    }

    public function pageData(array $filters = []): array
    {
        $status = $filters['status'] ?? 'open';
        $search = trim((string) ($filters['search'] ?? ''));

        $conditionals = $this->conditionalsQuery($status, $search)
            ->get()
            ->map(fn (ConditionalSale $conditionalSale) => $this->serializeConditionalSale($conditionalSale))
            ->values()
            ->all();

        return [
            'filters' => [
                'status' => $status,
                'search' => $search,
            ],
            'statusOptions' => [
                ['value' => 'open', 'label' => 'Abertos'],
                ['value' => 'overdue', 'label' => 'Atrasados'],
                ['value' => 'closed', 'label' => 'Fechados'],
                ['value' => 'all', 'label' => 'Todos'],
            ],
            'summary' => $this->summaryPayload(),
            'topProducts' => $this->topProductsPayload(),
            'conditionals' => $conditionals,
            'selectedConditionalId' => $this->resolveSelectedConditionalId($conditionals, $filters['conditional'] ?? null),
            'customers' => $this->customersPayload(),
            'products' => $this->productsPayload(),
            'paymentMethods' => collect(PaymentMethod::all())
                ->reject(fn (string $method) => $method === PaymentMethod::MIXED)
                ->map(fn (string $method) => [
                    'value' => $method,
                    'label' => PaymentMethod::label($method),
                ])
                ->values()
                ->all(),
        ];
    }

    public function create(array $input, int $userId): ConditionalSale
    {
        $validated = Validator::make($input, [
            'customer_id' => ['required', 'integer'],
            'withdrawn_at' => ['required', 'date'],
            'due_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
        ])->validate();

        $withdrawnAt = Carbon::parse((string) $validated['withdrawn_at']);
        $dueAt = Carbon::parse((string) $validated['due_at'])->startOfDay();

        if ($dueAt->lt($withdrawnAt->copy()->startOfDay())) {
            throw ValidationException::withMessages([
                'due_at' => 'A data limite precisa ser igual ou posterior a retirada.',
            ]);
        }

        return DB::transaction(function () use ($validated, $userId, $withdrawnAt, $dueAt) {
            /** @var Customer $customer */
            $customer = Customer::query()
                ->lockForUpdate()
                ->findOrFail((int) $validated['customer_id']);

            $this->assertCustomerReadyForConditional($customer);
            $this->assertCustomerCanReceiveConditional($customer);

            $normalizedItems = $this->normalizeCreationItems($validated['items']);
            $products = Product::query()
                ->lockForUpdate()
                ->whereIn('id', $normalizedItems->pluck('product_id'))
                ->get()
                ->keyBy('id');

            $subtotal = 0.0;
            $resolvedItems = collect();

            foreach ($normalizedItems as $item) {
                /** @var Product|null $product */
                $product = $products->get($item['product_id']);

                if (! $product || ! $product->active) {
                    throw ValidationException::withMessages([
                        'items' => 'Existe um produto indisponivel na condicional.',
                    ]);
                }

                if ((float) $product->stock_quantity < (float) $item['quantity']) {
                    throw ValidationException::withMessages([
                        'items' => "Estoque insuficiente para {$product->name}.",
                    ]);
                }

                $unitPrice = $item['unit_price'] !== null
                    ? round((float) $item['unit_price'], 2)
                    : round((float) $product->sale_price, 2);

                $resolvedItems->push([
                    'product' => $product,
                    'quantity' => (float) $item['quantity'],
                    'unit_price' => $unitPrice,
                ]);

                $subtotal += round((float) $item['quantity'] * $unitPrice, 2);
            }

            $this->assertCustomerLimit($customer, $subtotal, null, true);

            $conditionalSale = ConditionalSale::query()->create([
                'code' => $this->nextConditionalCode(),
                'customer_id' => $customer->id,
                'user_id' => $userId,
                'status' => 'open',
                'subtotal' => round($subtotal, 2),
                'withdrawn_at' => $withdrawnAt,
                'due_at' => $dueAt->toDateString(),
                'notes' => filled($validated['notes'] ?? null) ? trim((string) $validated['notes']) : null,
            ]);

            foreach ($resolvedItems as $item) {
                /** @var Product $product */
                $product = $item['product'];
                $conditionalSale->items()->create([
                    'product_id' => $product->id,
                    'product_code' => $product->code,
                    'product_name' => $product->name,
                    'quantity_sent' => $item['quantity'],
                    'unit_cost' => $product->cost_price,
                    'unit_price' => $item['unit_price'],
                ]);

                $this->inventoryMovementService->apply($product, -((float) $item['quantity']), 'conditional_outbound', [
                    'user_id' => $userId,
                    'reference' => $conditionalSale,
                    'unit_cost' => $product->cost_price,
                    'notes' => "Saida em condicional {$conditionalSale->code}",
                    'occurred_at' => $withdrawnAt,
                ]);
            }

            return $conditionalSale->fresh(['customer', 'user', 'sale', 'items.product']);
        });
    }

    public function registerReturn(ConditionalSale $conditionalSale, array $input, int $userId): ConditionalSale
    {
        $validated = Validator::make($input, [
            'returned_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.returned_quantity' => ['nullable', 'numeric', 'min:0'],
        ])->validate();

        $returnedAt = Carbon::parse((string) $validated['returned_at']);

        return DB::transaction(function () use ($conditionalSale, $validated, $returnedAt, $userId) {
            /** @var ConditionalSale $lockedConditional */
            $lockedConditional = ConditionalSale::query()
                ->with(['items.product', 'customer', 'user', 'sale'])
                ->lockForUpdate()
                ->findOrFail($conditionalSale->id);

            $this->assertConditionalOpen($lockedConditional);

            $items = $lockedConditional->items->keyBy('id');
            $hasReturnedQuantity = false;

            foreach ($validated['items'] as $entry) {
                $item = $items->get((int) $entry['id']);

                if (! $item) {
                    throw ValidationException::withMessages([
                        'items' => 'Item invalido para a devolucao.',
                    ]);
                }

                $returnedQuantity = round((float) ($entry['returned_quantity'] ?? 0), 3);

                if ($returnedQuantity <= 0) {
                    continue;
                }

                $remainingQuantity = $this->remainingQuantity($item);

                if ($returnedQuantity > $remainingQuantity) {
                    throw ValidationException::withMessages([
                        'items' => "A devolucao de {$item->product_name} ultrapassa o saldo em aberto.",
                    ]);
                }

                $item->forceFill([
                    'quantity_returned' => round((float) $item->quantity_returned + $returnedQuantity, 3),
                ])->save();

                $product = $item->product()->lockForUpdate()->firstOrFail();

                $this->inventoryMovementService->apply($product, $returnedQuantity, 'conditional_return', [
                    'user_id' => $userId,
                    'reference' => $lockedConditional,
                    'unit_cost' => $item->unit_cost,
                    'notes' => "Devolucao do item {$item->product_name} na condicional {$lockedConditional->code}",
                    'occurred_at' => $returnedAt,
                ]);

                $hasReturnedQuantity = true;
            }

            if (! $hasReturnedQuantity) {
                throw ValidationException::withMessages([
                    'items' => 'Informe ao menos uma quantidade para devolver.',
                ]);
            }

            $lockedConditional->forceFill([
                'notes' => $this->mergeNotes(
                    $lockedConditional->notes,
                    filled($validated['notes'] ?? null) ? trim((string) $validated['notes']) : null,
                ),
            ])->save();

            $this->syncConditionalState($lockedConditional, $returnedAt);

            return $lockedConditional->fresh(['customer', 'user', 'sale', 'items.product']);
        });
    }

    public function finalize(ConditionalSale $conditionalSale, array $input, int $userId): array
    {
        $validated = Validator::make($input, [
            'resolved_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'cash_received' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer'],
            'items.*.returned_quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.kept_quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.lost_quantity' => ['nullable', 'numeric', 'min:0'],
            'items.*.damaged_quantity' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['nullable', 'string'],
            'payments.*.amount' => ['nullable', 'numeric', 'min:0'],
        ])->validate();

        $resolvedAt = Carbon::parse((string) $validated['resolved_at']);

        return DB::transaction(function () use ($conditionalSale, $validated, $resolvedAt, $userId) {
            /** @var ConditionalSale $lockedConditional */
            $lockedConditional = ConditionalSale::query()
                ->with(['items.product', 'customer', 'user', 'sale'])
                ->lockForUpdate()
                ->findOrFail($conditionalSale->id);

            $this->assertConditionalOpen($lockedConditional);

            $items = $lockedConditional->items->keyBy('id');
            $billingLines = collect();
            $returnLines = collect();

            foreach ($validated['items'] as $entry) {
                /** @var ConditionalSaleItem|null $item */
                $item = $items->get((int) $entry['id']);

                if (! $item) {
                    throw ValidationException::withMessages([
                        'items' => 'Item invalido para o fechamento.',
                    ]);
                }

                $remainingQuantity = $this->remainingQuantity($item);
                $returnedQuantity = round((float) ($entry['returned_quantity'] ?? 0), 3);
                $keptQuantity = round((float) ($entry['kept_quantity'] ?? 0), 3);
                $lostQuantity = round((float) ($entry['lost_quantity'] ?? 0), 3);
                $damagedQuantity = round((float) ($entry['damaged_quantity'] ?? 0), 3);
                $resolvedQuantity = round($returnedQuantity + $keptQuantity + $lostQuantity + $damagedQuantity, 3);

                if ($remainingQuantity <= 0) {
                    continue;
                }

                if (abs($resolvedQuantity - $remainingQuantity) > 0.001) {
                    throw ValidationException::withMessages([
                        'items' => "Resolva todo o saldo do item {$item->product_name} antes de fechar a condicional.",
                    ]);
                }

                if ($returnedQuantity > 0) {
                    $returnLines->push([
                        'item' => $item,
                        'quantity' => $returnedQuantity,
                    ]);
                }

                if ($keptQuantity > 0 || $lostQuantity > 0 || $damagedQuantity > 0) {
                    $billingLines->push([
                        'item' => $item,
                        'kept_quantity' => $keptQuantity,
                        'lost_quantity' => $lostQuantity,
                        'damaged_quantity' => $damagedQuantity,
                        'billed_quantity' => round($keptQuantity + $lostQuantity + $damagedQuantity, 3),
                        'line_total' => round(($keptQuantity + $lostQuantity + $damagedQuantity) * (float) $item->unit_price, 2),
                    ]);
                }
            }

            if ($returnLines->isEmpty() && $billingLines->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'Nao existe saldo para fechar nesta condicional.',
                ]);
            }

            foreach ($returnLines as $entry) {
                /** @var ConditionalSaleItem $item */
                $item = $entry['item'];
                $product = $item->product()->lockForUpdate()->firstOrFail();

                $item->forceFill([
                    'quantity_returned' => round((float) $item->quantity_returned + (float) $entry['quantity'], 3),
                ])->save();

                $this->inventoryMovementService->apply($product, (float) $entry['quantity'], 'conditional_return', [
                    'user_id' => $userId,
                    'reference' => $lockedConditional,
                    'unit_cost' => $item->unit_cost,
                    'notes' => "Devolucao no fechamento da condicional {$lockedConditional->code}",
                    'occurred_at' => $resolvedAt,
                ]);
            }

            foreach ($billingLines as $entry) {
                /** @var ConditionalSaleItem $item */
                $item = $entry['item'];

                $item->forceFill([
                    'quantity_kept' => round((float) $item->quantity_kept + (float) $entry['kept_quantity'], 3),
                    'quantity_lost' => round((float) $item->quantity_lost + (float) $entry['lost_quantity'], 3),
                    'quantity_damaged' => round((float) $item->quantity_damaged + (float) $entry['damaged_quantity'], 3),
                ])->save();
            }

            $sale = null;
            $billingTotal = round((float) $billingLines->sum('line_total'), 2);

            if ($billingTotal > 0) {
                $payments = $this->normalizePayments($validated['payments'] ?? [], $billingTotal);
                $cashReceived = array_key_exists('cash_received', $validated) && $validated['cash_received'] !== null
                    ? round((float) $validated['cash_received'], 2)
                    : null;
                $cashRegister = $this->resolveOpenCashRegister($userId);

                if ($payments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::CREDIT)) {
                    $creditAmount = round((float) $payments
                        ->where('method', PaymentMethod::CREDIT)
                        ->sum('amount'), 2);

                    $this->assertCustomerLimit($lockedConditional->customer, $creditAmount, $lockedConditional->id, true);
                }

                $sale = $this->createSaleFromConditional(
                    $lockedConditional,
                    $billingLines,
                    $payments,
                    $cashRegister,
                    $cashReceived,
                    $resolvedAt,
                    filled($validated['notes'] ?? null) ? trim((string) $validated['notes']) : null,
                    $userId,
                );

                $lockedConditional->forceFill([
                    'sale_id' => $sale->id,
                ])->save();
            }

            $lockedConditional->forceFill([
                'notes' => $this->mergeNotes($lockedConditional->notes, filled($validated['notes'] ?? null) ? trim((string) $validated['notes']) : null),
            ])->save();

            $this->syncConditionalState($lockedConditional, $resolvedAt);

            return [
                'conditional_sale' => $lockedConditional->fresh(['customer', 'user', 'sale', 'items.product']),
                'sale' => $sale?->fresh(['items.product', 'payments']),
            ];
        });
    }

    protected function conditionalsQuery(string $status, string $search)
    {
        $query = ConditionalSale::query()
            ->with([
                'customer:id,name,phone,document,credit_limit',
                'user:id,name',
                'sale:id,sale_number,total,status',
                'items.product:id,name,code',
            ]);

        if ($status === 'open') {
            $query->whereNull('closed_at');
        } elseif ($status === 'overdue') {
            $query
                ->whereNull('closed_at')
                ->whereDate('due_at', '<', now()->toDateString());
        } elseif ($status === 'closed') {
            $query->whereNotNull('closed_at');
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('code', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($customerQuery) => $customerQuery->where('name', 'like', "%{$search}%"));
            });
        }

        return $query
            ->orderByRaw('CASE WHEN closed_at IS NULL THEN 0 ELSE 1 END')
            ->orderBy('due_at')
            ->orderByDesc('id');
    }

    protected function summaryPayload(): array
    {
        $allConditionals = ConditionalSale::query()
            ->with('items')
            ->get();

        $openConditionals = $allConditionals->filter(fn (ConditionalSale $conditionalSale) => $conditionalSale->closed_at === null);
        $closedConditionals = $allConditionals->filter(fn (ConditionalSale $conditionalSale) => $conditionalSale->closed_at !== null);
        $overdueCount = $openConditionals->filter(
            fn (ConditionalSale $conditionalSale) => $conditionalSale->due_at?->isBefore(now()->startOfDay()),
        )->count();
        $outstandingTotal = $openConditionals->sum(fn (ConditionalSale $conditionalSale) => $this->conditionalOutstandingTotal($conditionalSale));
        $convertedCount = $closedConditionals->filter(fn (ConditionalSale $conditionalSale) => $conditionalSale->sale_id !== null)->count();
        $conversionRate = $allConditionals->count() > 0
            ? round(($convertedCount / $allConditionals->count()) * 100, 1)
            : 0.0;
        $lossItems = ConditionalSaleItem::query()
            ->selectRaw('SUM(quantity_lost + quantity_damaged) as quantity_total')
            ->value('quantity_total');

        return [
            'open_count' => $openConditionals->count(),
            'overdue_count' => $overdueCount,
            'outstanding_total' => round((float) $outstandingTotal, 2),
            'conversion_rate' => $conversionRate,
            'loss_quantity' => round((float) ($lossItems ?? 0), 3),
        ];
    }

    protected function topProductsPayload(): array
    {
        return ConditionalSaleItem::query()
            ->selectRaw('product_id, product_code, product_name, SUM(quantity_sent) as sent_quantity, SUM((quantity_sent - quantity_returned - quantity_kept - quantity_lost - quantity_damaged)) as outstanding_quantity')
            ->groupBy('product_id', 'product_code', 'product_name')
            ->orderByDesc('sent_quantity')
            ->limit(5)
            ->get()
            ->map(fn (ConditionalSaleItem $item) => [
                'product_id' => $item->product_id,
                'product_code' => $item->product_code,
                'product_name' => $item->product_name,
                'sent_quantity' => round((float) $item->getAttribute('sent_quantity'), 3),
                'outstanding_quantity' => round((float) $item->getAttribute('outstanding_quantity'), 3),
            ])
            ->values()
            ->all();
    }

    protected function customersPayload(): array
    {
        $openConditionalExposure = $this->openConditionalExposureByCustomer();
        $overdueCounts = $this->overdueConditionalsByCustomer();
        $openCreditExposure = $this->openCreditExposureByCustomer();

        return Customer::query()
            ->where('active', true)
            ->orderBy('name')
            ->get($this->availableColumns('customers', ['id', 'name', 'document', 'phone', 'credit_limit']))
            ->map(function (Customer $customer) use ($openConditionalExposure, $overdueCounts, $openCreditExposure) {
                $conditionalExposure = round((float) ($openConditionalExposure[$customer->id] ?? 0), 2);
                $creditExposure = round((float) ($openCreditExposure[$customer->id] ?? 0), 2);
                $availableLimit = max(0, round((float) $customer->credit_limit - $conditionalExposure - $creditExposure, 2));

                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'document' => $this->hasColumn('customers', 'document') ? $customer->getAttribute('document') : null,
                    'phone' => $customer->phone,
                    'credit_limit' => (float) $customer->credit_limit,
                    'open_conditional_total' => $conditionalExposure,
                    'open_credit_total' => $creditExposure,
                    'overdue_count' => (int) ($overdueCounts[$customer->id] ?? 0),
                    'available_limit' => $availableLimit,
                ];
            })
            ->values()
            ->all();
    }

    protected function productsPayload(): array
    {
        $conditionalQuantities = $this->openConditionalQuantityByProduct();

        return Product::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'sale_price', 'stock_quantity'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'conditional_quantity' => round((float) ($conditionalQuantities[$product->id] ?? 0), 3),
            ])
            ->values()
            ->all();
    }

    protected function serializeConditionalSale(ConditionalSale $conditionalSale): array
    {
        $conditionalSale->loadMissing(['customer', 'user', 'sale', 'items.product']);

        $returnedTotal = $conditionalSale->items->sum(
            fn (ConditionalSaleItem $item) => round((float) $item->quantity_returned * (float) $item->unit_price, 2),
        );
        $billedTotal = $conditionalSale->items->sum(
            fn (ConditionalSaleItem $item) => round(($this->billedQuantity($item)) * (float) $item->unit_price, 2),
        );
        $outstandingTotal = $this->conditionalOutstandingTotal($conditionalSale);
        [$statusLabel, $statusTone] = $this->statusPresentation($conditionalSale);

        return [
            'id' => $conditionalSale->id,
            'code' => $conditionalSale->code,
            'customer' => [
                'id' => $conditionalSale->customer?->id,
                'name' => $conditionalSale->customer?->name,
                'document' => $this->hasColumn('customers', 'document') ? $conditionalSale->customer?->getAttribute('document') : null,
                'phone' => $conditionalSale->customer?->phone,
                'credit_limit' => (float) ($conditionalSale->customer?->credit_limit ?? 0),
            ],
            'operator_name' => $conditionalSale->user?->name,
            'sale' => $conditionalSale->sale ? [
                'id' => $conditionalSale->sale->id,
                'sale_number' => $conditionalSale->sale->sale_number,
                'total' => (float) $conditionalSale->sale->total,
            ] : null,
            'status' => $conditionalSale->status,
            'status_label' => $statusLabel,
            'status_tone' => $statusTone,
            'subtotal' => (float) $conditionalSale->subtotal,
            'returned_total' => round((float) $returnedTotal, 2),
            'billed_total' => round((float) $billedTotal, 2),
            'outstanding_total' => round((float) $outstandingTotal, 2),
            'withdrawn_at' => $conditionalSale->withdrawn_at?->toIso8601String(),
            'due_at' => $conditionalSale->due_at?->toDateString(),
            'closed_at' => $conditionalSale->closed_at?->toIso8601String(),
            'notes' => $conditionalSale->notes,
            'days_overdue' => $conditionalSale->closed_at === null && $conditionalSale->due_at?->isBefore(now()->startOfDay())
                ? $conditionalSale->due_at->diffInDays(now()->startOfDay())
                : 0,
            'items' => $conditionalSale->items
                ->map(fn (ConditionalSaleItem $item) => $this->serializeConditionalSaleItem($item))
                ->values()
                ->all(),
        ];
    }

    protected function serializeConditionalSaleItem(ConditionalSaleItem $item): array
    {
        $remainingQuantity = $this->remainingQuantity($item);
        $billedQuantity = $this->billedQuantity($item);

        return [
            'id' => $item->id,
            'product_id' => $item->product_id,
            'product_code' => $item->product_code,
            'product_name' => $item->product_name,
            'quantity_sent' => (float) $item->quantity_sent,
            'quantity_returned' => (float) $item->quantity_returned,
            'quantity_kept' => (float) $item->quantity_kept,
            'quantity_lost' => (float) $item->quantity_lost,
            'quantity_damaged' => (float) $item->quantity_damaged,
            'remaining_quantity' => $remainingQuantity,
            'billed_quantity' => $billedQuantity,
            'unit_price' => (float) $item->unit_price,
            'line_total' => round((float) $item->quantity_sent * (float) $item->unit_price, 2),
            'remaining_total' => round($remainingQuantity * (float) $item->unit_price, 2),
        ];
    }

    protected function normalizeCreationItems(array $items): Collection
    {
        return collect($items)
            ->map(function (array $item) {
                return [
                    'product_id' => (int) $item['product_id'],
                    'quantity' => round((float) $item['quantity'], 3),
                    'unit_price' => isset($item['unit_price']) && $item['unit_price'] !== null
                        ? round((float) $item['unit_price'], 2)
                        : null,
                ];
            })
            ->groupBy('product_id')
            ->map(function (Collection $groupedItems, int|string $productId) {
                $quantity = round((float) $groupedItems->sum('quantity'), 3);
                $unitPrice = $groupedItems->last()['unit_price'];

                return [
                    'product_id' => (int) $productId,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                ];
            })
            ->values();
    }

    protected function normalizePayments(array $payments, float $total): Collection
    {
        if ($total <= 0) {
            return collect();
        }

        if ($payments === []) {
            throw ValidationException::withMessages([
                'payments' => 'Informe ao menos uma forma de pagamento para os itens cobrados.',
            ]);
        }

        $normalized = collect($payments)->map(fn (array $payment) => [
            'method' => PaymentMethod::normalize($payment['method'] ?? null),
            'amount' => $payment['amount'] ?? null,
        ]);

        if ($normalized->contains(fn (array $payment) => $payment['method'] === PaymentMethod::MIXED)) {
            throw ValidationException::withMessages([
                'payments' => 'Detalhe o pagamento misto em parcelas separadas.',
            ]);
        }

        $resolved = $normalized->values()->map(function (array $payment) use ($normalized, $total) {
            if ($normalized->count() === 1 && $payment['amount'] === null) {
                return [
                    'method' => $payment['method'],
                    'amount' => $total,
                ];
            }

            if ($payment['amount'] === null) {
                throw ValidationException::withMessages([
                    'payments' => 'Informe o valor de cada parcela do pagamento.',
                ]);
            }

            return [
                'method' => $payment['method'],
                'amount' => round((float) $payment['amount'], 2),
            ];
        });

        if ($resolved->count() > 1 && $resolved->pluck('method')->unique()->count() < 2) {
            throw ValidationException::withMessages([
                'payments' => 'Use ao menos duas formas diferentes para pagamento misto.',
            ]);
        }

        $paymentsTotal = round((float) $resolved->sum('amount'), 2);

        if ($paymentsTotal !== round($total, 2)) {
            throw ValidationException::withMessages([
                'payments' => 'A soma dos pagamentos precisa bater com o total cobrado.',
            ]);
        }

        return $resolved;
    }

    protected function createSaleFromConditional(
        ConditionalSale $conditionalSale,
        Collection $billingLines,
        Collection $payments,
        CashRegister $cashRegister,
        ?float $cashReceived,
        Carbon $resolvedAt,
        ?string $resolutionNotes,
        int $userId,
    ): Sale {
        $subtotal = round((float) $billingLines->sum('line_total'), 2);
        $costTotal = round((float) $billingLines->sum(
            fn (array $entry) => (float) $entry['item']->unit_cost * (float) $entry['billed_quantity'],
        ), 2);
        $cashAmount = round((float) $payments->where('method', PaymentMethod::CASH)->sum('amount'), 2);
        $changeAmount = 0.0;

        if ($cashReceived !== null) {
            if ($cashAmount <= 0) {
                throw ValidationException::withMessages([
                    'cash_received' => 'Informe dinheiro recebido apenas quando houver parcela em dinheiro.',
                ]);
            }

            if ($cashReceived < $cashAmount) {
                throw ValidationException::withMessages([
                    'cash_received' => 'O valor em dinheiro precisa cobrir a parcela em dinheiro.',
                ]);
            }

            $changeAmount = round($cashReceived - $cashAmount, 2);
        }

        $paymentMethods = $payments->pluck('method')->unique()->values();
        $paymentMethod = $paymentMethods->count() === 1 ? $paymentMethods->first() : PaymentMethod::MIXED;
        $sale = Sale::query()->create(array_filter([
            'sale_number' => $this->nextSaleNumber(),
            'customer_id' => $conditionalSale->customer_id,
            'user_id' => $userId,
            'cash_register_id' => $cashRegister->id,
            'subtotal' => $subtotal,
            'discount' => 0,
            'total' => $subtotal,
            'cost_total' => $costTotal,
            'profit' => round($subtotal - $costTotal, 2),
            'payment_method' => $paymentMethod,
            'status' => 'finalized',
            'notes' => $this->buildConvertedSaleNotes($conditionalSale, $billingLines, $resolutionNotes),
            'requested_document_model' => $this->hasColumn('sales', 'requested_document_model') ? '65' : null,
            'cash_received' => $this->hasColumn('sales', 'cash_received') ? $cashReceived : null,
            'change_amount' => $this->hasColumn('sales', 'change_amount') ? $changeAmount : null,
        ], fn ($value) => $value !== null));

        foreach ($billingLines as $entry) {
            /** @var ConditionalSaleItem $item */
            $item = $entry['item'];
            $quantity = round((float) $entry['billed_quantity'], 3);
            $lineTotal = round((float) $entry['line_total'], 2);
            $unitPrice = $quantity > 0
                ? round($lineTotal / $quantity, 2)
                : (float) $item->unit_price;

            $sale->items()->create([
                'product_id' => $item->product_id,
                'quantity' => $quantity,
                'unit_cost' => $item->unit_cost,
                'unit_price' => $unitPrice,
                'total' => $lineTotal,
                'profit' => round($lineTotal - ((float) $item->unit_cost * $quantity), 2),
            ]);
        }

        foreach ($payments as $payment) {
            $sale->payments()->create([
                'payment_method' => $payment['method'],
                'amount' => $payment['amount'],
            ]);
        }

        $sale->forceFill([
            'created_at' => $resolvedAt,
            'updated_at' => $resolvedAt,
        ])->saveQuietly();

        return $sale;
    }

    protected function buildConvertedSaleNotes(ConditionalSale $conditionalSale, Collection $billingLines, ?string $resolutionNotes): string
    {
        $segments = ["Conversao da condicional {$conditionalSale->code}."];

        foreach ($billingLines as $entry) {
            /** @var ConditionalSaleItem $item */
            $item = $entry['item'];
            $descriptions = [];

            if ((float) $entry['kept_quantity'] > 0) {
                $descriptions[] = 'ficou '.$this->formatQuantity((float) $entry['kept_quantity']);
            }

            if ((float) $entry['lost_quantity'] > 0) {
                $descriptions[] = 'nao devolveu '.$this->formatQuantity((float) $entry['lost_quantity']);
            }

            if ((float) $entry['damaged_quantity'] > 0) {
                $descriptions[] = 'avariou '.$this->formatQuantity((float) $entry['damaged_quantity']);
            }

            if ($descriptions !== []) {
                $segments[] = "{$item->product_name}: ".implode(', ', $descriptions).'.';
            }
        }

        if (filled($resolutionNotes)) {
            $segments[] = $resolutionNotes;
        }

        return implode(' ', $segments);
    }

    protected function assertCustomerReadyForConditional(Customer $customer): void
    {
        if (! $customer->active) {
            throw ValidationException::withMessages([
                'customer_id' => 'O cliente selecionado esta inativo.',
            ]);
        }

        if (blank($customer->name) || blank($customer->phone) || blank($this->hasColumn('customers', 'document') ? $customer->getAttribute('document') : null)) {
            throw ValidationException::withMessages([
                'customer_id' => 'Cliente precisa ter nome, documento e telefone para sair em condicional.',
            ]);
        }
    }

    protected function assertCustomerCanReceiveConditional(Customer $customer): void
    {
        $hasOverdueConditional = ConditionalSale::query()
            ->where('customer_id', $customer->id)
            ->whereNull('closed_at')
            ->whereDate('due_at', '<', now()->toDateString())
            ->exists();

        if ($hasOverdueConditional) {
            throw ValidationException::withMessages([
                'customer_id' => 'Este cliente possui condicional atrasado e nao pode retirar novas pecas.',
            ]);
        }
    }

    protected function assertCustomerLimit(
        Customer $customer,
        float $incomingAmount,
        ?int $ignoreConditionalId = null,
        bool $includeCreditExposure = false,
    ): void {
        if ((float) $customer->credit_limit <= 0) {
            return;
        }

        $conditionalExposure = $this->customerOpenConditionalExposure($customer->id, $ignoreConditionalId);
        $creditExposure = $includeCreditExposure ? $this->customerOpenCreditExposure($customer->id) : 0.0;
        $availableLimit = round((float) $customer->credit_limit - $conditionalExposure - $creditExposure, 2);

        if (round($incomingAmount, 2) > $availableLimit) {
            throw ValidationException::withMessages([
                'customer_id' => 'O valor da condicional ultrapassa o limite disponivel deste cliente.',
            ]);
        }
    }

    protected function assertConditionalOpen(ConditionalSale $conditionalSale): void
    {
        if ($conditionalSale->closed_at !== null || $conditionalSale->status === 'closed') {
            throw ValidationException::withMessages([
                'conditional' => 'Esta condicional ja foi encerrada.',
            ]);
        }
    }

    protected function syncConditionalState(ConditionalSale $conditionalSale, ?Carbon $resolvedAt = null): void
    {
        $conditionalSale->load('items');
        $remainingTotal = $conditionalSale->items->sum(fn (ConditionalSaleItem $item) => $this->remainingQuantity($item));

        $conditionalSale->forceFill([
            'status' => $remainingTotal > 0 ? 'open' : 'closed',
            'closed_at' => $remainingTotal > 0 ? null : ($resolvedAt ?? now()),
        ])->save();
    }

    protected function customerOpenConditionalExposure(int $customerId, ?int $ignoreConditionalId = null): float
    {
        $query = ConditionalSale::query()
            ->where('customer_id', $customerId)
            ->whereNull('closed_at');

        if ($ignoreConditionalId) {
            $query->where('id', '!=', $ignoreConditionalId);
        }

        return (float) $query
            ->with('items')
            ->get()
            ->sum(fn (ConditionalSale $conditionalSale) => $this->conditionalOutstandingTotal($conditionalSale));
    }

    protected function customerOpenCreditExposure(int $customerId): float
    {
        return (float) Sale::query()
            ->where('customer_id', $customerId)
            ->where('status', 'finalized')
            ->join('sale_payments', 'sale_payments.sale_id', '=', 'sales.id')
            ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
            ->sum('sale_payments.amount');
    }

    protected function openConditionalExposureByCustomer(): array
    {
        return ConditionalSale::query()
            ->with('items')
            ->whereNull('closed_at')
            ->get()
            ->groupBy('customer_id')
            ->map(fn (Collection $conditionals) => round((float) $conditionals->sum(
                fn (ConditionalSale $conditionalSale) => $this->conditionalOutstandingTotal($conditionalSale),
            ), 2))
            ->all();
    }

    protected function overdueConditionalsByCustomer(): array
    {
        return ConditionalSale::query()
            ->selectRaw('customer_id, COUNT(*) as aggregate')
            ->whereNull('closed_at')
            ->whereDate('due_at', '<', now()->toDateString())
            ->groupBy('customer_id')
            ->pluck('aggregate', 'customer_id')
            ->map(fn ($value) => (int) $value)
            ->all();
    }

    protected function openCreditExposureByCustomer(): array
    {
        return SalePayment::query()
            ->selectRaw('sales.customer_id, SUM(sale_payments.amount) as aggregate')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->whereNotNull('sales.customer_id')
            ->where('sales.status', 'finalized')
            ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
            ->groupBy('sales.customer_id')
            ->pluck('aggregate', 'sales.customer_id')
            ->map(fn ($value) => round((float) $value, 2))
            ->all();
    }

    protected function openConditionalQuantityByProduct(): array
    {
        return ConditionalSaleItem::query()
            ->with('conditionalSale:id,closed_at')
            ->get()
            ->filter(fn (ConditionalSaleItem $item) => $item->conditionalSale?->closed_at === null)
            ->groupBy('product_id')
            ->map(fn (Collection $items) => round((float) $items->sum(fn (ConditionalSaleItem $item) => $this->remainingQuantity($item)), 3))
            ->all();
    }

    protected function conditionalOutstandingTotal(ConditionalSale $conditionalSale): float
    {
        return round((float) $conditionalSale->items->sum(
            fn (ConditionalSaleItem $item) => $this->remainingQuantity($item) * (float) $item->unit_price,
        ), 2);
    }

    protected function remainingQuantity(ConditionalSaleItem $item): float
    {
        return round(
            (float) $item->quantity_sent
            - (float) $item->quantity_returned
            - (float) $item->quantity_kept
            - (float) $item->quantity_lost
            - (float) $item->quantity_damaged,
            3,
        );
    }

    protected function billedQuantity(ConditionalSaleItem $item): float
    {
        return round((float) $item->quantity_kept + (float) $item->quantity_lost + (float) $item->quantity_damaged, 3);
    }

    protected function statusPresentation(ConditionalSale $conditionalSale): array
    {
        $hasReturned = $conditionalSale->items->contains(fn (ConditionalSaleItem $item) => (float) $item->quantity_returned > 0);
        $hasBilled = $conditionalSale->items->contains(fn (ConditionalSaleItem $item) => $this->billedQuantity($item) > 0);

        if ($conditionalSale->closed_at !== null) {
            if ($hasBilled && $hasReturned) {
                return ['Parcial', 'success'];
            }

            if ($hasBilled) {
                return ['Convertido', 'success'];
            }

            return ['Devolvido', 'success'];
        }

        if ($conditionalSale->due_at?->isBefore(now()->startOfDay())) {
            return ['Atrasado', 'danger'];
        }

        if ($hasReturned) {
            return ['Em ajuste', 'warning'];
        }

        return ['Em aberto', 'warning'];
    }

    protected function resolveSelectedConditionalId(array $conditionals, mixed $selectedId): ?int
    {
        $selectedId = filled($selectedId) ? (int) $selectedId : null;

        if ($selectedId && collect($conditionals)->contains(fn (array $conditionalSale) => $conditionalSale['id'] === $selectedId)) {
            return $selectedId;
        }

        return $conditionals[0]['id'] ?? null;
    }

    protected function resolveOpenCashRegister(int $userId): CashRegister
    {
        $cashRegister = CashRegister::query()
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->latest('opened_at')
            ->first();

        if (! $cashRegister) {
            throw ValidationException::withMessages([
                'payments' => 'Abra um caixa antes de converter a condicional em venda.',
            ]);
        }

        return $cashRegister;
    }

    protected function nextConditionalCode(): string
    {
        $prefix = now()->format('Ymd');
        $sequence = ConditionalSale::query()->whereDate('created_at', now())->count() + 1;

        return sprintf('COND-%s-%04d', $prefix, $sequence);
    }

    protected function nextSaleNumber(): string
    {
        $prefix = now()->format('Ymd');
        $count = Sale::query()->whereDate('created_at', now())->count() + 1;

        return sprintf('VND-%s-%04d', $prefix, $count);
    }

    protected function mergeNotes(?string $baseNotes, ?string $extraNotes): ?string
    {
        $notes = collect([$baseNotes, $extraNotes])
            ->filter(fn ($value) => filled($value))
            ->implode("\n");

        return $notes !== '' ? $notes : null;
    }

    protected function formatQuantity(float $quantity): string
    {
        return rtrim(rtrim(number_format($quantity, 3, '.', ''), '0'), '.');
    }

    protected function availableColumns(string $table, array $columns): array
    {
        return array_values(array_filter($columns, fn (string $column) => $this->hasColumn($table, $column)));
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new ConditionalSale())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new ConditionalSale())->getConnectionName())->hasColumn($table, $column);
    }
}
