<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\Company;
use App\Models\Tenant\Customer;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\Product;
use App\Models\Tenant\PurchaseReturn;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleItem;
use App\Models\Tenant\SaleReturn;
use App\Models\Tenant\Supplier;
use App\Models\Tenant\TaxRule;
use App\Support\Fiscal\NfcePaymentMapper;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class FiscalDocumentService
{
    protected array $schemaTableCache = [];

    protected array $schemaColumnCache = [];

    public function __construct(
        protected NfcePaymentMapper $paymentMapper,
        protected FiscalDocumentDispatchService $dispatchService,
        protected TaxRuleResolver $taxRuleResolver,
    ) {
    }

    protected function resolveTaxRule(?Product $product, ?string $cfop, FiscalProfile $profile): ?TaxRule
    {
        return $this->taxRuleResolver->resolve(
            $product?->ncm,
            $cfop,
            $profile->state,
            $profile->state,
            $this->regimeFromCrt($profile->crt),
        );
    }

    protected function regimeFromCrt(mixed $crt): ?string
    {
        return match ((string) $crt) {
            '1', '2' => 'simples',
            '3' => 'normal',
            default => null,
        };
    }

    public function issueFromSale(
        int $saleId,
        ?string $idempotencyKey = null,
        ?string $mode = null,
        ?array $recipient = null,
        ?string $contingencyReason = null,
    ): FiscalDocument {
        $document = DB::transaction(function () use ($saleId, $idempotencyKey, $mode, $recipient, $contingencyReason) {
            $sale = Sale::query()
                ->with($this->saleRelations())
                ->lockForUpdate()
                ->findOrFail($saleId);

            $documentModel = $this->resolveDocumentModel($sale);
            $profile = $this->resolveProfileForDocument($documentModel);

            if (! $profile) {
                throw ValidationException::withMessages([
                    'fiscal_profile' => $documentModel === '55'
                        ? 'Configure um perfil fiscal ativo especifico para NF-e modelo 55 antes de emitir.'
                        : 'Configure um perfil fiscal ativo especifico para NFC-e modelo 65 antes de emitir.',
                ]);
            }

            $resolvedMode = $this->resolveMode($profile, $documentModel, $mode);
            $localTest = $resolvedMode === 'local_test';
            $offlineContingency = $resolvedMode === 'contingency_offline';
            $normalizedContingencyReason = $offlineContingency
                ? $this->normalizeContingencyReason($contingencyReason)
                : null;
            $type = $this->documentTypeFor($documentModel, $localTest);
            $idempotencyKey = $idempotencyKey ?: sprintf('sale:%d:%s', $sale->id, $type);

            $existing = FiscalDocument::query()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return $existing;
            }

            $resolvedRecipient = $this->resolveConsumerPayload($sale, $recipient);

            $this->validateProfileForDocument($profile, $documentModel, requireTransmission: ! $localTest);
            $this->validateSaleForDocument($sale, $profile, $documentModel, $resolvedRecipient);

            $number = $localTest
                ? 900000 + (int) $sale->id
                : (int) $profile->next_number;

            if (! $localTest) {
                $profile->forceFill(['next_number' => $number + 1])->save();
            }

            $document = FiscalDocument::createCompatible([
                'sale_id' => $sale->id,
                'profile_id' => $profile->id,
                'type' => $type,
                'status' => 'queued',
                'idempotency_key' => $idempotencyKey,
                'environment' => (int) $profile->environment,
                'series' => (int) $profile->series,
                'number' => $number,
                'contingency_reason' => $normalizedContingencyReason,
                'contingency_requested_at' => $offlineContingency ? now() : null,
                'payload' => $this->buildPayload(
                    $sale,
                    $profile,
                    $number,
                    $documentModel,
                    $resolvedRecipient,
                    $resolvedMode,
                    $normalizedContingencyReason,
                ),
                'queued_at' => now(),
            ]);

            $document->events()->create([
                'status' => 'queued',
                'source' => 'backend',
                'message' => $localTest
                    ? 'Documento fiscal reservado e enviado para ensaio local.'
                    : ($offlineContingency
                        ? 'Documento fiscal reservado e enviado para contingencia offline legal.'
                        : 'Documento fiscal reservado e enviado para a fila de emissão.'),
            ]);

            return $document->fresh(['events']);
        });

        $this->dispatchService->dispatch((string) tenant()->getTenantKey(), $document->id);

        return $document->fresh(['events']);
    }

    public function prepareNfeFromSale(int $saleId, ?array $recipient = null): FiscalDocument
    {
        return DB::transaction(function () use ($saleId, $recipient) {
            $sale = Sale::query()
                ->lockForUpdate()
                ->findOrFail($saleId);

            if ($this->hasColumn('sales', 'requested_document_model')) {
                $sale->forceFill(['requested_document_model' => '55'])->save();
            }

            return $this->issueFromSale(
                $sale->id,
                sprintf('sale:%d:nfe', $sale->id),
                'sefaz',
                $recipient,
                null,
            );
        });
    }

    public function issueReturnForPurchase(PurchaseReturn $purchaseReturn, int $userId): FiscalDocument
    {
        $document = DB::transaction(function () use ($purchaseReturn) {
            $purchaseReturn->loadMissing(['items.product', 'purchase.incomingNfeDocument', 'supplier']);

            $idempotencyKey = sprintf('purchase_return:%d', $purchaseReturn->id);

            $existing = FiscalDocument::query()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return $existing;
            }

            $supplier = $purchaseReturn->supplier;
            $incomingDocument = $purchaseReturn->purchase->incomingNfeDocument;

            if (! $supplier) {
                throw ValidationException::withMessages([
                    'supplier' => 'Esta devolução não tem fornecedor vinculado para emitir a NF-e de devolução.',
                ]);
            }

            if (! $incomingDocument || blank($incomingDocument->access_key)) {
                throw ValidationException::withMessages([
                    'purchase' => 'Não foi encontrada a chave de acesso da NF-e de entrada original para referenciar na devolução.',
                ]);
            }

            $this->validateSupplierRecipient($supplier);

            $profile = $this->resolveProfileForDocument('55');

            if (! $profile) {
                throw ValidationException::withMessages([
                    'fiscal_profile' => 'Configure um perfil fiscal ativo especifico para NF-e modelo 55 antes de emitir a devolução.',
                ]);
            }

            $this->validateProfileForDocument($profile, '55', requireTransmission: true);

            $number = (int) $profile->next_number;
            $profile->forceFill(['next_number' => $number + 1])->save();

            return FiscalDocument::createCompatible([
                'sale_id' => null,
                'related_purchase_id' => $purchaseReturn->purchase_id,
                'profile_id' => $profile->id,
                'type' => 'nfe_return_purchase',
                'status' => 'queued',
                'idempotency_key' => $idempotencyKey,
                'environment' => (int) $profile->environment,
                'series' => (int) $profile->series,
                'number' => $number,
                'payload' => $this->buildPurchaseReturnPayload($purchaseReturn, $profile, $number, $supplier, $incomingDocument->access_key),
                'queued_at' => now(),
            ]);
        });

        if ($document->wasRecentlyCreated) {
            $document->events()->create([
                'status' => 'queued',
                'source' => 'backend',
                'message' => 'NF-e de devolução de compra reservada e enviada para a fila de emissão.',
            ]);

            $this->dispatchService->dispatch((string) tenant()->getTenantKey(), $document->id);
        }

        return $document->fresh(['events']);
    }

    protected function validateSupplierRecipient(Supplier $supplier): void
    {
        $missing = [];

        foreach ([
            'name' => 'nome/razão social',
            'document' => 'CPF/CNPJ',
            'street' => 'logradouro',
            'number' => 'número',
            'district' => 'bairro',
            'city_code' => 'código do município',
            'city_name' => 'município',
            'state' => 'UF',
            'zip_code' => 'CEP',
        ] as $field => $label) {
            if (blank($supplier->{$field})) {
                $missing[] = "Configure {$label} no cadastro do fornecedor antes de emitir a devolução.";
            }
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'supplier' => implode(' ', array_unique($missing)),
            ]);
        }
    }

    protected function buildPurchaseReturnPayload(
        PurchaseReturn $purchaseReturn,
        FiscalProfile $profile,
        int $number,
        Supplier $supplier,
        string $referencedAccessKey,
    ): array {
        $issuedAt = now()->format('Y-m-d\TH:i:sP');
        $randomCode = str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT);

        $items = $purchaseReturn->items->map(function ($item) use ($profile) {
            /** @var Product|null $product */
            $product = $item->product;
            $quantity = round((float) $item->quantity, 3);
            $lineTotal = round((float) $item->total, 2);
            $taxRule = $this->resolveTaxRule($product, $item->cfop, $profile);

            return [
                'code' => $product?->code ?: (string) $item->product_id,
                'barcode' => $product?->barcode,
                'name' => $product?->name ?: 'Item sem nome',
                'ncm' => $product?->ncm,
                'cfop' => $item->cfop,
                'cest' => $product?->cest,
                'origin_code' => $product?->origin_code ?: ($taxRule?->origin_code ?: '0'),
                'icms_csosn' => $product?->icms_csosn ?: ($taxRule?->csosn ?: '102'),
                'pis_cst' => $product?->pis_cst ?: ($taxRule?->pis_cst ?: '49'),
                'pis_base' => $lineTotal,
                'pis_amount' => 0.0,
                'pis_rate' => 0.0,
                'cofins_cst' => $product?->cofins_cst ?: ($taxRule?->cofins_cst ?: '49'),
                'cofins_base' => $lineTotal,
                'cofins_amount' => 0.0,
                'cofins_rate' => 0.0,
                'ipi_amount' => 0.0,
                'ibs_cbs_cst' => $product?->ibs_cbs_cst ?: ($taxRule?->ibs_cbs_cst),
                'c_class_trib' => $product?->c_class_trib ?: ($taxRule?->c_class_trib),
                'unit' => $product?->unit ?: 'UN',
                'commercial_unit' => $product?->commercial_unit ?: ($product?->unit ?: 'UN'),
                'taxable_unit' => $product?->taxable_unit ?: ($product?->unit ?: 'UN'),
                'quantity' => $quantity,
                'unit_price' => $quantity > 0 ? round($lineTotal / $quantity, 10) : 0.0,
                'line_subtotal' => $lineTotal,
                'discount_amount' => 0.0,
                'total' => $lineTotal,
                'tax_total' => 0.0,
            ];
        })->values()->all();

        $total = round($purchaseReturn->items->sum('total'), 2);

        return [
            'profile' => [
                'environment' => (int) $profile->environment,
                'invoice_model' => (string) $profile->invoice_model,
                'company_name' => $profile->company_name,
                'trade_name' => $profile->trade_name,
                'cnpj' => $profile->cnpj,
                'ie' => $profile->ie,
                'im' => $profile->im,
                'cnae' => $profile->cnae,
                'crt' => $profile->crt,
                'phone' => $profile->phone,
                'street' => $profile->street,
                'number' => $profile->number,
                'complement' => $profile->complement,
                'district' => $profile->district,
                'city_code' => $profile->city_code,
                'city_name' => $profile->city_name,
                'state' => $profile->state,
                'zip_code' => $profile->zip_code,
                'operation_nature' => 'DEVOLUCAO DE COMPRA',
                'csc_id' => $profile->csc_id,
                'csc_token' => $profile->csc_token,
                'technical_contact_name' => $profile->technical_contact_name,
                'technical_contact_email' => $profile->technical_contact_email,
                'technical_contact_phone' => $profile->technical_contact_phone,
                'technical_contact_cnpj' => $profile->technical_contact_cnpj,
            ],
            'sale' => [
                'number' => $number,
                'series' => (int) $profile->series,
                'random_code' => $randomCode,
                'issued_at' => $issuedAt,
                'total' => $total,
                'id_destination' => 2,
                'presence_indicator' => 9,
                'print_type' => 1,
                'emission_type' => 1,
                'consumer_final' => 0,
                'operation_type' => 1,
                'finalidade' => 4,
                'referencias' => [$referencedAccessKey],
            ],
            'items' => $items,
            'payments' => [[
                'tPag' => '90',
                'xPag' => 'Sem pagamento',
                'indPag' => 0,
                'amount' => 0.0,
                'xml_amount' => 0.0,
            ]],
            'consumer' => [
                'name' => $supplier->name,
                'document' => preg_replace('/\D+/', '', (string) $supplier->document),
                'ie_indicator' => filled($supplier->state_registration) ? 1 : 9,
                'state_registration' => $supplier->state_registration,
                'email' => $supplier->email,
                'phone' => $supplier->phone,
                'street' => $supplier->street,
                'number' => $supplier->number,
                'complement' => $supplier->complement,
                'district' => $supplier->district,
                'city_code' => $supplier->city_code,
                'city_name' => $supplier->city_name,
                'state' => $supplier->state,
                'zip_code' => $supplier->zip_code,
            ],
            'additional_info' => "Devolucao referente a compra {$purchaseReturn->purchase->code}. Motivo: {$purchaseReturn->reason}",
            'flags' => [
                'local_test' => false,
                'mode' => 'sefaz',
                'document_model' => '55',
                'offline_contingency' => false,
                'reforma_enabled' => (bool) $profile->reforma_enabled,
            ],
        ];
    }

    public function issueReturnForSale(SaleReturn $saleReturn, int $userId): FiscalDocument
    {
        $document = DB::transaction(function () use ($saleReturn) {
            $saleReturn->loadMissing(['items.product', 'sale']);

            $idempotencyKey = sprintf('sale_return:%d', $saleReturn->id);

            $existing = FiscalDocument::query()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return $existing;
            }

            $sale = $saleReturn->sale;

            $originalDocument = FiscalDocument::query()
                ->where('sale_id', $sale->id)
                ->whereIn('status', ['authorized', 'printed'])
                ->latest('id')
                ->first();

            if (! $originalDocument || blank($originalDocument->access_key)) {
                throw ValidationException::withMessages([
                    'sale' => 'Só é possível emitir devolução fiscal para uma venda com documento fiscal autorizado.',
                ]);
            }

            $recipient = $this->resolveConsumerPayload($sale);

            if (blank($recipient['document'] ?? null) || blank($recipient['name'] ?? null)) {
                throw ValidationException::withMessages([
                    'sale' => 'A devolução fiscal exige um cliente identificado (nome e CPF/CNPJ) na venda original.',
                ]);
            }

            $profile = $this->resolveProfileForDocument('55');

            if (! $profile) {
                throw ValidationException::withMessages([
                    'fiscal_profile' => 'Configure um perfil fiscal ativo especifico para NF-e modelo 55 antes de emitir a devolução.',
                ]);
            }

            $this->validateProfileForDocument($profile, '55', requireTransmission: true);

            $number = (int) $profile->next_number;
            $profile->forceFill(['next_number' => $number + 1])->save();

            return FiscalDocument::createCompatible([
                'sale_id' => null,
                'related_sale_id' => $sale->id,
                'origin_document_id' => $originalDocument->id,
                'profile_id' => $profile->id,
                'type' => 'nfe_return_sale',
                'status' => 'queued',
                'idempotency_key' => $idempotencyKey,
                'environment' => (int) $profile->environment,
                'series' => (int) $profile->series,
                'number' => $number,
                'payload' => $this->buildSaleReturnPayload($saleReturn, $profile, $number, $recipient, $originalDocument->access_key),
                'queued_at' => now(),
            ]);
        });

        if ($document->wasRecentlyCreated) {
            $document->events()->create([
                'status' => 'queued',
                'source' => 'backend',
                'message' => 'NF-e de devolução de venda reservada e enviada para a fila de emissão.',
            ]);

            $this->dispatchService->dispatch((string) tenant()->getTenantKey(), $document->id);
        }

        return $document->fresh(['events']);
    }

    protected function buildSaleReturnPayload(
        SaleReturn $saleReturn,
        FiscalProfile $profile,
        int $number,
        array $recipient,
        string $referencedAccessKey,
    ): array {
        $issuedAt = now()->format('Y-m-d\TH:i:sP');
        $randomCode = str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT);

        $items = $saleReturn->items->map(function ($item) use ($profile) {
            /** @var Product|null $product */
            $product = $item->product;
            $quantity = round((float) $item->quantity, 3);
            $lineTotal = round((float) $item->total, 2);
            $taxRule = $this->resolveTaxRule($product, $item->cfop, $profile);

            return [
                'code' => $product?->code ?: (string) $item->product_id,
                'barcode' => $product?->barcode,
                'name' => $product?->name ?: 'Item sem nome',
                'ncm' => $product?->ncm,
                'cfop' => $item->cfop,
                'cest' => $product?->cest,
                'origin_code' => $product?->origin_code ?: ($taxRule?->origin_code ?: '0'),
                'icms_csosn' => $product?->icms_csosn ?: ($taxRule?->csosn ?: '102'),
                'pis_cst' => $product?->pis_cst ?: ($taxRule?->pis_cst ?: '49'),
                'pis_base' => $lineTotal,
                'pis_amount' => 0.0,
                'pis_rate' => 0.0,
                'cofins_cst' => $product?->cofins_cst ?: ($taxRule?->cofins_cst ?: '49'),
                'cofins_base' => $lineTotal,
                'cofins_amount' => 0.0,
                'cofins_rate' => 0.0,
                'ipi_amount' => 0.0,
                'ibs_cbs_cst' => $product?->ibs_cbs_cst ?: ($taxRule?->ibs_cbs_cst),
                'c_class_trib' => $product?->c_class_trib ?: ($taxRule?->c_class_trib),
                'unit' => $product?->unit ?: 'UN',
                'commercial_unit' => $product?->commercial_unit ?: ($product?->unit ?: 'UN'),
                'taxable_unit' => $product?->taxable_unit ?: ($product?->unit ?: 'UN'),
                'quantity' => $quantity,
                'unit_price' => $quantity > 0 ? round($lineTotal / $quantity, 10) : 0.0,
                'line_subtotal' => $lineTotal,
                'discount_amount' => 0.0,
                'total' => $lineTotal,
                'tax_total' => 0.0,
            ];
        })->values()->all();

        $total = round($saleReturn->items->sum('total'), 2);

        return [
            'profile' => [
                'environment' => (int) $profile->environment,
                'invoice_model' => (string) $profile->invoice_model,
                'company_name' => $profile->company_name,
                'trade_name' => $profile->trade_name,
                'cnpj' => $profile->cnpj,
                'ie' => $profile->ie,
                'im' => $profile->im,
                'cnae' => $profile->cnae,
                'crt' => $profile->crt,
                'phone' => $profile->phone,
                'street' => $profile->street,
                'number' => $profile->number,
                'complement' => $profile->complement,
                'district' => $profile->district,
                'city_code' => $profile->city_code,
                'city_name' => $profile->city_name,
                'state' => $profile->state,
                'zip_code' => $profile->zip_code,
                'operation_nature' => 'DEVOLUCAO DE VENDA',
                'csc_id' => $profile->csc_id,
                'csc_token' => $profile->csc_token,
                'technical_contact_name' => $profile->technical_contact_name,
                'technical_contact_email' => $profile->technical_contact_email,
                'technical_contact_phone' => $profile->technical_contact_phone,
                'technical_contact_cnpj' => $profile->technical_contact_cnpj,
            ],
            'sale' => [
                'number' => $number,
                'series' => (int) $profile->series,
                'random_code' => $randomCode,
                'issued_at' => $issuedAt,
                'total' => $total,
                'id_destination' => 1,
                'presence_indicator' => 9,
                'print_type' => 1,
                'emission_type' => 1,
                'consumer_final' => 1,
                'operation_type' => 0,
                'finalidade' => 4,
                'referencias' => [$referencedAccessKey],
            ],
            'items' => $items,
            'payments' => [[
                'tPag' => '90',
                'xPag' => 'Sem pagamento',
                'indPag' => 0,
                'amount' => 0.0,
                'xml_amount' => 0.0,
            ]],
            'consumer' => $recipient,
            'additional_info' => "Devolucao referente a venda {$saleReturn->sale->sale_number}. Motivo: {$saleReturn->reason}",
            'flags' => [
                'local_test' => false,
                'mode' => 'sefaz',
                'document_model' => '55',
                'offline_contingency' => false,
                'reforma_enabled' => (bool) $profile->reforma_enabled,
            ],
        ];
    }

    public function retry(FiscalDocument $document): FiscalDocument
    {
        if (in_array($document->status, ['authorized', 'printed', 'signed_local', 'printed_local'], true)) {
            throw ValidationException::withMessages([
                'document' => 'Este documento fiscal já foi concluído e não pode ser reenfileirado.',
            ]);
        }

        $document->forceFillCompatible([
            'status' => 'queued',
            'last_error' => null,
            'failed_at' => null,
            'queued_at' => now(),
        ])->save();

        $document->events()->create([
            'status' => 'queued',
            'source' => 'backend',
            'message' => 'Documento reenfileirado para novo processamento.',
        ]);

        $this->dispatchService->dispatch((string) tenant()->getTenantKey(), $document->id);

        return $document->fresh(['events']);
    }

    public function buildLocalTestPayload(int $saleId): array
    {
        $sale = Sale::query()
            ->with($this->saleRelations())
            ->findOrFail($saleId);

        $profile = $this->resolveProfileForDocument('65');

        if (! $profile) {
            throw ValidationException::withMessages([
                'fiscal_profile' => 'Configure um perfil fiscal ativo de NFC-e antes do ensaio local.',
            ]);
        }

        $resolvedRecipient = $this->resolveConsumerPayload($sale);

        $this->validateProfileForDocument($profile, '65', requireTransmission: false);
        $this->validateSaleForDocument($sale, $profile, '65', $resolvedRecipient);

        $number = 900000 + (int) $sale->id;

        return $this->buildPayload($sale, $profile, $number, '65', $resolvedRecipient, 'local_test');
    }

    protected function resolveProfileForDocument(string $documentModel): ?FiscalProfile
    {
        $baseQuery = FiscalProfile::query()
            ->where('active', true)
            ->lockForUpdate();

        $exactMatch = (clone $baseQuery)
            ->where('invoice_model', $documentModel)
            ->orderByDesc('id')
            ->first();

        if ($exactMatch) {
            return $exactMatch;
        }

        if ($documentModel === '65' && (clone $baseQuery)->count() === 1) {
            return (clone $baseQuery)->first();
        }

        return null;
    }

    protected function resolveDocumentModel(Sale $sale): string
    {
        $documentModel = (string) ($this->saleValue($sale, 'requested_document_model') ?: '65');

        return in_array($documentModel, ['55', '65'], true) ? $documentModel : '65';
    }

    protected function resolveMode(FiscalProfile $profile, string $documentModel, ?string $mode = null): string
    {
        $mode = strtolower(trim((string) $mode));

        if ($mode === '' || $mode === 'auto') {
            $mode = 'sefaz';
        }

        if (! in_array($mode, ['sefaz', 'local_test', 'contingency_offline'], true)) {
            $mode = 'sefaz';
        }

        if ($documentModel !== '65' && in_array($mode, ['local_test', 'contingency_offline'], true)) {
            throw ValidationException::withMessages([
                'mode' => 'Os modos locais de contingencia e ensaio estao disponiveis apenas para NFC-e modelo 65.',
            ]);
        }

        return $mode;
    }

    protected function validateProfileForDocument(
        FiscalProfile $profile,
        string $documentModel,
        bool $requireTransmission = true,
    ): void {
        $missing = [];

        foreach ([
            'company_name' => 'razão social',
            'cnpj' => 'CNPJ',
            'ie' => 'inscrição estadual',
            'street' => 'logradouro',
            'number' => 'número',
            'district' => 'bairro',
            'city_code' => 'código do município',
            'city_name' => 'município',
            'state' => 'UF',
            'zip_code' => 'CEP',
            'operation_nature' => 'natureza da operação',
        ] as $field => $label) {
            if (blank($profile->{$field})) {
                $missing[] = "Configure {$label} no perfil fiscal.";
            }
        }

        if (! preg_match('/^\d{14}$/', (string) $profile->cnpj)) {
            $missing[] = 'O CNPJ do perfil fiscal precisa ter 14 digitos numéricos.';
        }

        if (! preg_match('/^\d{7}$/', (string) $profile->city_code)) {
            $missing[] = 'O código do município precisa ter 7 dígitos.';
        }

        if (! preg_match('/^\d{8}$/', (string) $profile->zip_code)) {
            $missing[] = 'O CEP do perfil fiscal precisa ter 8 digitos.';
        }

        if (! preg_match('/^[A-Z]{2}$/', strtoupper((string) $profile->state))) {
            $missing[] = 'A UF do perfil fiscal precisa ter duas letras validas.';
        }

        if ((int) $profile->environment < 1 || (int) $profile->environment > 2) {
            $missing[] = 'O ambiente fiscal precisa ser 1 (producao) ou 2 (homologacao).';
        }

        if ((int) $profile->series < 1 || (int) $profile->series > 999) {
            $missing[] = 'A serie fiscal precisa estar entre 1 e 999.';
        }

        if ((int) $profile->next_number < 1) {
            $missing[] = 'O próximo número fiscal precisa ser maior que zero.';
        }

        if ((string) $profile->invoice_model !== $documentModel) {
            $missing[] = "O perfil fiscal ativo precisa estar configurado para o modelo {$documentModel}.";
        }

        if (! in_array((string) $profile->crt, ['1', '2', '4'], true)) {
            $missing[] = 'O emissor atual suporta somente CRT 1, 2 ou 4. Regime normal ainda não está implementado neste fluxo.';
        }

        if (preg_match('/^\d{7}$/', (string) $profile->city_code)) {
            $expectedPrefix = $this->ufCode((string) $profile->state);

            if (substr((string) $profile->city_code, 0, 2) !== $expectedPrefix) {
                $missing[] = 'O código IBGE do município não corresponde à UF configurada no perfil fiscal.';
            }
        }

        if ($documentModel === '65' && $requireTransmission && (blank($profile->csc_id) || blank($profile->csc_token))) {
            $missing[] = 'Configure CSC ID e CSC Token do ambiente NFC-e antes de transmitir.';
        }

        if ($requireTransmission) {
            foreach ([
                'technical_contact_name' => 'nome do responsóvel técnico',
                'technical_contact_email' => 'email do responsóvel técnico',
                'technical_contact_phone' => 'telefone do responsóvel técnico',
                'technical_contact_cnpj' => 'CNPJ do responsóvel técnico',
            ] as $field => $label) {
                if (blank($profile->{$field})) {
                    $missing[] = "Configure {$label} no perfil fiscal.";
                }
            }

            if (
                filled($profile->technical_contact_email)
                && filter_var((string) $profile->technical_contact_email, FILTER_VALIDATE_EMAIL) === false
            ) {
                $missing[] = 'O e-mail do responsóvel técnico precisa ser válido.';
            }

            if (
                filled($profile->technical_contact_cnpj)
                && ! preg_match('/^\d{14}$/', (string) $profile->technical_contact_cnpj)
            ) {
                $missing[] = 'O CNPJ do responsóvel técnico precisa ter 14 digitos numéricos.';
            }

            if (
                filled($profile->technical_contact_phone)
                && ! preg_match('/^\d{10,11}$/', (string) $profile->technical_contact_phone)
            ) {
                $missing[] = 'O telefone do responsóvel técnico precisa ter 10 ou 11 digitos.';
            }
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'fiscal_profile' => implode(' ', array_unique($missing)),
            ]);
        }
    }

    protected function buildPayload(
        Sale $sale,
        FiscalProfile $profile,
        int $number,
        string $documentModel,
        array $recipient,
        string $mode = 'sefaz',
        ?string $contingencyReason = null,
    ): array {
        $localTest = $mode === 'local_test';
        $offlineContingency = $mode === 'contingency_offline';
        $issuedAt = now()->format('Y-m-d\TH:i:sP');
        $randomCode = str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT);
        $notes = trim((string) $sale->notes);
        $changeAmount = $this->saleChangeAmount($sale);
        $subtotal = round((float) $sale->subtotal, 2);
        $discount = round((float) $sale->discount, 2);
        $total = round((float) $sale->total, 2);
        $consumerFinal = $documentModel === '65'
            ? true
            : ($recipient['consumer_final'] ?? true);
        $resolvedContingencyReason = $offlineContingency
            ? $this->normalizeContingencyReason($contingencyReason)
            : null;

        if ($localTest) {
            $notes = trim(implode(' | ', array_filter([
                $notes,
                'ENSAIO LOCAL NFC-E SEM TRANSMISSAO SEFAZ',
            ])));
        } elseif ($offlineContingency) {
            $notes = trim(implode(' | ', array_filter([
                $notes,
                'NFC-E EMITIDA EM CONTINGENCIA OFFLINE LEGAL',
            ])));
        }

        return [
            'profile' => [
                'environment' => (int) $profile->environment,
                'invoice_model' => (string) $profile->invoice_model,
                'company_name' => $profile->company_name,
                'trade_name' => $profile->trade_name,
                'cnpj' => $profile->cnpj,
                'ie' => $profile->ie,
                'im' => $profile->im,
                'cnae' => $profile->cnae,
                'crt' => $profile->crt,
                'phone' => $profile->phone,
                'street' => $profile->street,
                'number' => $profile->number,
                'complement' => $profile->complement,
                'district' => $profile->district,
                'city_code' => $profile->city_code,
                'city_name' => $profile->city_name,
                'state' => $profile->state,
                'zip_code' => $profile->zip_code,
                'operation_nature' => $profile->operation_nature,
                'csc_id' => $profile->csc_id,
                'csc_token' => $profile->csc_token,
                'technical_contact_name' => $profile->technical_contact_name,
                'technical_contact_email' => $profile->technical_contact_email,
                'technical_contact_phone' => $profile->technical_contact_phone,
                'technical_contact_cnpj' => $profile->technical_contact_cnpj,
            ],
            'sale' => [
                'id' => $sale->id,
                'number' => $number,
                'series' => (int) $profile->series,
                'random_code' => $randomCode,
                'sale_number' => $sale->sale_number,
                'issued_at' => $issuedAt,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'change_amount' => $changeAmount,
                'requested_document_model' => $documentModel,
                'id_destination' => $this->resolveDestinationIndicator($profile, $recipient),
                'presence_indicator' => 1,
                'print_type' => $documentModel === '65' ? 4 : 1,
                'emission_type' => $offlineContingency ? 9 : 1,
                'dh_contingency' => $offlineContingency ? $issuedAt : null,
                'contingency_reason' => $resolvedContingencyReason,
                'consumer_final' => $consumerFinal ? 1 : 0,
                'operation_type' => (int) ($this->saleValue($sale, 'fiscal_operation_type') ?? 1),
                'finalidade' => (int) ($this->saleValue($sale, 'fiscal_finalidade') ?: 1),
                'referencias' => (array) ($this->saleValue($sale, 'fiscal_reference_access_keys') ?: []),
            ],
            'items' => $sale->items->map(function (SaleItem $item) use ($profile) {
                /** @var Product|null $product */
                $product = $item->product;
                $quantity = round((float) $item->quantity, 3);
                $discountAmount = $this->saleItemDiscountAmount($item);
                $lineTotal = round((float) $item->total, 2);
                $lineSubtotal = round($lineTotal + $discountAmount, 2);
                $grossUnitPrice = $quantity > 0 ? $lineSubtotal / $quantity : (float) $item->unit_price;
                $taxRule = $this->resolveTaxRule($product, $product?->cfop, $profile);
                $pisBase = $lineTotal;
                $pisRate = $product?->pis_rate !== null ? (float) $product->pis_rate : (float) ($taxRule?->pis_rate ?? 0);
                $cofinsRate = $product?->cofins_rate !== null ? (float) $product->cofins_rate : (float) ($taxRule?->cofins_rate ?? 0);
                $icmsRate = $product?->icms_rate !== null ? (float) $product->icms_rate : (float) ($taxRule?->icms_rate ?? 0);
                $pisCst = (string) ($product?->pis_cst ?: ($taxRule?->pis_cst ?: '49'));
                $cofinsCst = (string) ($product?->cofins_cst ?: ($taxRule?->cofins_cst ?: '49'));
                $pisAmount = $this->calculateContributionAmount($pisBase, $pisRate, $pisCst);
                $cofinsAmount = $this->calculateContributionAmount($lineTotal, $cofinsRate, $cofinsCst);

                return [
                    'code' => $product?->code ?: (string) $item->product_id,
                    'barcode' => $product?->barcode,
                    'name' => $product?->name ?: 'Item sem nome',
                    'fiscal_enabled' => (bool) ($product?->fiscal_enabled ?? true),
                    'ncm' => $product?->ncm,
                    'cfop' => $product?->cfop,
                    'cest' => $product?->cest,
                    'origin_code' => $product?->origin_code ?: ($taxRule?->origin_code ?: '0'),
                    'icms_csosn' => $product?->icms_csosn ?: ($taxRule?->csosn ?: '102'),
                    'icms_rate' => $icmsRate,
                    'pis_cst' => $pisCst,
                    'pis_rate' => $pisRate,
                    'pis_base' => $pisBase,
                    'pis_amount' => $pisAmount,
                    'cofins_cst' => $cofinsCst,
                    'cofins_rate' => $cofinsRate,
                    'cofins_base' => $lineTotal,
                    'cofins_amount' => $cofinsAmount,
                    'ipi_rate' => (float) ($product?->ipi_rate ?? 0),
                    'ipi_base' => 0.0,
                    'ipi_amount' => 0.0,
                    'ibs_cbs_cst' => $product?->ibs_cbs_cst ?: ($taxRule?->ibs_cbs_cst),
                    'c_class_trib' => $product?->c_class_trib ?: ($taxRule?->c_class_trib),
                    'unit' => $product?->unit ?: 'UN',
                    'commercial_unit' => $product?->commercial_unit ?: ($product?->unit ?: 'UN'),
                    'taxable_unit' => $product?->taxable_unit ?: ($product?->unit ?: 'UN'),
                    'quantity' => $quantity,
                    'unit_price' => round($grossUnitPrice, 10),
                    'line_subtotal' => $lineSubtotal,
                    'discount_amount' => $discountAmount,
                    'total' => $lineTotal,
                    'tax_total' => round($pisAmount + $cofinsAmount, 2),
                ];
            })->values()->all(),
            'payments' => $sale->payments->map(function ($payment) {
                $mapped = $this->paymentMapper->toTpag((string) $payment->payment_method);
                $amount = round((float) $payment->amount, 2);

                return [
                    'method' => $payment->payment_method,
                    'amount' => $amount,
                    'xml_amount' => $mapped['requires_zero_value'] ? 0.0 : $amount,
                    'tPag' => $mapped['tPag'],
                    'xPag' => $mapped['xPag'],
                    'indPag' => (int) ($mapped['indPag'] ?? 0),
                    'requires_zero_value' => (bool) ($mapped['requires_zero_value'] ?? false),
                ];
            })->values()->all(),
            'consumer' => $recipient,
            'additional_info' => $notes,
            'flags' => [
                'local_test' => $localTest,
                'mode' => $mode,
                'document_model' => $documentModel,
                'offline_contingency' => $offlineContingency,
                'offline_contingency_stage' => $offlineContingency ? 'issue' : null,
                'reforma_enabled' => (bool) $profile->reforma_enabled,
            ],
        ];
    }

    protected function normalizeContingencyReason(?string $reason): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', (string) $reason) ?? '');

        if (mb_strlen($normalized) < 15) {
            $normalized = 'FALHA DE COMUNICACAO E EMISSAO EM CONTINGENCIA OFFLINE';
        }

        return mb_substr($normalized, 0, 255);
    }

    protected function resolveConsumerPayload(Sale $sale, ?array $override = null): array
    {
        $payload = is_array($override) && $override !== []
            ? $override
            : (is_array($this->saleValue($sale, 'recipient_payload')) ? $this->saleValue($sale, 'recipient_payload') : []);

        $manualRecipient = $this->normalizeRecipient([
            'name' => $payload['name'] ?? null,
            'document' => $payload['document'] ?? null,
            'email' => $payload['email'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'state_registration' => $payload['state_registration'] ?? null,
            'ie_indicator' => $payload['ie_indicator'] ?? null,
            'street' => $payload['street'] ?? null,
            'number' => $payload['number'] ?? null,
            'complement' => $payload['complement'] ?? null,
            'district' => $payload['district'] ?? null,
            'city_name' => $payload['city_name'] ?? null,
            'city_code' => $payload['city_code'] ?? null,
            'state' => $payload['state'] ?? null,
            'zip_code' => $payload['zip_code'] ?? null,
            'consumer_final' => $payload['consumer_final'] ?? null,
        ]);

        if (($payload['type'] ?? null) === 'consumer_final') {
            return $this->normalizeRecipient([
                'consumer_final' => true,
            ]);
        }

        if (($payload['type'] ?? null) === 'document' || (filled($manualRecipient['name'] ?? null) && filled($manualRecipient['document'] ?? null))) {
            return $manualRecipient;
        }

        if ($this->supportsCompanyRecipients() && (filled($payload['company_id'] ?? null) || ($payload['type'] ?? null) === 'company')) {
            if ($sale->company) {
                return $this->normalizeCompanyRecipient($sale->company, $manualRecipient);
            }
        }

        if (filled($payload['customer_id'] ?? null) || ($payload['type'] ?? null) === 'customer') {
            if ($sale->customer) {
                return $this->normalizeCustomerRecipient($sale->customer, $manualRecipient);
            }
        }

        return $manualRecipient;
    }

    protected function saleRelations(): array
    {
        $relations = ['items.product', 'payments', 'customer'];

        if ($this->supportsCompanyRecipients()) {
            $relations[] = 'company';
        }

        return $relations;
    }

    protected function supportsCompanyRecipients(): bool
    {
        return $this->hasTable('companies') && $this->hasColumn('sales', 'company_id');
    }

    protected function saleValue(Sale $sale, string $column): mixed
    {
        return $this->hasColumn('sales', $column)
            ? $sale->getAttribute($column)
            : null;
    }

    protected function saleChangeAmount(Sale $sale): float
    {
        if ($this->hasColumn('sales', 'change_amount')) {
            return round((float) ($sale->getAttribute('change_amount') ?? 0), 2);
        }

        return 0.0;
    }

    protected function saleItemDiscountAmount(SaleItem $item): float
    {
        if ($this->hasColumn('sale_items', 'discount_amount')) {
            return round((float) ($item->getAttribute('discount_amount') ?? 0), 2);
        }

        return 0.0;
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

    protected function validateSaleForDocument(
        Sale $sale,
        FiscalProfile $profile,
        string $documentModel,
        array $recipient,
    ): void {
        if ($sale->items->isEmpty()) {
            throw ValidationException::withMessages([
                'sale' => 'A venda precisa ter itens para emissão fiscal.',
            ]);
        }

        $missing = [];
        $allowedCsosn = ['102', '103', '300', '400'];

        foreach ($sale->items as $item) {
            $product = $item->product;

            if (! $product) {
                $missing[] = "Produto vinculado ao item {$item->id} não encontrado.";
                continue;
            }

            if (array_key_exists('fiscal_enabled', $product->getAttributes()) && ! $product->fiscal_enabled) {
                $missing[] = "Produto {$product->name} está com movimentação fiscal desativada e não pode ser emitido.";
                continue;
            }

            if (! $product->ncm || ! preg_match('/^\d{8}$/', (string) $product->ncm)) {
                $missing[] = "Produto {$product->name} precisa ter NCM com 8 digitos.";
            }

            if (! $product->cfop || ! preg_match('/^\d{4}$/', (string) $product->cfop)) {
                $missing[] = "Produto {$product->name} precisa ter CFOP com 4 digitos.";
            }

            $taxRule = $this->resolveTaxRule($product, $product->cfop, $profile);
            $effectiveOriginCode = filled($product->origin_code) ? $product->origin_code : $taxRule?->origin_code;
            $effectiveCsosn = filled($product->icms_csosn) ? $product->icms_csosn : $taxRule?->csosn;

            if (blank($effectiveOriginCode) || ! preg_match('/^[0-8]$/', (string) $effectiveOriginCode)) {
                $missing[] = "Produto {$product->name} precisa ter origem da mercadoria valida.";
            }

            if (blank($product->commercial_unit) && blank($product->unit)) {
                $missing[] = "Produto {$product->name} precisa ter unidade comercial configurada.";
            }

            if (blank($product->taxable_unit) && blank($product->unit)) {
                $missing[] = "Produto {$product->name} precisa ter unidade tributavel configurada.";
            }

            if (! in_array((string) $effectiveCsosn, $allowedCsosn, true)) {
                $missing[] = "Produto {$product->name} usa CSOSN não suportado pelo emissor atual.";
            }
        }

        $paymentsTotal = round((float) $sale->payments->sum('amount'), 2);

        if ($paymentsTotal <= 0) {
            $missing[] = 'A venda precisa ter pagamentos válidos para emissão fiscal.';
        } elseif ($paymentsTotal !== round((float) $sale->total, 2)) {
            $missing[] = 'A soma dos pagamentos da venda precisa ser igual ao total antes da emissão fiscal.';
        }

        foreach ($sale->payments as $payment) {
            $mapped = $this->paymentMapper->toTpag((string) $payment->payment_method);

            if (($mapped['tPag'] ?? '99') === '99') {
                $missing[] = sprintf(
                    'A forma de pagamento "%s" ainda não possui mapeamento fiscal válido para a SEFAZ.',
                    (string) $payment->payment_method,
                );
            }
        }

        if ($documentModel === '55') {
            $this->validateIdentifiedRecipient($recipient, $missing);
        } elseif (
            (filled($recipient['name'] ?? null) || filled($recipient['document'] ?? null))
            && (blank($recipient['name'] ?? null) || blank($recipient['document'] ?? null))
        ) {
            $missing[] = 'Quando houver identificacao do consumidor na NFC-e, informe nome e CPF/CNPJ juntos.';
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'products' => implode(' ', array_unique($missing)),
            ]);
        }
    }

    protected function validateIdentifiedRecipient(array $recipient, array &$missing): void
    {
        foreach ([
            'name' => 'nome ou razao social',
            'document' => 'CPF/CNPJ',
            'street' => 'logradouro',
            'number' => 'número',
            'district' => 'bairro',
            'city_code' => 'código do município',
            'city_name' => 'município',
            'state' => 'UF',
            'zip_code' => 'CEP',
        ] as $field => $label) {
            if (blank($recipient[$field] ?? null)) {
                $missing[] = "Informe {$label} do destinatario para emitir NF-e.";
            }
        }

        $document = (string) ($recipient['document'] ?? '');

        if ($document !== '' && ! preg_match('/^\d{11}$|^\d{14}$/', $document)) {
            $missing[] = 'O destinatário da NF-e precisa ter CPF ou CNPJ numérico válido.';
        }

        if (filled($recipient['city_code'] ?? null) && ! preg_match('/^\d{7}$/', (string) $recipient['city_code'])) {
            $missing[] = 'O código do município do destinatário precisa ter 7 dígitos.';
        }

        if (filled($recipient['zip_code'] ?? null) && ! preg_match('/^\d{8}$/', (string) $recipient['zip_code'])) {
            $missing[] = 'O CEP do destinatario precisa ter 8 digitos.';
        }

        if (filled($recipient['state'] ?? null) && ! preg_match('/^[A-Z]{2}$/', strtoupper((string) $recipient['state']))) {
            $missing[] = 'A UF do destinatario precisa ter duas letras validas.';
        }

        if (
            filled($recipient['city_code'] ?? null)
            && filled($recipient['state'] ?? null)
            && substr((string) $recipient['city_code'], 0, 2) !== $this->ufCode((string) $recipient['state'])
        ) {
            $missing[] = 'O código IBGE do destinatário não corresponde à UF informada.';
        }
    }

    protected function normalizeCompanyRecipient(Company $company, array $override = []): array
    {
        return $this->normalizeRecipient([
            'name' => $override['name'] ?? ($company->trade_name ?: $company->name),
            'document' => $override['document'] ?? $company->document,
            'email' => $override['email'] ?? $company->email,
            'phone' => $override['phone'] ?? $company->phone,
            'state_registration' => $override['state_registration'] ?? $company->state_registration,
            'ie_indicator' => $override['ie_indicator'] ?? (filled($company->state_registration) ? '1' : '9'),
            'street' => $override['street'] ?? $company->street,
            'number' => $override['number'] ?? $company->number,
            'complement' => $override['complement'] ?? $company->complement,
            'district' => $override['district'] ?? $company->district,
            'city_name' => $override['city_name'] ?? $company->city_name,
            'city_code' => $override['city_code'] ?? $company->city_code,
            'state' => $override['state'] ?? $company->state,
            'zip_code' => $override['zip_code'] ?? $company->zip_code,
            'consumer_final' => $override['consumer_final'] ?? ! filled($company->state_registration),
        ]);
    }

    protected function normalizeCustomerRecipient(Customer $customer, array $override = []): array
    {
        return $this->normalizeRecipient([
            'name' => $override['name'] ?? $customer->name,
            'document' => $override['document'] ?? $customer->document,
            'email' => $override['email'] ?? $customer->email,
            'phone' => $override['phone'] ?? $customer->phone,
            'state_registration' => $override['state_registration'] ?? $customer->state_registration,
            'ie_indicator' => $override['ie_indicator'] ?? (filled($customer->state_registration) ? '1' : '9'),
            'street' => $override['street'] ?? $customer->street,
            'number' => $override['number'] ?? $customer->number,
            'complement' => $override['complement'] ?? $customer->complement,
            'district' => $override['district'] ?? $customer->district,
            'city_name' => $override['city_name'] ?? $customer->city_name,
            'city_code' => $override['city_code'] ?? $customer->city_code,
            'state' => $override['state'] ?? $customer->state,
            'zip_code' => $override['zip_code'] ?? $customer->zip_code,
            'consumer_final' => $override['consumer_final'] ?? ($customer->consumer_final ?? true),
        ]);
    }

    protected function normalizeRecipient(array $payload): array
    {
        $document = filled($payload['document'] ?? null)
            ? preg_replace('/\D+/', '', (string) $payload['document'])
            : null;
        $stateRegistration = filled($payload['state_registration'] ?? null)
            ? strtoupper(trim((string) $payload['state_registration']))
            : null;
        $ieIndicator = filled($payload['ie_indicator'] ?? null)
            ? (string) $payload['ie_indicator']
            : null;

        if (! in_array($ieIndicator, ['1', '2', '9'], true)) {
            $ieIndicator = filled($stateRegistration) ? '1' : '9';
        }

        $consumerFinal = array_key_exists('consumer_final', $payload)
            ? filter_var($payload['consumer_final'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
            : null;

        if ($consumerFinal === null) {
            $consumerFinal = $document !== null && strlen($document) <= 11;
        }

        return [
            'name' => filled($payload['name'] ?? null) ? trim((string) $payload['name']) : null,
            'document' => $document,
            'email' => filled($payload['email'] ?? null) ? trim((string) $payload['email']) : null,
            'phone' => filled($payload['phone'] ?? null)
                ? preg_replace('/\D+/', '', (string) $payload['phone'])
                : null,
            'state_registration' => $stateRegistration,
            'ie_indicator' => $ieIndicator,
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
            'consumer_final' => $consumerFinal,
        ];
    }

    protected function calculateContributionAmount(float $base, float $rate, string $cst): float
    {
        if (! in_array($cst, ['01', '02'], true) || $rate <= 0) {
            return 0.0;
        }

        return round(($base * $rate) / 100, 2);
    }

    protected function resolveDestinationIndicator(FiscalProfile $profile, array $recipient): int
    {
        $recipientState = strtoupper((string) ($recipient['state'] ?? ''));
        $issuerState = strtoupper((string) $profile->state);

        if ($recipientState === '' || $recipientState === $issuerState) {
            return 1;
        }

        return 2;
    }

    protected function documentTypeFor(string $documentModel, bool $localTest): string
    {
        if ($documentModel === '55') {
            return 'nfe';
        }

        return $localTest ? 'nfce_local_test' : 'nfce';
    }

    protected function ufCode(string $uf): string
    {
        return match (strtoupper($uf)) {
            'RO' => '11',
            'AC' => '12',
            'AM' => '13',
            'RR' => '14',
            'PA' => '15',
            'AP' => '16',
            'TO' => '17',
            'MA' => '21',
            'PI' => '22',
            'CE' => '23',
            'RN' => '24',
            'PB' => '25',
            'PE' => '26',
            'AL' => '27',
            'SE' => '28',
            'BA' => '29',
            'MG' => '31',
            'ES' => '32',
            'RJ' => '33',
            'SP' => '35',
            'PR' => '41',
            'SC' => '42',
            'RS' => '43',
            'MS' => '50',
            'MT' => '51',
            'GO' => '52',
            'DF' => '53',
            default => '00',
        };
    }
}
