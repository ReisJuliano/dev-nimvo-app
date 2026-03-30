<?php

namespace App\Http\Controllers\Tenant\Fashion;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Category;
use App\Models\Tenant\Customer;
use App\Models\Tenant\OrderDraft;
use App\Models\Tenant\Product;
use App\Models\Tenant\Promotion;
use App\Models\Tenant\ReturnExchange;
use App\Services\Tenant\FashionModuleSettingsService;
use App\Services\Tenant\OrderDraftService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class FashionModulePageController extends Controller
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __invoke(
        Request $request,
        FashionModuleSettingsService $settingsService,
        OrderDraftService $orderDraftService,
        string $module,
    ): Response {
        return match ($module) {
            'promotions' => Inertia::render('Fashion/Workspace', $this->promotionsPayload()),
            'returns' => Inertia::render('Fashion/Workspace', $this->returnsPayload()),
            'catalog' => Inertia::render('Fashion/Workspace', $this->catalogPayload($settingsService)),
            'online-orders' => Inertia::render('Fashion/Workspace', $this->onlineOrdersPayload($orderDraftService)),
            'whatsapp' => Inertia::render('Fashion/Workspace', $this->whatsAppPayload($settingsService)),
            default => abort(404),
        };
    }

    protected function promotionsPayload(): array
    {
        $promotions = $this->hasTable('promotions')
            ? Promotion::query()
                ->with(['product:id,name,code', 'category:id,name'])
                ->latest()
                ->get()
                ->map(fn (Promotion $promotion) => [
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
                ])
                ->values()
            : collect();

        return [
            'moduleKey' => 'promotions',
            'moduleTitle' => 'Promocoes',
            'moduleDescription' => 'Campanhas reais com cadastro, alvo comercial e persistencia em banco.',
            'payload' => [
                'promotions' => $promotions,
                'products' => Product::query()
                    ->where('active', true)
                    ->orderBy('name')
                    ->get($this->productSelectColumns(['collection', 'color', 'size']))
                    ->map(fn (Product $product) => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'code' => $product->code,
                        'collection' => $this->productValue($product, 'collection'),
                        'color' => $this->productValue($product, 'color'),
                        'size' => $this->productValue($product, 'size'),
                        'sale_price' => (float) $product->sale_price,
                    ])
                    ->values(),
                'categories' => Category::query()
                    ->where('active', true)
                    ->orderBy('name')
                    ->get(['id', 'name']),
                'collections' => $this->collections(),
            ],
        ];
    }

    protected function returnsPayload(): array
    {
        $records = $this->hasTable('return_exchanges')
            ? ReturnExchange::query()
                ->with(['customer:id,name', 'product:id,name,code,color,size'])
                ->latest()
                ->get()
                ->map(fn (ReturnExchange $record) => [
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
                ])
                ->values()
            : collect();

        return [
            'moduleKey' => 'returns',
            'moduleTitle' => 'Trocas e devolucoes',
            'moduleDescription' => 'Registro de atendimento, motivo, status e credito gerado para o cliente.',
            'payload' => [
                'records' => $records,
                'customers' => Customer::query()
                    ->where('active', true)
                    ->orderBy('name')
                    ->get(['id', 'name', 'phone']),
                'products' => Product::query()
                    ->where('active', true)
                    ->orderBy('name')
                    ->get($this->productSelectColumns(['color', 'size', 'collection']))
                    ->map(fn (Product $product) => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'code' => $product->code,
                        'color' => $this->productValue($product, 'color'),
                        'size' => $this->productValue($product, 'size'),
                        'collection' => $this->productValue($product, 'collection'),
                    ])
                    ->values(),
            ],
        ];
    }

    protected function catalogPayload(FashionModuleSettingsService $settingsService): array
    {
        return [
            'moduleKey' => 'catalog',
            'moduleTitle' => 'Catalogo online',
            'moduleDescription' => 'Vitrine digital, colecoes publicadas e configuracoes reais do canal.',
            'payload' => [
                'settings' => $settingsService->getCatalog(),
                'products' => Product::query()
                    ->with('category:id,name')
                    ->where('active', true)
                    ->when($this->hasColumn('products', 'collection'), fn ($query) => $query->orderBy('collection'))
                    ->orderBy('name')
                    ->get($this->productSelectColumns(['style_reference', 'color', 'size', 'collection', 'catalog_visible']))
                    ->map(fn (Product $product) => [
                        'id' => $product->id,
                        'code' => $product->code,
                        'name' => $product->name,
                        'description' => $product->description,
                        'style_reference' => $this->productValue($product, 'style_reference'),
                        'color' => $this->productValue($product, 'color'),
                        'size' => $this->productValue($product, 'size'),
                        'collection' => $this->productValue($product, 'collection'),
                        'catalog_visible' => (bool) $this->productValue($product, 'catalog_visible', false),
                        'sale_price' => (float) $product->sale_price,
                        'stock_quantity' => (float) $product->stock_quantity,
                        'category_name' => $product->category?->name,
                    ])
                    ->values(),
                'collections' => $this->collections(),
            ],
        ];
    }

    protected function onlineOrdersPayload(OrderDraftService $orderDraftService): array
    {
        return [
            'moduleKey' => 'online-orders',
            'moduleTitle' => 'Pedidos online',
            'moduleDescription' => 'Fila real por canal digital, com cadastro, edicao e envio ao caixa.',
            'payload' => [
                'orders' => $this->hasColumn('order_drafts', 'channel')
                    ? $orderDraftService->channelDrafts([
                        OrderDraft::CHANNEL_SITE,
                        OrderDraft::CHANNEL_WHATSAPP,
                    ], true)
                    : [],
                'customers' => Customer::query()
                    ->where('active', true)
                    ->orderBy('name')
                    ->get(['id', 'name', 'phone']),
                'products' => Product::query()
                    ->where('active', true)
                    ->orderBy('name')
                    ->get($this->productSelectColumns(['color', 'size', 'collection', 'catalog_visible']))
                    ->map(fn (Product $product) => [
                        'id' => $product->id,
                        'name' => $product->name,
                        'code' => $product->code,
                        'sale_price' => (float) $product->sale_price,
                        'stock_quantity' => (float) $product->stock_quantity,
                        'color' => $this->productValue($product, 'color'),
                        'size' => $this->productValue($product, 'size'),
                        'collection' => $this->productValue($product, 'collection'),
                        'catalog_visible' => (bool) $this->productValue($product, 'catalog_visible', false),
                    ])
                    ->values(),
            ],
        ];
    }

    protected function whatsAppPayload(FashionModuleSettingsService $settingsService): array
    {
        return [
            'moduleKey' => 'whatsapp',
            'moduleTitle' => 'WhatsApp',
            'moduleDescription' => 'Numero oficial, mensagem padrao e preview do fechamento conversacional.',
            'payload' => [
                'settings' => $settingsService->getWhatsApp(),
                'summary' => [
                    'drafts' => $this->hasColumn('order_drafts', 'channel')
                        ? OrderDraft::query()
                            ->where('channel', OrderDraft::CHANNEL_WHATSAPP)
                            ->where('status', OrderDraft::STATUS_DRAFT)
                            ->count()
                        : 0,
                    'sent_to_cashier' => $this->hasColumn('order_drafts', 'channel')
                        ? OrderDraft::query()
                            ->where('channel', OrderDraft::CHANNEL_WHATSAPP)
                            ->where('status', OrderDraft::STATUS_SENT_TO_CASHIER)
                            ->count()
                        : 0,
                ],
            ],
        ];
    }

    protected function collections(): array
    {
        if (!$this->hasColumn('products', 'collection')) {
            return [];
        }

        return Product::query()
            ->where('active', true)
            ->whereNotNull('collection')
            ->where('collection', '!=', '')
            ->distinct()
            ->orderBy('collection')
            ->pluck('collection')
            ->values()
            ->all();
    }

    protected function productSelectColumns(array $extraColumns = []): array
    {
        $columns = [
            'id',
            'name',
            'code',
            'description',
            'sale_price',
            'stock_quantity',
            'category_id',
            'active',
        ];

        foreach ($extraColumns as $column) {
            if ($this->hasColumn('products', $column)) {
                $columns[] = $column;
            }
        }

        return array_values(array_unique($columns));
    }

    protected function productValue(Product $product, string $column, mixed $default = null): mixed
    {
        return $this->hasColumn('products', $column) ? $product->getAttribute($column) : $default;
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
