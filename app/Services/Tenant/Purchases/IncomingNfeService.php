<?php

namespace App\Services\Tenant\Purchases;

use App\Models\Tenant\AppSetting;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\IncomingNfeItem;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Supplier;
use App\Services\Tenant\InventoryMovementService;
use App\Services\Tenant\ProductService;
use App\Support\DanfePdfRenderer;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class IncomingNfeService
{
    public function __construct(
        protected IncomingNfeXmlParser $parser,
        protected IncomingNfeStorage $storage,
        protected IncomingNfeSefazGateway $sefazGateway,
        protected InventoryMovementService $inventoryMovementService,
        protected ProductService $productService,
        protected DanfePdfRenderer $danfePdfRenderer,
    ) {
    }

    public function integrationStatus(): array
    {
        return $this->sefazGateway->status($this->activeFiscalProfile());
    }

    public function sync(array $filters = []): array
    {
        $profile = $this->activeFiscalProfile();

        if (!$profile) {
            throw ValidationException::withMessages([
                'fiscal_profile' => 'Ative um perfil fiscal para consultar NF-e recebida.',
            ]);
        }

        $accessKey = preg_replace('/\D+/', '', (string) ($filters['access_key'] ?? ''));
        $response = $accessKey !== ''
            ? $this->sefazGateway->downloadByAccessKey($profile, $accessKey)
            : $this->sefazGateway->syncByLastNsu($profile, $this->lastNsu());

        if (!in_array($response['status_code'] ?? null, ['137', '138'], true)) {
            throw ValidationException::withMessages([
                'sefaz' => sprintf(
                    'A SEFAZ recusou a sincronizacao [%s] %s',
                    $response['status_code'] ?? '---',
                    $response['reason'] ?? 'Sem motivo informado.'
                ),
            ]);
        }

        $imported = [];

        foreach ($response['documents'] as $document) {
            $schema = (string) ($document['schema'] ?? '');
            $xml = (string) ($document['xml'] ?? '');
            $nsu = (string) ($document['nsu'] ?? '');

            if ($xml === '') {
                continue;
            }

            $imported[] = str_contains($schema, 'resNFe')
                ? $this->importParsed(
                    $this->parser->parseSummary($xml),
                    source: 'sefaz_sync',
                    xml: null,
                    distributionNsu: $nsu,
                    allowUpdate: true,
                )
                : $this->importParsed(
                    $this->parser->parse($xml),
                    source: 'sefaz_sync',
                    xml: $xml,
                    distributionNsu: $nsu,
                    allowUpdate: true,
                );
        }

        $this->storeLastNsu((string) ($response['last_nsu'] ?? '0'));

        return [
            'message' => count($imported)
                ? sprintf('%d NF-e sincronizada(s) com sucesso.', count($imported))
                : 'Nenhuma NF-e nova foi encontrada na sincronizacao.',
            'records' => collect($imported)->map(fn (IncomingNfeDocument $document) => $this->serializeDocument($document))->all(),
            'status' => $this->integrationStatus(),
        ];
    }

    public function importXml(string $xml, string $source = 'xml_upload'): IncomingNfeDocument
    {
        return $this->importParsed(
            $this->parser->parse($xml),
            source: $source,
            xml: $xml,
            distributionNsu: null,
            allowUpdate: false,
        );
    }

    public function reprocess(IncomingNfeDocument $document): IncomingNfeDocument
    {
        $document->loadMissing('purchase');

        if (filled($document->purchase?->stock_applied_at)) {
            throw ValidationException::withMessages([
                'document' => 'Esta NF-e ja gerou entrada no estoque e nao pode ser reprocessada.',
            ]);
        }

        $xml = $this->storage->readXml($document->xml_path);

        if ($xml) {
            return $this->importParsed(
                $this->parser->parse($xml),
                source: $document->source,
                xml: $xml,
                distributionNsu: $document->distribution_nsu,
                allowUpdate: true,
                current: $document,
            );
        }

        $this->sync(['access_key' => $document->access_key]);

        return IncomingNfeDocument::query()
            ->with(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price'])
            ->findOrFail($document->id);
    }

    public function quickCreateSupplier(IncomingNfeDocument $document, array $input = []): IncomingNfeDocument
    {
        $document->loadMissing('supplier');

        if ($document->supplier_id) {
            return $document->fresh(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price']);
        }

        $name = trim((string) ($input['name'] ?? $document->supplier_name));
        $documentNumber = preg_replace('/\D+/', '', (string) ($input['document'] ?? $document->supplier_document));

        if ($name === '' || $documentNumber === '') {
            throw ValidationException::withMessages([
                'supplier' => 'Informe nome e CNPJ do fornecedor para o cadastro rapido.',
            ]);
        }

        $supplier = Supplier::query()->firstOrCreate(
            ['document' => $documentNumber],
            [
                'name' => $name,
                'document_type' => strlen($documentNumber) === 14 ? 'cnpj' : 'cpf',
                'trade_name' => $input['trade_name'] ?? $document->supplier_trade_name,
                'state_registration' => $input['state_registration'] ?? $document->supplier_state_registration,
                'city_name' => $input['city_name'] ?? data_get($document->metadata, 'supplier.city_name'),
                'state' => Str::upper((string) ($input['state'] ?? data_get($document->metadata, 'supplier.state'))),
                'phone' => null,
                'email' => null,
                'active' => true,
            ],
        );

        return $this->updateMappings($document, [
            'supplier_id' => $supplier->id,
        ]);
    }

    public function updateMappings(IncomingNfeDocument $document, array $input): IncomingNfeDocument
    {
        $validated = Validator::make($input, [
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'items' => ['nullable', 'array'],
            'items.*.id' => ['required', 'integer'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.action' => ['nullable', Rule::in(['auto_create'])],
            'items.*.sale_price' => ['nullable', 'numeric', 'min:0'],
        ])->validate();

        return DB::transaction(function () use ($document, $validated) {
            $document = IncomingNfeDocument::query()
                ->with(['items.product', 'purchase'])
                ->lockForUpdate()
                ->findOrFail($document->id);

            if (filled($document->purchase?->stock_applied_at)) {
                throw ValidationException::withMessages([
                    'document' => 'A NF-e ja foi confirmada no estoque e nao aceita remapeamento.',
                ]);
            }

            if (array_key_exists('supplier_id', $validated)) {
                $document->forceFill(['supplier_id' => $validated['supplier_id']])->save();
            }

            foreach ($validated['items'] ?? [] as $entry) {
                $item = $document->items->firstWhere('id', (int) $entry['id']);

                if (!$item) {
                    continue;
                }

                if (($entry['action'] ?? null) === 'auto_create') {
                    $product = $this->createProductFromItem($item, $document, $entry);
                    $this->applyItemMapping($item, $product, 'auto_create', 100);
                    continue;
                }

                if (filled($entry['product_id'] ?? null)) {
                    $product = Product::query()->findOrFail((int) $entry['product_id']);
                    $this->applyItemMapping($item, $product, 'manual_link', 100);
                    continue;
                }

                $item->forceFill([
                    'product_id' => null,
                    'match_status' => 'pending',
                    'match_type' => null,
                    'match_confidence' => null,
                    'validation_warnings' => $this->buildWarnings(null, $item->toArray()),
                ])->save();
            }

            $this->recalculateDocument($document->fresh(['items.product', 'purchase']));

            return $document->fresh(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price']);
        });
    }

    public function confirm(IncomingNfeDocument $document, array $input, int $userId): IncomingNfeDocument
    {
        $validated = Validator::make($input, [
            'cost_method' => ['nullable', Rule::in(['last_cost', 'average_cost'])],
            'auto_create_missing' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string'],
        ])->validate();

        $costMethod = $validated['cost_method'] ?? 'last_cost';

        return DB::transaction(function () use ($document, $validated, $costMethod, $userId) {
            $document = IncomingNfeDocument::query()
                ->with(['items.product', 'purchase.items'])
                ->lockForUpdate()
                ->findOrFail($document->id);

            $this->guardRecipientDocument($document->recipient_document);

            if (filled($document->purchase?->stock_applied_at)) {
                throw ValidationException::withMessages([
                    'document' => 'Esta NF-e ja foi confirmada anteriormente.',
                ]);
            }

            if ((bool) ($validated['auto_create_missing'] ?? false)) {
                foreach ($document->items->whereNull('product_id') as $item) {
                    $product = $this->createProductFromItem($item, $document, []);
                    $this->applyItemMapping($item, $product, 'auto_create', 100);
                }

                $document->load('items.product');
            }

            if ($document->items->contains(fn (IncomingNfeItem $item) => !$item->product_id)) {
                throw ValidationException::withMessages([
                    'products' => 'Existem itens sem cadastro ou vinculacao. Revise as pendencias antes de confirmar.',
                ]);
            }

            $purchase = $document->purchase ?: new Purchase();
            $subtotal = round((float) $document->items->sum(fn (IncomingNfeItem $item) => (float) $item->total_price), 2);
            $freight = round((float) $document->freight_total, 2);
            $total = round((float) ($document->invoice_total ?: ($subtotal + $freight)), 2);
            $receivedAt = $document->authorized_at ?: $document->issued_at ?: now();

            $purchase->fill([
                'supplier_id' => $document->supplier_id,
                'user_id' => $purchase->user_id ?: $userId,
                'code' => $purchase->code ?: $this->nextPurchaseCode(),
                'status' => 'received',
                'expected_at' => $document->issued_at ? Carbon::parse($document->issued_at)->toDateString() : null,
                'received_at' => $receivedAt,
                'subtotal' => $subtotal,
                'freight' => $freight,
                'total' => $total,
                'notes' => trim(implode("\n", array_filter([
                    "Entrada importada pela NF-e {$document->number}/{$document->series}",
                    "Chave de acesso: {$document->access_key}",
                    $validated['notes'] ?? null,
                ]))),
            ])->save();

            $purchase->items()->delete();

            foreach ($document->items as $incomingItem) {
                $product = Product::query()->lockForUpdate()->findOrFail((int) $incomingItem->product_id);
                $unitCost = round((float) $incomingItem->unit_price, 4);
                $purchaseItem = $purchase->items()->create([
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'quantity' => round((float) $incomingItem->quantity, 3),
                    'unit_cost' => round($unitCost, 2),
                    'total' => round((float) $incomingItem->total_price, 2),
                ]);

                $this->updateProductCost($product, (float) $incomingItem->quantity, $unitCost, $costMethod, $document->supplier_id, $incomingItem);

                $this->inventoryMovementService->apply($product->fresh(), (float) $incomingItem->quantity, 'purchase', [
                    'user_id' => $userId,
                    'reference' => $purchase,
                    'unit_cost' => round($unitCost, 2),
                    'notes' => sprintf('Entrada por NF-e %s', $document->access_key),
                    'occurred_at' => $receivedAt,
                ]);

                $incomingItem->forceFill([
                    'purchase_item_id' => $purchaseItem->id,
                ])->save();
            }

            $purchase->forceFill(['stock_applied_at' => now()])->save();
            $document->forceFill([
                'purchase_id' => $purchase->id,
                'status' => 'processed',
                'last_processed_at' => now(),
            ])->save();

            $this->recalculateDocument($document->fresh(['items.product', 'purchase']));

            return $document->fresh(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price']);
        });
    }

    public function serializeDocument(IncomingNfeDocument $document): array
    {
        $document->loadMissing(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price']);
        $snapshot = is_array($document->validation_snapshot) ? $document->validation_snapshot : [];

        return [
            'id' => $document->id,
            'purchase_id' => $document->purchase_id,
            'supplier_id' => $document->supplier_id,
            'supplier_name' => $document->supplier?->name ?? $document->supplier_name,
            'supplier_document' => $document->supplier?->document ?? $document->supplier_document,
            'access_key' => $document->access_key,
            'status' => $document->status,
            'source' => $document->source,
            'manifest_status' => $document->manifest_status,
            'distribution_nsu' => $document->distribution_nsu,
            'number' => $document->number,
            'series' => $document->series,
            'issued_at' => $document->issued_at?->toIso8601String(),
            'authorized_at' => $document->authorized_at?->toIso8601String(),
            'products_total' => (float) $document->products_total,
            'freight_total' => (float) $document->freight_total,
            'invoice_total' => (float) $document->invoice_total,
            'recipient_name' => $document->recipient_name,
            'recipient_document' => $document->recipient_document,
            'operation_nature' => $document->operation_nature,
            'xml_available' => filled($document->xml_path),
            'danfe_available' => filled($document->danfe_path),
            'summary_only' => (bool) data_get($document->metadata, 'summary_only', false),
            'validation' => [
                'matched_items' => (int) ($snapshot['matched_items'] ?? 0),
                'pending_items' => (int) ($snapshot['pending_items'] ?? 0),
                'new_products' => (int) ($snapshot['new_products'] ?? 0),
                'price_changes' => (int) ($snapshot['price_changes'] ?? 0),
                'ncm_mismatches' => (int) ($snapshot['ncm_mismatches'] ?? 0),
                'alerts' => $snapshot['alerts'] ?? [],
            ],
            'items' => $document->items
                ->sortBy('item_number')
                ->values()
                ->map(fn (IncomingNfeItem $item) => [
                    'id' => $item->id,
                    'item_number' => $item->item_number,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name,
                    'product_code' => $item->product?->code,
                    'supplier_code' => $item->supplier_code,
                    'barcode' => $item->barcode,
                    'description' => $item->description,
                    'ncm' => $item->ncm,
                    'cfop' => $item->cfop,
                    'unit' => $item->unit,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'total_price' => (float) $item->total_price,
                    'match_status' => $item->match_status,
                    'match_type' => $item->match_type,
                    'match_confidence' => $item->match_confidence !== null ? (float) $item->match_confidence : null,
                    'validation_warnings' => $item->validation_warnings ?? [],
                    'suggested_product_id' => data_get($item->metadata, 'suggested_product_id'),
                    'suggested_product_name' => data_get($item->metadata, 'suggested_product_name'),
                ])
                ->all(),
        ];
    }

    protected function importParsed(
        array $parsed,
        string $source,
        ?string $xml,
        ?string $distributionNsu,
        bool $allowUpdate,
        ?IncomingNfeDocument $current = null,
    ): IncomingNfeDocument {
        $this->guardRecipientDocument((string) ($parsed['recipient']['document'] ?? ''));

        return DB::transaction(function () use ($parsed, $source, $xml, $distributionNsu, $allowUpdate, $current) {
            $existing = $current ?: IncomingNfeDocument::query()
                ->with(['items.product', 'purchase'])
                ->where('access_key', (string) $parsed['access_key'])
                ->lockForUpdate()
                ->first();

            if ($existing && !$allowUpdate) {
                throw ValidationException::withMessages([
                    'access_key' => 'Essa NF-e ja foi importada anteriormente.',
                ]);
            }

            if ($existing && filled($existing->purchase?->stock_applied_at)) {
                throw ValidationException::withMessages([
                    'access_key' => 'Essa NF-e ja gerou entrada no estoque e nao pode ser atualizada.',
                ]);
            }

            $supplier = $this->findSupplier($parsed);
            $document = $existing ?: new IncomingNfeDocument();
            $document->fill([
                'purchase_id' => $existing?->purchase_id,
                'supplier_id' => $supplier?->id,
                'access_key' => $parsed['access_key'],
                'status' => data_get($parsed, 'metadata.summary_only') ? 'summary_only' : 'pending_products',
                'source' => $source,
                'manifest_status' => data_get($parsed, 'metadata.summary_only') ? 'pending' : 'available',
                'distribution_nsu' => $distributionNsu ?: $existing?->distribution_nsu,
                'environment' => $parsed['environment'],
                'series' => $parsed['series'],
                'number' => $parsed['number'],
                'operation_nature' => $parsed['operation_nature'],
                'supplier_name' => data_get($parsed, 'supplier.name'),
                'supplier_trade_name' => data_get($parsed, 'supplier.trade_name'),
                'supplier_document' => data_get($parsed, 'supplier.document'),
                'supplier_state_registration' => data_get($parsed, 'supplier.state_registration'),
                'recipient_name' => data_get($parsed, 'recipient.name') ?: $this->activeFiscalProfile()?->company_name,
                'recipient_document' => data_get($parsed, 'recipient.document') ?: $this->activeFiscalProfile()?->cnpj,
                'products_total' => data_get($parsed, 'totals.products_total', 0),
                'freight_total' => data_get($parsed, 'totals.freight_total', 0),
                'invoice_total' => data_get($parsed, 'totals.invoice_total', 0),
                'metadata' => array_filter([
                    'supplier' => data_get($parsed, 'supplier'),
                    'recipient' => data_get($parsed, 'recipient'),
                    'summary_only' => (bool) data_get($parsed, 'metadata.summary_only', false),
                    'schema' => $parsed['schema'] ?? null,
                ], fn ($value) => $value !== null),
                'issued_at' => $parsed['issued_at'] ?? null,
                'authorized_at' => $parsed['authorized_at'] ?? null,
                'last_synced_at' => $source === 'sefaz_sync' ? now() : $existing?->last_synced_at,
            ])->save();

            $paths = ['xml' => $existing?->xml_path, 'danfe' => $existing?->danfe_path];

            if ($xml) {
                $paths = $this->storage->persist($this->tenantKey(), $document, [
                    'xml' => $xml,
                    'danfe' => $this->renderDanfe($xml),
                ]);
            }

            $document->forceFill([
                'xml_path' => $paths['xml'] ?? $document->xml_path,
                'danfe_path' => $paths['danfe'] ?? $document->danfe_path,
            ])->save();

            if (!data_get($parsed, 'metadata.summary_only')) {
                $existingMap = $existing ? $existing->items->keyBy('item_number') : collect();
                $document->items()->delete();
                $products = $this->activeProducts();

                foreach ($parsed['items'] as $itemData) {
                    $previous = $existingMap->get($itemData['item_number']);
                    $matched = $this->resolveProductMatch($itemData, $products, $previous);
                    $document->items()->create([
                        'purchase_item_id' => $previous?->purchase_item_id,
                        'product_id' => $matched['product_id'],
                        'item_number' => $itemData['item_number'],
                        'supplier_code' => $itemData['supplier_code'],
                        'barcode' => $itemData['barcode'],
                        'description' => $itemData['description'],
                        'ncm' => $itemData['ncm'],
                        'cfop' => $itemData['cfop'],
                        'unit' => $itemData['unit'],
                        'quantity' => $itemData['quantity'],
                        'unit_price' => $itemData['unit_price'],
                        'total_price' => $itemData['total_price'],
                        'match_status' => $matched['match_status'],
                        'match_type' => $matched['match_type'],
                        'match_confidence' => $matched['match_confidence'],
                        'validation_warnings' => $matched['validation_warnings'],
                        'metadata' => $matched['metadata'],
                    ]);
                }
            }

            $this->recalculateDocument($document->fresh(['items.product', 'purchase']));

            return $document->fresh(['supplier:id,name,document', 'purchase', 'items.product:id,name,code,barcode,ncm,cost_price']);
        });
    }

    protected function recalculateDocument(IncomingNfeDocument $document): void
    {
        $document->loadMissing(['items.product', 'purchase']);
        $items = $document->items;
        $matchedItems = $items->filter(fn (IncomingNfeItem $item) => filled($item->product_id))->count();
        $pendingItems = $items->count() - $matchedItems;
        $alerts = $items
            ->flatMap(fn (IncomingNfeItem $item) => collect($item->validation_warnings ?? []))
            ->values();

        $document->forceFill([
            'status' => filled($document->purchase?->stock_applied_at)
                ? 'processed'
                : ((bool) data_get($document->metadata, 'summary_only')
                    ? 'summary_only'
                    : ($pendingItems > 0 ? 'pending_products' : 'ready')),
            'validation_snapshot' => [
                'matched_items' => $matchedItems,
                'pending_items' => $pendingItems,
                'new_products' => $items->where('match_status', 'pending')->count(),
                'price_changes' => $alerts->where('code', 'price_change')->count(),
                'ncm_mismatches' => $alerts->where('code', 'ncm_mismatch')->count(),
                'alerts' => $alerts->all(),
            ],
        ])->save();
    }

    protected function createProductFromItem(IncomingNfeItem $item, IncomingNfeDocument $document, array $data): Product
    {
        $preferredCode = $item->supplier_code;

        if (filled($preferredCode) && Product::query()->where('code', $preferredCode)->exists()) {
            $preferredCode = null;
        }

        return $this->productService->save(new Product(), [
            'code' => $preferredCode,
            'barcode' => $item->barcode,
            'name' => $item->description,
            'supplier_id' => $document->supplier_id,
            'unit' => $item->unit ?: 'UN',
            'commercial_unit' => $item->unit ?: 'UN',
            'taxable_unit' => $item->unit ?: 'UN',
            'cost_price' => round((float) $item->unit_price, 2),
            'sale_price' => round((float) ($data['sale_price'] ?? $item->unit_price), 2),
            'stock_quantity' => 0,
            'min_stock' => 0,
            'active' => true,
            'fiscal_enabled' => true,
            'ncm' => $item->ncm,
            'cfop' => $item->cfop,
        ]);
    }

    protected function applyItemMapping(IncomingNfeItem $item, Product $product, string $matchType, float $confidence): void
    {
        $item->forceFill([
            'product_id' => $product->id,
            'match_status' => 'matched',
            'match_type' => $matchType,
            'match_confidence' => $confidence,
            'validation_warnings' => $this->buildWarnings($product, $item->toArray()),
            'metadata' => array_merge((array) $item->metadata, [
                'suggested_product_id' => $product->id,
                'suggested_product_name' => $product->name,
            ]),
        ])->save();
    }

    protected function updateProductCost(Product $product, float $quantity, float $unitCost, string $costMethod, ?int $supplierId, IncomingNfeItem $incomingItem): void
    {
        $currentStock = round((float) $product->stock_quantity, 3);
        $currentCost = round((float) $product->cost_price, 4);
        $resolvedCost = $costMethod === 'average_cost' && ($currentStock + $quantity) > 0
            ? round((($currentStock * $currentCost) + ($quantity * $unitCost)) / ($currentStock + $quantity), 4)
            : round($unitCost, 4);

        $payload = [
            'cost_price' => round($resolvedCost, 2),
            'supplier_id' => $product->supplier_id ?: $supplierId,
        ];

        if (!$product->ncm && $incomingItem->ncm) {
            $payload['ncm'] = $incomingItem->ncm;
        }

        if (!$product->cfop && $incomingItem->cfop) {
            $payload['cfop'] = $incomingItem->cfop;
        }

        $product->forceFill($payload)->save();
    }

    protected function resolveProductMatch(array $item, Collection $products, ?IncomingNfeItem $previous = null): array
    {
        if ($previous && filled($previous->product_id) && in_array($previous->match_type, ['manual_link', 'auto_create'], true)) {
            $product = $products->firstWhere('id', $previous->product_id);

            if ($product) {
                return [
                    'product_id' => $product->id,
                    'match_status' => 'matched',
                    'match_type' => $previous->match_type,
                    'match_confidence' => 100,
                    'validation_warnings' => $this->buildWarnings($product, $item),
                    'metadata' => [
                        'suggested_product_id' => $product->id,
                        'suggested_product_name' => $product->name,
                    ],
                ];
            }
        }

        if (filled($item['supplier_code'] ?? null)) {
            $product = $products->firstWhere('code', $item['supplier_code']);

            if ($product) {
                return [
                    'product_id' => $product->id,
                    'match_status' => 'matched',
                    'match_type' => 'code',
                    'match_confidence' => 100,
                    'validation_warnings' => $this->buildWarnings($product, $item),
                    'metadata' => [
                        'suggested_product_id' => $product->id,
                        'suggested_product_name' => $product->name,
                    ],
                ];
            }
        }

        if (filled($item['barcode'] ?? null)) {
            $product = $products->firstWhere('barcode', $item['barcode']);

            if ($product) {
                return [
                    'product_id' => $product->id,
                    'match_status' => 'matched',
                    'match_type' => 'barcode',
                    'match_confidence' => 100,
                    'validation_warnings' => $this->buildWarnings($product, $item),
                    'metadata' => [
                        'suggested_product_id' => $product->id,
                        'suggested_product_name' => $product->name,
                    ],
                ];
            }
        }

        $normalizedItem = $this->normalizeText((string) ($item['description'] ?? ''));
        $bestProduct = null;
        $bestScore = 0.0;

        foreach ($products as $product) {
            similar_text($normalizedItem, $this->normalizeText((string) $product->name), $score);

            if ($score > $bestScore) {
                $bestProduct = $product;
                $bestScore = round((float) $score, 2);
            }
        }

        if ($bestProduct && $bestScore >= 88) {
            return [
                'product_id' => $bestProduct->id,
                'match_status' => 'matched',
                'match_type' => 'description',
                'match_confidence' => $bestScore,
                'validation_warnings' => $this->buildWarnings($bestProduct, $item),
                'metadata' => [
                    'suggested_product_id' => $bestProduct->id,
                    'suggested_product_name' => $bestProduct->name,
                ],
            ];
        }

        return [
            'product_id' => null,
            'match_status' => 'pending',
            'match_type' => $bestProduct ? 'description_suggestion' : null,
            'match_confidence' => $bestProduct ? $bestScore : null,
            'validation_warnings' => $this->buildWarnings(null, $item),
            'metadata' => $bestProduct ? [
                'suggested_product_id' => $bestProduct->id,
                'suggested_product_name' => $bestProduct->name,
            ] : [],
        ];
    }

    protected function buildWarnings(?Product $product, array $item): array
    {
        if (!$product) {
            return [[
                'code' => 'product_missing',
                'message' => 'Produto ainda nao cadastrado no sistema.',
            ]];
        }

        $warnings = [];
        $itemCost = round((float) ($item['unit_price'] ?? 0), 2);
        $productCost = round((float) $product->cost_price, 2);

        if (abs($itemCost - $productCost) >= 0.01) {
            $warnings[] = [
                'code' => 'price_change',
                'message' => sprintf('Preco de custo atual %0.2f difere da NF-e %0.2f.', $productCost, $itemCost),
            ];
        }

        if (filled($product->ncm) && filled($item['ncm'] ?? null) && $product->ncm !== $item['ncm']) {
            $warnings[] = [
                'code' => 'ncm_mismatch',
                'message' => sprintf('NCM cadastrado %s difere do XML %s.', $product->ncm, $item['ncm']),
            ];
        }

        return $warnings;
    }

    protected function findSupplier(array $parsed): ?Supplier
    {
        $document = data_get($parsed, 'supplier.document');

        if (filled($document)) {
            return Supplier::query()->where('document', $document)->first();
        }

        return Supplier::query()
            ->where('name', data_get($parsed, 'supplier.name'))
            ->first();
    }

    protected function activeProducts(): Collection
    {
        return Product::query()
            ->where('active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'barcode', 'ncm', 'cfop', 'cost_price', 'stock_quantity', 'supplier_id']);
    }

    protected function guardRecipientDocument(?string $document): void
    {
        $expected = $this->activeFiscalProfile()?->cnpj;
        $normalized = preg_replace('/\D+/', '', (string) $document);

        if (!$expected) {
            throw ValidationException::withMessages([
                'recipient' => 'Configure um perfil fiscal ativo com o CNPJ da empresa para importar NF-e recebida.',
            ]);
        }

        if ($normalized !== '' && $normalized !== $expected) {
            throw ValidationException::withMessages([
                'recipient' => 'A NF-e selecionada nao pertence a empresa destinataria configurada neste tenant.',
            ]);
        }
    }

    protected function activeFiscalProfile(): ?FiscalProfile
    {
        return FiscalProfile::query()->where('active', true)->first();
    }

    protected function lastNsu(): int
    {
        return (int) data_get(
            AppSetting::query()->where('key', 'incoming_nfe.last_nsu')->value('payload'),
            'last_nsu',
            0,
        );
    }

    protected function storeLastNsu(string $lastNsu): void
    {
        AppSetting::query()->updateOrCreate(
            ['key' => 'incoming_nfe.last_nsu'],
            ['payload' => ['last_nsu' => $lastNsu]],
        );
    }

    protected function tenantKey(): string
    {
        return (string) (tenant()?->getTenantKey() ?? 'local');
    }

    protected function nextPurchaseCode(): string
    {
        $datePrefix = now()->format('Ymd');
        $sequence = Purchase::query()->count() + 1;

        do {
            $code = sprintf('CMP-%s-%04d', $datePrefix, $sequence);
            $sequence++;
        } while (Purchase::query()->where('code', $code)->exists());

        return $code;
    }

    protected function normalizeText(string $value): string
    {
        return Str::lower(trim(Str::ascii($value)));
    }

    protected function renderDanfe(string $xml): ?string
    {
        try {
            return $this->danfePdfRenderer->render($xml);
        } catch (\Throwable) {
            return null;
        }
    }
}
