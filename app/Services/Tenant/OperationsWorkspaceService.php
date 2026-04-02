<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OperationsWorkspaceService
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
    ) {
    }

    public function workspaceModules(): array
    {
        return [
            'clientes',
            'fornecedores',
            'categorias',
            'delivery',
            'compras',
            'entrada-estoque',
            'ajuste-estoque',
            'movimentacao-estoque',
            'usuarios',
        ];
    }

    public function isWorkspaceModule(string $module): bool
    {
        return in_array($module, $this->workspaceModules(), true);
    }

    public function build(string $module): array
    {
        return match ($module) {
            'clientes' => [
                'moduleKey' => 'clientes',
                'moduleTitle' => 'Clientes',
                'moduleDescription' => 'Cadastro completo de clientes com contato, limite de credito e status operacional.',
                'payload' => $this->customersPayload(),
            ],
            'fornecedores' => [
                'moduleKey' => 'fornecedores',
                'moduleTitle' => 'Fornecedores',
                'moduleDescription' => 'Cadastro operacional de fornecedores com contato e cobertura por produtos.',
                'payload' => $this->suppliersPayload(),
            ],
            'categorias' => [
                'moduleKey' => 'categorias',
                'moduleTitle' => 'Categorias',
                'moduleDescription' => 'Estrutura do catalogo com descricao, status e acompanhamento de itens por categoria.',
                'payload' => $this->categoriesPayload(),
            ],
            'delivery' => [
                'moduleKey' => 'delivery',
                'moduleTitle' => 'Delivery',
                'moduleDescription' => 'Fila de entrega e retirada com taxa, endereco, status e entregador.',
                'payload' => $this->deliveryPayload(),
            ],
            'compras' => [
                'moduleKey' => 'compras',
                'moduleTitle' => 'Compras',
                'moduleDescription' => 'Pedido de compra, itens recebidos e entrada automatica no estoque.',
                'payload' => $this->purchasesPayload(),
            ],
            'entrada-estoque' => [
                'moduleKey' => 'entrada-estoque',
                'moduleTitle' => 'Entrada de estoque',
                'moduleDescription' => 'Lancamento real de entrada de produtos com documento, custo e local de recebimento.',
                'payload' => $this->stockInboundPayload(),
            ],
            'ajuste-estoque' => [
                'moduleKey' => 'ajuste-estoque',
                'moduleTitle' => 'Conferencia de estoque',
                'moduleDescription' => 'Conferencia por contagem fisica e ajuste do saldo quando houver divergencia.',
                'payload' => $this->stockAdjustmentsPayload(),
            ],
            'movimentacao-estoque' => [
                'moduleKey' => 'movimentacao-estoque',
                'moduleTitle' => 'Movimentacao entre locais',
                'moduleDescription' => 'Registro de transferencia entre locais internos com historico e rastreabilidade.',
                'payload' => $this->stockTransfersPayload(),
            ],
            'usuarios' => [
                'moduleKey' => 'usuarios',
                'moduleTitle' => 'Usuarios',
                'moduleDescription' => 'Perfis de acesso, senha de autorizacao gerencial e status operacional.',
                'payload' => $this->usersPayload(),
            ],
            default => abort(404),
        };
    }

    public function store(string $module, array $input, int $userId): array
    {
        return match ($module) {
            'clientes' => ['message' => 'Cliente cadastrado com sucesso.', 'record' => $this->serializeCustomer($this->saveCustomer(null, $input))],
            'fornecedores' => ['message' => 'Fornecedor cadastrado com sucesso.', 'record' => $this->serializeSupplier($this->saveSupplier(null, $input))],
            'categorias' => ['message' => 'Categoria cadastrada com sucesso.', 'record' => $this->serializeCategory($this->saveCategory(null, $input))],
            'delivery' => ['message' => 'Entrega salva com sucesso.', 'record' => $this->serializeDeliveryOrder($this->saveDeliveryOrder(null, $input))],
            'compras' => ['message' => 'Compra salva com sucesso.', 'record' => $this->serializePurchase($this->savePurchase(null, $input, $userId))],
            'entrada-estoque' => ['message' => 'Entrada de estoque registrada com sucesso.', 'record' => $this->serializeStockMovement($this->saveStockInbound($input, $userId))],
            'ajuste-estoque' => ['message' => 'Conferencia registrada com sucesso.', 'record' => $this->serializeStockMovement($this->saveStockAdjustment($input, $userId))],
            'movimentacao-estoque' => ['message' => 'Movimentacao registrada com sucesso.', 'record' => $this->serializeStockMovement($this->saveStockTransfer($input, $userId))],
            'usuarios' => ['message' => 'Usuario salvo com sucesso.', 'record' => $this->serializeUser($this->saveUser(null, $input))],
            default => abort(404),
        };
    }

    public function records(string $module): array
    {
        return [
            'records' => data_get($this->build($module), 'payload.records', []),
        ];
    }

    public function update(string $module, int $recordId, array $input, int $userId): array
    {
        return match ($module) {
            'clientes' => ['message' => 'Cliente atualizado com sucesso.', 'record' => $this->serializeCustomer($this->saveCustomer($this->findRecord(Customer::class, $recordId), $input))],
            'fornecedores' => ['message' => 'Fornecedor atualizado com sucesso.', 'record' => $this->serializeSupplier($this->saveSupplier($this->findRecord(Supplier::class, $recordId), $input))],
            'categorias' => ['message' => 'Categoria atualizada com sucesso.', 'record' => $this->serializeCategory($this->saveCategory($this->findRecord(Category::class, $recordId), $input))],
            'delivery' => ['message' => 'Entrega atualizada com sucesso.', 'record' => $this->serializeDeliveryOrder($this->saveDeliveryOrder($this->findRecord(DeliveryOrder::class, $recordId), $input))],
            'compras' => ['message' => 'Compra atualizada com sucesso.', 'record' => $this->serializePurchase($this->savePurchase($this->findRecord(Purchase::class, $recordId), $input, $userId))],
            'entrada-estoque', 'ajuste-estoque', 'movimentacao-estoque' => throw ValidationException::withMessages([
                'record' => 'Registros de estoque nao podem ser alterados. Crie um novo lancamento.',
            ]),
            'usuarios' => ['message' => 'Usuario atualizado com sucesso.', 'record' => $this->serializeUser($this->saveUser($this->findRecord(User::class, $recordId), $input))],
            default => abort(404),
        };
    }

    public function destroy(string $module, int $recordId): string
    {
        return match ($module) {
            'clientes' => tap($this->findRecord(Customer::class, $recordId))->delete() ? 'Cliente removido com sucesso.' : 'Cliente removido com sucesso.',
            'fornecedores' => tap($this->findRecord(Supplier::class, $recordId))->delete() ? 'Fornecedor removido com sucesso.' : 'Fornecedor removido com sucesso.',
            'categorias' => tap($this->findRecord(Category::class, $recordId))->delete() ? 'Categoria removida com sucesso.' : 'Categoria removida com sucesso.',
            'delivery' => tap($this->findRecord(DeliveryOrder::class, $recordId))->delete() ? 'Entrega removida com sucesso.' : 'Entrega removida com sucesso.',
            'compras' => $this->deleteStockSensitiveRecord($this->findRecord(Purchase::class, $recordId), 'Compra removida com sucesso.'),
            'usuarios' => tap($this->findRecord(User::class, $recordId))->delete() ? 'Usuario removido com sucesso.' : 'Usuario removido com sucesso.',
            'entrada-estoque', 'ajuste-estoque', 'movimentacao-estoque' => throw ValidationException::withMessages([
                'record' => 'Registros de estoque nao podem ser excluidos para preservar a rastreabilidade.',
            ]),
            default => abort(404),
        };
    }

    protected function deleteStockSensitiveRecord(Model $model, string $message): string
    {
        if (filled($model->getAttribute('stock_applied_at'))) {
            throw ValidationException::withMessages([
                'record' => 'Este registro ja impactou o estoque e nao pode ser removido.',
            ]);
        }

        $model->delete();

        return $message;
    }

    protected function deliveryPayload(): array
    {
        return [
            'records' => DeliveryOrder::query()
                ->with(['customer:id,name,phone'])
                ->latest()
                ->get()
                ->map(fn (DeliveryOrder $order) => $this->serializeDeliveryOrder($order))
                ->values()
                ->all(),
            'customers' => $this->customerOptions(),
        ];
    }

    protected function purchasesPayload(): array
    {
        return [
            'records' => Purchase::query()
                ->with(['supplier:id,name', 'items.product:id,name,code,unit'])
                ->latest()
                ->get()
                ->map(fn (Purchase $purchase) => $this->serializePurchase($purchase))
                ->values()
                ->all(),
            'suppliers' => $this->supplierOptions(),
            'products' => $this->productOptions(),
        ];
    }

    protected function customersPayload(): array
    {
        return [
            'records' => Customer::query()
                ->withCount(['sales as sales_count' => fn ($query) => $query->where('status', 'finalized')])
                ->orderBy('name')
                ->get()
                ->map(fn (Customer $customer) => $this->serializeCustomer($customer))
                ->values()
                ->all(),
        ];
    }

    protected function suppliersPayload(): array
    {
        return [
            'records' => Supplier::query()
                ->withCount(['products as products_count' => fn ($query) => $query->where('active', true)])
                ->orderBy('name')
                ->get()
                ->map(fn (Supplier $supplier) => $this->serializeSupplier($supplier))
                ->values()
                ->all(),
        ];
    }

    protected function categoriesPayload(): array
    {
        return [
            'records' => Category::query()
                ->withCount(['products as products_count' => fn ($query) => $query->where('active', true)])
                ->orderBy('name')
                ->get()
                ->map(fn (Category $category) => $this->serializeCategory($category))
                ->values()
                ->all(),
        ];
    }

    protected function stockInboundPayload(): array
    {
        return [
            'records' => $this->stockMovementRecords(['manual_inbound']),
            'products' => $this->stockProductOptions(),
            'suppliers' => $this->supplierOptions(),
            'locations' => $this->stockLocationOptions(),
        ];
    }

    protected function stockAdjustmentsPayload(): array
    {
        return [
            'records' => $this->stockMovementRecords(['manual_adjustment', 'stock_conference']),
            'products' => $this->stockProductOptions(),
            'locations' => $this->stockLocationOptions(),
        ];
    }

    protected function stockTransfersPayload(): array
    {
        return [
            'records' => $this->stockMovementRecords(['stock_transfer']),
            'products' => $this->stockProductOptions(),
            'locations' => $this->stockLocationOptions(),
        ];
    }

    protected function usersPayload(): array
    {
        return [
            'records' => User::query()
                ->orderByRaw("CASE WHEN role = 'admin' THEN 0 WHEN role = 'manager' THEN 1 ELSE 2 END")
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => $this->serializeUser($user))
                ->values()
                ->all(),
            'roles' => [
                ['value' => 'admin', 'label' => 'Administrador'],
                ['value' => 'manager', 'label' => 'Gerente'],
                ['value' => 'operator', 'label' => 'Operador'],
            ],
        ];
    }

    protected function saveCustomer(?Customer $customer, array $input): Customer
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255', Rule::unique('customers', 'name')->ignore($customer?->id)],
            'phone' => ['nullable', 'string', 'max:60'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $customer ??= new Customer();
        $customer->fill([
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'credit_limit' => round((float) ($validated['credit_limit'] ?? 0), 2),
            'active' => $validated['active'],
        ])->save();

        return $customer->fresh();
    }

    protected function saveSupplier(?Supplier $supplier, array $input): Supplier
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255', Rule::unique('suppliers', 'name')->ignore($supplier?->id)],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $supplier ??= new Supplier();
        $supplier->fill($validated)->save();

        return $supplier->fresh();
    }

    protected function saveCategory(?Category $category, array $input): Category
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($category?->id)],
            'description' => ['nullable', 'string'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $category ??= new Category();
        $category->fill($validated)->save();

        return $category->fresh();
    }

    protected function saveUser(?User $user, array $input): User
    {
        $isCreate = !$user;

        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', Rule::unique('users', 'username')->ignore($user?->id)],
            'role' => ['required', Rule::in(['admin', 'manager', 'operator'])],
            'is_supervisor' => ['nullable', 'boolean'],
            'active' => ['required', 'boolean'],
            'must_change_password' => ['nullable', 'boolean'],
            'password' => [$isCreate ? 'required' : 'nullable', 'string', 'min:4'],
            'discount_authorization_password' => ['nullable', 'string', 'min:4'],
        ])->validate();

        $user ??= new User();

        $payload = [
            'name' => $validated['name'],
            'username' => $validated['username'],
            'role' => $validated['role'],
            'is_supervisor' => $this->hasColumn('users', 'is_supervisor')
                ? (bool) ($validated['is_supervisor'] ?? false)
                : false,
            'active' => $validated['active'],
            'must_change_password' => (bool) ($validated['must_change_password'] ?? false),
        ];

        if (filled($validated['password'] ?? null)) {
            $payload['password'] = Hash::make((string) $validated['password']);
        }

        if ($this->hasColumn('users', 'discount_authorization_password') && array_key_exists('discount_authorization_password', $validated)) {
            $payload['discount_authorization_password'] = filled($validated['discount_authorization_password'] ?? null)
                ? Hash::make((string) $validated['discount_authorization_password'])
                : null;
        }

        $user->fill($payload)->save();

        return $user->fresh();
    }

    protected function saveStockInbound(array $input, int $userId): InventoryMovement
    {
        $validated = Validator::make($input, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'document' => ['nullable', 'string', 'max:80'],
            'location' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
            'occurred_at' => ['nullable', 'date'],
        ])->validate();

        $product = Product::query()->findOrFail((int) $validated['product_id']);
        $supplier = filled($validated['supplier_id'] ?? null)
            ? Supplier::query()->find((int) $validated['supplier_id'])
            : null;

        $stockProduct = $this->inventoryMovementService->apply(
            $product,
            round((float) $validated['quantity'], 3),
            'manual_inbound',
            [
                'user_id' => $userId,
                'unit_cost' => round((float) ($validated['unit_cost'] ?? $product->cost_price), 2),
                'notes' => $this->encodeMovementNotes('stock_inbound', [
                    'supplier_id' => $supplier?->id,
                    'supplier_name' => $supplier?->name,
                    'document' => $validated['document'] ?? null,
                    'location' => $validated['location'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                ]),
                'occurred_at' => $validated['occurred_at'] ?? null,
            ],
        );

        return InventoryMovement::query()
            ->where('product_id', $stockProduct->id)
            ->where('type', 'manual_inbound')
            ->latest('id')
            ->firstOrFail();
    }

    protected function saveStockAdjustment(array $input, int $userId): InventoryMovement
    {
        $validated = Validator::make($input, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'counted_quantity' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string'],
            'occurred_at' => ['nullable', 'date'],
        ])->validate();

        $product = Product::query()->findOrFail((int) $validated['product_id']);
        $expected = round((float) $product->stock_quantity, 3);
        $counted = round((float) $validated['counted_quantity'], 3);
        $delta = round($counted - $expected, 3);
        $movementType = abs($delta) > 0.0001 ? 'manual_adjustment' : 'stock_conference';

        $notes = $this->encodeMovementNotes('stock_adjustment', [
            'reason' => $validated['reason'],
            'location' => $validated['location'] ?? null,
            'expected_quantity' => $expected,
            'counted_quantity' => $counted,
            'adjustment_delta' => $delta,
            'notes' => $validated['notes'] ?? null,
        ]);

        if ($movementType === 'stock_conference') {
            $movement = InventoryMovement::query()->create([
                'product_id' => $product->id,
                'user_id' => $userId,
                'type' => 'stock_conference',
                'reference_type' => null,
                'reference_id' => null,
                'quantity_delta' => 0,
                'stock_before' => $expected,
                'stock_after' => $expected,
                'unit_cost' => round((float) $product->cost_price, 2),
                'notes' => $notes,
                'occurred_at' => $this->parseMovementOccurredAt($validated['occurred_at'] ?? null),
            ]);

            return $movement->fresh(['product:id,name,code,unit', 'user:id,name']);
        }

        $stockProduct = $this->inventoryMovementService->apply(
            $product,
            $delta,
            'manual_adjustment',
            [
                'user_id' => $userId,
                'unit_cost' => round((float) $product->cost_price, 2),
                'notes' => $notes,
                'occurred_at' => $validated['occurred_at'] ?? null,
            ],
        );

        return InventoryMovement::query()
            ->where('product_id', $stockProduct->id)
            ->where('type', 'manual_adjustment')
            ->latest('id')
            ->firstOrFail();
    }

    protected function saveStockTransfer(array $input, int $userId): InventoryMovement
    {
        $validated = Validator::make($input, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'from_location' => ['required', 'string', 'max:120'],
            'to_location' => ['required', 'string', 'max:120', 'different:from_location'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'occurred_at' => ['nullable', 'date'],
        ])->validate();

        $product = Product::query()->findOrFail((int) $validated['product_id']);
        $currentStock = round((float) $product->stock_quantity, 3);

        $movement = InventoryMovement::query()->create([
            'product_id' => $product->id,
            'user_id' => $userId,
            'type' => 'stock_transfer',
            'reference_type' => null,
            'reference_id' => null,
            'quantity_delta' => 0,
            'stock_before' => $currentStock,
            'stock_after' => $currentStock,
            'unit_cost' => round((float) $product->cost_price, 2),
            'notes' => $this->encodeMovementNotes('stock_transfer', [
                'quantity' => round((float) $validated['quantity'], 3),
                'from_location' => $validated['from_location'],
                'to_location' => $validated['to_location'],
                'reason' => $validated['reason'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ]),
            'occurred_at' => $this->parseMovementOccurredAt($validated['occurred_at'] ?? null),
        ]);

        return $movement->fresh(['product:id,name,code,unit', 'user:id,name']);
    }

    protected function saveDeliveryOrder(?DeliveryOrder $order, array $input): DeliveryOrder
    {
        $validated = Validator::make($input, [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'reference' => ['nullable', 'string', 'max:80'],
            'status' => ['required', Rule::in(['pending', 'dispatched', 'delivered'])],
            'channel' => ['required', Rule::in(['delivery', 'retirada'])],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:60'],
            'courier_name' => ['nullable', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'neighborhood' => ['nullable', 'string', 'max:255'],
            'delivery_fee' => ['nullable', 'numeric', 'gte:0'],
            'order_total' => ['nullable', 'numeric', 'gte:0'],
            'scheduled_for' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ])->validate();

        $order ??= new DeliveryOrder();

        [$dispatchedAt, $deliveredAt] = match ($validated['status']) {
            'pending' => [null, null],
            'dispatched' => [$order->dispatched_at ?: now(), null],
            'delivered' => [$order->dispatched_at ?: now(), $order->delivered_at ?: now()],
        };

        $order->fill([
            'customer_id' => $validated['customer_id'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'status' => $validated['status'],
            'channel' => $validated['channel'],
            'recipient_name' => $validated['recipient_name'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'courier_name' => $validated['courier_name'] ?? null,
            'address' => $validated['address'],
            'neighborhood' => $validated['neighborhood'] ?? null,
            'delivery_fee' => round((float) ($validated['delivery_fee'] ?? 0), 2),
            'order_total' => round((float) ($validated['order_total'] ?? 0), 2),
            'scheduled_for' => $validated['scheduled_for'] ?? null,
            'dispatched_at' => $dispatchedAt,
            'delivered_at' => $deliveredAt,
            'notes' => $validated['notes'] ?? null,
        ])->save();

        return $order->fresh(['customer:id,name,phone']);
    }

    protected function savePurchase(?Purchase $purchase, array $input, int $userId): Purchase
    {
        $validated = Validator::make($input, [
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'status' => ['required', Rule::in(['draft', 'ordered', 'received'])],
            'expected_at' => ['nullable', 'date'],
            'freight' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'gte:0'],
        ])->validate();

        return DB::transaction(function () use ($purchase, $validated, $userId) {
            $products = Product::query()
                ->whereIn('id', collect($validated['items'])->pluck('product_id')->all())
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $items = collect($validated['items'])->map(function (array $item) use ($products) {
                $product = $products->get($item['product_id']);
                $quantity = round((float) $item['quantity'], 3);
                $unitCost = round((float) $item['unit_cost'], 2);

                return [
                    'product' => $product,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'total' => round($quantity * $unitCost, 2),
                ];
            });

            if ($purchase && filled($purchase->stock_applied_at)) {
                throw ValidationException::withMessages([
                    'record' => 'Esta compra ja entrou no estoque e nao pode mais ser alterada.',
                ]);
            }

            $purchase ??= new Purchase();
            $subtotal = round($items->sum('total'), 2);
            $freight = round((float) ($validated['freight'] ?? 0), 2);

            $purchase->fill([
                'supplier_id' => $validated['supplier_id'] ?? null,
                'user_id' => $purchase->user_id ?: $userId,
                'code' => $purchase->code ?: $this->nextCode(Purchase::class, 'CMP'),
                'status' => $validated['status'],
                'expected_at' => $validated['expected_at'] ?? null,
                'received_at' => $validated['status'] === 'received' ? ($purchase->received_at ?: now()) : null,
                'subtotal' => $subtotal,
                'freight' => $freight,
                'total' => round($subtotal + $freight, 2),
                'notes' => $validated['notes'] ?? null,
            ])->save();

            $purchase->items()->delete();

            foreach ($items as $item) {
                $purchase->items()->create([
                    'product_id' => $item['product']->id,
                    'product_name' => $item['product']->name,
                    'quantity' => $item['quantity'],
                    'unit_cost' => $item['unit_cost'],
                    'total' => $item['total'],
                ]);
            }

            if ($purchase->status === 'received' && blank($purchase->stock_applied_at)) {
                foreach ($items as $item) {
                    $this->inventoryMovementService->apply($item['product'], $item['quantity'], 'purchase', [
                        'user_id' => $userId,
                        'reference' => $purchase,
                        'unit_cost' => $item['unit_cost'],
                        'notes' => "Recebimento da compra {$purchase->code}",
                        'occurred_at' => $purchase->received_at,
                    ]);
                }

                $purchase->forceFill(['stock_applied_at' => now()])->save();
            }

            return $purchase->fresh(['supplier:id,name', 'producer:id,name', 'items.product:id,name,code,unit']);
        });
    }

    protected function stockMovementRecords(array $types, int $limit = 120): array
    {
        return InventoryMovement::query()
            ->with(['product:id,name,code,unit', 'user:id,name'])
            ->whereIn('type', $types)
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (InventoryMovement $movement) => $this->serializeStockMovement($movement))
            ->values()
            ->all();
    }

    protected function stockProductOptions(): array
    {
        return Product::query()
            ->with('supplier:id,name')
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'unit', 'cost_price', 'stock_quantity', 'supplier_id'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'supplier_id' => $product->supplier_id,
                'supplier_name' => $product->supplier?->name,
                'label' => "{$product->name} ({$product->code})",
            ])
            ->values()
            ->all();
    }

    protected function stockLocationOptions(): array
    {
        return ['Loja', 'Deposito', 'Estoque geral', 'Cozinha', 'Producao'];
    }

    protected function encodeMovementNotes(string $type, array $metadata = []): string
    {
        $payload = array_filter($metadata, fn ($value) => $value !== null && $value !== '');

        return (string) json_encode([
            'schema' => 'ops_workspace_v1',
            'type' => $type,
            'meta' => $payload,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    protected function decodeMovementNotes(?string $notes): array
    {
        if (blank($notes)) {
            return [];
        }

        $decoded = json_decode((string) $notes, true);

        if (!is_array($decoded)) {
            return ['notes' => $notes];
        }

        if (($decoded['schema'] ?? null) === 'ops_workspace_v1') {
            return is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [];
        }

        return $decoded;
    }

    protected function parseMovementOccurredAt(mixed $occurredAt): Carbon
    {
        if ($occurredAt instanceof Carbon) {
            return $occurredAt;
        }

        if (filled($occurredAt)) {
            return Carbon::parse((string) $occurredAt);
        }

        return now();
    }

    protected function stockMovementTypeLabel(string $type): string
    {
        return match ($type) {
            'manual_inbound' => 'Entrada manual',
            'manual_adjustment' => 'Ajuste de saldo',
            'stock_conference' => 'Conferencia de estoque',
            'stock_transfer' => 'Movimentacao entre locais',
            default => $type,
        };
    }

    protected function productOptions(): array
    {
        return Product::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'unit', 'cost_price', 'sale_price', 'stock_quantity'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'label' => "{$product->name} ({$product->code})",
            ])
            ->values()
            ->all();
    }

    protected function customerOptions(): array
    {
        return Customer::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'phone'])
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
            ])
            ->values()
            ->all();
    }

    protected function supplierOptions(): array
    {
        return Supplier::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Supplier $supplier) => [
                'id' => $supplier->id,
                'name' => $supplier->name,
            ])
            ->values()
            ->all();
    }

    protected function serializeCustomer(Customer $customer): array
    {
        if (!array_key_exists('sales_count', $customer->getAttributes())) {
            $customer->loadCount(['sales as sales_count' => fn ($query) => $query->where('status', 'finalized')]);
        }

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'phone' => $customer->phone,
            'credit_limit' => (float) $customer->credit_limit,
            'sales_count' => (int) ($customer->sales_count ?? 0),
            'active' => (bool) $customer->active,
            'created_at' => $customer->created_at?->toIso8601String(),
        ];
    }

    protected function serializeSupplier(Supplier $supplier): array
    {
        if (!array_key_exists('products_count', $supplier->getAttributes())) {
            $supplier->loadCount(['products as products_count' => fn ($query) => $query->where('active', true)]);
        }

        return [
            'id' => $supplier->id,
            'name' => $supplier->name,
            'phone' => $supplier->phone,
            'email' => $supplier->email,
            'products_count' => (int) ($supplier->products_count ?? 0),
            'active' => (bool) $supplier->active,
            'created_at' => $supplier->created_at?->toIso8601String(),
        ];
    }

    protected function serializeCategory(Category $category): array
    {
        if (!array_key_exists('products_count', $category->getAttributes())) {
            $category->loadCount(['products as products_count' => fn ($query) => $query->where('active', true)]);
        }

        $stockValue = Product::query()
            ->where('active', true)
            ->where('category_id', $category->id)
            ->get(['stock_quantity', 'cost_price'])
            ->sum(fn (Product $product) => (float) $product->stock_quantity * (float) $product->cost_price);

        return [
            'id' => $category->id,
            'name' => $category->name,
            'description' => $category->description,
            'products_count' => (int) ($category->products_count ?? 0),
            'stock_value' => round((float) $stockValue, 2),
            'active' => (bool) $category->active,
            'created_at' => $category->created_at?->toIso8601String(),
        ];
    }

    protected function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'role' => $user->role,
            'is_supervisor' => $this->hasColumn('users', 'is_supervisor')
                ? (bool) $user->is_supervisor
                : false,
            'active' => (bool) $user->active,
            'must_change_password' => (bool) $user->must_change_password,
            'has_discount_authorization_password' => $this->hasColumn('users', 'discount_authorization_password')
                ? filled($user->discount_authorization_password)
                : false,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new User())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new User())->getConnectionName())->hasColumn($table, $column);
    }

    protected function serializeStockMovement(InventoryMovement $movement): array
    {
        $movement->loadMissing(['product:id,name,code,unit', 'user:id,name']);
        $metadata = $this->decodeMovementNotes($movement->notes);

        return [
            'id' => $movement->id,
            'type' => $movement->type,
            'type_label' => $this->stockMovementTypeLabel($movement->type),
            'product_id' => $movement->product_id,
            'product_name' => $movement->product?->name,
            'product_code' => $movement->product?->code,
            'unit' => $movement->product?->unit,
            'quantity_delta' => (float) $movement->quantity_delta,
            'quantity' => (float) ($metadata['quantity'] ?? abs((float) $movement->quantity_delta)),
            'stock_before' => (float) $movement->stock_before,
            'stock_after' => (float) $movement->stock_after,
            'unit_cost' => (float) $movement->unit_cost,
            'supplier_id' => $metadata['supplier_id'] ?? null,
            'supplier_name' => $metadata['supplier_name'] ?? null,
            'document' => $metadata['document'] ?? null,
            'location' => $metadata['location'] ?? null,
            'reason' => $metadata['reason'] ?? null,
            'from_location' => $metadata['from_location'] ?? null,
            'to_location' => $metadata['to_location'] ?? null,
            'counted_quantity' => array_key_exists('counted_quantity', $metadata) ? (float) $metadata['counted_quantity'] : null,
            'expected_quantity' => array_key_exists('expected_quantity', $metadata) ? (float) $metadata['expected_quantity'] : null,
            'adjustment_delta' => array_key_exists('adjustment_delta', $metadata) ? (float) $metadata['adjustment_delta'] : null,
            'notes' => $metadata['notes'] ?? null,
            'occurred_at' => $movement->occurred_at?->toIso8601String(),
            'created_by' => $movement->user?->name,
        ];
    }

    public function listDeliveryOrders(): array
    {
        return [
            'records' => DeliveryOrder::query()
                ->with(['customer:id,name,phone'])
                ->latest()
                ->get()
                ->map(fn (DeliveryOrder $order) => $this->serializeDeliveryOrder($order))
                ->values()
                ->all(),
        ];
    }

    public function createDeliveryFromDraft(OrderDraft $draft, array $input): array
    {
        $draft->loadMissing('customer:id,name,phone');

        $order = DeliveryOrder::query()->create([
            'customer_id' => $input['customer_id'] ?? $draft->customer_id,
            'order_draft_id' => $draft->id,
            'reference' => ($input['reference'] ?? null) ?: ($draft->reference ?: $draft->id),
            'status' => 'pending',
            'channel' => $input['channel'],
            'recipient_name' => $input['recipient_name'] ?? ($draft->customer?->name ?? null),
            'phone' => $input['phone'] ?? ($draft->customer?->phone ?? null),
            'courier_name' => $input['courier_name'] ?? null,
            'address' => $input['address'],
            'neighborhood' => $input['neighborhood'] ?? null,
            'delivery_fee' => round((float) ($input['delivery_fee'] ?? 0), 2),
            'order_total' => round((float) $draft->total, 2),
            'scheduled_for' => $input['scheduled_for'] ?? null,
            'dispatched_at' => null,
            'delivered_at' => null,
            'notes' => $input['notes'] ?? null,
        ]);

        return [
            'message' => 'Entrega criada com sucesso.',
            'record' => $this->serializeDeliveryOrder($order->fresh(['customer:id,name,phone'])),
        ];
    }

    public function updateDeliveryStatus(DeliveryOrder $order, array $input): array
    {
        $status = $input['status'];

        [$dispatchedAt, $deliveredAt] = match ($status) {
            'pending' => [null, null],
            'dispatched' => [$order->dispatched_at ?: now(), null],
            'delivered' => [$order->dispatched_at ?: now(), $order->delivered_at ?: now()],
        };

        $order->forceFill([
            'status' => $status,
            'dispatched_at' => $dispatchedAt,
            'delivered_at' => $deliveredAt,
        ])->save();

        return [
            'message' => 'Status da entrega atualizado.',
            'record' => $this->serializeDeliveryOrder($order->fresh(['customer:id,name,phone'])),
        ];
    }

    protected function serializeDeliveryOrder(DeliveryOrder $order): array
    {
        $order->loadMissing('customer:id,name,phone');

        return [
            'id' => $order->id,
            'customer_id' => $order->customer_id,
            'customer_name' => $order->customer?->name,
            'reference' => $order->reference,
            'status' => $order->status,
            'channel' => $order->channel,
            'recipient_name' => $order->recipient_name,
            'phone' => $order->phone,
            'courier_name' => $order->courier_name,
            'address' => $order->address,
            'neighborhood' => $order->neighborhood,
            'delivery_fee' => (float) $order->delivery_fee,
            'order_total' => (float) $order->order_total,
            'scheduled_for' => $order->scheduled_for?->format('Y-m-d\TH:i'),
            'dispatched_at' => $order->dispatched_at?->toIso8601String(),
            'delivered_at' => $order->delivered_at?->toIso8601String(),
            'notes' => $order->notes,
        ];
    }

    protected function serializePurchase(Purchase $purchase): array
    {
        $purchase->loadMissing(['supplier:id,name', 'items.product:id,name,code,unit']);

        return [
            'id' => $purchase->id,
            'code' => $purchase->code,
            'supplier_id' => $purchase->supplier_id,
            'supplier_name' => $purchase->supplier?->name,
            'status' => $purchase->status,
            'expected_at' => $purchase->expected_at?->format('Y-m-d'),
            'received_at' => $purchase->received_at?->toIso8601String(),
            'subtotal' => (float) $purchase->subtotal,
            'freight' => (float) $purchase->freight,
            'total' => (float) $purchase->total,
            'notes' => $purchase->notes,
            'stock_applied_at' => $purchase->stock_applied_at?->toIso8601String(),
            'items' => $purchase->items
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'quantity' => (float) $item->quantity,
                    'unit_cost' => (float) $item->unit_cost,
                    'total' => (float) $item->total,
                ])
                ->values()
                ->all(),
        ];
    }

    protected function findRecord(string $modelClass, int $recordId): Model
    {
        return $modelClass::query()->findOrFail($recordId);
    }

    protected function nextCode(string $modelClass, string $prefix): string
    {
        $datePrefix = now()->format('Ymd');
        $sequence = $modelClass::query()->count() + 1;

        do {
            $code = sprintf('%s-%s-%04d', $prefix, $datePrefix, $sequence);
            $sequence++;
        } while ($modelClass::query()->where('code', $code)->exists());

        return $code;
    }
}
