<?php

namespace Database\Seeders;

use App\Models\Tenant\CashMovement;
use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Sale;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\User;
use App\Services\Tenant\InventoryMovementService;
use App\Services\Tenant\OrderDraftService;
use App\Services\Tenant\PosService;
use App\Services\Tenant\ProductService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class TenantSampleDataSeeder extends Seeder
{
    protected array $columnCache = [];

    public function run(): void
    {
        $this->ensureModulesEnabled();

        $users = $this->ensureUsers();
        $categories = $this->ensureCategories();
        $suppliers = $this->ensureSuppliers();
        $customers = $this->ensureCustomers();
        $products = $this->ensureProducts($categories, $suppliers);

        $this->ensureCashRegisters($users);
        $this->ensureCashMovements($users);
        $this->ensurePurchases($products, $suppliers, $users['operator']);
        $this->ensureDeliveries($customers);
        $this->ensureOrderDrafts($products, $customers, $users);
        $this->ensureSales($customers, $users);

        $this->outputSummary();
    }

    protected function ensureModulesEnabled(): void
    {
        $settingsService = app(TenantSettingsService::class);
        $settings = $settingsService->get();
        $modules = array_merge($settings['modules'] ?? [], [
            'comandas' => true,
            'pdv_simples' => true,
            'estoque' => true,
            'prazo' => true,
            'delivery' => true,
            'caixa' => true,
            'relatorios_avancados' => true,
            'clientes' => true,
            'fornecedores' => true,
            'compras' => true,
        ]);

        $settingsService->update([
            'business' => [
                'preset' => TenantSettingsService::CUSTOM_PRESET,
            ],
            'cash_closing' => $settings['cash_closing'] ?? [],
            'modules' => $modules,
        ]);
    }

    protected function ensureUsers(): array
    {
        $users = [];

        foreach ([
            'admin' => [
                'name' => 'Admin Amostra',
                'username' => 'amostra.admin',
                'role' => 'admin',
                'is_supervisor' => true,
            ],
            'operator' => [
                'name' => 'Caixa Amostra',
                'username' => 'amostra.caixa',
                'role' => 'operator',
                'is_supervisor' => false,
            ],
            'attendant' => [
                'name' => 'Atendimento Amostra',
                'username' => 'amostra.atendimento',
                'role' => 'operator',
                'is_supervisor' => false,
            ],
        ] as $key => $entry) {
            $user = User::query()->firstOrNew(['username' => $entry['username']]);

            $payload = [
                'name' => $entry['name'],
                'username' => $entry['username'],
                'role' => $entry['role'],
                'password' => $user->exists ? $user->password : Hash::make('123456'),
                'active' => true,
                'must_change_password' => false,
            ];

            if ($this->hasColumn('users', 'is_supervisor')) {
                $payload['is_supervisor'] = $entry['is_supervisor'];
            }

            if ($this->hasColumn('users', 'discount_authorization_password')) {
                $payload['discount_authorization_password'] = Hash::make('1234');
            }

            $user->fill($payload)->save();
            $users[$key] = $user->fresh();
        }

        return $users;
    }

    protected function ensureCategories(): array
    {
        $records = [];

        foreach ($this->categoryEntries() as $entry) {
            $category = Category::query()->updateOrCreate(
                ['name' => $entry['name']],
                [
                    'description' => $entry['description'],
                    'active' => $entry['active'],
                ],
            );

            $records[$entry['key']] = $category;
        }

        return $records;
    }

    protected function ensureSuppliers(): array
    {
        $records = [];

        foreach ($this->supplierEntries() as $entry) {
            $supplier = Supplier::query()->firstOrNew(['name' => $entry['name']]);
            $payload = [
                'name' => $entry['name'],
                'phone' => $entry['phone'],
                'email' => $entry['email'],
                'active' => $entry['active'],
            ];

            if ($this->hasColumn('suppliers', 'document')) {
                $payload['document'] = $entry['document'];
            }

            if ($this->hasColumn('suppliers', 'document_type')) {
                $payload['document_type'] = 'cnpj';
            }

            if ($this->hasColumn('suppliers', 'trade_name')) {
                $payload['trade_name'] = $entry['trade_name'];
            }

            if ($this->hasColumn('suppliers', 'state_registration')) {
                $payload['state_registration'] = $entry['state_registration'];
            }

            if ($this->hasColumn('suppliers', 'city_name')) {
                $payload['city_name'] = $entry['city_name'];
            }

            if ($this->hasColumn('suppliers', 'state')) {
                $payload['state'] = $entry['state'];
            }

            $supplier->fill($payload)->save();
            $records[$entry['key']] = $supplier->fresh();
        }

        return $records;
    }

    protected function ensureCustomers(): array
    {
        $records = [];

        foreach ($this->customerEntries() as $entry) {
            $customer = Customer::query()->firstOrNew(['name' => $entry['name']]);
            $payload = [
                'name' => $entry['name'],
                'phone' => $entry['phone'],
                'credit_limit' => $entry['credit_limit'],
                'active' => $entry['active'],
            ];

            if ($this->hasColumn('customers', 'document')) {
                $payload['document'] = $entry['document'];
            }

            if ($this->hasColumn('customers', 'document_type')) {
                $payload['document_type'] = 'cpf';
            }

            if ($this->hasColumn('customers', 'email')) {
                $payload['email'] = $entry['email'];
            }

            if ($this->hasColumn('customers', 'state_registration')) {
                $payload['state_registration'] = null;
            }

            if ($this->hasColumn('customers', 'street')) {
                $payload['street'] = $entry['street'];
            }

            if ($this->hasColumn('customers', 'number')) {
                $payload['number'] = $entry['number'];
            }

            if ($this->hasColumn('customers', 'complement')) {
                $payload['complement'] = $entry['complement'];
            }

            if ($this->hasColumn('customers', 'district')) {
                $payload['district'] = $entry['district'];
            }

            if ($this->hasColumn('customers', 'city_name')) {
                $payload['city_name'] = $entry['city_name'];
            }

            if ($this->hasColumn('customers', 'city_code')) {
                $payload['city_code'] = $entry['city_code'];
            }

            if ($this->hasColumn('customers', 'state')) {
                $payload['state'] = $entry['state'];
            }

            if ($this->hasColumn('customers', 'zip_code')) {
                $payload['zip_code'] = $entry['zip_code'];
            }

            if ($this->hasColumn('customers', 'consumer_final')) {
                $payload['consumer_final'] = true;
            }

            $customer->fill($payload)->save();
            $records[$entry['key']] = $customer->fresh();
        }

        return $records;
    }

    protected function ensureProducts(array $categories, array $suppliers): array
    {
        $records = [];
        $productService = app(ProductService::class);

        foreach ($this->productEntries() as $entry) {
            $product = Product::query()->firstWhere('code', $entry['code']) ?? new Product;

            $saved = $productService->save($product, [
                'code' => $entry['code'],
                'barcode' => $entry['barcode'],
                'name' => $entry['name'],
                'description' => $entry['description'],
                'category_id' => $categories[$entry['category']]->id,
                'supplier_id' => $suppliers[$entry['supplier']]->id,
                'unit' => 'UN',
                'commercial_unit' => 'UN',
                'taxable_unit' => 'UN',
                'cost_price' => $entry['cost_price'],
                'sale_price' => $entry['sale_price'],
                'min_stock' => $entry['min_stock'],
                'active' => true,
                'catalog_visible' => true,
                'fiscal_enabled' => true,
                'ncm' => $entry['ncm'],
                'cfop' => '5102',
                'origin_code' => '0',
                'icms_csosn' => '102',
                'pis_cst' => '49',
                'cofins_cst' => '49',
            ]);

            $records[$entry['key']] = $saved;
        }

        return $records;
    }

    protected function ensureCashRegisters(array $users): void
    {
        $base = now()->subDays(90)->setTime(8, 0);

        foreach ([
            'operator' => 'Amostra seed caixa operador',
            'attendant' => 'Amostra seed caixa atendimento',
        ] as $userKey => $openingNotes) {
            $existing = CashRegister::query()
                ->where('user_id', $users[$userKey]->id)
                ->where('status', 'open')
                ->where('opening_notes', $openingNotes)
                ->first();

            if ($existing) {
                $existing->forceFill([
                    'opening_amount' => 200,
                    'opened_at' => $base->copy(),
                ])->saveQuietly();

                continue;
            }

            CashRegister::query()->create([
                'user_id' => $users[$userKey]->id,
                'status' => 'open',
                'opening_amount' => 200,
                'opening_notes' => $openingNotes,
                'opened_at' => $base->copy(),
            ]);
        }
    }

    protected function ensureCashMovements(array $users): void
    {
        $base = now()->startOfDay();
        $cashRegisters = [
            'operator' => CashRegister::query()
                ->where('user_id', $users['operator']->id)
                ->where('status', 'open')
                ->where('opening_notes', 'Amostra seed caixa operador')
                ->latest('opened_at')
                ->first(),
            'attendant' => CashRegister::query()
                ->where('user_id', $users['attendant']->id)
                ->where('status', 'open')
                ->where('opening_notes', 'Amostra seed caixa atendimento')
                ->latest('opened_at')
                ->first(),
        ];

        foreach ($this->cashMovementEntries($base) as $entry) {
            if (CashMovement::query()->where('reason', $entry['reason'])->exists()) {
                continue;
            }

            $movement = CashMovement::query()->create([
                'cash_register_id' => $cashRegisters[$entry['user']]?->id,
                'user_id' => $users[$entry['user']]->id,
                'type' => $entry['type'],
                'amount' => $entry['amount'],
                'reason' => $entry['reason'],
            ]);

            $movement->forceFill([
                'created_at' => $entry['created_at'],
                'updated_at' => $entry['created_at'],
            ])->saveQuietly();
        }
    }

    protected function ensurePurchases(array $products, array $suppliers, User $user): void
    {
        $inventoryService = app(InventoryMovementService::class);
        $base = now()->startOfDay();

        foreach ($this->purchaseEntries($base) as $entry) {
            if (Purchase::query()->where('code', $entry['code'])->exists()) {
                continue;
            }

            DB::transaction(function () use ($entry, $suppliers, $products, $user, $inventoryService) {
                $items = collect($entry['items'])->map(function (array $item) use ($products) {
                    $product = $products[$item['product']];
                    $quantity = round((float) $item['quantity'], 3);
                    $unitCost = round((float) $item['unit_cost'], 2);

                    return [
                        'product' => $product,
                        'quantity' => $quantity,
                        'unit_cost' => $unitCost,
                        'total' => round($quantity * $unitCost, 2),
                    ];
                });

                $subtotal = round($items->sum('total'), 2);
                $freight = round((float) $entry['freight'], 2);
                $purchase = Purchase::query()->create([
                    'supplier_id' => $suppliers[$entry['supplier']]->id,
                    'user_id' => $user->id,
                    'code' => $entry['code'],
                    'status' => $entry['status'],
                    'expected_at' => $entry['expected_at'],
                    'received_at' => $entry['received_at'],
                    'subtotal' => $subtotal,
                    'freight' => $freight,
                    'total' => round($subtotal + $freight, 2),
                    'notes' => $this->encodePurchaseNotes([
                        'notes' => $entry['notes'],
                        'invoice_number' => $entry['invoice_number'],
                        'billing_barcode' => $entry['billing_barcode'],
                        'billing_amount' => round($subtotal + $freight, 2),
                        'billing_due_date' => $entry['billing_due_date'],
                    ]),
                ]);

                $purchase->forceFill([
                    'created_at' => $entry['created_at'],
                    'updated_at' => $entry['updated_at'],
                ])->saveQuietly();

                foreach ($items as $item) {
                    $purchaseItem = $purchase->items()->create([
                        'product_id' => $item['product']->id,
                        'product_name' => $item['product']->name,
                        'quantity' => $item['quantity'],
                        'unit_cost' => $item['unit_cost'],
                        'total' => $item['total'],
                    ]);

                    $purchaseItem->forceFill([
                        'created_at' => $entry['created_at'],
                        'updated_at' => $entry['updated_at'],
                    ])->saveQuietly();
                }

                if ($entry['status'] === 'received' && $purchase->stock_applied_at === null) {
                    foreach ($items as $item) {
                        $inventoryService->apply(
                            Product::query()->findOrFail($item['product']->id),
                            $item['quantity'],
                            'purchase',
                            [
                                'user_id' => $user->id,
                                'reference' => $purchase,
                                'unit_cost' => $item['unit_cost'],
                                'notes' => "Recebimento da compra {$purchase->code}",
                                'occurred_at' => $entry['received_at'],
                            ],
                        );
                    }

                    $purchase->forceFill([
                        'stock_applied_at' => $entry['received_at'] ?? $entry['updated_at'],
                        'updated_at' => $entry['updated_at'],
                    ])->saveQuietly();
                }
            });
        }
    }

    protected function ensureDeliveries(array $customers): void
    {
        $base = now()->startOfDay();

        foreach ($this->deliveryEntries($base) as $entry) {
            if (DeliveryOrder::query()->where('reference', $entry['reference'])->exists()) {
                continue;
            }

            $delivery = DeliveryOrder::query()->create([
                'customer_id' => $customers[$entry['customer']]->id,
                'reference' => $entry['reference'],
                'status' => $entry['status'],
                'channel' => $entry['channel'],
                'recipient_name' => $entry['recipient_name'],
                'phone' => $entry['phone'],
                'courier_name' => $entry['courier_name'],
                'address' => $entry['address'],
                'neighborhood' => $entry['neighborhood'],
                'delivery_fee' => $entry['delivery_fee'],
                'order_total' => $entry['order_total'],
                'scheduled_for' => $entry['scheduled_for'],
                'dispatched_at' => $entry['dispatched_at'],
                'delivered_at' => $entry['delivered_at'],
                'notes' => $entry['notes'],
            ]);

            $delivery->forceFill([
                'created_at' => $entry['created_at'],
                'updated_at' => $entry['updated_at'],
            ])->saveQuietly();
        }
    }

    protected function ensureOrderDrafts(array $products, array $customers, array $users): void
    {
        $base = now()->startOfDay();
        $orderDraftService = app(OrderDraftService::class);

        foreach ($this->orderDraftEntries($base) as $entry) {
            $existing = OrderDraft::query()
                ->with('items')
                ->where('reference', $entry['reference'])
                ->first();

            if ($existing) {
                continue;
            }

            $draft = $orderDraftService->create($users[$entry['user']]->id, [
                'type' => $entry['type'],
                'channel' => $entry['channel'],
                'reference' => $entry['reference'],
                'customer_id' => $customers[$entry['customer']]->id,
                'notes' => $entry['notes'],
            ]);

            $draft = $orderDraftService->save($draft, [
                'type' => $entry['type'],
                'channel' => $entry['channel'],
                'reference' => $entry['reference'],
                'customer_id' => $customers[$entry['customer']]->id,
                'notes' => $entry['notes'],
                'items' => collect($entry['items'])->map(function (array $item) use ($products) {
                    return [
                        'id' => $products[$item['product']]->id,
                        'qty' => $item['qty'],
                    ];
                })->all(),
            ]);

            if ($entry['status'] === OrderDraft::STATUS_SENT_TO_CASHIER) {
                $draft = $orderDraftService->sendToCashier($draft);
                $draft->forceFill([
                    'sent_to_cashier_at' => $entry['sent_to_cashier_at'],
                ])->saveQuietly();
            }

            $draft->forceFill([
                'created_at' => $entry['created_at'],
                'updated_at' => $entry['updated_at'],
            ])->saveQuietly();

            foreach ($draft->items as $item) {
                $item->forceFill([
                    'created_at' => $entry['created_at'],
                    'updated_at' => $entry['updated_at'],
                ])->saveQuietly();
            }
        }
    }

    protected function ensureSales(array $customers, array $users): void
    {
        $base = now()->startOfDay();
        $posService = app(PosService::class);
        $cashRegisters = [
            'operator' => CashRegister::query()
                ->where('user_id', $users['operator']->id)
                ->where('status', 'open')
                ->where('opening_notes', 'Amostra seed caixa operador')
                ->latest('opened_at')
                ->firstOrFail(),
            'attendant' => CashRegister::query()
                ->where('user_id', $users['attendant']->id)
                ->where('status', 'open')
                ->where('opening_notes', 'Amostra seed caixa atendimento')
                ->latest('opened_at')
                ->firstOrFail(),
        ];

        foreach ($this->saleEntries($base) as $entry) {
            $noteKey = sprintf('[seed-demo:%s]', $entry['key']);

            if (Sale::query()->where('notes', 'like', "%{$noteKey}%")->exists()) {
                continue;
            }

            $user = $users[$entry['user']];
            $customerId = $entry['customer'] ? $customers[$entry['customer']]->id : null;

            Carbon::setTestNow($entry['sold_at']);

            try {
                $posService->finalize([
                    'cash_register_id' => $cashRegisters[$entry['user']]->id,
                    'customer_id' => $customerId,
                    'discount' => 0,
                    'notes' => $entry['notes'].' '.$noteKey,
                    'items' => collect($entry['items'])->map(fn (array $item) => [
                        'id' => Product::query()->where('code', $item['product_code'])->value('id'),
                        'qty' => $item['qty'],
                        'discount' => 0,
                    ])->all(),
                    'payments' => $entry['payments'],
                ], $user->id);
            } finally {
                Carbon::setTestNow();
            }
        }
    }

    protected function outputSummary(): void
    {
        if (! $this->command) {
            return;
        }

        $this->command->info('Dados de amostra aplicados no tenant.');
        $this->command->line('Categorias: '.Category::query()->where('name', 'like', 'Amostra %')->count());
        $this->command->line('Fornecedores: '.Supplier::query()->where('name', 'like', 'Amostra %')->count());
        $this->command->line('Clientes: '.Customer::query()->where('name', 'like', 'Cliente Amostra %')->count());
        $this->command->line('Produtos: '.Product::query()->where('code', 'like', 'AMST-PRD-%')->count());
        $this->command->line('Compras: '.Purchase::query()->where('code', 'like', 'AMST-CMP-%')->count());
        $this->command->line('Entregas: '.DeliveryOrder::query()->where('reference', 'like', 'AMST-ENT-%')->count());
        $this->command->line('Comandas: '.OrderDraft::query()->where('reference', 'like', 'AMST-CMD-%')->count());
        $this->command->line('Movimentos de caixa: '.CashMovement::query()->where('reason', 'like', 'AMST-MOV-%')->count());
        $this->command->line('Vendas: '.Sale::query()->where('notes', 'like', '%[seed-demo:%]%')->count());
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->columnCache[$cacheKey]
            ??= Schema::connection((new Category)->getConnectionName())->hasColumn($table, $column);
    }

    protected function encodePurchaseNotes(array $metadata): ?string
    {
        $payload = array_filter($metadata, fn (mixed $value) => $value !== null && $value !== '');

        if ($payload === []) {
            return null;
        }

        return (string) json_encode([
            'schema' => 'ops_purchase_v1',
            'meta' => $payload,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    protected function categoryEntries(): array
    {
        return [
            ['key' => 'mercearia', 'name' => 'Amostra Mercearia', 'description' => 'Itens secos e mercearia de giro rapido.', 'active' => true],
            ['key' => 'bebidas', 'name' => 'Amostra Bebidas', 'description' => 'Refrigerantes, sucos e bebidas prontas.', 'active' => true],
            ['key' => 'hortifruti', 'name' => 'Amostra Hortifruti', 'description' => 'Itens frescos para teste de reposicao.', 'active' => true],
            ['key' => 'padaria', 'name' => 'Amostra Padaria', 'description' => 'Linha de paes e conveniencia.', 'active' => true],
            ['key' => 'laticinios', 'name' => 'Amostra Laticinios', 'description' => 'Queijos e refrigerados de apoio.', 'active' => true],
            ['key' => 'congelados', 'name' => 'Amostra Congelados', 'description' => 'Pratos rapidos para venda direta.', 'active' => true],
            ['key' => 'limpeza', 'name' => 'Amostra Limpeza', 'description' => 'Produtos de uso domestico.', 'active' => true],
            ['key' => 'higiene', 'name' => 'Amostra Higiene', 'description' => 'Linha de higiene e cuidado pessoal.', 'active' => true],
            ['key' => 'pet', 'name' => 'Amostra Pet Shop', 'description' => 'Amostra de itens para animais.', 'active' => true],
            ['key' => 'utilidades', 'name' => 'Amostra Utilidades', 'description' => 'Embalagens e utilidades para o caixa.', 'active' => true],
        ];
    }

    protected function supplierEntries(): array
    {
        return [
            ['key' => 'distribuidora_norte', 'name' => 'Amostra Distribuidora Norte', 'trade_name' => 'Dist Norte', 'document' => '11222333000101', 'state_registration' => '110223344', 'phone' => '11991000001', 'email' => 'norte@amostra.test', 'city_name' => 'Sao Paulo', 'state' => 'SP', 'active' => true],
            ['key' => 'casa_cafe', 'name' => 'Amostra Casa do Cafe', 'trade_name' => 'Casa Cafe', 'document' => '11222333000102', 'state_registration' => '110223345', 'phone' => '11991000002', 'email' => 'cafe@amostra.test', 'city_name' => 'Sao Paulo', 'state' => 'SP', 'active' => true],
            ['key' => 'laticinios_serra', 'name' => 'Amostra Laticinios Serra', 'trade_name' => 'Serra Leite', 'document' => '11222333000103', 'state_registration' => '110223346', 'phone' => '11991000003', 'email' => 'serra@amostra.test', 'city_name' => 'Atibaia', 'state' => 'SP', 'active' => true],
            ['key' => 'atacado_vale', 'name' => 'Amostra Atacado Vale', 'trade_name' => 'Vale Atacado', 'document' => '11222333000104', 'state_registration' => '110223347', 'phone' => '11991000004', 'email' => 'vale@amostra.test', 'city_name' => 'Guarulhos', 'state' => 'SP', 'active' => true],
            ['key' => 'bebidas_central', 'name' => 'Amostra Bebidas Central', 'trade_name' => 'Central Drinks', 'document' => '11222333000105', 'state_registration' => '110223348', 'phone' => '11991000005', 'email' => 'bebidas@amostra.test', 'city_name' => 'Sao Paulo', 'state' => 'SP', 'active' => true],
            ['key' => 'higiene_max', 'name' => 'Amostra Higiene Max', 'trade_name' => 'Higiene Max', 'document' => '11222333000106', 'state_registration' => '110223349', 'phone' => '11991000006', 'email' => 'higiene@amostra.test', 'city_name' => 'Osasco', 'state' => 'SP', 'active' => true],
            ['key' => 'limpeza_forte', 'name' => 'Amostra Limpeza Forte', 'trade_name' => 'Limpeza Forte', 'document' => '11222333000107', 'state_registration' => '110223350', 'phone' => '11991000007', 'email' => 'limpeza@amostra.test', 'city_name' => 'Barueri', 'state' => 'SP', 'active' => true],
            ['key' => 'hortifruti_campo', 'name' => 'Amostra Hortifruti Campo', 'trade_name' => 'Campo Verde', 'document' => '11222333000108', 'state_registration' => '110223351', 'phone' => '11991000008', 'email' => 'campo@amostra.test', 'city_name' => 'Mogi', 'state' => 'SP', 'active' => true],
            ['key' => 'pet_center', 'name' => 'Amostra Pet Center', 'trade_name' => 'Pet Center', 'document' => '11222333000109', 'state_registration' => '110223352', 'phone' => '11991000009', 'email' => 'pet@amostra.test', 'city_name' => 'Campinas', 'state' => 'SP', 'active' => true],
            ['key' => 'embalagens_sul', 'name' => 'Amostra Embalagens Sul', 'trade_name' => 'Emb Sul', 'document' => '11222333000110', 'state_registration' => '110223353', 'phone' => '11991000010', 'email' => 'embalagens@amostra.test', 'city_name' => 'Santos', 'state' => 'SP', 'active' => true],
        ];
    }

    protected function customerEntries(): array
    {
        return [
            ['key' => 'ana', 'name' => 'Cliente Amostra Ana Lima', 'document' => '12345678901', 'phone' => '11992000001', 'email' => 'ana@cliente.test', 'street' => 'Rua das Flores', 'number' => '101', 'complement' => 'Casa', 'district' => 'Centro', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '01001000', 'credit_limit' => 400, 'active' => true],
            ['key' => 'bruno', 'name' => 'Cliente Amostra Bruno Reis', 'document' => '12345678902', 'phone' => '11992000002', 'email' => 'bruno@cliente.test', 'street' => 'Rua do Comercio', 'number' => '88', 'complement' => 'Sala 2', 'district' => 'Mooca', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '03104000', 'credit_limit' => 0, 'active' => true],
            ['key' => 'carla', 'name' => 'Cliente Amostra Carla Dias', 'document' => '12345678903', 'phone' => '11992000003', 'email' => 'carla@cliente.test', 'street' => 'Av Paulista', 'number' => '1500', 'complement' => 'Apto 33', 'district' => 'Bela Vista', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '01310200', 'credit_limit' => 70, 'active' => true],
            ['key' => 'diego', 'name' => 'Cliente Amostra Diego Prado', 'document' => '12345678904', 'phone' => '11992000004', 'email' => 'diego@cliente.test', 'street' => 'Rua da Serra', 'number' => '540', 'complement' => null, 'district' => 'Vila Mariana', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '04101000', 'credit_limit' => 350, 'active' => true],
            ['key' => 'erica', 'name' => 'Cliente Amostra Erica Mota', 'document' => '12345678905', 'phone' => '11992000005', 'email' => 'erica@cliente.test', 'street' => 'Rua do Porto', 'number' => '16', 'complement' => 'Fundos', 'district' => 'Ipiranga', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '04263000', 'credit_limit' => 700, 'active' => true],
            ['key' => 'fabio', 'name' => 'Cliente Amostra Fabio Rocha', 'document' => '12345678906', 'phone' => '11992000006', 'email' => 'fabio@cliente.test', 'street' => 'Rua dos Pinhais', 'number' => '221', 'complement' => null, 'district' => 'Tatuape', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '03310000', 'credit_limit' => 420, 'active' => true],
            ['key' => 'gabriela', 'name' => 'Cliente Amostra Gabriela Nunes', 'document' => '12345678907', 'phone' => '11992000007', 'email' => 'gabriela@cliente.test', 'street' => 'Rua da Estacao', 'number' => '12', 'complement' => 'Bloco B', 'district' => 'Lapa', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '05074000', 'credit_limit' => 550, 'active' => true],
            ['key' => 'henrique', 'name' => 'Cliente Amostra Henrique Costa', 'document' => '12345678908', 'phone' => '11992000008', 'email' => 'henrique@cliente.test', 'street' => 'Rua das Palmeiras', 'number' => '76', 'complement' => null, 'district' => 'Santana', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '02019000', 'credit_limit' => 800, 'active' => true],
            ['key' => 'isabela', 'name' => 'Cliente Amostra Isabela Teixeira', 'document' => '12345678909', 'phone' => '11992000009', 'email' => 'isabela@cliente.test', 'street' => 'Rua da Praca', 'number' => '300', 'complement' => null, 'district' => 'Vila Matilde', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '03513000', 'credit_limit' => 90, 'active' => true],
            ['key' => 'joao', 'name' => 'Cliente Amostra Joao Teles', 'document' => '12345678910', 'phone' => '11992000010', 'email' => 'joao@cliente.test', 'street' => 'Rua do Mercado', 'number' => '45', 'complement' => 'Loja 4', 'district' => 'Penha', 'city_name' => 'Sao Paulo', 'city_code' => '3550308', 'state' => 'SP', 'zip_code' => '03631000', 'credit_limit' => 300, 'active' => true],
        ];
    }

    protected function productEntries(): array
    {
        return [
            ['key' => 'cafe', 'code' => 'AMST-PRD-001', 'barcode' => '7899000000001', 'name' => 'Cafe Torrado 500g', 'description' => 'Amostra de cafe para testes de venda e compra.', 'category' => 'mercearia', 'supplier' => 'casa_cafe', 'cost_price' => 9.40, 'sale_price' => 14.90, 'min_stock' => 5, 'ncm' => '09012100'],
            ['key' => 'cola', 'code' => 'AMST-PRD-002', 'barcode' => '7899000000002', 'name' => 'Refrigerante Cola 2L', 'description' => 'Linha de bebidas com giro alto.', 'category' => 'bebidas', 'supplier' => 'bebidas_central', 'cost_price' => 5.20, 'sale_price' => 8.99, 'min_stock' => 8, 'ncm' => '22021000'],
            ['key' => 'queijo', 'code' => 'AMST-PRD-003', 'barcode' => '7899000000003', 'name' => 'Queijo Minas 400g', 'description' => 'Produto refrigerado para testar margem.', 'category' => 'laticinios', 'supplier' => 'atacado_vale', 'cost_price' => 11.50, 'sale_price' => 18.90, 'min_stock' => 4, 'ncm' => '04061010'],
            ['key' => 'pao', 'code' => 'AMST-PRD-004', 'barcode' => '7899000000004', 'name' => 'Pao de Forma Integral', 'description' => 'Padaria de conveniencia para pdv.', 'category' => 'padaria', 'supplier' => 'atacado_vale', 'cost_price' => 4.10, 'sale_price' => 7.50, 'min_stock' => 6, 'ncm' => '19059090'],
            ['key' => 'tomate', 'code' => 'AMST-PRD-005', 'barcode' => '7899000000005', 'name' => 'Tomate Italiano 1kg', 'description' => 'Hortifruti para testar reposicao rapida.', 'category' => 'hortifruti', 'supplier' => 'hortifruti_campo', 'cost_price' => 4.80, 'sale_price' => 7.90, 'min_stock' => 10, 'ncm' => '07020000'],
            ['key' => 'lasanha', 'code' => 'AMST-PRD-006', 'barcode' => '7899000000006', 'name' => 'Lasanha Congelada 600g', 'description' => 'Congelado com ticket medio superior.', 'category' => 'congelados', 'supplier' => 'atacado_vale', 'cost_price' => 10.90, 'sale_price' => 16.90, 'min_stock' => 4, 'ncm' => '19022000'],
            ['key' => 'sabao', 'code' => 'AMST-PRD-007', 'barcode' => '7899000000007', 'name' => 'Sabao Liquido 1L', 'description' => 'Produto de limpeza para margem constante.', 'category' => 'limpeza', 'supplier' => 'limpeza_forte', 'cost_price' => 6.30, 'sale_price' => 10.90, 'min_stock' => 5, 'ncm' => '34022000'],
            ['key' => 'shampoo', 'code' => 'AMST-PRD-008', 'barcode' => '7899000000008', 'name' => 'Shampoo Neutro 350ml', 'description' => 'Higiene pessoal para sortimento de teste.', 'category' => 'higiene', 'supplier' => 'limpeza_forte', 'cost_price' => 8.10, 'sale_price' => 13.50, 'min_stock' => 5, 'ncm' => '33051000'],
            ['key' => 'racao', 'code' => 'AMST-PRD-009', 'barcode' => '7899000000009', 'name' => 'Racao Premium 1kg', 'description' => 'Produto pet para testes de a prazo.', 'category' => 'pet', 'supplier' => 'pet_center', 'cost_price' => 13.70, 'sale_price' => 21.90, 'min_stock' => 3, 'ncm' => '23091000'],
            ['key' => 'pote', 'code' => 'AMST-PRD-010', 'barcode' => '7899000000010', 'name' => 'Pote Hermetico 1.2L', 'description' => 'Utilidade domestica para testar mix.', 'category' => 'utilidades', 'supplier' => 'embalagens_sul', 'cost_price' => 7.80, 'sale_price' => 12.90, 'min_stock' => 2, 'ncm' => '39241000'],
        ];
    }

    protected function purchaseEntries(Carbon $base): array
    {
        return [
            ['code' => 'AMST-CMP-001', 'supplier' => 'casa_cafe', 'status' => 'received', 'created_at' => $base->copy()->subDays(14)->setTime(9, 10), 'updated_at' => $base->copy()->subDays(12)->setTime(14, 0), 'expected_at' => $base->copy()->subDays(12)->toDateString(), 'received_at' => $base->copy()->subDays(12)->setTime(14, 0), 'freight' => 9.90, 'invoice_number' => 'NF-AMST-001', 'billing_barcode' => '34191790010104351004791020150008291070026000', 'billing_due_date' => $base->copy()->subDays(4)->toDateString(), 'notes' => 'Reposicao de cafe para testes de estoque.', 'items' => [['product' => 'cafe', 'quantity' => 24, 'unit_cost' => 9.10]]],
            ['code' => 'AMST-CMP-002', 'supplier' => 'bebidas_central', 'status' => 'received', 'created_at' => $base->copy()->subDays(13)->setTime(10, 20), 'updated_at' => $base->copy()->subDays(11)->setTime(15, 30), 'expected_at' => $base->copy()->subDays(11)->toDateString(), 'received_at' => $base->copy()->subDays(11)->setTime(15, 30), 'freight' => 14.50, 'invoice_number' => 'NF-AMST-002', 'billing_barcode' => '34191790010104351004791020150008291070026001', 'billing_due_date' => $base->copy()->addDays(6)->toDateString(), 'notes' => 'Carga de bebidas para o caixa rapido.', 'items' => [['product' => 'cola', 'quantity' => 36, 'unit_cost' => 4.90]]],
            ['code' => 'AMST-CMP-003', 'supplier' => 'atacado_vale', 'status' => 'received', 'created_at' => $base->copy()->subDays(12)->setTime(8, 40), 'updated_at' => $base->copy()->subDays(9)->setTime(16, 10), 'expected_at' => $base->copy()->subDays(10)->toDateString(), 'received_at' => $base->copy()->subDays(9)->setTime(16, 10), 'freight' => 18.75, 'invoice_number' => 'NF-AMST-003', 'billing_barcode' => '34191790010104351004791020150008291070026002', 'billing_due_date' => $base->copy()->subDays(2)->toDateString(), 'notes' => 'Compra mista de refrigerados e congelados.', 'items' => [['product' => 'queijo', 'quantity' => 18, 'unit_cost' => 11.20], ['product' => 'pao', 'quantity' => 25, 'unit_cost' => 3.90], ['product' => 'lasanha', 'quantity' => 14, 'unit_cost' => 10.40]]],
            ['code' => 'AMST-CMP-004', 'supplier' => 'hortifruti_campo', 'status' => 'received', 'created_at' => $base->copy()->subDays(10)->setTime(7, 55), 'updated_at' => $base->copy()->subDays(8)->setTime(11, 45), 'expected_at' => $base->copy()->subDays(8)->toDateString(), 'received_at' => $base->copy()->subDays(8)->setTime(11, 45), 'freight' => 6.80, 'invoice_number' => 'NF-AMST-004', 'billing_barcode' => '34191790010104351004791020150008291070026003', 'billing_due_date' => $base->copy()->addDays(4)->toDateString(), 'notes' => 'Entrada rapida de hortifruti para reposicao.', 'items' => [['product' => 'tomate', 'quantity' => 32, 'unit_cost' => 4.20]]],
            ['code' => 'AMST-CMP-005', 'supplier' => 'limpeza_forte', 'status' => 'received', 'created_at' => $base->copy()->subDays(9)->setTime(9, 5), 'updated_at' => $base->copy()->subDays(7)->setTime(13, 40), 'expected_at' => $base->copy()->subDays(7)->toDateString(), 'received_at' => $base->copy()->subDays(7)->setTime(13, 40), 'freight' => 11.40, 'invoice_number' => 'NF-AMST-005', 'billing_barcode' => '34191790010104351004791020150008291070026004', 'billing_due_date' => $base->copy()->addDays(8)->toDateString(), 'notes' => 'Limpeza e higiene com custo medio controlado.', 'items' => [['product' => 'sabao', 'quantity' => 20, 'unit_cost' => 5.95], ['product' => 'shampoo', 'quantity' => 18, 'unit_cost' => 7.70]]],
            ['code' => 'AMST-CMP-006', 'supplier' => 'pet_center', 'status' => 'received', 'created_at' => $base->copy()->subDays(8)->setTime(10, 10), 'updated_at' => $base->copy()->subDays(6)->setTime(12, 0), 'expected_at' => $base->copy()->subDays(6)->toDateString(), 'received_at' => $base->copy()->subDays(6)->setTime(12, 0), 'freight' => 13.30, 'invoice_number' => 'NF-AMST-006', 'billing_barcode' => '34191790010104351004791020150008291070026005', 'billing_due_date' => $base->copy()->subDays(1)->toDateString(), 'notes' => 'Estoque de pet shop para vendas de teste.', 'items' => [['product' => 'racao', 'quantity' => 15, 'unit_cost' => 13.20]]],
            ['code' => 'AMST-CMP-007', 'supplier' => 'embalagens_sul', 'status' => 'received', 'created_at' => $base->copy()->subDays(7)->setTime(8, 15), 'updated_at' => $base->copy()->subDays(5)->setTime(10, 50), 'expected_at' => $base->copy()->subDays(5)->toDateString(), 'received_at' => $base->copy()->subDays(5)->setTime(10, 50), 'freight' => 8.20, 'invoice_number' => 'NF-AMST-007', 'billing_barcode' => '34191790010104351004791020150008291070026006', 'billing_due_date' => $base->copy()->addDays(10)->toDateString(), 'notes' => 'Embalagens e utilidades para sortimento.', 'items' => [['product' => 'pote', 'quantity' => 18, 'unit_cost' => 7.30]]],
            ['code' => 'AMST-CMP-008', 'supplier' => 'distribuidora_norte', 'status' => 'ordered', 'created_at' => $base->copy()->subDays(6)->setTime(15, 10), 'updated_at' => $base->copy()->subDays(3)->setTime(9, 0), 'expected_at' => $base->copy()->subDays(2)->toDateString(), 'received_at' => null, 'freight' => 16.90, 'invoice_number' => 'PED-AMST-008', 'billing_barcode' => '34191790010104351004791020150008291070026007', 'billing_due_date' => $base->copy()->addDays(2)->toDateString(), 'notes' => 'Pedido atrasado para testar previsao vencida.', 'items' => [['product' => 'cafe', 'quantity' => 12, 'unit_cost' => 9.25], ['product' => 'cola', 'quantity' => 18, 'unit_cost' => 5.00]]],
            ['code' => 'AMST-CMP-009', 'supplier' => 'laticinios_serra', 'status' => 'ordered', 'created_at' => $base->copy()->subDays(4)->setTime(16, 45), 'updated_at' => $base->copy()->subDays(1)->setTime(11, 20), 'expected_at' => $base->copy()->addDays(3)->toDateString(), 'received_at' => null, 'freight' => 12.60, 'invoice_number' => 'PED-AMST-009', 'billing_barcode' => '34191790010104351004791020150008291070026008', 'billing_due_date' => $base->copy()->addDays(9)->toDateString(), 'notes' => 'Pedido confirmado para reposicao futura.', 'items' => [['product' => 'queijo', 'quantity' => 10, 'unit_cost' => 11.40], ['product' => 'racao', 'quantity' => 8, 'unit_cost' => 13.50]]],
            ['code' => 'AMST-CMP-010', 'supplier' => 'higiene_max', 'status' => 'draft', 'created_at' => $base->copy()->subDays(2)->setTime(10, 5), 'updated_at' => $base->copy()->subDays(1)->setTime(17, 10), 'expected_at' => $base->copy()->addDays(5)->toDateString(), 'received_at' => null, 'freight' => 7.40, 'invoice_number' => 'RSC-AMST-010', 'billing_barcode' => '34191790010104351004791020150008291070026009', 'billing_due_date' => $base->copy()->addDays(12)->toDateString(), 'notes' => 'Rascunho de reposicao para ajustes finais.', 'items' => [['product' => 'shampoo', 'quantity' => 14, 'unit_cost' => 7.90]]],
        ];
    }

    protected function deliveryEntries(Carbon $base): array
    {
        return [
            ['reference' => 'AMST-ENT-001', 'customer' => 'ana', 'status' => 'pending', 'channel' => 'delivery', 'recipient_name' => 'Ana Lima', 'phone' => '11992000001', 'courier_name' => 'Moto Lucas', 'address' => 'Rua das Flores, 101', 'neighborhood' => 'Centro', 'delivery_fee' => 8.50, 'order_total' => 42.30, 'scheduled_for' => $base->copy()->addHours(11), 'dispatched_at' => null, 'delivered_at' => null, 'created_at' => $base->copy()->subDays(1)->setTime(18, 0), 'updated_at' => $base->copy()->subDays(1)->setTime(18, 0), 'notes' => 'Entrega programada para horario de almoco.'],
            ['reference' => 'AMST-ENT-002', 'customer' => 'bruno', 'status' => 'pending', 'channel' => 'delivery', 'recipient_name' => 'Bruno Reis', 'phone' => '11992000002', 'courier_name' => 'Moto Lucas', 'address' => 'Rua do Comercio, 88', 'neighborhood' => 'Mooca', 'delivery_fee' => 9.00, 'order_total' => 58.40, 'scheduled_for' => $base->copy()->addDay()->setTime(19, 30), 'dispatched_at' => null, 'delivered_at' => null, 'created_at' => $base->copy()->subDays(1)->setTime(19, 5), 'updated_at' => $base->copy()->subDays(1)->setTime(19, 5), 'notes' => 'Cliente pediu contato antes da saida.'],
            ['reference' => 'AMST-ENT-003', 'customer' => 'carla', 'status' => 'pending', 'channel' => 'retirada', 'recipient_name' => 'Carla Dias', 'phone' => '11992000003', 'courier_name' => null, 'address' => 'Retirada no balcao', 'neighborhood' => 'Bela Vista', 'delivery_fee' => 0, 'order_total' => 33.80, 'scheduled_for' => $base->copy()->addHours(15), 'dispatched_at' => null, 'delivered_at' => null, 'created_at' => $base->copy()->subHours(14), 'updated_at' => $base->copy()->subHours(14), 'notes' => 'Retirada rapida no fim da tarde.'],
            ['reference' => 'AMST-ENT-004', 'customer' => 'diego', 'status' => 'pending', 'channel' => 'delivery', 'recipient_name' => 'Diego Prado', 'phone' => '11992000004', 'courier_name' => 'Moto Sara', 'address' => 'Rua da Serra, 540', 'neighborhood' => 'Vila Mariana', 'delivery_fee' => 7.80, 'order_total' => 64.10, 'scheduled_for' => $base->copy()->addDays(2)->setTime(13, 45), 'dispatched_at' => null, 'delivered_at' => null, 'created_at' => $base->copy()->subHours(8), 'updated_at' => $base->copy()->subHours(8), 'notes' => 'Pedido com janela curta de entrega.'],
            ['reference' => 'AMST-ENT-005', 'customer' => 'erica', 'status' => 'dispatched', 'channel' => 'delivery', 'recipient_name' => 'Erica Mota', 'phone' => '11992000005', 'courier_name' => 'Moto Sara', 'address' => 'Rua do Porto, 16', 'neighborhood' => 'Ipiranga', 'delivery_fee' => 10.20, 'order_total' => 72.00, 'scheduled_for' => $base->copy()->subHours(2), 'dispatched_at' => $base->copy()->subHours(1), 'delivered_at' => null, 'created_at' => $base->copy()->subDays(1)->setTime(11, 40), 'updated_at' => $base->copy()->subHours(1), 'notes' => 'Saiu para entrega e aguarda confirmacao.'],
            ['reference' => 'AMST-ENT-006', 'customer' => 'fabio', 'status' => 'dispatched', 'channel' => 'delivery', 'recipient_name' => 'Fabio Rocha', 'phone' => '11992000006', 'courier_name' => 'Moto Pedro', 'address' => 'Rua dos Pinhais, 221', 'neighborhood' => 'Tatuape', 'delivery_fee' => 8.90, 'order_total' => 49.70, 'scheduled_for' => $base->copy()->subDay()->setTime(20, 0), 'dispatched_at' => $base->copy()->subDay()->setTime(20, 20), 'delivered_at' => null, 'created_at' => $base->copy()->subDay()->setTime(18, 50), 'updated_at' => $base->copy()->subDay()->setTime(20, 20), 'notes' => 'Pedido em rota desde o fim da noite.'],
            ['reference' => 'AMST-ENT-007', 'customer' => 'gabriela', 'status' => 'dispatched', 'channel' => 'retirada', 'recipient_name' => 'Gabriela Nunes', 'phone' => '11992000007', 'courier_name' => null, 'address' => 'Separado para retirada', 'neighborhood' => 'Lapa', 'delivery_fee' => 0, 'order_total' => 28.40, 'scheduled_for' => $base->copy()->setTime(17, 30), 'dispatched_at' => $base->copy()->setTime(17, 45), 'delivered_at' => null, 'created_at' => $base->copy()->subHours(6), 'updated_at' => $base->copy()->subHours(4), 'notes' => 'Separado no balcao e aguardando retirada.'],
            ['reference' => 'AMST-ENT-008', 'customer' => 'henrique', 'status' => 'delivered', 'channel' => 'delivery', 'recipient_name' => 'Henrique Costa', 'phone' => '11992000008', 'courier_name' => 'Moto Pedro', 'address' => 'Rua das Palmeiras, 76', 'neighborhood' => 'Santana', 'delivery_fee' => 11.50, 'order_total' => 82.90, 'scheduled_for' => $base->copy()->subDays(3)->setTime(12, 15), 'dispatched_at' => $base->copy()->subDays(3)->setTime(12, 25), 'delivered_at' => $base->copy()->subDays(3)->setTime(13, 5), 'created_at' => $base->copy()->subDays(3)->setTime(10, 50), 'updated_at' => $base->copy()->subDays(3)->setTime(13, 5), 'notes' => 'Entrega concluida sem ocorrencias.'],
            ['reference' => 'AMST-ENT-009', 'customer' => 'isabela', 'status' => 'delivered', 'channel' => 'delivery', 'recipient_name' => 'Isabela Teixeira', 'phone' => '11992000009', 'courier_name' => 'Moto Lucas', 'address' => 'Rua da Praca, 300', 'neighborhood' => 'Vila Matilde', 'delivery_fee' => 7.20, 'order_total' => 39.50, 'scheduled_for' => $base->copy()->subDays(2)->setTime(19, 10), 'dispatched_at' => $base->copy()->subDays(2)->setTime(19, 30), 'delivered_at' => $base->copy()->subDays(2)->setTime(20, 5), 'created_at' => $base->copy()->subDays(2)->setTime(18, 0), 'updated_at' => $base->copy()->subDays(2)->setTime(20, 5), 'notes' => 'Cliente confirmou entrega no portao.'],
            ['reference' => 'AMST-ENT-010', 'customer' => 'joao', 'status' => 'delivered', 'channel' => 'retirada', 'recipient_name' => 'Joao Teles', 'phone' => '11992000010', 'courier_name' => null, 'address' => 'Retirada finalizada no caixa', 'neighborhood' => 'Penha', 'delivery_fee' => 0, 'order_total' => 21.30, 'scheduled_for' => $base->copy()->subDay()->setTime(16, 20), 'dispatched_at' => $base->copy()->subDay()->setTime(16, 35), 'delivered_at' => $base->copy()->subDay()->setTime(16, 50), 'created_at' => $base->copy()->subDay()->setTime(15, 10), 'updated_at' => $base->copy()->subDay()->setTime(16, 50), 'notes' => 'Retirada concluida pelo proprio cliente.'],
        ];
    }

    protected function cashMovementEntries(Carbon $base): array
    {
        return [
            ['user' => 'operator', 'type' => 'supply', 'amount' => 60.00, 'reason' => 'AMST-MOV-001 - reforco de troco', 'created_at' => $base->copy()->subDays(9)->setTime(8, 35)],
            ['user' => 'operator', 'type' => 'withdrawal', 'amount' => 45.00, 'reason' => 'AMST-MOV-002 - sangria meio periodo', 'created_at' => $base->copy()->subDays(9)->setTime(13, 10)],
            ['user' => 'attendant', 'type' => 'supply', 'amount' => 80.00, 'reason' => 'AMST-MOV-003 - troco inicial delivery', 'created_at' => $base->copy()->subDays(8)->setTime(9, 5)],
            ['user' => 'attendant', 'type' => 'withdrawal', 'amount' => 55.00, 'reason' => 'AMST-MOV-004 - retirada cartorio', 'created_at' => $base->copy()->subDays(8)->setTime(16, 20)],
            ['user' => 'operator', 'type' => 'supply', 'amount' => 40.00, 'reason' => 'AMST-MOV-005 - ajuste de troco', 'created_at' => $base->copy()->subDays(6)->setTime(10, 15)],
            ['user' => 'operator', 'type' => 'withdrawal', 'amount' => 38.00, 'reason' => 'AMST-MOV-006 - sangria pico de caixa', 'created_at' => $base->copy()->subDays(6)->setTime(18, 45)],
            ['user' => 'attendant', 'type' => 'supply', 'amount' => 35.00, 'reason' => 'AMST-MOV-007 - complemento gaveta', 'created_at' => $base->copy()->subDays(4)->setTime(11, 0)],
            ['user' => 'attendant', 'type' => 'withdrawal', 'amount' => 62.00, 'reason' => 'AMST-MOV-008 - deposito parcial', 'created_at' => $base->copy()->subDays(4)->setTime(17, 35)],
            ['user' => 'operator', 'type' => 'supply', 'amount' => 50.00, 'reason' => 'AMST-MOV-009 - troco final semana', 'created_at' => $base->copy()->subDays(2)->setTime(8, 55)],
            ['user' => 'operator', 'type' => 'withdrawal', 'amount' => 47.00, 'reason' => 'AMST-MOV-010 - sangria noturna', 'created_at' => $base->copy()->subDay()->setTime(20, 10)],
        ];
    }

    protected function orderDraftEntries(Carbon $base): array
    {
        return [
            ['reference' => 'AMST-CMD-001', 'type' => 'comanda', 'channel' => 'store', 'status' => OrderDraft::STATUS_DRAFT, 'user' => 'operator', 'customer' => 'ana', 'created_at' => $base->copy()->subDays(3)->setTime(9, 20), 'updated_at' => $base->copy()->subDays(3)->setTime(9, 35), 'sent_to_cashier_at' => null, 'notes' => 'Comanda aberta para cafe da manha.', 'items' => [['product' => 'cafe', 'qty' => 1], ['product' => 'pao', 'qty' => 2]]],
            ['reference' => 'AMST-CMD-002', 'type' => 'pedido', 'channel' => 'store', 'status' => OrderDraft::STATUS_DRAFT, 'user' => 'attendant', 'customer' => 'bruno', 'created_at' => $base->copy()->subDays(3)->setTime(10, 5), 'updated_at' => $base->copy()->subDays(3)->setTime(10, 22), 'sent_to_cashier_at' => null, 'notes' => 'Pedido aguardando confirmacao do cliente.', 'items' => [['product' => 'cola', 'qty' => 2], ['product' => 'queijo', 'qty' => 1]]],
            ['reference' => 'AMST-CMD-003', 'type' => 'mesa', 'channel' => 'store', 'status' => OrderDraft::STATUS_DRAFT, 'user' => 'operator', 'customer' => 'carla', 'created_at' => $base->copy()->subDays(2)->setTime(12, 0), 'updated_at' => $base->copy()->subDays(2)->setTime(12, 18), 'sent_to_cashier_at' => null, 'notes' => 'Mesa em atendimento parcial.', 'items' => [['product' => 'lasanha', 'qty' => 1], ['product' => 'cola', 'qty' => 1]]],
            ['reference' => 'AMST-CMD-004', 'type' => 'comanda', 'channel' => 'whatsapp', 'status' => OrderDraft::STATUS_DRAFT, 'user' => 'attendant', 'customer' => 'diego', 'created_at' => $base->copy()->subDays(2)->setTime(14, 40), 'updated_at' => $base->copy()->subDays(2)->setTime(14, 55), 'sent_to_cashier_at' => null, 'notes' => 'Pedido recebido por mensagem.', 'items' => [['product' => 'sabao', 'qty' => 1], ['product' => 'shampoo', 'qty' => 1]]],
            ['reference' => 'AMST-CMD-005', 'type' => 'pedido', 'channel' => 'site', 'status' => OrderDraft::STATUS_DRAFT, 'user' => 'operator', 'customer' => 'erica', 'created_at' => $base->copy()->subDay()->setTime(8, 50), 'updated_at' => $base->copy()->subDay()->setTime(9, 5), 'sent_to_cashier_at' => null, 'notes' => 'Checkout online aguardando envio ao caixa.', 'items' => [['product' => 'pote', 'qty' => 2]]],
            ['reference' => 'AMST-CMD-006', 'type' => 'comanda', 'channel' => 'store', 'status' => OrderDraft::STATUS_SENT_TO_CASHIER, 'user' => 'attendant', 'customer' => 'fabio', 'created_at' => $base->copy()->subDays(2)->setTime(16, 10), 'updated_at' => $base->copy()->subDays(2)->setTime(16, 35), 'sent_to_cashier_at' => $base->copy()->subDays(2)->setTime(16, 32), 'notes' => 'Comanda pronta para cobranca no caixa.', 'items' => [['product' => 'cafe', 'qty' => 2], ['product' => 'cola', 'qty' => 1]]],
            ['reference' => 'AMST-CMD-007', 'type' => 'mesa', 'channel' => 'store', 'status' => OrderDraft::STATUS_SENT_TO_CASHIER, 'user' => 'operator', 'customer' => 'gabriela', 'created_at' => $base->copy()->subDays(2)->setTime(19, 5), 'updated_at' => $base->copy()->subDays(2)->setTime(19, 40), 'sent_to_cashier_at' => $base->copy()->subDays(2)->setTime(19, 36), 'notes' => 'Mesa encerrada e enviada para pagamento.', 'items' => [['product' => 'queijo', 'qty' => 1], ['product' => 'pao', 'qty' => 1], ['product' => 'cola', 'qty' => 1]]],
            ['reference' => 'AMST-CMD-008', 'type' => 'pedido', 'channel' => 'whatsapp', 'status' => OrderDraft::STATUS_SENT_TO_CASHIER, 'user' => 'attendant', 'customer' => 'henrique', 'created_at' => $base->copy()->subDay()->setTime(11, 20), 'updated_at' => $base->copy()->subDay()->setTime(11, 55), 'sent_to_cashier_at' => $base->copy()->subDay()->setTime(11, 50), 'notes' => 'Pedido confirmado e encaminhado ao caixa.', 'items' => [['product' => 'racao', 'qty' => 1], ['product' => 'pote', 'qty' => 1]]],
            ['reference' => 'AMST-CMD-009', 'type' => 'comanda', 'channel' => 'site', 'status' => OrderDraft::STATUS_SENT_TO_CASHIER, 'user' => 'operator', 'customer' => 'isabela', 'created_at' => $base->copy()->subDay()->setTime(13, 5), 'updated_at' => $base->copy()->subDay()->setTime(13, 40), 'sent_to_cashier_at' => $base->copy()->subDay()->setTime(13, 35), 'notes' => 'Pedido do site aguardando cobranca.', 'items' => [['product' => 'tomate', 'qty' => 2], ['product' => 'cola', 'qty' => 2]]],
            ['reference' => 'AMST-CMD-010', 'type' => 'mesa', 'channel' => 'store', 'status' => OrderDraft::STATUS_SENT_TO_CASHIER, 'user' => 'attendant', 'customer' => 'joao', 'created_at' => $base->copy()->setTime(15, 0), 'updated_at' => $base->copy()->setTime(15, 28), 'sent_to_cashier_at' => $base->copy()->setTime(15, 24), 'notes' => 'Fechamento rapido de atendimento presencial.', 'items' => [['product' => 'cafe', 'qty' => 1], ['product' => 'pao', 'qty' => 1], ['product' => 'queijo', 'qty' => 1]]],
        ];
    }

    protected function saleEntries(Carbon $base): array
    {
        return [
            ['key' => 'sale-001', 'user' => 'operator', 'customer' => 'ana', 'sold_at' => $base->copy()->subDays(9)->setTime(9, 15), 'notes' => 'Venda de amostra no caixa principal.', 'payments' => [['method' => 'cash', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-001', 'qty' => 2], ['product_code' => 'AMST-PRD-004', 'qty' => 1]]],
            ['key' => 'sale-002', 'user' => 'attendant', 'customer' => 'bruno', 'sold_at' => $base->copy()->subDays(58)->setTime(10, 40), 'notes' => 'Venda de amostra a prazo sem limite configurado.', 'payments' => [['method' => 'credit', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-002', 'qty' => 3]]],
            ['key' => 'sale-003', 'user' => 'operator', 'customer' => 'carla', 'sold_at' => $base->copy()->subDays(36)->setTime(12, 20), 'notes' => 'Venda de amostra a prazo perto do limite.', 'payments' => [['method' => 'credit', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-003', 'qty' => 1], ['product_code' => 'AMST-PRD-006', 'qty' => 1], ['product_code' => 'AMST-PRD-010', 'qty' => 2]]],
            ['key' => 'sale-004', 'user' => 'attendant', 'customer' => 'erica', 'sold_at' => $base->copy()->subDays(22)->setTime(14, 5), 'notes' => 'Venda de amostra antiga em aberto na carteira.', 'payments' => [['method' => 'credit', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-001', 'qty' => 2], ['product_code' => 'AMST-PRD-004', 'qty' => 1]]],
            ['key' => 'sale-005', 'user' => 'operator', 'customer' => 'diego', 'sold_at' => $base->copy()->subDays(5)->setTime(15, 30), 'notes' => 'Venda de amostra com itens de limpeza.', 'payments' => [['method' => 'debit_card', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-007', 'qty' => 2], ['product_code' => 'AMST-PRD-008', 'qty' => 1]]],
            ['key' => 'sale-006', 'user' => 'attendant', 'customer' => 'henrique', 'sold_at' => $base->copy()->subDays(4)->setTime(16, 10), 'notes' => 'Venda de amostra com ticket rapido.', 'payments' => [['method' => 'credit_card', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-009', 'qty' => 1]]],
            ['key' => 'sale-007', 'user' => 'operator', 'customer' => null, 'sold_at' => $base->copy()->subDays(3)->setTime(11, 50), 'notes' => 'Venda de amostra sem identificacao do cliente.', 'payments' => [['method' => 'cash', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-010', 'qty' => 2], ['product_code' => 'AMST-PRD-001', 'qty' => 1]]],
            ['key' => 'sale-008', 'user' => 'attendant', 'customer' => 'fabio', 'sold_at' => $base->copy()->subDays(2)->setTime(18, 25), 'notes' => 'Venda de amostra com bebidas e hortifruti.', 'payments' => [['method' => 'pix', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-002', 'qty' => 2], ['product_code' => 'AMST-PRD-005', 'qty' => 3]]],
            ['key' => 'sale-009', 'user' => 'operator', 'customer' => 'gabriela', 'sold_at' => $base->copy()->subDay()->setTime(19, 10), 'notes' => 'Venda de amostra com pagamento misto.', 'payments' => [['method' => 'cash', 'amount' => 20.00], ['method' => 'pix', 'amount' => 28.70]], 'items' => [['product_code' => 'AMST-PRD-003', 'qty' => 1], ['product_code' => 'AMST-PRD-006', 'qty' => 1], ['product_code' => 'AMST-PRD-010', 'qty' => 1]]],
            ['key' => 'sale-010', 'user' => 'attendant', 'customer' => 'isabela', 'sold_at' => $base->copy()->setTime(20, 35), 'notes' => 'Venda de amostra no fechamento do dia.', 'payments' => [['method' => 'credit_card', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-001', 'qty' => 1], ['product_code' => 'AMST-PRD-009', 'qty' => 1]]],
            ['key' => 'sale-011', 'user' => 'attendant', 'customer' => 'bruno', 'sold_at' => $base->copy()->subDays(61)->setTime(17, 10), 'notes' => 'Lancamento antigo a prazo sem limite configurado.', 'payments' => [['method' => 'credit', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-002', 'qty' => 3], ['product_code' => 'AMST-PRD-004', 'qty' => 2]]],
            ['key' => 'sale-012', 'user' => 'operator', 'customer' => 'carla', 'sold_at' => $base->copy()->subDays(34)->setTime(13, 25), 'notes' => 'Lancamento a prazo perto do limite do cliente.', 'payments' => [['method' => 'credit', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-003', 'qty' => 1], ['product_code' => 'AMST-PRD-006', 'qty' => 1], ['product_code' => 'AMST-PRD-010', 'qty' => 2]]],
            ['key' => 'sale-013', 'user' => 'attendant', 'customer' => 'erica', 'sold_at' => $base->copy()->subDays(19)->setTime(15, 50), 'notes' => 'Venda antiga em aberto para testar carteira a prazo.', 'payments' => [['method' => 'credit', 'amount' => null]], 'items' => [['product_code' => 'AMST-PRD-001', 'qty' => 2], ['product_code' => 'AMST-PRD-004', 'qty' => 1]]],
        ];
    }
}
