<?php

namespace App\Http\Controllers\Tenant\Fashion;

use App\Http\Controllers\Controller;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Models\Tenant\ReturnExchange;
use App\Services\Tenant\FashionModuleSettingsService;
use App\Services\Tenant\OrderDraftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class FashionModuleApiController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function storePromotion(Request $request): JsonResponse
    {
        if (!$this->hasTable('promotions')) {
            return $this->schemaNotReadyResponse('promocoes');
        }

        $promotion = Promotion::query()->create($this->validatePromotion($request));

        return response()->json([
            'message' => 'Promocao cadastrada com sucesso.',
            'promotion' => $this->serializePromotion($promotion),
        ], 201);
    }

    public function updatePromotion(Request $request, Promotion $promotion): JsonResponse
    {
        if (!$this->hasTable('promotions')) {
            return $this->schemaNotReadyResponse('promocoes');
        }

        $promotion->update($this->validatePromotion($request));

        return response()->json([
            'message' => 'Promocao atualizada com sucesso.',
            'promotion' => $this->serializePromotion($promotion),
        ]);
    }

    public function destroyPromotion(Promotion $promotion): JsonResponse
    {
        if (!$this->hasTable('promotions')) {
            return $this->schemaNotReadyResponse('promocoes');
        }

        $promotion->delete();

        return response()->json(['message' => 'Promocao removida com sucesso.']);
    }

    public function storeReturn(Request $request): JsonResponse
    {
        if (!$this->hasTable('return_exchanges')) {
            return $this->schemaNotReadyResponse('trocas e devolucoes');
        }

        $record = ReturnExchange::query()->create($this->validateReturn($request));

        return response()->json([
            'message' => 'Atendimento salvo com sucesso.',
            'record' => $this->serializeReturn($record),
        ], 201);
    }

    public function updateReturn(Request $request, ReturnExchange $returnExchange): JsonResponse
    {
        if (!$this->hasTable('return_exchanges')) {
            return $this->schemaNotReadyResponse('trocas e devolucoes');
        }

        $returnExchange->update($this->validateReturn($request));

        return response()->json([
            'message' => 'Atendimento atualizado com sucesso.',
            'record' => $this->serializeReturn($returnExchange),
        ]);
    }

    public function destroyReturn(ReturnExchange $returnExchange): JsonResponse
    {
        if (!$this->hasTable('return_exchanges')) {
            return $this->schemaNotReadyResponse('trocas e devolucoes');
        }

        $returnExchange->delete();

        return response()->json(['message' => 'Atendimento removido com sucesso.']);
    }

    public function updateCatalogSettings(
        Request $request,
        FashionModuleSettingsService $settingsService,
    ): JsonResponse {
        $settings = $settingsService->updateCatalog($request->validate([
            'title' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'featured_collection' => ['nullable', 'string', 'max:120'],
            'show_prices' => ['required', 'boolean'],
        ]));

        return response()->json([
            'message' => 'Configuracoes do catalogo salvas com sucesso.',
            'settings' => $settings,
        ]);
    }

    public function updateCatalogProduct(Request $request, Product $product): JsonResponse
    {
        if (!$this->hasColumn('products', 'catalog_visible')) {
            return $this->schemaNotReadyResponse('catalogo online');
        }

        $payload = $request->validate([
            'catalog_visible' => ['required', 'boolean'],
        ]);

        $product->update($payload);

        return response()->json([
            'message' => 'Visibilidade do produto atualizada.',
            'product' => [
                'id' => $product->id,
                'catalog_visible' => $product->catalog_visible,
            ],
        ]);
    }

    public function storeOnlineOrder(Request $request, OrderDraftService $orderDraftService): JsonResponse
    {
        if (!$this->hasColumn('order_drafts', 'channel')) {
            return $this->schemaNotReadyResponse('pedidos online');
        }

        $payload = $this->validateOnlineOrder($request);

        $draft = $orderDraftService->create((int) auth()->user()?->getKey(), [
            'type' => 'pedido',
            'channel' => $payload['channel'],
            'customer_id' => $payload['customer_id'] ?? null,
            'reference' => $payload['reference'] ?? null,
            'notes' => $payload['notes'] ?? null,
        ]);

        $draft = $orderDraftService->save($draft, [
            'type' => 'pedido',
            'channel' => $payload['channel'],
            'customer_id' => $payload['customer_id'] ?? null,
            'reference' => $payload['reference'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'items' => $payload['items'],
        ]);

        return response()->json([
            'message' => 'Pedido online salvo com sucesso.',
            'order' => $orderDraftService->toDetail($draft),
        ], 201);
    }

    public function updateOnlineOrder(
        Request $request,
        OrderDraft $orderDraft,
        OrderDraftService $orderDraftService,
    ): JsonResponse {
        if (!$this->hasColumn('order_drafts', 'channel')) {
            return $this->schemaNotReadyResponse('pedidos online');
        }

        $payload = $this->validateOnlineOrder($request);

        $draft = $orderDraftService->save($orderDraft, [
            'type' => 'pedido',
            'channel' => $payload['channel'],
            'customer_id' => $payload['customer_id'] ?? null,
            'reference' => $payload['reference'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'items' => $payload['items'],
        ]);

        return response()->json([
            'message' => 'Pedido online atualizado com sucesso.',
            'order' => $orderDraftService->toDetail($draft),
        ]);
    }

    public function sendOnlineOrderToCashier(
        OrderDraft $orderDraft,
        OrderDraftService $orderDraftService,
    ): JsonResponse {
        if (!$this->hasColumn('order_drafts', 'channel')) {
            return $this->schemaNotReadyResponse('pedidos online');
        }

        $draft = $orderDraftService->sendToCashier($orderDraft);

        return response()->json([
            'message' => 'Pedido online enviado para o caixa.',
            'order' => $orderDraftService->toDetail($draft),
        ]);
    }

    public function updateWhatsAppSettings(
        Request $request,
        FashionModuleSettingsService $settingsService,
    ): JsonResponse {
        $settings = $settingsService->updateWhatsApp($request->validate([
            'phone' => ['nullable', 'string', 'max:40'],
            'greeting' => ['required', 'string', 'max:255'],
            'checkout_template' => ['required', 'string'],
            'business_hours' => ['nullable', 'string', 'max:120'],
        ]));

        return response()->json([
            'message' => 'Configuracoes do WhatsApp salvas com sucesso.',
            'settings' => $settings,
        ]);
    }

    protected function validatePromotion(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'type' => ['required', 'string', Rule::in(['percent', 'fixed', 'price_override'])],
            'scope' => ['required', 'string', Rule::in(['all', 'product', 'category', 'collection'])],
            'product_id' => ['nullable', 'required_if:scope,product', 'integer', 'exists:products,id'],
            'category_id' => ['nullable', 'required_if:scope,category', 'integer', 'exists:categories,id'],
            'collection' => ['nullable', 'required_if:scope,collection', 'string', 'max:120'],
            'discount_value' => ['required', 'numeric', 'min:0'],
            'highlight_text' => ['nullable', 'string', 'max:120'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date', 'after_or_equal:start_at'],
            'active' => ['required', 'boolean'],
        ]);
    }

    protected function validateReturn(Request $request): array
    {
        return $request->validate([
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'sale_id' => ['nullable', 'integer', 'exists:sales,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'type' => ['required', 'string', Rule::in(['troca', 'devolucao'])],
            'status' => ['required', 'string', Rule::in(['aberto', 'em_analise', 'concluido', 'cancelado'])],
            'product_name' => ['required', 'string', 'max:255'],
            'product_code' => ['nullable', 'string', 'max:255'],
            'size' => ['nullable', 'string', 'max:120'],
            'color' => ['nullable', 'string', 'max:120'],
            'reason' => ['required', 'string', 'max:255'],
            'resolution' => ['nullable', 'string', 'max:255'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'store_credit_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'processed_at' => ['nullable', 'date'],
        ]);
    }

    protected function validateOnlineOrder(Request $request): array
    {
        return $request->validate([
            'channel' => ['required', 'string', Rule::in([OrderDraft::CHANNEL_SITE, OrderDraft::CHANNEL_WHATSAPP])],
            'reference' => ['nullable', 'string', 'max:80'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
        ]);
    }

    protected function serializePromotion(Promotion $promotion): array
    {
        $promotion->loadMissing(['product:id,name,code', 'category:id,name']);

        return [
            'id' => $promotion->id,
            'name' => $promotion->name,
            'description' => $promotion->description,
            'type' => $promotion->type,
            'scope' => $promotion->scope,
            'product_id' => $promotion->product_id,
            'category_id' => $promotion->category_id,
            'product_name' => $promotion->product?->name,
            'category_name' => $promotion->category?->name,
            'collection' => $promotion->collection,
            'discount_value' => (float) $promotion->discount_value,
            'highlight_text' => $promotion->highlight_text,
            'start_at' => $promotion->start_at?->format('Y-m-d\TH:i'),
            'end_at' => $promotion->end_at?->format('Y-m-d\TH:i'),
            'active' => $promotion->active,
        ];
    }

    protected function serializeReturn(ReturnExchange $record): array
    {
        $record->loadMissing(['customer:id,name', 'product:id,name,code,color,size']);

        return [
            'id' => $record->id,
            'customer_id' => $record->customer_id,
            'customer_name' => $record->customer?->name,
            'sale_id' => $record->sale_id,
            'product_id' => $record->product_id,
            'product_name' => $record->product_name,
            'product_code' => $record->product_code,
            'type' => $record->type,
            'status' => $record->status,
            'size' => $record->size,
            'color' => $record->color,
            'reason' => $record->reason,
            'resolution' => $record->resolution,
            'refund_amount' => (float) $record->refund_amount,
            'store_credit_amount' => (float) $record->store_credit_amount,
            'notes' => $record->notes,
            'processed_at' => $record->processed_at?->format('Y-m-d\TH:i'),
            'created_at' => $record->created_at?->toIso8601String(),
        ];
    }

    protected function schemaNotReadyResponse(string $module): JsonResponse
    {
        return response()->json([
            'message' => "O schema do tenant ainda nao foi atualizado para {$module}. Execute a migration do tenant e tente novamente.",
        ], 409);
    }

    protected function hasTable(string $table): bool
    {
        return $this->schemaTableCache[$table]
            ??= Schema::connection((new Product())->getConnectionName())->hasTable($table);
    }

    protected function hasColumn(string $table, string $column): bool
    {
        $cacheKey = "{$table}.{$column}";

        return $this->schemaColumnCache[$cacheKey]
            ??= $this->hasTable($table)
                && Schema::connection((new Product())->getConnectionName())->hasColumn($table, $column);
    }
}
