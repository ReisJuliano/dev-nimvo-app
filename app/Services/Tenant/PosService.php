<?php

namespace App\Services\Tenant;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Customer;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class PosService
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __construct(
        protected OrderDraftService $orderDraftService,
        protected TenantSettingsService $settingsService,
        protected InventoryMovementService $inventoryMovementService,
        protected PendingSaleService $pendingSaleService,
        protected ConditionalSaleService $conditionalSaleService,
    ) {
    }

    public function finalize(array $payload, int $userId): array
    {
        $cashRegister = null;

        if (!empty($payload['cash_register_id'])) {
            $cashRegister = CashRegister::query()
                ->where('user_id', $userId)
                ->where('status', 'open')
                ->find($payload['cash_register_id']);
        }

        if (! $cashRegister) {
            $cashRegister = CashRegister::query()
                ->where('user_id', $userId)
                ->where('status', 'open')
                ->latest('opened_at')
                ->first();
        }

        if (! $cashRegister) {
            throw ValidationException::withMessages([
                'cash_register' => 'Abra um caixa antes de finalizar a venda.',
            ]);
        }

        return DB::transaction(function () use ($payload, $userId, $cashRegister) {
            $orderDraft = null;

            if (!empty($payload['order_draft_id'])) {
                if (!$this->settingsService->isModuleEnabled('pedidos')) {
                    throw ValidationException::withMessages([
                        'order_draft_id' => 'Pedidos estao desativados para esta operacao.',
                    ]);
                }

                $orderDraft = OrderDraft::query()
                    ->lockForUpdate()
                    ->find($payload['order_draft_id']);

                if (!$orderDraft || $orderDraft->status === OrderDraft::STATUS_COMPLETED || $orderDraft->sale_id) {
                    throw ValidationException::withMessages([
                        'order_draft_id' => 'Este pedido nao esta mais disponivel para cobranca.',
                    ]);
                }
            }

            $items = collect($payload['items'])->map(function (array $item) {
                /** @var Product $product */
                $product = Product::query()->lockForUpdate()->findOrFail($item['id']);
                $quantity = (float) $item['qty'];
                $unitPrice = array_key_exists('unit_price', $item) && $item['unit_price'] !== null
                    ? round((float) $item['unit_price'], 2)
                    : round((float) $product->sale_price, 2);

                if ((float) $product->stock_quantity < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => "Estoque insuficiente para {$product->name}.",
                    ]);
                }

                $lineSubtotal = round($unitPrice * $quantity, 2);
                $lineDiscount = round((float) ($item['discount'] ?? 0), 2);

                if ($lineDiscount < 0 || $lineDiscount > $lineSubtotal) {
                    throw ValidationException::withMessages([
                        'items' => "Desconto invalido para {$product->name}.",
                    ]);
                }

                $discountPercent = array_key_exists('discount_percent', $item)
                    ? round((float) ($item['discount_percent'] ?? 0), 4)
                    : ($lineSubtotal > 0 && $lineDiscount > 0 ? round(($lineDiscount / $lineSubtotal) * 100, 4) : null);

                $discountAuthorizer = $lineDiscount > 0
                    ? ($item['discount_authorized_by'] ?? null)
                    : null;

                if ($lineDiscount > 0 && !$discountAuthorizer) {
                    throw ValidationException::withMessages([
                        'items' => "O desconto do produto {$product->name} precisa de autorizacao gerencial.",
                    ]);
                }

                return [
                    'product' => $product,
                    'quantity' => $quantity,
                    'unitPrice' => $unitPrice,
                    'lineSubtotal' => $lineSubtotal,
                    'lineDiscount' => $lineDiscount,
                    'discountPercent' => $discountPercent,
                    'discountScope' => $item['discount_scope'] ?? ($lineDiscount > 0 ? 'item' : null),
                    'discountAuthorizedBy' => $discountAuthorizer,
                ];
            });

            $subtotal = round($items->sum('lineSubtotal'), 2);
            $costTotal = $items->sum(fn ($item) => (float) $item['product']->cost_price * $item['quantity']);
            $discount = round((float) ($payload['discount'] ?? 0), 2);
            $itemDiscountTotal = round($items->sum('lineDiscount'), 2);

            if (abs($itemDiscountTotal - $discount) > 0.02) {
                throw ValidationException::withMessages([
                    'discount' => 'O desconto total nao confere com os descontos aplicados nos itens.',
                ]);
            }

            if ($discount > $subtotal) {
                throw ValidationException::withMessages([
                    'discount' => 'O desconto nao pode ser maior que o subtotal da venda.',
                ]);
            }

            $total = round(max(0, $subtotal - $discount), 2);
            $cashReceived = array_key_exists('cash_received', $payload) && $payload['cash_received'] !== null
                ? round((float) $payload['cash_received'], 2)
                : null;

            $payments = collect($payload['payments'])->map(function (array $payment) {
                return [
                    'method' => PaymentMethod::normalize($payment['method'] ?? null),
                    'amount' => $payment['amount'] ?? null,
                ];
            });

            if ($payments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::MIXED)) {
                throw ValidationException::withMessages([
                    'payments' => 'O pagamento misto deve ser detalhado em parcelas.',
                ]);
            }

            $resolvedPayments = $payments->values()->map(function (array $payment) use ($payments, $total) {
                if ($payments->count() === 1 && $payment['amount'] === null) {
                    return ['method' => $payment['method'], 'amount' => $total];
                }

                if ($payment['amount'] === null) {
                    throw ValidationException::withMessages([
                        'payments' => 'Informe o valor de cada parcela do pagamento misto.',
                    ]);
                }

                return ['method' => $payment['method'], 'amount' => (float) $payment['amount']];
            });

            $isConditionalPayment = $resolvedPayments->count() === 1
                && $resolvedPayments->first()['method'] === PaymentMethod::CONDITIONAL;

            if ($resolvedPayments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::CONDITIONAL) && ! $isConditionalPayment) {
                throw ValidationException::withMessages([
                    'payments' => 'Venda condicional deve ser usada como forma unica de pagamento.',
                ]);
            }

            if ($resolvedPayments->count() > 1 && $resolvedPayments->pluck('method')->unique()->count() < 2) {
                throw ValidationException::withMessages([
                    'payments' => 'Use ao menos duas formas para registrar pagamento misto.',
                ]);
            }

            if (
                $resolvedPayments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::CREDIT)
                && !$this->settingsService->isModuleEnabled('prazo')
            ) {
                throw ValidationException::withMessages([
                    'payments' => 'O pagamento a prazo esta desativado para esta operacao.',
                ]);
            }

            $paymentsTotal = round($resolvedPayments->sum('amount'), 2);
            if (round($paymentsTotal, 2) !== round($total, 2)) {
                throw ValidationException::withMessages([
                    'payments' => 'A soma dos pagamentos precisa ser igual ao total da venda.',
                ]);
            }

            $recipientPayload = $this->normalizeRecipientPayload($payload['recipient_payload'] ?? null);
            $customerId = $payload['customer_id'] ?? $recipientPayload['customer_id'] ?? $orderDraft?->customer_id;
            $companyId = $this->hasTable('companies')
                ? ($payload['company_id'] ?? $recipientPayload['company_id'] ?? null)
                : null;
            $requestedDocumentModel = (string) ($payload['requested_document_model'] ?? '65');
            $fiscalDecision = $payload['fiscal_decision'] ?? null;

            if ($isConditionalPayment) {
                if (! $this->settingsService->isModuleEnabled('prazo')) {
                    throw ValidationException::withMessages([
                        'payments' => 'Venda condicional esta desativada para esta operacao.',
                    ]);
                }

                if (! $customerId) {
                    throw ValidationException::withMessages([
                        'customer_id' => 'Selecione um cliente para registrar venda condicional.',
                    ]);
                }

                if (blank($payload['conditional_due_at'] ?? null)) {
                    throw ValidationException::withMessages([
                        'conditional_due_at' => 'Informe a data limite da condicional.',
                    ]);
                }

                $conditionalSale = $this->conditionalSaleService->create([
                    'customer_id' => $customerId,
                    'withdrawn_at' => now()->toIso8601String(),
                    'due_at' => Carbon::parse((string) $payload['conditional_due_at'])->toDateString(),
                    'notes' => $this->buildConditionalNotes($payload['notes'] ?? null, $orderDraft),
                    'items' => $items->map(function (array $entry) {
                        $quantity = (float) $entry['quantity'];
                        $lineTotal = round(max(0, $entry['lineSubtotal'] - $entry['lineDiscount']), 2);
                        $unitPrice = $quantity > 0
                            ? round($lineTotal / $quantity, 2)
                            : round((float) ($entry['unitPrice'] ?? 0), 2);

                        return [
                            'product_id' => $entry['product']->id,
                            'quantity' => $quantity,
                            'unit_price' => $unitPrice,
                        ];
                    })->values()->all(),
                ], $userId);

                if ($orderDraft) {
                    $this->orderDraftService->markAsCompletedWithoutSale($orderDraft);
                }

                $this->pendingSaleService->discard($userId);

                return [
                    'type' => 'conditional',
                    'conditional_sale_id' => $conditionalSale->id,
                    'conditional_code' => $conditionalSale->code,
                    'total' => (float) $conditionalSale->subtotal,
                    'subtotal' => (float) $conditionalSale->subtotal,
                    'discount' => (float) $discount,
                    'payment_method' => PaymentMethod::CONDITIONAL,
                    'fiscal_decision' => null,
                    'payments' => $resolvedPayments->values()->all(),
                ];
            }

            $cashAmount = round((float) $resolvedPayments
                ->where('method', PaymentMethod::CASH)
                ->sum('amount'), 2);
            $changeAmount = 0.0;

            if ($cashReceived !== null) {
                if ($cashAmount <= 0) {
                    throw ValidationException::withMessages([
                        'cash_received' => 'O valor entregue em dinheiro so pode ser informado quando houver pagamento em dinheiro.',
                    ]);
                }

                if ($cashReceived < $cashAmount) {
                    throw ValidationException::withMessages([
                        'cash_received' => 'O valor entregue em dinheiro precisa cobrir a parcela em dinheiro da venda.',
                    ]);
                }

                $changeAmount = round($cashReceived - $cashAmount, 2);
            }

            $paymentMethods = $resolvedPayments->pluck('method')->unique()->values();
            $paymentMethod = $paymentMethods->count() === 1 ? $paymentMethods->first() : PaymentMethod::MIXED;
            $hasCredit = $resolvedPayments->contains(fn (array $payment) => $payment['method'] === PaymentMethod::CREDIT);

            if ($hasCredit && ! $customerId) {
                throw ValidationException::withMessages([
                    'customer_id' => 'Selecione um cliente para venda a prazo.',
                ]);
            }

            if ($hasCredit && $customerId) {
                /** @var Customer $customer */
                $customer = Customer::query()->findOrFail($customerId);
                $creditAmount = (float) $resolvedPayments
                    ->where('method', PaymentMethod::CREDIT)
                    ->sum('amount');

                $openCredit = (float) $customer->sales()
                    ->where('status', 'finalized')
                    ->whereHas('payments', fn ($query) => $query->where('payment_method', PaymentMethod::CREDIT))
                    ->join('sale_payments', 'sale_payments.sale_id', '=', 'sales.id')
                    ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
                    ->sum('sale_payments.amount');

                $availableCredit = max(0, (float) $customer->credit_limit - $openCredit);

                if ((float) $customer->credit_limit > 0 && $creditAmount > $availableCredit) {
                    throw ValidationException::withMessages([
                        'payments' => 'O valor a prazo ultrapassa o limite disponivel deste cliente.',
                    ]);
                }
            }

            $saleAttributes = [
                'sale_number' => $this->nextSaleNumber(),
                'customer_id' => $customerId,
                'user_id' => $userId,
                'cash_register_id' => $cashRegister->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'cost_total' => $costTotal,
                'profit' => $total - $costTotal,
                'payment_method' => $paymentMethod,
                'status' => 'finalized',
                'notes' => $payload['notes'] ?? $orderDraft?->notes,
            ];

            if ($this->hasColumn('sales', 'company_id')) {
                $saleAttributes['company_id'] = $companyId;
            }

            if ($this->hasColumn('sales', 'requested_document_model')) {
                $saleAttributes['requested_document_model'] = $requestedDocumentModel;
            }

            if ($this->hasColumn('sales', 'cash_received')) {
                $saleAttributes['cash_received'] = $cashReceived;
            }

            if ($this->hasColumn('sales', 'change_amount')) {
                $saleAttributes['change_amount'] = $changeAmount;
            }

            if ($this->hasColumn('sales', 'fiscal_decision')) {
                $saleAttributes['fiscal_decision'] = $fiscalDecision;
            }

            if ($this->hasColumn('sales', 'recipient_payload')) {
                $saleAttributes['recipient_payload'] = $recipientPayload;
            }

            $sale = Sale::query()->create($saleAttributes);

            foreach ($items as $entry) {
                /** @var Product $product */
                $product = $entry['product'];
                $quantity = $entry['quantity'];
                $lineTotal = round(max(0, $entry['lineSubtotal'] - $entry['lineDiscount']), 2);
                $unitPrice = $quantity > 0
                    ? round($lineTotal / $quantity, 2)
                    : round((float) ($entry['unitPrice'] ?? 0), 2);

                $saleItemAttributes = [
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_cost' => $product->cost_price,
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                    'profit' => round($lineTotal - ((float) $product->cost_price * $quantity), 2),
                ];

                if ($this->hasColumn('sale_items', 'discount_amount')) {
                    $saleItemAttributes['discount_amount'] = $entry['lineDiscount'];
                }

                if ($this->hasColumn('sale_items', 'discount_percent')) {
                    $saleItemAttributes['discount_percent'] = $entry['discountPercent'];
                }

                if ($this->hasColumn('sale_items', 'discount_authorized_by')) {
                    $saleItemAttributes['discount_authorized_by'] = $entry['discountAuthorizedBy'];
                }

                if ($this->hasColumn('sale_items', 'discount_authorization_scope')) {
                    $saleItemAttributes['discount_authorization_scope'] = $entry['discountScope'];
                }

                $sale->items()->create($saleItemAttributes);

                $this->inventoryMovementService->apply($product, -$quantity, 'sale', [
                    'user_id' => $userId,
                    'reference' => $sale,
                    'unit_cost' => $product->cost_price,
                    'notes' => "Saida pela venda {$sale->sale_number}",
                    'occurred_at' => $sale->created_at,
                ]);
            }

            foreach ($resolvedPayments as $payment) {
                $sale->payments()->create([
                    'payment_method' => $payment['method'],
                    'amount' => $payment['amount'],
                ]);
            }

            if ($orderDraft) {
                $this->orderDraftService->markAsCompleted($orderDraft, $sale);
            }

            $this->pendingSaleService->discard($userId);

            return [
                'type' => 'sale',
                'sale_id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'total' => (float) $sale->total,
                'subtotal' => (float) $sale->subtotal,
                'discount' => (float) $sale->discount,
                'payment_method' => $sale->payment_method,
                'cash_received' => (float) ($sale->cash_received ?? $cashReceived ?? 0),
                'change_amount' => (float) ($sale->change_amount ?? $changeAmount),
                'requested_document_model' => $this->hasColumn('sales', 'requested_document_model')
                    ? $sale->requested_document_model
                    : $requestedDocumentModel,
                'fiscal_decision' => $this->hasColumn('sales', 'fiscal_decision')
                    ? $sale->fiscal_decision
                    : $fiscalDecision,
                'payments' => $resolvedPayments->values()->all(),
            ];
        });
    }

    protected function buildConditionalNotes(?string $notes, ?OrderDraft $orderDraft): ?string
    {
        $segments = ['Gerado pelo PDV como venda condicional.'];

        if ($orderDraft?->reference) {
            $segments[] = "Origem: pedido {$orderDraft->reference}.";
        }

        if (filled($notes)) {
            $segments[] = trim((string) $notes);
        }

        return implode(' ', $segments);
    }

    protected function normalizeRecipientPayload(mixed $payload): ?array
    {
        if (!is_array($payload)) {
            return null;
        }

        $normalized = [
            'type' => $payload['type'] ?? null,
            'name' => filled($payload['name'] ?? null) ? trim((string) $payload['name']) : null,
            'document' => filled($payload['document'] ?? null)
                ? preg_replace('/\D+/', '', (string) $payload['document'])
                : null,
            'customer_id' => filled($payload['customer_id'] ?? null) ? (int) $payload['customer_id'] : null,
            'company_id' => filled($payload['company_id'] ?? null) ? (int) $payload['company_id'] : null,
            'email' => filled($payload['email'] ?? null) ? trim((string) $payload['email']) : null,
            'phone' => filled($payload['phone'] ?? null)
                ? preg_replace('/\D+/', '', (string) $payload['phone'])
                : null,
            'state_registration' => filled($payload['state_registration'] ?? null)
                ? strtoupper(trim((string) $payload['state_registration']))
                : null,
            'ie_indicator' => filled($payload['ie_indicator'] ?? null) ? (string) $payload['ie_indicator'] : null,
            'street' => filled($payload['street'] ?? null) ? trim((string) $payload['street']) : null,
            'number' => filled($payload['number'] ?? null) ? trim((string) $payload['number']) : null,
            'complement' => filled($payload['complement'] ?? null) ? trim((string) $payload['complement']) : null,
            'district' => filled($payload['district'] ?? null) ? trim((string) $payload['district']) : null,
            'city_name' => filled($payload['city_name'] ?? null) ? trim((string) $payload['city_name']) : null,
            'city_code' => filled($payload['city_code'] ?? null)
                ? preg_replace('/\D+/', '', (string) $payload['city_code'])
                : null,
            'state' => filled($payload['state'] ?? null) ? strtoupper(trim((string) $payload['state'])) : null,
            'zip_code' => filled($payload['zip_code'] ?? null)
                ? preg_replace('/\D+/', '', (string) $payload['zip_code'])
                : null,
            'consumer_final' => array_key_exists('consumer_final', $payload)
                ? filter_var($payload['consumer_final'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
                : null,
        ];

        $normalized = array_filter($normalized, fn ($value) => $value !== null && $value !== '');

        return $normalized === [] ? null : $normalized;
    }

    protected function nextSaleNumber(): string
    {
        $prefix = now()->format('Ymd');
        $count = Sale::query()->whereDate('created_at', now())->count() + 1;

        return sprintf('VND-%s-%04d', $prefix, $count);
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Sale())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new Sale())->getConnectionName())->hasColumn($table, $column);
    }
}
