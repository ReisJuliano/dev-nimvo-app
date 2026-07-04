<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\InventoryMovement;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Payable;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\Purchases\IncomingNfeService;
use App\Support\TextSearch;
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
    // Alçada de confirmação: valores que estourem N vezes a referência (custo dos itens
    // ou média histórica de lançamentos) exigem confirmação extra antes de salvar, evitando
    // d?vidas fictícias por erro de digita??o (ex.: zero a mais, falta de separador decimal).
    protected const AMOUNT_CONFIRMATION_RATIO = 3.0;

    protected const AMOUNT_CONFIRMATION_MIN_DIFF = 200.0;

    protected const AMOUNT_CONFIRMATION_ABSOLUTE_CEILING = 20000.0;

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
            'contas-a-pagar',
            'entrada-estoque',
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
                'moduleDescription' => 'Cadastro completo de clientes com contato, limite de crédito e status operacional.',
                'payload' => [
                    'records' => [],
                ],
            ],
            'fornecedores' => [
                'moduleKey' => 'fornecedores',
                'moduleTitle' => 'Fornecedores',
                'moduleDescription' => 'Cadastro operacional de fornecedores com contato e cobertura por produtos.',
                'payload' => $this->suppliersPayload(false),
            ],
            'categorias' => [
                'moduleKey' => 'categorias',
                'moduleTitle' => 'Categorias',
                'moduleDescription' => 'Estrutura do catálogo com descrição, status e acompanhamento de itens por categoria.',
                'payload' => $this->categoriesPayload(false),
            ],
            'delivery' => [
                'moduleKey' => 'delivery',
                'moduleTitle' => 'Delivery',
                'moduleDescription' => 'Fila de entrega e retirada com taxa, endereço, status e entregador.',
                'payload' => $this->deliveryPayload(false),
            ],
            'compras' => [
                'moduleKey' => 'compras',
                'moduleTitle' => 'Compras',
                'moduleDescription' => 'Pedido de compra, itens recebidos e entrada automatica no estoque.',
                'payload' => $this->purchasesPayload(false),
            ],
            'contas-a-pagar' => [
                'moduleKey' => 'contas-a-pagar',
                'moduleTitle' => 'Contas a pagar',
                'moduleDescription' => 'Compromissos gerados por notas de entrada e lancamentos financeiros avulsos.',
                'payload' => $this->payablesPayload(false),
            ],
            'entrada-estoque' => [
                'moduleKey' => 'entrada-estoque',
                'moduleTitle' => 'Entrada de estoque',
                'moduleDescription' => 'Recebimento em etapas com fornecedor, nota, bipagem de itens e dados do boleto.',
                'payload' => $this->stockInboundPayload(false),
            ],
            'usuarios' => [
                'moduleKey' => 'usuarios',
                'moduleTitle' => 'Usuarios',
                'moduleDescription' => 'Perfis de acesso, senha de autorização gerencial e status operacional.',
                'payload' => $this->usersPayload(false),
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
            'contas-a-pagar' => ['message' => 'Conta a pagar salva com sucesso.', 'record' => $this->serializePayable($this->savePayable(null, $input, $userId))],
            'entrada-estoque' => ['message' => 'Entrada de estoque registrada com sucesso.', 'record' => $this->serializePurchase($this->saveStockInbound($input, $userId))],
            'usuarios' => ['message' => 'Usuario salvo com sucesso.', 'record' => $this->serializeUser($this->saveUser(null, $input))],
            default => abort(404),
        };
    }

    public function records(string $module, array $filters = []): array
    {
        return match ($module) {
            'clientes' => $this->customersPayload($filters),
            'fornecedores' => [
                'records' => $this->supplierRecords($filters),
            ],
            'categorias' => [
                'records' => $this->categoryRecords($filters),
            ],
            'delivery' => [
                'records' => $this->deliveryRecords($filters),
            ],
            'compras' => [
                'records' => $this->purchaseRecords($filters),
            ],
            'contas-a-pagar' => [
                'records' => $this->payableRecords($filters),
            ],
            'entrada-estoque' => [
                'records' => $this->stockInboundRecords($filters),
            ],
            'usuarios' => [
                'records' => $this->userRecords($filters),
            ],
            default => [
                'records' => data_get($this->build($module), 'payload.records', []),
            ],
        };
    }

    public function update(string $module, int $recordId, array $input, int $userId): array
    {
        return match ($module) {
            'clientes' => ['message' => 'Cliente atualizado com sucesso.', 'record' => $this->serializeCustomer($this->saveCustomer($this->findRecord(Customer::class, $recordId), $input))],
            'fornecedores' => ['message' => 'Fornecedor atualizado com sucesso.', 'record' => $this->serializeSupplier($this->saveSupplier($this->findRecord(Supplier::class, $recordId), $input))],
            'categorias' => ['message' => 'Categoria atualizada com sucesso.', 'record' => $this->serializeCategory($this->saveCategory($this->findRecord(Category::class, $recordId), $input))],
            'delivery' => ['message' => 'Entrega atualizada com sucesso.', 'record' => $this->serializeDeliveryOrder($this->saveDeliveryOrder($this->findRecord(DeliveryOrder::class, $recordId), $input))],
            'compras' => ['message' => 'Compra atualizada com sucesso.', 'record' => $this->serializePurchase($this->savePurchase($this->findRecord(Purchase::class, $recordId), $input, $userId))],
            'contas-a-pagar' => ['message' => 'Conta a pagar atualizada com sucesso.', 'record' => $this->serializePayable($this->savePayable($this->findRecord(Payable::class, $recordId), $input, $userId))],
            'entrada-estoque' => throw ValidationException::withMessages([
                'record' => 'Registros de estoque não podem ser alterados. Crie um novo lançamento.',
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
            'contas-a-pagar' => tap($this->findRecord(Payable::class, $recordId))->delete() ? 'Conta a pagar removida com sucesso.' : 'Conta a pagar removida com sucesso.',
            'usuarios' => tap($this->findRecord(User::class, $recordId))->delete() ? 'Usuario removido com sucesso.' : 'Usuario removido com sucesso.',
            'entrada-estoque' => throw ValidationException::withMessages([
                'record' => 'Registros de estoque não podem ser excluídos para preservar a rastreabilidade.',
            ]),
            default => abort(404),
        };
    }

    protected function deleteStockSensitiveRecord(Model $model, string $message): string
    {
        if (filled($model->getAttribute('stock_applied_at'))) {
            throw ValidationException::withMessages([
                'record' => 'Este registro já impactou o estoque e não pode ser removido.',
            ]);
        }

        $model->delete();

        return $message;
    }

    protected function deliveryPayload(bool $includeRecords = true, array $filters = []): array
    {
        return [
            'records' => $includeRecords ? $this->deliveryRecords($filters) : [],
            'customers' => $this->customerOptions(),
        ];
    }

    protected function deliveryRecords(array $filters = []): array
    {
        $validated = Validator::make($filters, [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'value' => ['nullable', 'numeric', 'gte:0'],
            'date' => ['nullable', 'date'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['all', 'pending', 'dispatched', 'delivered'])],
        ])->validate();

        if (!$this->hasDeliverySearchFilters($validated)) {
            return [];
        }

        if (filled($validated['from'] ?? null) && filled($validated['to'] ?? null) && $validated['from'] > $validated['to']) {
            throw ValidationException::withMessages([
                'filters' => 'O periodo final precisa ser maior ou igual ao periodo inicial.',
            ]);
        }

        $referenceDateExpression = 'COALESCE(scheduled_for, created_at)';
        $referenceDateOnlyExpression = "DATE({$referenceDateExpression})";
        $targetValue = filled($validated['value'] ?? null) ? round((float) $validated['value'], 2) : null;

        return DeliveryOrder::query()
            ->with(['customer:id,name,phone'])
            ->when(filled($validated['customer_id'] ?? null), fn ($query) => $query->where('customer_id', (int) $validated['customer_id']))
            ->when(filled($validated['status'] ?? null) && $validated['status'] !== 'all', fn ($query) => $query->where('status', $validated['status']))
            ->when(filled($validated['date'] ?? null), fn ($query) => $query->whereRaw("{$referenceDateOnlyExpression} = ?", [$validated['date']]))
            ->when(filled($validated['from'] ?? null), fn ($query) => $query->whereRaw("{$referenceDateOnlyExpression} >= ?", [$validated['from']]))
            ->when(filled($validated['to'] ?? null), fn ($query) => $query->whereRaw("{$referenceDateOnlyExpression} <= ?", [$validated['to']]))
            ->orderByRaw("{$referenceDateExpression} desc")
            ->orderByDesc('id')
            ->get()
            ->map(fn (DeliveryOrder $order) => $this->serializeDeliveryOrder($order))
            ->filter(fn (array $record) => $targetValue === null
                || round((float) $record['order_total'] + (float) $record['delivery_fee'], 2) === $targetValue)
            ->values()
            ->all();
    }

    protected function hasDeliverySearchFilters(array $filters): bool
    {
        return filled($filters['customer_id'] ?? null)
            || filled($filters['value'] ?? null)
            || filled($filters['date'] ?? null)
            || filled($filters['from'] ?? null)
            || filled($filters['to'] ?? null)
            || (filled($filters['status'] ?? null) && $filters['status'] !== 'all');
    }

    protected function purchasesPayload(bool $includeRecords = true): array
    {
        return [
            'records' => $includeRecords ? $this->purchaseRecords([], false) : [],
            'suppliers' => $this->supplierOptions(),
            'products' => $this->productOptions(),
            'incoming_nfe_documents' => IncomingNfeDocument::query()
                ->with([
                    'supplier:id,name,document',
                    'purchase.items',
                    'items.product:id,name,code,barcode,ncm,cost_price',
                    'manifestations',
                    'bookkeepingEntries',
                    'taxCredits',
                ])
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

    protected function purchaseRecords(array $filters = [], bool $requireDateFilters = true): array
    {
        if ($requireDateFilters && !$this->hasPurchaseDateFilters($filters)) {
            return [];
        }

        $date = filled($filters['date'] ?? null) ? (string) $filters['date'] : null;
        $from = filled($filters['from'] ?? null) ? (string) $filters['from'] : null;
        $to = filled($filters['to'] ?? null) ? (string) $filters['to'] : null;

        return Purchase::query()
            ->with(['supplier:id,name', 'items.product:id,name,code,unit'])
            ->when($date, fn ($query, $value) => $query->whereRaw('substr(created_at, 1, 10) = ?', [Carbon::parse($value)->toDateString()]))
            ->when($from, fn ($query, $value) => $query->whereRaw('substr(created_at, 1, 10) >= ?', [Carbon::parse($value)->toDateString()]))
            ->when($to, fn ($query, $value) => $query->whereRaw('substr(created_at, 1, 10) <= ?', [Carbon::parse($value)->toDateString()]))
            ->latest()
            ->get()
            ->map(fn (Purchase $purchase) => $this->serializePurchase($purchase))
            ->values()
            ->all();
    }

    protected function hasPurchaseDateFilters(array $filters): bool
    {
        return filled($filters['date'] ?? null)
            || filled($filters['from'] ?? null)
            || filled($filters['to'] ?? null);
    }

    protected function payablesPayload(bool $includeRecords = true): array
    {
        return [
            'records' => $includeRecords ? $this->payableRecords(['applied' => true]) : [],
            'status_counts' => $includeRecords ? $this->payableStatusCounts() : null,
            'suppliers' => $this->supplierOptions(),
            'categories' => [
                ['value' => 'supplier', 'label' => 'Fornecedor'],
                ['value' => 'rent', 'label' => 'Aluguel'],
                ['value' => 'utilities', 'label' => 'Utilities'],
                ['value' => 'other', 'label' => 'Outros'],
            ],
            'payment_methods' => [
                ['value' => 'cash', 'label' => 'Dinheiro'],
                ['value' => 'pix', 'label' => 'PIX'],
                ['value' => 'transfer', 'label' => 'Transferencia'],
                ['value' => 'boleto', 'label' => 'Boleto'],
            ],
            'recurrences' => [
                ['value' => 'once', 'label' => 'Unica'],
                ['value' => 'monthly', 'label' => 'Mensal'],
                ['value' => 'weekly', 'label' => 'Semanal'],
            ],
        ];
    }

    protected function payableStatusCounts(): array
    {
        return [
            'open' => Payable::query()->whereIn('status', ['open', 'overdue'])->count(),
            'overdue' => Payable::query()->where('status', 'overdue')->count(),
            'paid' => Payable::query()->where('status', 'paid')->count(),
            'all' => Payable::query()->count(),
        ];
    }

    protected function customersPayload(array $filters = []): array
    {
        $search = TextSearch::normalize($filters['search'] ?? null);

        if ($search === '') {
            return [
                'records' => [],
            ];
        }

        $query = Customer::query()
            ->withCount(['sales as sales_count' => fn ($query) => $query->where('status', 'finalized')]);

        if (! TextSearch::matchesAll($search)) {
            $query->where('name', 'like', TextSearch::likePattern($search));
        }

        return [
            'records' => $query
                ->orderBy('name')
                ->get()
                ->map(fn (Customer $customer) => $this->serializeCustomer($customer))
                ->values()
                ->all(),
        ];
    }

    protected function suppliersPayload(bool $includeRecords = true): array
    {
        return [
            'records' => $includeRecords ? $this->supplierRecords(['applied' => true]) : [],
        ];
    }

    protected function categoriesPayload(bool $includeRecords = true): array
    {
        return [
            'records' => $includeRecords ? $this->categoryRecords(['applied' => true]) : [],
        ];
    }

    protected function supplierRecords(array $filters = []): array
    {
        if (! $this->shouldLoadListRecords($filters)) {
            return [];
        }

        return Supplier::query()
            ->withCount(['products as products_count' => fn ($query) => $query->where('active', true)])
            ->orderBy('name')
            ->get()
            ->map(fn (Supplier $supplier) => $this->serializeSupplier($supplier))
            ->values()
            ->all();
    }

    protected function categoryRecords(array $filters = []): array
    {
        if (! $this->shouldLoadListRecords($filters)) {
            return [];
        }

        $search = TextSearch::normalize($filters['search'] ?? null);
        $status = (string) ($filters['status'] ?? 'all');

        return Category::query()
            ->withCount(['products as products_count' => fn ($query) => $query->where('active', true)])
            ->when($search !== '' && ! TextSearch::matchesAll($search), function ($query) use ($search) {
                $pattern = TextSearch::likePattern($search);

                $query->where(function ($query) use ($pattern) {
                    $query
                        ->where('name', 'like', $pattern)
                        ->orWhere('description', 'like', $pattern);
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('active', true))
            ->when($status === 'inactive', fn ($query) => $query->where('active', false))
            ->when($status === 'with-products', fn ($query) => $query->whereHas('products', fn ($query) => $query->where('active', true)))
            ->when($status === 'without-products', fn ($query) => $query->whereDoesntHave('products', fn ($query) => $query->where('active', true)))
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category) => $this->serializeCategory($category))
            ->values()
            ->all();
    }

    protected function payableRecords(array $filters = []): array
    {
        if (! $this->shouldLoadListRecords($filters)) {
            return [];
        }

        $validated = Validator::make($filters, [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['all', 'open', 'overdue', 'paid', 'cancelled'])],
            'search' => ['nullable', 'string', 'max:255'],
        ])->validate();

        if (filled($validated['from'] ?? null) && filled($validated['to'] ?? null) && $validated['from'] > $validated['to']) {
            throw ValidationException::withMessages([
                'filters' => 'O periodo final precisa ser maior ou igual ao periodo inicial.',
            ]);
        }

        $from = filled($validated['from'] ?? null) ? Carbon::parse((string) $validated['from'])->toDateString() : null;
        $to = filled($validated['to'] ?? null) ? Carbon::parse((string) $validated['to'])->toDateString() : null;
        $status = (string) ($validated['status'] ?? 'all');
        $search = TextSearch::normalize($validated['search'] ?? null);
        $referenceDateExpression = 'COALESCE(due_date, paid_at, created_at)';

        return Payable::query()
            ->with(['supplier:id,name', 'purchase:id,code'])
            ->when($from, fn ($query, string $value) => $query->whereRaw("DATE({$referenceDateExpression}) >= ?", [$value]))
            ->when($to, fn ($query, string $value) => $query->whereRaw("DATE({$referenceDateExpression}) <= ?", [$value]))
            ->orderByRaw("CASE WHEN status = 'paid' THEN 2 WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 0 ELSE 1 END")
            ->orderBy('due_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Payable $payable) => $this->serializePayable($payable))
            ->filter(fn (array $record) => $this->matchesPayableStatusFilter($record, $status))
            ->filter(fn (array $record) => $this->matchesPayableSearchFilter($record, $search))
            ->values()
            ->all();
    }

    protected function matchesPayableStatusFilter(array $record, string $status): bool
    {
        return match ($status) {
            'open' => in_array($record['status'] ?? '', ['open', 'overdue'], true),
            'overdue', 'paid', 'cancelled' => ($record['status'] ?? '') === $status,
            default => true,
        };
    }

    protected function matchesPayableSearchFilter(array $record, string $search): bool
    {
        if ($search === '') {
            return true;
        }

        $haystack = implode(' ', array_filter([
            $record['description'] ?? null,
            $record['supplier_name'] ?? null,
            $record['purchase_code'] ?? null,
            $record['code'] ?? null,
            $record['payment_method'] ?? null,
            $record['bank_name'] ?? null,
        ], fn ($value) => filled($value)));

        return str_contains(mb_strtolower($haystack), mb_strtolower($search));
    }

    protected function shouldLoadListRecords(array $filters = []): bool
    {
        return filter_var($filters['applied'] ?? false, FILTER_VALIDATE_BOOL);
    }

    protected function stockInboundPayload(bool $includeRecords = false, array $filters = []): array
    {
        return [
            'records' => $includeRecords ? $this->stockInboundRecords($filters) : [],
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

    protected function usersPayload(bool $includeRecords = true): array
    {
        return [
            'records' => $includeRecords ? $this->userRecords(['applied' => true]) : [],
            'roles' => [
                ['value' => 'admin', 'label' => 'Dono'],
                ['value' => 'manager', 'label' => 'Gerente'],
                ['value' => 'operator', 'label' => 'Operador'],
            ],
        ];
    }

    protected function userRecords(array $filters = []): array
    {
        if (! $this->shouldLoadListRecords($filters)) {
            return [];
        }

        return User::query()
            ->orderByRaw("CASE WHEN role = 'admin' THEN 0 WHEN role = 'manager' THEN 1 ELSE 2 END")
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->serializeUser($user))
            ->values()
            ->all();
    }

    protected function saveCustomer(?Customer $customer, array $input): Customer
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255', Rule::unique('customers', 'name')->ignore($customer?->id)],
            'document' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'state_registration' => ['nullable', 'string', 'max:30'],
            'street' => ['nullable', 'string', 'max:255'],
            'number' => ['nullable', 'string', 'max:30'],
            'complement' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'city_name' => ['nullable', 'string', 'max:255'],
            'city_code' => ['nullable', 'string', 'max:10'],
            'state' => ['nullable', 'string', 'size:2'],
            'zip_code' => ['nullable', 'string', 'max:12'],
            'consumer_final' => ['nullable', 'boolean'],
            'credit_limit' => ['nullable', 'numeric', 'min:0'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $document = filled($validated['document'] ?? null)
            ? preg_replace('/\D+/', '', (string) $validated['document'])
            : null;
        $cityCode = filled($validated['city_code'] ?? null)
            ? preg_replace('/\D+/', '', (string) $validated['city_code'])
            : null;
        $zipCode = filled($validated['zip_code'] ?? null)
            ? preg_replace('/\D+/', '', (string) $validated['zip_code'])
            : null;

        $customer ??= new Customer;
        $payload = [
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? null,
            'credit_limit' => round((float) ($validated['credit_limit'] ?? 0), 2),
            'active' => $validated['active'],
        ];

        if ($this->hasColumn('customers', 'document')) {
            $payload['document'] = $document;
        }

        if ($this->hasColumn('customers', 'document_type')) {
            $payload['document_type'] = $document
                ? (strlen($document) === 14 ? 'cnpj' : 'cpf')
                : null;
        }

        if ($this->hasColumn('customers', 'email')) {
            $payload['email'] = $validated['email'] ?? null;
        }

        if ($this->hasColumn('customers', 'state_registration')) {
            $payload['state_registration'] = $validated['state_registration'] ?? null;
        }

        if ($this->hasColumn('customers', 'street')) {
            $payload['street'] = $validated['street'] ?? null;
        }

        if ($this->hasColumn('customers', 'number')) {
            $payload['number'] = $validated['number'] ?? null;
        }

        if ($this->hasColumn('customers', 'complement')) {
            $payload['complement'] = $validated['complement'] ?? null;
        }

        if ($this->hasColumn('customers', 'district')) {
            $payload['district'] = $validated['district'] ?? null;
        }

        if ($this->hasColumn('customers', 'city_name')) {
            $payload['city_name'] = $validated['city_name'] ?? null;
        }

        if ($this->hasColumn('customers', 'city_code')) {
            $payload['city_code'] = $cityCode;
        }

        if ($this->hasColumn('customers', 'state')) {
            $payload['state'] = isset($validated['state']) ? strtoupper((string) $validated['state']) : null;
        }

        if ($this->hasColumn('customers', 'zip_code')) {
            $payload['zip_code'] = $zipCode;
        }

        if ($this->hasColumn('customers', 'consumer_final')) {
            $payload['consumer_final'] = (bool) ($validated['consumer_final'] ?? true);
        }

        $customer->fill($payload)->save();

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

    protected function requiresAmountConfirmation(float $amount, float $referenceAmount): bool
    {
        if ($amount <= 0) {
            return false;
        }

        if ($referenceAmount <= 0) {
            return $amount > self::AMOUNT_CONFIRMATION_ABSOLUTE_CEILING;
        }

        return $amount > $referenceAmount * self::AMOUNT_CONFIRMATION_RATIO
            && ($amount - $referenceAmount) > self::AMOUNT_CONFIRMATION_MIN_DIFF;
    }

    protected function assertAmountConfirmed(float $amount, float $referenceAmount, bool $confirmed, string $referenceLabel): void
    {
        if ($confirmed || ! $this->requiresAmountConfirmation($amount, $referenceAmount)) {
            return;
        }

        throw ValidationException::withMessages([
            'confirm_amount_mismatch' => [sprintf(
                'O valor informado (R$ %s) esta muito acima %s (R$ %s). Confirme se o valor esta correto para continuar.',
                number_format($amount, 2, ',', '.'),
                $referenceLabel,
                number_format($referenceAmount, 2, ',', '.'),
            )],
        ]);
    }

    protected function averagePayableAmount(): float
    {
        $average = Payable::query()
            ->where('status', '!=', 'cancelled')
            ->avg('amount');

        return $average !== null ? round((float) $average, 2) : 0.0;
    }

    protected function savePayable(?Payable $payable, array $input, int $userId): Payable
    {
        if (($input['action'] ?? null) === 'register_payment') {
            if (!$payable) {
                throw ValidationException::withMessages([
                    'record' => 'Selecione uma conta para registrar o pagamento.',
                ]);
            }

            $validated = Validator::make($input, [
                'payment_amount' => ['required', 'numeric', 'gt:0'],
                'payment_date' => ['required', 'date'],
                'payment_method' => ['required', 'string', 'max:40'],
                'payment_account' => ['nullable', 'string', 'max:120'],
                'payment_notes' => ['nullable', 'string'],
            ])->validate();

            $currentPaid = round((float) $payable->amount_paid, 2);
            $paymentAmount = round((float) $validated['payment_amount'], 2);
            $nextPaid = round(min((float) $payable->amount, $currentPaid + $paymentAmount), 2);
            $metadata = is_array($payable->metadata) ? $payable->metadata : [];
            $payments = is_array($metadata['payments'] ?? null) ? $metadata['payments'] : [];
            $payments[] = [
                'amount' => $paymentAmount,
                'paid_at' => $validated['payment_date'],
                'method' => $validated['payment_method'],
                'account' => $validated['payment_account'] ?? null,
                'notes' => $validated['payment_notes'] ?? null,
                'user_id' => $userId,
            ];

            $payable->forceFill([
                'amount_paid' => $nextPaid,
                'paid_at' => $nextPaid >= (float) $payable->amount ? ($validated['payment_date'] ?? $payable->paid_at) : $payable->paid_at,
                'payment_method' => $validated['payment_method'],
                'bank_name' => $validated['payment_account'] ?? $payable->bank_name,
                'notes' => $validated['payment_notes'] ?? $payable->notes,
                'status' => $nextPaid >= (float) $payable->amount ? 'paid' : 'open',
                'metadata' => array_merge($metadata, [
                    'payments' => $payments,
                ]),
            ])->save();

            return $payable->fresh(['supplier:id,name', 'purchase:id,code', 'user:id,name']);
        }

        $validated = Validator::make($input, [
            'purchase_id' => ['nullable', 'integer', 'exists:purchases,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'description' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(['supplier', 'rent', 'utilities', 'other'])],
            'payment_method' => ['nullable', 'string', 'max:40'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'amount_paid' => ['nullable', 'numeric', 'gte:0'],
            'due_date' => ['nullable', 'date'],
            'paid_at' => ['nullable', 'date'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'installment_label' => ['nullable', 'string', 'max:60'],
            'installment_number' => ['nullable', 'integer', 'min:1'],
            'installment_total' => ['nullable', 'integer', 'min:1'],
            'recurrence' => ['nullable', Rule::in(['once', 'monthly', 'weekly'])],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['open', 'paid', 'cancelled'])],
            'confirm_amount_mismatch' => ['nullable', 'boolean'],
        ])->validate();

        $payable ??= new Payable;
        $amount = round((float) $validated['amount'], 2);

        $this->assertAmountConfirmed(
            $amount,
            $this->averagePayableAmount(),
            (bool) ($validated['confirm_amount_mismatch'] ?? false),
            'da média dos lançamentos já cadastrados',
        );
        $amountPaid = round(min($amount, (float) ($validated['amount_paid'] ?? 0)), 2);
        $status = $validated['status'] ?? ($amountPaid >= $amount ? 'paid' : 'open');
        $metadata = is_array($payable->metadata) ? $payable->metadata : [];

        $payable->fill([
            'purchase_id' => $validated['purchase_id'] ?? null,
            'supplier_id' => $validated['supplier_id'] ?? null,
            'user_id' => $payable->user_id ?: $userId,
            'code' => $payable->code ?: $this->nextCode(Payable::class, 'PAG'),
            'description' => $validated['description'],
            'category' => $validated['category'],
            'status' => $status,
            'payment_method' => $validated['payment_method'] ?? null,
            'amount' => $amount,
            'amount_paid' => $amountPaid,
            'due_date' => $validated['due_date'] ?? null,
            'paid_at' => $status === 'paid'
                ? ($validated['paid_at'] ?? $payable->paid_at ?? now())
                : null,
            'bank_name' => $validated['bank_name'] ?? null,
            'barcode' => $validated['barcode'] ?? null,
            'installment_label' => $validated['installment_label'] ?? null,
            'installment_number' => $validated['installment_number'] ?? null,
            'installment_total' => $validated['installment_total'] ?? null,
            'recurrence' => $validated['recurrence'] ?? 'once',
            'notes' => $validated['notes'] ?? null,
            'metadata' => $metadata,
        ])->save();

        return $payable->fresh(['supplier:id,name', 'purchase:id,code', 'user:id,name']);
    }

    protected function savePurchase(?Purchase $purchase, array $input, int $userId): Purchase
    {
        $requestedStatus = (string) ($input['status'] ?? $purchase?->status ?? 'draft');
        $requiresItems = in_array($requestedStatus, ['ordered', 'received'], true);

        $validator = Validator::make($input, [
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'custom_name' => ['nullable', 'string', 'max:160'],
            'status' => ['required', Rule::in(['draft', 'ordered', 'received'])],
            'expected_at' => ['nullable', 'date'],
            'received_at' => ['nullable', 'date'],
            'freight' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'invoice_number' => ['nullable', 'string', 'max:80'],
            'invoice_date' => ['nullable', 'date'],
            'invoice_series' => ['nullable', 'string', 'max:20'],
            'invoice_access_key' => ['nullable', 'string', 'max:80'],
            'billing_barcode' => ['nullable', 'string', 'max:255'],
            'billing_amount' => ['nullable', 'numeric', 'gte:0'],
            'billing_due_date' => ['nullable', 'date'],
            'payables' => ['nullable', 'array'],
            'payables.*.description' => ['nullable', 'string', 'max:255'],
            'payables.*.amount' => ['required_with:payables', 'numeric', 'gt:0'],
            'payables.*.due_date' => ['nullable', 'date'],
            'payables.*.payment_method' => ['nullable', 'string', 'max:40'],
            'payables.*.bank_name' => ['nullable', 'string', 'max:120'],
            'payables.*.barcode' => ['nullable', 'string', 'max:255'],
            'payables.*.installment_label' => ['nullable', 'string', 'max:60'],
            'payables.*.installment_number' => ['nullable', 'integer', 'min:1'],
            'payables.*.installment_total' => ['nullable', 'integer', 'min:1'],
            'payables.*.recurrence' => ['nullable', Rule::in(['once', 'monthly', 'weekly'])],
            'payables.*.mark_paid' => ['nullable', 'boolean'],
            'payables.*.paid_at' => ['nullable', 'date'],
            'payables.*.notes' => ['nullable', 'string'],
            'auto_update_sale_price' => ['nullable', 'boolean'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'gte:0'],
            'items.*.sale_price' => ['nullable', 'numeric', 'gte:0'],
            'items.*.apply_sale_price' => ['nullable', 'boolean'],
            'confirm_amount_mismatch' => ['nullable', 'boolean'],
        ]);

        $validator->after(function ($validator) use ($input, $requiresItems) {
            $items = $input['items'] ?? [];

            if ($requiresItems && (! is_array($items) || count($items) === 0)) {
                $validator->errors()->add('items', 'Adicione pelo menos um item antes de concluir a compra.');
            }
        });

        $validated = $validator->validate();

        if ($validated['status'] === 'received') {
            $itemsSubtotal = collect($validated['items'] ?? [])->sum(
                fn (array $item) => round((float) $item['quantity'], 3) * round((float) $item['unit_cost'], 2),
            );
            $referenceTotal = round($itemsSubtotal + round((float) ($validated['freight'] ?? 0), 2), 2);
            $payablesTotal = round(collect($validated['payables'] ?? [])->sum(
                fn (array $entry) => round((float) ($entry['amount'] ?? 0), 2),
            ), 2);
            $amountToCheck = $payablesTotal > 0
                ? $payablesTotal
                : round((float) ($validated['billing_amount'] ?? 0), 2);

            $this->assertAmountConfirmed(
                $amountToCheck,
                $referenceTotal,
                (bool) ($validated['confirm_amount_mismatch'] ?? false),
                'do custo dos itens desta entrada de mercadoria',
            );
        }

        return DB::transaction(function () use ($purchase, $validated, $userId) {
            $products = Product::query()
                ->whereIn('id', collect($validated['items'] ?? [])->pluck('product_id')->all())
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $items = collect($validated['items'] ?? [])->map(function (array $item) use ($products) {
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
                    'record' => 'Esta compra já entrou no estoque e não pode mais ser alterada.',
                ]);
            }

            $purchase ??= new Purchase;
            $subtotal = round($items->sum('total'), 2);
            $freight = round((float) ($validated['freight'] ?? 0), 2);
            $purchaseMetadata = $this->decodePurchaseNotes($purchase->notes);
            $customName = array_key_exists('custom_name', $validated)
                ? ($validated['custom_name'] ?? null)
                : ($purchaseMetadata['custom_name'] ?? null);
            $plainNotes = array_key_exists('notes', $validated)
                ? ($validated['notes'] ?? null)
                : ($purchaseMetadata['notes'] ?? null);
            $invoiceNumber = array_key_exists('invoice_number', $validated)
                ? ($validated['invoice_number'] ?? null)
                : ($purchaseMetadata['invoice_number'] ?? null);
            $invoiceDate = array_key_exists('invoice_date', $validated)
                ? ($validated['invoice_date'] ?? null)
                : ($purchaseMetadata['invoice_date'] ?? null);
            $invoiceSeries = array_key_exists('invoice_series', $validated)
                ? ($validated['invoice_series'] ?? null)
                : ($purchaseMetadata['invoice_series'] ?? null);
            $invoiceAccessKey = array_key_exists('invoice_access_key', $validated)
                ? (filled($validated['invoice_access_key'] ?? null)
                    ? preg_replace('/\D+/', '', (string) $validated['invoice_access_key'])
                    : null)
                : ($purchaseMetadata['invoice_access_key'] ?? null);
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
                || filled($customName)
                || filled($invoiceNumber)
                || filled($invoiceDate)
                || filled($invoiceSeries)
                || filled($invoiceAccessKey)
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
                        'custom_name' => $customName,
                        'notes' => $plainNotes,
                        'invoice_number' => $invoiceNumber,
                        'invoice_date' => $invoiceDate,
                        'invoice_series' => $invoiceSeries,
                        'invoice_access_key' => $invoiceAccessKey,
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

                if ((bool) ($validated['auto_update_sale_price'] ?? false)) {
                    foreach ($validated['items'] as $entry) {
                        if (!($entry['apply_sale_price'] ?? false) || !array_key_exists('sale_price', $entry) || $entry['sale_price'] === null) {
                            continue;
                        }

                        $product = $products->get($entry['product_id']);

                        if (!$product) {
                            continue;
                        }

                        $product->forceFill([
                            'sale_price' => round((float) $entry['sale_price'], 2),
                        ])->save();
                    }
                }

                $purchase->forceFill(['stock_applied_at' => now()])->save();
            }

            if ($purchase->status === 'received') {
                $payableSchedule = $this->resolvePurchasePayableSchedule(
                    $validated,
                    $purchase,
                    $invoiceNumber,
                    $billingAmount,
                    $billingDueDate,
                    $billingBarcode,
                );

                $this->syncPurchasePayables($purchase, $payableSchedule, $userId);
            }

            return $purchase->fresh(['supplier:id,name', 'producer:id,name', 'items.product:id,name,code,unit']);
        });
    }

    protected function resolvePurchasePayableSchedule(
        array $validated,
        Purchase $purchase,
        ?string $invoiceNumber,
        ?float $billingAmount,
        mixed $billingDueDate,
        ?string $billingBarcode,
    ): array {
        $payables = collect($validated['payables'] ?? [])
            ->filter(fn ($entry) => round((float) ($entry['amount'] ?? 0), 2) > 0)
            ->map(function (array $entry, int $index) use ($purchase, $invoiceNumber) {
                $amount = round((float) $entry['amount'], 2);
                $markPaid = (bool) ($entry['mark_paid'] ?? false);

                return [
                    'description' => $entry['description']
                        ?? sprintf('%s%s', $invoiceNumber ?: ($purchase->code ?: 'Conta a pagar'), !empty($entry['installment_label']) ? " - {$entry['installment_label']}" : ''),
                    'amount' => $amount,
                    'due_date' => $entry['due_date'] ?? null,
                    'payment_method' => $entry['payment_method'] ?? null,
                    'bank_name' => $entry['bank_name'] ?? null,
                    'barcode' => $entry['barcode'] ?? null,
                    'installment_label' => $entry['installment_label'] ?? sprintf('Parcela %d', $index + 1),
                    'installment_number' => $entry['installment_number'] ?? null,
                    'installment_total' => $entry['installment_total'] ?? null,
                    'recurrence' => $entry['recurrence'] ?? 'once',
                    'notes' => $entry['notes'] ?? null,
                    'amount_paid' => $markPaid ? $amount : round((float) ($entry['amount_paid'] ?? 0), 2),
                    'paid_at' => $markPaid ? ($entry['paid_at'] ?? now()->toDateString()) : ($entry['paid_at'] ?? null),
                    'status' => $markPaid ? 'paid' : 'open',
                ];
            })
            ->values()
            ->all();

        if ($payables !== []) {
            return $payables;
        }

        if (($billingAmount ?? 0) <= 0 && blank($billingDueDate) && blank($billingBarcode)) {
            return [];
        }

        return [[
            'description' => $invoiceNumber ?: $purchase->code,
            'amount' => round((float) ($billingAmount ?? $purchase->total), 2),
            'due_date' => $billingDueDate,
            'payment_method' => filled($billingBarcode) ? 'boleto' : 'cash',
            'bank_name' => null,
            'barcode' => $billingBarcode,
            'installment_label' => 'Parcela única',
            'installment_number' => 1,
            'installment_total' => 1,
            'recurrence' => 'once',
            'notes' => null,
            'amount_paid' => 0,
            'paid_at' => null,
            'status' => 'open',
        ]];
    }

    protected function syncPurchasePayables(Purchase $purchase, array $schedule, int $userId): void
    {
        Payable::query()->where('purchase_id', $purchase->id)->delete();

        if ($schedule === []) {
            return;
        }

        $purchase->loadMissing('supplier:id,name');

        foreach ($schedule as $index => $entry) {
            $amount = round((float) ($entry['amount'] ?? 0), 2);

            if ($amount <= 0) {
                continue;
            }

            $amountPaid = round(min($amount, (float) ($entry['amount_paid'] ?? 0)), 2);
            $status = ($entry['status'] ?? null) === 'cancelled'
                ? 'cancelled'
                : ($amountPaid >= $amount ? 'paid' : 'open');

            Payable::query()->create([
                'purchase_id' => $purchase->id,
                'supplier_id' => $purchase->supplier_id,
                'user_id' => $userId,
                'code' => $this->nextCode(Payable::class, 'PAG'),
                'description' => $entry['description'] ?? ($purchase->code ?: 'Conta a pagar'),
                'category' => 'supplier',
                'status' => $status,
                'payment_method' => $entry['payment_method'] ?? null,
                'amount' => $amount,
                'amount_paid' => $amountPaid,
                'due_date' => $entry['due_date'] ?? null,
                'paid_at' => $status === 'paid' ? ($entry['paid_at'] ?? now()) : null,
                'bank_name' => $entry['bank_name'] ?? null,
                'barcode' => $entry['barcode'] ?? null,
                'installment_label' => $entry['installment_label'] ?? sprintf('Parcela %d', $index + 1),
                'installment_number' => $entry['installment_number'] ?? ($index + 1),
                'installment_total' => $entry['installment_total'] ?? count($schedule),
                'recurrence' => $entry['recurrence'] ?? 'once',
                'notes' => $entry['notes'] ?? null,
                'metadata' => [
                    'generated_from' => 'purchase',
                    'purchase_code' => $purchase->code,
                    'supplier_name' => $purchase->supplier?->name,
                ],
            ]);
        }
    }

    protected function stockInboundRecords(array $filters = [], int $limit = 80): array
    {
        if (! $this->shouldLoadListRecords($filters)) {
            return [];
        }

        $nf = TextSearch::normalize($filters['nf'] ?? null);
        $supplier = TextSearch::normalize($filters['supplier'] ?? null);
        $product = TextSearch::normalize($filters['product'] ?? null);
        $search = TextSearch::normalize($filters['search'] ?? null);
        $date = filled($filters['date'] ?? null) ? Carbon::parse((string) $filters['date'])->toDateString() : null;
        $from = filled($filters['from'] ?? null) ? Carbon::parse((string) $filters['from'])->toDateString() : null;
        $to = filled($filters['to'] ?? null) ? Carbon::parse((string) $filters['to'])->toDateString() : null;
        $month = filled($filters['month'] ?? null) ? substr((string) $filters['month'], 0, 7) : null;
        $period = (string) ($filters['period'] ?? '');
        $exactTime = filled($filters['time'] ?? null) ? substr((string) $filters['time'], 0, 5) : null;
        $timeSlot = (string) ($filters['time_slot'] ?? '');
        $periodStart = match ($period) {
            'today' => now()->startOfDay(),
            'week' => now()->subDays(6)->startOfDay(),
            'month' => now()->subDays(29)->startOfDay(),
            default => null,
        };

        $records = Purchase::query()
            ->with(['supplier:id,name', 'items.product:id,name,code,barcode,unit'])
            ->where('status', 'received')
            ->when($date, fn ($query, $value) => $query->whereRaw('substr(COALESCE(received_at, created_at), 1, 10) = ?', [$value]))
            ->when($from, fn ($query, string $value) => $query->whereRaw('substr(COALESCE(received_at, created_at), 1, 10) >= ?', [$value]))
            ->when($to, fn ($query, string $value) => $query->whereRaw('substr(COALESCE(received_at, created_at), 1, 10) <= ?', [$value]))
            ->when($month, fn ($query, $value) => $query->whereRaw('substr(COALESCE(received_at, created_at), 1, 7) = ?', [$value]))
            ->when($periodStart, fn ($query, Carbon $value) => $query->whereRaw('COALESCE(received_at, created_at) >= ?', [$value->toDateTimeString()]))
            ->when($nf !== '', function ($query) use ($nf) {
                $like = TextSearch::likePattern($nf);

                $query->where(function ($nestedQuery) use ($like, $nf) {
                    $nestedQuery
                        ->where('code', 'like', $like)
                        ->orWhere('notes', 'like', $like);

                    if (is_numeric($nf)) {
                        $nestedQuery->orWhere('id', (int) $nf);
                    }
                });
            })
            ->when($supplier !== '', function ($query) use ($supplier) {
                $like = TextSearch::likePattern($supplier);

                $query->whereHas('supplier', fn ($supplierQuery) => $supplierQuery->where('name', 'like', $like));
            })
            ->when($product !== '', function ($query) use ($product) {
                $like = TextSearch::likePattern($product);

                $query->whereHas('items', function ($itemQuery) use ($like) {
                    $itemQuery
                        ->where('product_name', 'like', $like)
                        ->orWhereHas('product', fn ($productQuery) => $productQuery->where('name', 'like', $like));
                });
            })
            ->when($search !== '', function ($query) use ($search) {
                $like = TextSearch::likePattern($search);

                $query->where(function ($nestedQuery) use ($like, $search) {
                    $nestedQuery
                        ->where('code', 'like', $like)
                        ->orWhere('notes', 'like', $like)
                        ->orWhereHas('supplier', fn ($supplierQuery) => $supplierQuery->where('name', 'like', $like))
                        ->orWhereHas('items', function ($itemQuery) use ($like) {
                            $itemQuery
                                ->where('product_name', 'like', $like)
                                ->orWhereHas('product', fn ($productQuery) => $productQuery->where('name', 'like', $like));
                        });

                    if (is_numeric($search)) {
                        $nestedQuery->orWhere('id', (int) $search);
                    }
                });
            })
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (Purchase $purchase) => $this->serializePurchase($purchase))
            ->filter(fn (array $record) => $this->matchesStockInboundTimeFilters($record, $exactTime, $timeSlot))
            ->values();

        return $records->all();
    }

    protected function matchesStockInboundTimeFilters(array $record, ?string $exactTime, string $timeSlot): bool
    {
        if (! $exactTime && $timeSlot === '') {
            return true;
        }

        $value = $record['received_at'] ?? $record['created_at'] ?? null;

        if (! $value) {
            return false;
        }

        $date = Carbon::parse((string) $value);

        if ($exactTime && ! str_starts_with($date->format('H:i'), $exactTime)) {
            return false;
        }

        if ($timeSlot === 'morning') {
            return $date->hour >= 6 && $date->hour < 12;
        }

        if ($timeSlot === 'afternoon') {
            return $date->hour >= 12 && $date->hour < 18;
        }

        if ($timeSlot === 'night') {
            return $date->hour >= 18 || $date->hour < 6;
        }

        return true;
    }

    protected function stockMovementRecords(array $types, int $limit = 120, array $filters = []): array
    {
        $search = TextSearch::normalize($filters['search'] ?? null);
        $date = filled($filters['date'] ?? null) ? Carbon::parse((string) $filters['date'])->toDateString() : null;
        $from = filled($filters['from'] ?? null) ? Carbon::parse((string) $filters['from'])->toDateString() : null;
        $to = filled($filters['to'] ?? null) ? Carbon::parse((string) $filters['to'])->toDateString() : null;

        return InventoryMovement::query()
            ->with(['product:id,name,code,unit', 'user:id,name'])
            ->whereIn('type', $types)
            ->when($date, fn ($query, string $value) => $query->whereRaw('substr(occurred_at, 1, 10) = ?', [$value]))
            ->when($from, fn ($query, string $value) => $query->whereRaw('substr(occurred_at, 1, 10) >= ?', [$value]))
            ->when($to, fn ($query, string $value) => $query->whereRaw('substr(occurred_at, 1, 10) <= ?', [$value]))
            ->when($search !== '', function ($query) use ($search) {
                $like = TextSearch::likePattern($search);

                $query->where(function ($nestedQuery) use ($like) {
                    $nestedQuery
                        ->where('notes', 'like', $like)
                        ->orWhereHas('product', function ($productQuery) use ($like) {
                            $productQuery
                                ->where('name', 'like', $like)
                                ->orWhere('code', 'like', $like)
                                ->orWhere('barcode', 'like', $like);
                        })
                        ->orWhereHas('user', fn ($userQuery) => $userQuery->where('name', 'like', $like));
                });
            })
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
            'manual_adjustment' => 'Ajuste de estoque',
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
            ->get(['id', 'name', 'document', 'city_name', 'state'])
            ->map(fn (Supplier $supplier) => [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'document' => $supplier->document,
                'city_name' => $supplier->city_name,
                'state' => $supplier->state,
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
            'document' => $this->hasColumn('customers', 'document')
                ? $customer->getAttribute('document')
                : null,
            'document_type' => $this->hasColumn('customers', 'document_type')
                ? $customer->getAttribute('document_type')
                : null,
            'phone' => $customer->phone,
            'email' => $this->hasColumn('customers', 'email')
                ? $customer->getAttribute('email')
                : null,
            'state_registration' => $this->hasColumn('customers', 'state_registration')
                ? $customer->getAttribute('state_registration')
                : null,
            'street' => $this->hasColumn('customers', 'street')
                ? $customer->getAttribute('street')
                : null,
            'number' => $this->hasColumn('customers', 'number')
                ? $customer->getAttribute('number')
                : null,
            'complement' => $this->hasColumn('customers', 'complement')
                ? $customer->getAttribute('complement')
                : null,
            'district' => $this->hasColumn('customers', 'district')
                ? $customer->getAttribute('district')
                : null,
            'city_name' => $this->hasColumn('customers', 'city_name')
                ? $customer->getAttribute('city_name')
                : null,
            'city_code' => $this->hasColumn('customers', 'city_code')
                ? $customer->getAttribute('city_code')
                : null,
            'state' => $this->hasColumn('customers', 'state')
                ? $customer->getAttribute('state')
                : null,
            'zip_code' => $this->hasColumn('customers', 'zip_code')
                ? $customer->getAttribute('zip_code')
                : null,
            'consumer_final' => $this->hasColumn('customers', 'consumer_final')
                ? (bool) $customer->getAttribute('consumer_final')
                : true,
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

    protected function serializePayable(Payable $payable): array
    {
        $payable->loadMissing(['supplier:id,name', 'purchase:id,code']);
        $amount = round((float) $payable->amount, 2);
        $amountPaid = round((float) $payable->amount_paid, 2);
        $remaining = round(max(0, $amount - $amountPaid), 2);
        $baseStatus = (string) ($payable->status ?: 'open');
        $resolvedStatus = $baseStatus;

        if ($baseStatus !== 'cancelled') {
            if ($remaining <= 0.009) {
                $resolvedStatus = 'paid';
            } elseif ($payable->due_date && $payable->due_date->lt(today())) {
                $resolvedStatus = 'overdue';
            } else {
                $resolvedStatus = 'open';
            }
        }

        return [
            'id' => $payable->id,
            'purchase_id' => $payable->purchase_id,
            'purchase_code' => $payable->purchase?->code,
            'supplier_id' => $payable->supplier_id,
            'supplier_name' => $payable->supplier?->name,
            'code' => $payable->code,
            'description' => $payable->description,
            'category' => $payable->category,
            'status' => $resolvedStatus,
            'base_status' => $baseStatus,
            'status_label' => match ($resolvedStatus) {
                'paid' => 'Pago',
                'overdue' => 'Vencido',
                'cancelled' => 'Cancelado',
                default => 'Em aberto',
            },
            'status_tone' => match ($resolvedStatus) {
                'paid' => 'success',
                'overdue' => 'danger',
                'cancelled' => 'neutral',
                default => 'warning',
            },
            'payment_method' => $payable->payment_method,
            'amount' => $amount,
            'amount_paid' => $amountPaid,
            'remaining_amount' => $remaining,
            'due_date' => $payable->due_date?->toDateString(),
            'paid_at' => $payable->paid_at?->toIso8601String(),
            'bank_name' => $payable->bank_name,
            'barcode' => $payable->barcode,
            'installment_label' => $payable->installment_label,
            'installment_number' => $payable->installment_number,
            'installment_total' => $payable->installment_total,
            'recurrence' => $payable->recurrence,
            'notes' => $payable->notes,
            'metadata' => $payable->metadata ?? [],
            'created_at' => $payable->created_at?->toIso8601String(),
            'updated_at' => $payable->updated_at?->toIso8601String(),
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
            'created_at' => $purchase->created_at?->toIso8601String(),
            'expected_at' => $purchase->expected_at?->format('Y-m-d'),
            'received_at' => $purchase->received_at?->toIso8601String(),
            'subtotal' => (float) $purchase->subtotal,
            'freight' => (float) $purchase->freight,
            'total' => (float) $purchase->total,
            'custom_name' => $metadata['custom_name'] ?? null,
            'notes' => $metadata['notes'] ?? null,
            'invoice_number' => $metadata['invoice_number'] ?? null,
            'invoice_date' => $metadata['invoice_date'] ?? null,
            'invoice_series' => $metadata['invoice_series'] ?? null,
            'invoice_access_key' => $metadata['invoice_access_key'] ?? null,
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
