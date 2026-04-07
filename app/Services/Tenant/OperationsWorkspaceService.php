<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\Purchases\IncomingNfeService;
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
        protected IncomingNfeService $incomingNfeService,
    ) {}

    public function workspaceModules(): array
    {
        return [
            'clientes',
            'fornecedores',
            'categorias',
            'delivery',
            'compras',
            'entrada-estoque',
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
                'moduleDescription' => 'Recebimento em etapas com fornecedor, nota, bipagem de itens e dados do boleto.',
                'payload' => $this->stockInboundPayload(),
            ],
            'movimentacao-estoque' => [
                'moduleKey' => 'movimentacao-estoque',
                'moduleTitle' => 'Movimentacao de estoque',
                'moduleDescription' => 'Bipe o produto, confira o saldo atual e ajuste a quantidade final com confirmacao.',
                'payload' => $this->stockMovementsPayload(),
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
            'entrada-estoque' => ['message' => 'Entrada de estoque registrada com sucesso.', 'record' => $this->serializePurchase($this->saveStockInbound($input, $userId))],
            'movimentacao-estoque' => ['message' => 'Saldo atualizado com sucesso.', 'record' => $this->serializeStockMovement($this->saveStockLevelUpdate($input, $userId))],
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
            'entrada-estoque', 'movimentacao-estoque' => throw ValidationException::withMessages([
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
            'entrada-estoque', 'movimentacao-estoque' => throw ValidationException::withMessages([
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
            'incoming_nfe_documents' => IncomingNfeDocument::query()
                ->with(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price'])
                ->orderByDesc('issued_at')
                ->orderByDesc('id')
                ->limit(80)
                ->get()
                ->map(fn (IncomingNfeDocument $document) => $this->incomingNfeService->serializeDocument($document))
                ->values()
                ->all(),
            'incoming_nfe_status' => $this->incomingNfeService->integrationStatus(),
            'cost_methods' => [
                ['value' => 'last_cost', 'label' => 'Ultima compra'],
                ['value' => 'average_cost', 'label' => 'Custo medio'],
            ],
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
            'records' => $this->stockInboundRecords(),
            'products' => $this->stockProductOptions(),
            'suppliers' => $this->supplierOptions(),
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

    protected function stockMovementsPayload(): array
    {
        return [
            'records' => $this->stockMovementRecords(['manual_adjustment']),
            'products' => $this->stockProductOptions(),
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

        $customer ??= new Customer;
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
            'document' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'trade_name' => ['nullable', 'string', 'max:255'],
            'state_registration' => ['nullable', 'string', 'max:30'],
            'city_name' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'size:2'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $supplier ??= new Supplier;
        $document = filled($validated['document'] ?? null)
            ? preg_replace('/\D+/', '', (string) $validated['document'])
            : null;

        $supplier->fill([
            'name' => $validated['name'],
            'document' => $document,
            'document_type' => $document ? (strlen($document) === 14 ? 'cnpj' : 'cpf') : null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'trade_name' => $validated['trade_name'] ?? null,
            'state_registration' => $validated['state_registration'] ?? null,
            'city_name' => $validated['city_name'] ?? null,
            'state' => isset($validated['state']) ? strtoupper((string) $validated['state']) : null,
            'active' => $validated['active'],
        ])->save();

        return $supplier->fresh();
    }

    protected function saveCategory(?Category $category, array $input): Category
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($category?->id)],
            'description' => ['nullable', 'string'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $category ??= new Category;
        $category->fill($validated)->save();

        return $category->fresh();
    }

    protected function saveUser(?User $user, array $input): User
    {
        $isCreate = ! $user;

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

        $user ??= new User;

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

    protected function saveStockInbound(array $input, int $userId): Purchase
    {
        return $this->savePurchase(null, [
            ...$this->normalizeStockInboundInput($input),
            'status' => 'received',
        ], $userId);
    }

    protected function saveStockLevelUpdate(array $input, int $userId): InventoryMovement
    {
        $validated = Validator::make($input, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'counted_quantity' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'occurred_at' => ['nullable', 'date'],
        ])->validate();

        $product = Product::query()->findOrFail((int) $validated['product_id']);
        $expected = round((float) $product->stock_quantity, 3);
        $counted = round((float) $validated['counted_quantity'], 3);
        $delta = round($counted - $expected, 3);

        if (abs($delta) <= 0.0001) {
            throw ValidationException::withMessages([
                'counted_quantity' => 'Informe um saldo diferente do estoque atual para registrar a movimentacao.',
            ]);
        }

        $stockProduct = $this->inventoryMovementService->apply(
            $product,
            $delta,
            'manual_adjustment',
            [
                'user_id' => $userId,
                'unit_cost' => round((float) $product->cost_price, 2),
                'notes' => $this->encodeMovementNotes('stock_adjustment', [
                    'reason' => $validated['reason'] ?? 'Ajuste manual de saldo',
                    'expected_quantity' => $expected,
                    'counted_quantity' => $counted,
                    'adjustment_delta' => $delta,
                    'notes' => $validated['notes'] ?? null,
                ]),
                'occurred_at' => $validated['occurred_at'] ?? null,
            ],
        );

        return InventoryMovement::query()
            ->where('product_id', $stockProduct->id)
            ->where('type', 'manual_adjustment')
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

        $order ??= new DeliveryOrder;

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
            'received_at' => ['nullable', 'date'],
            'freight' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'invoice_number' => ['nullable', 'string', 'max:80'],
            'billing_barcode' => ['nullable', 'string', 'max:255'],
            'billing_amount' => ['nullable', 'numeric', 'gte:0'],
            'billing_due_date' => ['nullable', 'date'],
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

            $purchase ??= new Purchase;
            $subtotal = round($items->sum('total'), 2);
            $freight = round((float) ($validated['freight'] ?? 0), 2);
            $purchaseMetadata = $this->decodePurchaseNotes($purchase->notes);
            $plainNotes = array_key_exists('notes', $validated)
                ? ($validated['notes'] ?? null)
                : ($purchaseMetadata['notes'] ?? null);
            $invoiceNumber = array_key_exists('invoice_number', $validated)
                ? ($validated['invoice_number'] ?? null)
                : ($purchaseMetadata['invoice_number'] ?? null);
            $billingBarcode = array_key_exists('billing_barcode', $validated)
                ? ($validated['billing_barcode'] ?? null)
                : ($purchaseMetadata['billing_barcode'] ?? null);
            $billingAmount = array_key_exists('billing_amount', $validated)
                ? (filled($validated['billing_amount'] ?? null)
                    ? round((float) $validated['billing_amount'], 2)
                    : null)
                : (array_key_exists('billing_amount', $purchaseMetadata)
                    ? round((float) $purchaseMetadata['billing_amount'], 2)
                    : null);
            $billingDueDate = array_key_exists('billing_due_date', $validated)
                ? ($validated['billing_due_date'] ?? null)
                : ($purchaseMetadata['billing_due_date'] ?? null);
            $shouldEncodeNotes = $this->hasStructuredPurchaseNotes($purchase->notes)
                || filled($invoiceNumber)
                || filled($billingBarcode)
                || $billingAmount !== null
                || filled($billingDueDate);

            $purchase->fill([
                'supplier_id' => $validated['supplier_id'] ?? null,
                'user_id' => $purchase->user_id ?: $userId,
                'code' => $purchase->code ?: $this->nextCode(Purchase::class, 'CMP'),
                'status' => $validated['status'],
                'expected_at' => $validated['expected_at'] ?? null,
                'received_at' => $validated['status'] === 'received'
                    ? ($validated['received_at'] ?? $purchase->received_at ?? now())
                    : null,
                'subtotal' => $subtotal,
                'freight' => $freight,
                'total' => round($subtotal + $freight, 2),
                'notes' => $shouldEncodeNotes
                    ? $this->encodePurchaseNotes([
                        'notes' => $plainNotes,
                        'invoice_number' => $invoiceNumber,
                        'billing_barcode' => $billingBarcode,
                        'billing_amount' => $billingAmount,
                        'billing_due_date' => $billingDueDate,
                    ])
                    : $plainNotes,
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

    protected function stockInboundRecords(int $limit = 80): array
    {
        return Purchase::query()
            ->with(['supplier:id,name', 'items.product:id,name,code,barcode,unit'])
            ->where('status', 'received')
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (Purchase $purchase) => $this->serializePurchase($purchase))
            ->values()
            ->all();
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
            ->get(['id', 'name', 'code', 'barcode', 'unit', 'cost_price', 'stock_quantity', 'supplier_id'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'supplier_id' => $product->supplier_id,
                'supplier_name' => $product->supplier?->name,
                'label' => $product->name.' ('.($product->barcode ?: $product->code).')',
            ])
            ->values()
            ->all();
    }

    protected function stockLocationOptions(): array
    {
        return ['Loja', 'Deposito', 'Estoque geral', 'Cozinha', 'Producao'];
    }

    protected function normalizeStockInboundInput(array $input): array
    {
        if (is_array($input['items'] ?? null) && count($input['items']) > 0) {
            return $input;
        }

        $product = Product::query()->findOrFail((int) ($input['product_id'] ?? 0));

        return [
            'supplier_id' => $input['supplier_id'] ?? null,
            'received_at' => $input['received_at'] ?? $input['occurred_at'] ?? null,
            'invoice_number' => $input['invoice_number'] ?? $input['document'] ?? null,
            'notes' => $input['notes'] ?? null,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => $input['quantity'] ?? 1,
                'unit_cost' => $input['unit_cost'] ?? $product->cost_price,
            ]],
        ];
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

        if (! is_array($decoded)) {
            return ['notes' => $notes];
        }

        if (($decoded['schema'] ?? null) === 'ops_workspace_v1') {
            return is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [];
        }

        return $decoded;
    }

    protected function encodePurchaseNotes(array $metadata = []): ?string
    {
        $payload = array_filter($metadata, fn ($value) => $value !== null && $value !== '');

        if ($payload === []) {
            return null;
        }

        return (string) json_encode([
            'schema' => 'ops_purchase_v1',
            'meta' => $payload,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    protected function decodePurchaseNotes(?string $notes): array
    {
        if (blank($notes)) {
            return [];
        }

        $decoded = json_decode((string) $notes, true);

        if (! is_array($decoded)) {
            return ['notes' => $notes];
        }

        if (($decoded['schema'] ?? null) === 'ops_purchase_v1') {
            return is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [];
        }

        return ['notes' => $notes];
    }

    protected function hasStructuredPurchaseNotes(?string $notes): bool
    {
        if (blank($notes)) {
            return false;
        }

        $decoded = json_decode((string) $notes, true);

        return is_array($decoded) && ($decoded['schema'] ?? null) === 'ops_purchase_v1';
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
            ->get(['id', 'name', 'code', 'barcode', 'ncm', 'cfop', 'unit', 'cost_price', 'sale_price', 'stock_quantity'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'ncm' => $product->ncm,
                'cfop' => $product->cfop,
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
            ->get(['id', 'name', 'document'])
            ->map(fn (Supplier $supplier) => [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'document' => $supplier->document,
            ])
            ->values()
            ->all();
    }

    protected function serializeCustomer(Customer $customer): array
    {
        if (! array_key_exists('sales_count', $customer->getAttributes())) {
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
        if (! array_key_exists('products_count', $supplier->getAttributes())) {
            $supplier->loadCount(['products as products_count' => fn ($query) => $query->where('active', true)]);
        }

        return [
            'id' => $supplier->id,
            'name' => $supplier->name,
            'document' => $supplier->document,
            'phone' => $supplier->phone,
            'email' => $supplier->email,
            'trade_name' => $supplier->trade_name,
            'state_registration' => $supplier->state_registration,
            'city_name' => $supplier->city_name,
            'state' => $supplier->state,
            'products_count' => (int) ($supplier->products_count ?? 0),
            'active' => (bool) $supplier->active,
            'created_at' => $supplier->created_at?->toIso8601String(),
        ];
    }

    protected function serializeCategory(Category $category): array
    {
        if (! array_key_exists('products_count', $category->getAttributes())) {
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
            ??= Schema::connection((new User)->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new User)->getConnectionName())->hasColumn($table, $column);
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
        $metadata = $this->decodePurchaseNotes($purchase->notes);
        $items = $purchase->items
            ->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'quantity' => (float) $item->quantity,
                'unit_cost' => (float) $item->unit_cost,
                'total' => (float) $item->total,
            ])
            ->values();

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
            'notes' => $metadata['notes'] ?? null,
            'invoice_number' => $metadata['invoice_number'] ?? null,
            'document' => $metadata['invoice_number'] ?? null,
            'billing_barcode' => $metadata['billing_barcode'] ?? null,
            'billing_amount' => array_key_exists('billing_amount', $metadata) ? (float) $metadata['billing_amount'] : null,
            'billing_due_date' => $metadata['billing_due_date'] ?? null,
            'stock_applied_at' => $purchase->stock_applied_at?->toIso8601String(),
            'items_count' => $items->count(),
            'quantity_total' => (float) $items->sum('quantity'),
            'items' => $items->all(),
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
