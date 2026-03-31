<?php

namespace App\Services\Tenant;

use App\Models\Tenant\Customer;
use App\Models\Tenant\DeliveryOrder;
use App\Models\Tenant\KitchenTicket;
use App\Models\Tenant\LossRecord;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Producer;
use App\Models\Tenant\ProductionOrder;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Recipe;
use App\Models\Tenant\ServiceOrder;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\WeighingRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OperationsWorkspaceService
{
    protected array $productColumnCache = [];

    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
    ) {
    }

    public function workspaceModules(): array
    {
        return [
            'producao',
            'fichas-tecnicas',
            'cozinha',
            'perdas',
            'pesagem',
            'delivery',
            'compras',
            'ordens-servico',
            'produtores',
        ];
    }

    public function isWorkspaceModule(string $module): bool
    {
        return in_array($module, $this->workspaceModules(), true);
    }

    public function build(string $module): array
    {
        return match ($module) {
            'produtores' => [
                'moduleKey' => 'produtores',
                'moduleTitle' => 'Produtores',
                'moduleDescription' => 'Cadastro operacional de produtores rurais com contato, regiao e historico comercial.',
                'payload' => $this->producersPayload(),
            ],
            'fichas-tecnicas' => [
                'moduleKey' => 'fichas-tecnicas',
                'moduleTitle' => 'Receitas',
                'moduleDescription' => 'Receitas reais com rendimento, tempo de preparo e consumo de insumos.',
                'payload' => $this->recipesPayload(),
            ],
            'producao' => [
                'moduleKey' => 'producao',
                'moduleTitle' => 'Producao',
                'moduleDescription' => 'Planeje lotes, acompanhe o andamento e devolva o item pronto para o estoque.',
                'payload' => $this->productionPayload(),
            ],
            'cozinha' => [
                'moduleKey' => 'cozinha',
                'moduleTitle' => 'Cozinha',
                'moduleDescription' => 'Fila de preparo com prioridade, canal de origem e status de expedicao.',
                'payload' => $this->kitchenPayload(),
            ],
            'perdas' => [
                'moduleKey' => 'perdas',
                'moduleTitle' => 'Controle de perdas',
                'moduleDescription' => 'Registro de quebras, descartes e ajustes operacionais com reflexo no estoque.',
                'payload' => $this->lossesPayload(),
            ],
            'pesagem' => [
                'moduleKey' => 'pesagem',
                'moduleTitle' => 'Pesagem',
                'moduleDescription' => 'Controle de pesagens com liquido apurado, cliente opcional e total previsto.',
                'payload' => $this->weighingPayload(),
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
            'ordens-servico' => [
                'moduleKey' => 'ordens-servico',
                'moduleTitle' => 'Ordens de servico',
                'moduleDescription' => 'Atendimento tecnico com diagnostico, pecas, mao de obra e fechamento.',
                'payload' => $this->serviceOrdersPayload(),
            ],
            default => abort(404),
        };
    }

    public function store(string $module, array $input, int $userId): array
    {
        return match ($module) {
            'produtores' => ['message' => 'Produtor cadastrado com sucesso.', 'record' => $this->serializeProducer($this->saveProducer(null, $input))],
            'fichas-tecnicas' => ['message' => 'Ficha tecnica cadastrada com sucesso.', 'record' => $this->serializeRecipe($this->saveRecipe(null, $input))],
            'producao' => ['message' => 'Ordem de producao cadastrada com sucesso.', 'record' => $this->serializeProductionOrder($this->saveProductionOrder(null, $input, $userId))],
            'cozinha' => ['message' => 'Ticket da cozinha cadastrado com sucesso.', 'record' => $this->serializeKitchenTicket($this->saveKitchenTicket(null, $input, $userId))],
            'perdas' => ['message' => 'Registro de perda salvo com sucesso.', 'record' => $this->serializeLossRecord($this->saveLossRecord(null, $input, $userId))],
            'pesagem' => ['message' => 'Pesagem salva com sucesso.', 'record' => $this->serializeWeighingRecord($this->saveWeighingRecord(null, $input))],
            'delivery' => ['message' => 'Entrega salva com sucesso.', 'record' => $this->serializeDeliveryOrder($this->saveDeliveryOrder(null, $input))],
            'compras' => ['message' => 'Compra salva com sucesso.', 'record' => $this->serializePurchase($this->savePurchase(null, $input, $userId))],
            'ordens-servico' => ['message' => 'Ordem de servico salva com sucesso.', 'record' => $this->serializeServiceOrder($this->saveServiceOrder(null, $input, $userId))],
            default => abort(404),
        };
    }

    public function records(string $module): array
    {
        return [
            'records' => match ($module) {
                'cozinha' => KitchenTicket::query()
                    ->with(['items.product:id,name,code,unit'])
                    ->latest()
                    ->get()
                    ->map(fn (KitchenTicket $ticket) => $this->serializeKitchenTicket($ticket))
                    ->values()
                    ->all(),
                default => data_get($this->build($module), 'payload.records', []),
            },
        ];
    }

    public function update(string $module, int $recordId, array $input, int $userId): array
    {
        return match ($module) {
            'produtores' => ['message' => 'Produtor atualizado com sucesso.', 'record' => $this->serializeProducer($this->saveProducer($this->findRecord(Producer::class, $recordId), $input))],
            'fichas-tecnicas' => ['message' => 'Ficha tecnica atualizada com sucesso.', 'record' => $this->serializeRecipe($this->saveRecipe($this->findRecord(Recipe::class, $recordId), $input))],
            'producao' => ['message' => 'Ordem de producao atualizada com sucesso.', 'record' => $this->serializeProductionOrder($this->saveProductionOrder($this->findRecord(ProductionOrder::class, $recordId), $input, $userId))],
            'cozinha' => ['message' => 'Ticket da cozinha atualizado com sucesso.', 'record' => $this->serializeKitchenTicket($this->saveKitchenTicket($this->findRecord(KitchenTicket::class, $recordId), $input, $userId))],
            'perdas' => ['message' => 'Registro de perda atualizado com sucesso.', 'record' => $this->serializeLossRecord($this->saveLossRecord($this->findRecord(LossRecord::class, $recordId), $input, $userId))],
            'pesagem' => ['message' => 'Pesagem atualizada com sucesso.', 'record' => $this->serializeWeighingRecord($this->saveWeighingRecord($this->findRecord(WeighingRecord::class, $recordId), $input))],
            'delivery' => ['message' => 'Entrega atualizada com sucesso.', 'record' => $this->serializeDeliveryOrder($this->saveDeliveryOrder($this->findRecord(DeliveryOrder::class, $recordId), $input))],
            'compras' => ['message' => 'Compra atualizada com sucesso.', 'record' => $this->serializePurchase($this->savePurchase($this->findRecord(Purchase::class, $recordId), $input, $userId))],
            'ordens-servico' => ['message' => 'Ordem de servico atualizada com sucesso.', 'record' => $this->serializeServiceOrder($this->saveServiceOrder($this->findRecord(ServiceOrder::class, $recordId), $input, $userId))],
            default => abort(404),
        };
    }

    public function destroy(string $module, int $recordId): string
    {
        return match ($module) {
            'produtores' => tap($this->findRecord(Producer::class, $recordId))->delete() ? 'Produtor removido com sucesso.' : 'Produtor removido com sucesso.',
            'fichas-tecnicas' => tap($this->findRecord(Recipe::class, $recordId))->delete() ? 'Ficha tecnica removida com sucesso.' : 'Ficha tecnica removida com sucesso.',
            'producao' => $this->deleteStockSensitiveRecord($this->findRecord(ProductionOrder::class, $recordId), 'Ordem de producao removida com sucesso.'),
            'cozinha' => tap($this->findRecord(KitchenTicket::class, $recordId))->delete() ? 'Ticket removido com sucesso.' : 'Ticket removido com sucesso.',
            'perdas' => $this->deleteStockSensitiveRecord($this->findRecord(LossRecord::class, $recordId), 'Registro de perda removido com sucesso.'),
            'pesagem' => tap($this->findRecord(WeighingRecord::class, $recordId))->delete() ? 'Pesagem removida com sucesso.' : 'Pesagem removida com sucesso.',
            'delivery' => tap($this->findRecord(DeliveryOrder::class, $recordId))->delete() ? 'Entrega removida com sucesso.' : 'Entrega removida com sucesso.',
            'compras' => $this->deleteStockSensitiveRecord($this->findRecord(Purchase::class, $recordId), 'Compra removida com sucesso.'),
            'ordens-servico' => tap($this->findRecord(ServiceOrder::class, $recordId))->delete() ? 'Ordem de servico removida com sucesso.' : 'Ordem de servico removida com sucesso.',
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

    protected function producersPayload(): array
    {
        return [
            'records' => Producer::query()
                ->orderBy('name')
                ->get()
                ->map(fn (Producer $producer) => $this->serializeProducer($producer))
                ->values()
                ->all(),
        ];
    }

    protected function recipesPayload(): array
    {
        return [
            'records' => Recipe::query()
                ->with(['product:id,name,code,unit', 'items.product:id,name,code'])
                ->orderBy('name')
                ->get()
                ->map(fn (Recipe $recipe) => $this->serializeRecipe($recipe))
                ->values()
                ->all(),
            'products' => $this->productOptions(),
        ];
    }

    protected function productionPayload(): array
    {
        return [
            'records' => ProductionOrder::query()
                ->with(['recipe:id,name,product_id,yield_quantity,yield_unit', 'product:id,name,code,unit', 'user:id,name'])
                ->latest()
                ->get()
                ->map(fn (ProductionOrder $order) => $this->serializeProductionOrder($order))
                ->values()
                ->all(),
            'products' => $this->productOptions(),
            'recipes' => Recipe::query()
                ->with('product:id,name,code,unit')
                ->where('active', true)
                ->orderBy('name')
                ->get()
                ->map(fn (Recipe $recipe) => [
                    'id' => $recipe->id,
                    'name' => $recipe->name,
                    'code' => $recipe->code,
                    'product_id' => $recipe->product_id,
                    'product_name' => $recipe->product?->name,
                    'yield_quantity' => (float) $recipe->yield_quantity,
                    'yield_unit' => $recipe->yield_unit,
                ])
                ->values()
                ->all(),
        ];
    }

    protected function kitchenPayload(): array
    {
        return [
            'records' => KitchenTicket::query()
                ->with(['items.product:id,name,code,unit'])
                ->latest()
                ->get()
                ->map(fn (KitchenTicket $ticket) => $this->serializeKitchenTicket($ticket))
                ->values()
                ->all(),
            'products' => $this->productOptions(),
        ];
    }

    protected function lossesPayload(): array
    {
        return [
            'records' => LossRecord::query()
                ->with(['product:id,name,code,unit', 'user:id,name'])
                ->latest()
                ->get()
                ->map(fn (LossRecord $record) => $this->serializeLossRecord($record))
                ->values()
                ->all(),
            'products' => $this->productOptions(),
        ];
    }

    protected function weighingPayload(): array
    {
        return [
            'records' => WeighingRecord::query()
                ->with(['product:id,name,code,unit,sale_price', 'customer:id,name'])
                ->latest()
                ->get()
                ->map(fn (WeighingRecord $record) => $this->serializeWeighingRecord($record))
                ->values()
                ->all(),
            'products' => $this->productOptions(),
            'customers' => $this->customerOptions(),
        ];
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
                ->with(['supplier:id,name', 'producer:id,name', 'items.product:id,name,code,unit'])
                ->latest()
                ->get()
                ->map(fn (Purchase $purchase) => $this->serializePurchase($purchase))
                ->values()
                ->all(),
            'suppliers' => $this->supplierOptions(),
            'producers' => $this->producerOptions(),
            'products' => $this->productOptions(),
        ];
    }

    protected function serviceOrdersPayload(): array
    {
        return [
            'records' => ServiceOrder::query()
                ->with(['customer:id,name,phone', 'items'])
                ->latest()
                ->get()
                ->map(fn (ServiceOrder $serviceOrder) => $this->serializeServiceOrder($serviceOrder))
                ->values()
                ->all(),
            'customers' => $this->customerOptions(),
        ];
    }

    protected function saveProducer(?Producer $producer, array $input): Producer
    {
        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'document' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:60'],
            'email' => ['nullable', 'email', 'max:255'],
            'region' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'active' => ['required', 'boolean'],
        ])->validate();

        $producer ??= new Producer();
        $producer->fill($validated)->save();

        return $producer->fresh();
    }

    protected function saveRecipe(?Recipe $recipe, array $input): Recipe
    {
        $validated = Validator::make($input, [
            'code' => ['nullable', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:255'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'yield_quantity' => ['required', 'numeric', 'gt:0'],
            'yield_unit' => ['required', 'string', 'max:20'],
            'prep_time_minutes' => ['nullable', 'integer', 'min:0'],
            'instructions' => ['nullable', 'string'],
            'active' => ['required', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['required', 'string', 'max:20'],
            'items.*.notes' => ['nullable', 'string'],
        ])->validate();

        return DB::transaction(function () use ($recipe, $validated) {
            $recipe ??= new Recipe();
            $recipe->fill([
                'code' => ($validated['code'] ?? null) ?: ($recipe->code ?? $this->nextCode(Recipe::class, 'FCT')),
                'name' => $validated['name'],
                'product_id' => $validated['product_id'] ?? null,
                'yield_quantity' => $validated['yield_quantity'],
                'yield_unit' => $validated['yield_unit'],
                'prep_time_minutes' => $validated['prep_time_minutes'] ?? null,
                'instructions' => $validated['instructions'] ?? null,
                'active' => $validated['active'],
            ])->save();

            $recipe->items()->delete();

            $products = Product::query()
                ->whereIn('id', collect($validated['items'])->pluck('product_id')->all())
                ->get()
                ->keyBy('id');

            foreach ($validated['items'] as $item) {
                $product = $products->get($item['product_id']);

                $recipe->items()->create([
                    'product_id' => $product?->id,
                    'ingredient_name' => $product?->name ?? 'Insumo',
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $recipe->fresh(['product:id,name,code,unit', 'items.product:id,name,code']);
        });
    }

    protected function saveProductionOrder(?ProductionOrder $order, array $input, int $userId): ProductionOrder
    {
        $validated = Validator::make($input, [
            'recipe_id' => ['nullable', 'integer', 'exists:recipes,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'status' => ['required', Rule::in(['planned', 'in_progress', 'completed'])],
            'planned_quantity' => ['required', 'numeric', 'gt:0'],
            'produced_quantity' => ['nullable', 'numeric', 'gte:0'],
            'unit' => ['required', 'string', 'max:20'],
            'scheduled_for' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ])->validate();

        return DB::transaction(function () use ($order, $validated, $userId) {
            $order ??= new ProductionOrder();
            $recipe = filled($validated['recipe_id'] ?? null) ? Recipe::query()->with('items.product', 'product')->findOrFail($validated['recipe_id']) : null;
            $productId = $validated['product_id'] ?? $recipe?->product_id;
            $producedQuantity = round((float) ($validated['produced_quantity'] ?? 0), 3);

            if ($validated['status'] === 'completed' && $producedQuantity <= 0) {
                $producedQuantity = round((float) $validated['planned_quantity'], 3);
            }

            $this->guardStockAppliedMutation($order, [
                'recipe_id' => $validated['recipe_id'] ?? null,
                'product_id' => $productId,
                'status' => $validated['status'],
                'planned_quantity' => round((float) $validated['planned_quantity'], 3),
                'produced_quantity' => $producedQuantity,
                'unit' => $validated['unit'],
            ]);

            $order->fill([
                'recipe_id' => $validated['recipe_id'] ?? null,
                'product_id' => $productId,
                'user_id' => $order->user_id ?: $userId,
                'code' => $order->code ?: $this->nextCode(ProductionOrder::class, 'PRD'),
                'status' => $validated['status'],
                'planned_quantity' => $validated['planned_quantity'],
                'produced_quantity' => $producedQuantity,
                'unit' => $validated['unit'],
                'scheduled_for' => $validated['scheduled_for'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'completed_at' => $validated['status'] === 'completed' ? ($order->completed_at ?: now()) : null,
            ])->save();

            if ($order->status === 'completed' && blank($order->stock_applied_at)) {
                $this->applyProductionStock($order->fresh(['recipe.items.product', 'recipe.product', 'product']), $userId);
            }

            return $order->fresh(['recipe:id,name,product_id,yield_quantity,yield_unit', 'product:id,name,code,unit', 'user:id,name']);
        });
    }

    protected function saveKitchenTicket(?KitchenTicket $ticket, array $input, int $userId): KitchenTicket
    {
        $validated = Validator::make($input, [
            'reference' => ['nullable', 'string', 'max:80'],
            'channel' => ['required', Rule::in(['balcao', 'mesa', 'delivery', 'retirada'])],
            'status' => ['required', Rule::in(['queued', 'in_preparation', 'ready', 'completed'])],
            'priority' => ['required', Rule::in(['normal', 'urgent'])],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'requested_at' => ['nullable', 'date'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.item_name' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit' => ['required', 'string', 'max:20'],
            'items.*.notes' => ['nullable', 'string'],
        ])->validate();

        return DB::transaction(function () use ($ticket, $validated, $userId) {
            $ticket ??= new KitchenTicket();

            [$startedAt, $readyAt, $completedAt] = match ($validated['status']) {
                'queued' => [null, null, null],
                'in_preparation' => [$ticket->started_at ?: now(), null, null],
                'ready' => [$ticket->started_at ?: now(), $ticket->ready_at ?: now(), null],
                'completed' => [$ticket->started_at ?: now(), $ticket->ready_at ?: now(), $ticket->completed_at ?: now()],
            };

            $ticket->fill([
                'user_id' => $ticket->user_id ?: $userId,
                'reference' => $validated['reference'] ?? null,
                'channel' => $validated['channel'],
                'status' => $validated['status'],
                'priority' => $validated['priority'],
                'customer_name' => $validated['customer_name'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'requested_at' => $validated['requested_at'] ?? ($ticket->requested_at ?: now()),
                'started_at' => $startedAt,
                'ready_at' => $readyAt,
                'completed_at' => $completedAt,
            ])->save();

            $ticket->items()->delete();

            foreach ($validated['items'] as $item) {
                $ticket->items()->create([
                    'product_id' => $item['product_id'] ?? null,
                    'item_name' => $item['item_name'],
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }

            return $ticket->fresh(['items.product:id,name,code,unit']);
        });
    }

    protected function saveLossRecord(?LossRecord $record, array $input, int $userId): LossRecord
    {
        $validated = Validator::make($input, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'reason' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(['draft', 'confirmed'])],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'notes' => ['nullable', 'string'],
            'occurred_at' => ['nullable', 'date'],
        ])->validate();

        return DB::transaction(function () use ($record, $validated, $userId) {
            $record ??= new LossRecord();
            $product = Product::query()->lockForUpdate()->findOrFail($validated['product_id']);
            $quantity = round((float) $validated['quantity'], 3);
            $unitCost = round((float) $product->cost_price, 2);

            $this->guardStockAppliedMutation($record, [
                'product_id' => $product->id,
                'status' => $validated['status'],
                'quantity' => $quantity,
            ]);

            $record->fill([
                'product_id' => $product->id,
                'user_id' => $record->user_id ?: $userId,
                'reason' => $validated['reason'],
                'status' => $validated['status'],
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'total_cost' => round($quantity * $unitCost, 2),
                'notes' => $validated['notes'] ?? null,
                'occurred_at' => $validated['occurred_at'] ?? ($record->occurred_at ?: now()),
            ])->save();

            if ($record->status === 'confirmed' && blank($record->stock_applied_at)) {
                $this->inventoryMovementService->apply($product, -$quantity, 'loss', [
                    'user_id' => $userId,
                    'reference' => $record,
                    'unit_cost' => $unitCost,
                    'notes' => "Perda registrada: {$record->reason}",
                    'occurred_at' => $record->occurred_at,
                ]);

                $record->forceFill(['stock_applied_at' => now()])->save();
            }

            return $record->fresh(['product:id,name,code,unit', 'user:id,name']);
        });
    }

    protected function saveWeighingRecord(?WeighingRecord $record, array $input): WeighingRecord
    {
        $validated = Validator::make($input, [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'reference' => ['nullable', 'string', 'max:80'],
            'status' => ['required', Rule::in(['draft', 'confirmed'])],
            'gross_weight' => ['required', 'numeric', 'gt:0'],
            'tare_weight' => ['nullable', 'numeric', 'gte:0', 'lte:gross_weight'],
            'unit_price' => ['nullable', 'numeric', 'gte:0'],
            'notes' => ['nullable', 'string'],
            'weighed_at' => ['nullable', 'date'],
        ])->validate();

        $product = Product::query()->findOrFail($validated['product_id']);
        $gross = round((float) $validated['gross_weight'], 3);
        $tare = round((float) ($validated['tare_weight'] ?? 0), 3);
        $net = round(max(0, $gross - $tare), 3);
        $unitPrice = round((float) ($validated['unit_price'] ?? $product->sale_price), 2);

        $record ??= new WeighingRecord();
        $record->fill([
            'product_id' => $product->id,
            'customer_id' => $validated['customer_id'] ?? null,
            'reference' => $validated['reference'] ?? null,
            'status' => $validated['status'],
            'gross_weight' => $gross,
            'tare_weight' => $tare,
            'net_weight' => $net,
            'unit_price' => $unitPrice,
            'total' => round($net * $unitPrice, 2),
            'notes' => $validated['notes'] ?? null,
            'weighed_at' => $validated['weighed_at'] ?? ($record->weighed_at ?: now()),
        ])->save();

        return $record->fresh(['product:id,name,code,unit,sale_price', 'customer:id,name']);
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
            'producer_id' => ['nullable', 'integer', 'exists:producers,id'],
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
                'producer_id' => $validated['producer_id'] ?? null,
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

    protected function saveServiceOrder(?ServiceOrder $serviceOrder, array $input, int $userId): ServiceOrder
    {
        $validated = Validator::make($input, [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'status' => ['required', Rule::in(['open', 'in_service', 'completed'])],
            'equipment' => ['required', 'string', 'max:255'],
            'issue_description' => ['required', 'string'],
            'diagnosis' => ['nullable', 'string'],
            'resolution' => ['nullable', 'string'],
            'technician_name' => ['nullable', 'string', 'max:255'],
            'labor_total' => ['nullable', 'numeric', 'gte:0'],
            'due_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'items' => ['nullable', 'array'],
            'items.*.description' => ['required', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'gte:0'],
        ])->validate();

        return DB::transaction(function () use ($serviceOrder, $validated, $userId) {
            $items = collect($validated['items'] ?? [])->map(function (array $item) {
                $quantity = round((float) $item['quantity'], 3);
                $unitPrice = round((float) $item['unit_price'], 2);

                return [
                    'description' => $item['description'],
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total' => round($quantity * $unitPrice, 2),
                ];
            });

            $partsTotal = round($items->sum('total'), 2);
            $laborTotal = round((float) ($validated['labor_total'] ?? 0), 2);

            $serviceOrder ??= new ServiceOrder();
            $serviceOrder->fill([
                'customer_id' => $validated['customer_id'] ?? null,
                'user_id' => $serviceOrder->user_id ?: $userId,
                'code' => $serviceOrder->code ?: $this->nextCode(ServiceOrder::class, 'OS'),
                'status' => $validated['status'],
                'equipment' => $validated['equipment'],
                'issue_description' => $validated['issue_description'],
                'diagnosis' => $validated['diagnosis'] ?? null,
                'resolution' => $validated['resolution'] ?? null,
                'technician_name' => $validated['technician_name'] ?? null,
                'labor_total' => $laborTotal,
                'parts_total' => $partsTotal,
                'total' => round($laborTotal + $partsTotal, 2),
                'due_at' => $validated['due_at'] ?? null,
                'closed_at' => $validated['status'] === 'completed' ? ($serviceOrder->closed_at ?: now()) : null,
                'notes' => $validated['notes'] ?? null,
            ])->save();

            $serviceOrder->items()->delete();

            foreach ($items as $item) {
                $serviceOrder->items()->create($item);
            }

            return $serviceOrder->fresh(['customer:id,name,phone', 'items']);
        });
    }

    protected function applyProductionStock(ProductionOrder $order, int $userId): void
    {
        $producedQuantity = round((float) $order->produced_quantity, 3);

        if ($producedQuantity <= 0) {
            throw ValidationException::withMessages([
                'produced_quantity' => 'Informe uma quantidade produzida maior que zero para concluir a producao.',
            ]);
        }

        $outputProduct = $order->product ?: $order->recipe?->product;

        if (!$outputProduct) {
            throw ValidationException::withMessages([
                'product_id' => 'Selecione um produto final para devolver a producao ao estoque.',
            ]);
        }

        if ($order->recipe && $order->recipe->items->isNotEmpty()) {
            $yieldBase = max(0.001, (float) $order->recipe->yield_quantity);
            $factor = $producedQuantity / $yieldBase;

            foreach ($order->recipe->items as $item) {
                if (!$item->product) {
                    continue;
                }

                $consumedQuantity = round((float) $item->quantity * $factor, 3);

                if ($consumedQuantity <= 0) {
                    continue;
                }

                $this->inventoryMovementService->apply($item->product, -$consumedQuantity, 'production_consume', [
                    'user_id' => $userId,
                    'reference' => $order,
                    'unit_cost' => $item->product->cost_price,
                    'notes' => "Consumo da producao {$order->code}",
                    'occurred_at' => $order->completed_at ?: now(),
                ]);
            }
        }

        $this->inventoryMovementService->apply($outputProduct, $producedQuantity, 'production_output', [
            'user_id' => $userId,
            'reference' => $order,
            'unit_cost' => $outputProduct->cost_price,
            'notes' => "Entrada da producao {$order->code}",
            'occurred_at' => $order->completed_at ?: now(),
        ]);

        $order->forceFill([
            'stock_applied_at' => now(),
            'completed_at' => $order->completed_at ?: now(),
        ])->save();
    }

    protected function guardStockAppliedMutation(?Model $model, array $nextState): void
    {
        if (!$model || blank($model->getAttribute('stock_applied_at'))) {
            return;
        }

        foreach ($nextState as $field => $value) {
            $current = $model->getAttribute($field);

            if ($current instanceof Carbon) {
                $current = $current->toDateString();
            }

            if ($value instanceof Carbon) {
                $value = $value->toDateString();
            }

            if ((string) $current !== (string) $value) {
                throw ValidationException::withMessages([
                    'record' => 'Este registro ja impactou o estoque e nao pode mais ter seus dados operacionais alterados.',
                ]);
            }
        }
    }

    protected function productOptions(): array
    {
        $hasRequiresPreparation = $this->productColumnExists('requires_preparation');
        $columns = ['id', 'name', 'code', 'unit', 'cost_price', 'sale_price', 'stock_quantity'];

        if ($hasRequiresPreparation) {
            $columns[] = 'requires_preparation';
        }

        return Product::query()
            ->where('active', true)
            ->orderBy('name')
            ->get($columns)
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'code' => $product->code,
                'unit' => $product->unit,
                'cost_price' => (float) $product->cost_price,
                'sale_price' => (float) $product->sale_price,
                'stock_quantity' => (float) $product->stock_quantity,
                'requires_preparation' => $hasRequiresPreparation ? (bool) $product->requires_preparation : true,
                'label' => "{$product->name} ({$product->code})",
            ])
            ->values()
            ->all();
    }

    protected function productColumnExists(string $column): bool
    {
        return $this->productColumnCache[$column]
            ??= Schema::connection((new Product())->getConnectionName())->hasColumn('products', $column);
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

    protected function producerOptions(): array
    {
        return Producer::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'region'])
            ->map(fn (Producer $producer) => [
                'id' => $producer->id,
                'name' => $producer->name,
                'region' => $producer->region,
            ])
            ->values()
            ->all();
    }

    protected function serializeProducer(Producer $producer): array
    {
        return [
            'id' => $producer->id,
            'name' => $producer->name,
            'document' => $producer->document,
            'phone' => $producer->phone,
            'email' => $producer->email,
            'region' => $producer->region,
            'notes' => $producer->notes,
            'active' => (bool) $producer->active,
            'created_at' => $producer->created_at?->toIso8601String(),
        ];
    }

    protected function serializeRecipe(Recipe $recipe): array
    {
        $recipe->loadMissing(['product:id,name,code,unit', 'items.product:id,name,code']);

        return [
            'id' => $recipe->id,
            'code' => $recipe->code,
            'name' => $recipe->name,
            'product_id' => $recipe->product_id,
            'product_name' => $recipe->product?->name,
            'product_code' => $recipe->product?->code,
            'yield_quantity' => (float) $recipe->yield_quantity,
            'yield_unit' => $recipe->yield_unit,
            'prep_time_minutes' => $recipe->prep_time_minutes,
            'instructions' => $recipe->instructions,
            'active' => (bool) $recipe->active,
            'items' => $recipe->items
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? $item->ingredient_name,
                    'ingredient_name' => $item->ingredient_name,
                    'quantity' => (float) $item->quantity,
                    'unit' => $item->unit,
                    'notes' => $item->notes,
                ])
                ->values()
                ->all(),
        ];
    }

    protected function serializeProductionOrder(ProductionOrder $order): array
    {
        $order->loadMissing(['recipe:id,name,product_id,yield_quantity,yield_unit', 'recipe.product:id,name,code', 'product:id,name,code,unit', 'user:id,name']);

        return [
            'id' => $order->id,
            'code' => $order->code,
            'recipe_id' => $order->recipe_id,
            'recipe_name' => $order->recipe?->name,
            'product_id' => $order->product_id,
            'product_name' => $order->product?->name ?? $order->recipe?->product?->name,
            'product_code' => $order->product?->code ?? $order->recipe?->product?->code,
            'status' => $order->status,
            'planned_quantity' => (float) $order->planned_quantity,
            'produced_quantity' => (float) $order->produced_quantity,
            'unit' => $order->unit,
            'scheduled_for' => $order->scheduled_for?->format('Y-m-d'),
            'notes' => $order->notes,
            'stock_applied_at' => $order->stock_applied_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'created_by' => $order->user?->name,
        ];
    }

    protected function serializeKitchenTicket(KitchenTicket $ticket): array
    {
        $ticket->loadMissing('items.product:id,name,code,unit');

        return [
            'id' => $ticket->id,
            'order_draft_id' => $ticket->order_draft_id,
            'reference' => $ticket->reference,
            'channel' => $ticket->channel,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'customer_name' => $ticket->customer_name,
            'notes' => $ticket->notes,
            'requested_at' => $ticket->requested_at?->format('Y-m-d\TH:i'),
            'started_at' => $ticket->started_at?->toIso8601String(),
            'ready_at' => $ticket->ready_at?->toIso8601String(),
            'completed_at' => $ticket->completed_at?->toIso8601String(),
            'items' => $ticket->items
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'item_name' => $item->item_name,
                    'quantity' => (float) $item->quantity,
                    'unit' => $item->unit,
                    'notes' => $item->notes,
                    'done_at' => $item->done_at?->toIso8601String(),
                ])
                ->values()
                ->all(),
        ];
    }

    public function toggleKitchenItemDone(int $ticketId, int $itemId): array
    {
        /** @var KitchenTicket $ticket */
        $ticket = KitchenTicket::query()
            ->with(['items.product:id,name,code,unit'])
            ->findOrFail($ticketId);

        $item = $ticket->items->firstWhere('id', $itemId);
        abort_unless($item, 404);

        $item->forceFill([
            'done_at' => $item->done_at ? null : now(),
        ])->save();

        return [
            'message' => $item->done_at ? 'Item confirmado.' : 'Item reaberto.',
            'record' => $this->serializeKitchenTicket($ticket->fresh(['items.product:id,name,code,unit'])),
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

    protected function serializeLossRecord(LossRecord $record): array
    {
        $record->loadMissing(['product:id,name,code,unit', 'user:id,name']);

        return [
            'id' => $record->id,
            'product_id' => $record->product_id,
            'product_name' => $record->product?->name,
            'product_code' => $record->product?->code,
            'unit' => $record->product?->unit,
            'status' => $record->status,
            'reason' => $record->reason,
            'quantity' => (float) $record->quantity,
            'unit_cost' => (float) $record->unit_cost,
            'total_cost' => (float) $record->total_cost,
            'notes' => $record->notes,
            'occurred_at' => $record->occurred_at?->format('Y-m-d\TH:i'),
            'stock_applied_at' => $record->stock_applied_at?->toIso8601String(),
            'created_by' => $record->user?->name,
        ];
    }

    protected function serializeWeighingRecord(WeighingRecord $record): array
    {
        $record->loadMissing(['product:id,name,code,unit,sale_price', 'customer:id,name']);

        return [
            'id' => $record->id,
            'product_id' => $record->product_id,
            'product_name' => $record->product?->name,
            'product_code' => $record->product?->code,
            'unit' => $record->product?->unit,
            'customer_id' => $record->customer_id,
            'customer_name' => $record->customer?->name,
            'reference' => $record->reference,
            'status' => $record->status,
            'gross_weight' => (float) $record->gross_weight,
            'tare_weight' => (float) $record->tare_weight,
            'net_weight' => (float) $record->net_weight,
            'unit_price' => (float) $record->unit_price,
            'total' => (float) $record->total,
            'notes' => $record->notes,
            'weighed_at' => $record->weighed_at?->format('Y-m-d\TH:i'),
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
        $purchase->loadMissing(['supplier:id,name', 'producer:id,name', 'items.product:id,name,code,unit']);

        return [
            'id' => $purchase->id,
            'code' => $purchase->code,
            'supplier_id' => $purchase->supplier_id,
            'supplier_name' => $purchase->supplier?->name,
            'producer_id' => $purchase->producer_id,
            'producer_name' => $purchase->producer?->name,
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

    protected function serializeServiceOrder(ServiceOrder $serviceOrder): array
    {
        $serviceOrder->loadMissing(['customer:id,name,phone', 'items']);

        return [
            'id' => $serviceOrder->id,
            'code' => $serviceOrder->code,
            'customer_id' => $serviceOrder->customer_id,
            'customer_name' => $serviceOrder->customer?->name,
            'status' => $serviceOrder->status,
            'equipment' => $serviceOrder->equipment,
            'issue_description' => $serviceOrder->issue_description,
            'diagnosis' => $serviceOrder->diagnosis,
            'resolution' => $serviceOrder->resolution,
            'technician_name' => $serviceOrder->technician_name,
            'labor_total' => (float) $serviceOrder->labor_total,
            'parts_total' => (float) $serviceOrder->parts_total,
            'total' => (float) $serviceOrder->total,
            'due_at' => $serviceOrder->due_at?->format('Y-m-d'),
            'closed_at' => $serviceOrder->closed_at?->toIso8601String(),
            'notes' => $serviceOrder->notes,
            'items' => $serviceOrder->items
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
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
