<?php

namespace App\Services\Tenant\Fiscal;

use App\Jobs\Tenant\QueueFiscalDocumentForEmission;
use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\FiscalProfile;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
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
    ) {
    }

    public function issueFromSale(int $saleId, ?string $idempotencyKey = null, ?string $mode = null): FiscalDocument
    {
        return DB::transaction(function () use ($saleId, $idempotencyKey, $mode) {
            $sale = Sale::query()
                ->with($this->saleRelations())
                ->lockForUpdate()
                ->findOrFail($saleId);

            $profile = FiscalProfile::query()
                ->where('active', true)
                ->lockForUpdate()
                ->first();

            if (!$profile) {
                throw ValidationException::withMessages([
                    'fiscal_profile' => 'Configure um perfil fiscal ativo antes de emitir a NFC-e.',
                ]);
            }

            $resolvedMode = $this->resolveMode($profile, $mode);
            $localTest = $resolvedMode === 'local_test';
            $type = $localTest ? 'nfce_local_test' : 'nfce';
            $idempotencyKey = $idempotencyKey ?: sprintf('sale:%d:%s', $sale->id, $type);

            $existing = FiscalDocument::query()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return $existing;
            }

            $this->validateProfileForNfce($profile, requireCsc: !$localTest);
            $this->validateSaleForNfce($sale);
            $number = $localTest
                ? 900000 + (int) $sale->id
                : (int) $profile->next_number;

            if (!$localTest) {
                $profile->forceFill(['next_number' => $number + 1])->save();
            }

            $document = FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                'profile_id' => $profile->id,
                'type' => $type,
                'status' => 'queued',
                'idempotency_key' => $idempotencyKey,
                'environment' => (int) $profile->environment,
                'series' => (int) $profile->series,
                'number' => $number,
                'payload' => $this->buildPayload($sale, $profile, $number, $localTest),
                'queued_at' => now(),
            ]);

            $document->events()->create([
                'status' => 'queued',
                'source' => 'backend',
                'message' => 'Documento fiscal reservado e enviado para a fila.',
            ]);

            QueueFiscalDocumentForEmission::dispatch((string) tenant()->getTenantKey(), $document->id)
                ->onQueue(config('fiscal.queues.documents'));

            return $document->fresh(['events']);
        });
    }

    public function prepareNfeFromSale(int $saleId, ?array $recipient = null): FiscalDocument
    {
        return DB::transaction(function () use ($saleId, $recipient) {
            $sale = Sale::query()
                ->with($this->saleRelations())
                ->lockForUpdate()
                ->findOrFail($saleId);

            $profile = FiscalProfile::query()
                ->where('active', true)
                ->lockForUpdate()
                ->first();

            $resolvedRecipient = $this->resolveConsumerPayload($sale, $recipient);

            if (blank($resolvedRecipient['name'] ?? null) || blank($resolvedRecipient['document'] ?? null)) {
                throw ValidationException::withMessages([
                    'recipient' => 'Informe nome e CPF/CNPJ do destinatario para preparar a NF-e / DANFE.',
                ]);
            }

            $idempotencyKey = sprintf('sale:%d:nfe_prepared', $sale->id);
            $existing = FiscalDocument::query()
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing) {
                return $existing;
            }

            $number = (int) ($profile?->next_number ?? (900000 + (int) $sale->id));

            $document = FiscalDocument::query()->create([
                'sale_id' => $sale->id,
                'profile_id' => $profile?->id,
                'type' => 'nfe_prepared',
                'status' => 'prepared',
                'idempotency_key' => $idempotencyKey,
                'environment' => (int) ($profile?->environment ?? 2),
                'series' => (int) ($profile?->series ?? 1),
                'number' => $number,
                'payload' => [
                    'profile' => $profile ? [
                        'environment' => (int) $profile->environment,
                        'company_name' => $profile->company_name,
                        'trade_name' => $profile->trade_name,
                        'cnpj' => $profile->cnpj,
                        'ie' => $profile->ie,
                        'street' => $profile->street,
                        'number' => $profile->number,
                        'district' => $profile->district,
                        'city_code' => $profile->city_code,
                        'city_name' => $profile->city_name,
                        'state' => $profile->state,
                        'zip_code' => $profile->zip_code,
                        'operation_nature' => $profile->operation_nature,
                    ] : null,
                    'sale' => [
                        'id' => $sale->id,
                        'sale_number' => $sale->sale_number,
                        'total' => (float) $sale->total,
                        'requested_document_model' => '55',
                    ],
                    'recipient' => $resolvedRecipient,
                    'flags' => [
                        'mode' => 'prepared',
                        'document_model' => '55',
                        'prepared_only' => true,
                    ],
                ],
                'queued_at' => now(),
            ]);

            $document->events()->create([
                'status' => 'prepared',
                'source' => 'backend',
                'message' => 'Venda preparada para emissao posterior de NF-e / DANFE.',
            ]);

            return $document->fresh(['events']);
        });
    }

    public function retry(FiscalDocument $document): FiscalDocument
    {
        if (in_array($document->status, ['authorized', 'printed', 'signed_local', 'printed_local'], true)) {
            throw ValidationException::withMessages([
                'document' => 'Este documento fiscal ja foi concluido e nao pode ser reenfileirado.',
            ]);
        }

        $document->forceFill([
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

        QueueFiscalDocumentForEmission::dispatch((string) tenant()->getTenantKey(), $document->id)
            ->onQueue(config('fiscal.queues.documents'));

        return $document->fresh(['events']);
    }

    public function buildLocalTestPayload(int $saleId): array
    {
        $sale = Sale::query()
            ->with($this->saleRelations())
            ->findOrFail($saleId);

        $profile = FiscalProfile::query()
            ->where('active', true)
            ->first();

        if (!$profile) {
            throw ValidationException::withMessages([
                'fiscal_profile' => 'Configure um perfil fiscal ativo antes do ensaio local da NFC-e.',
            ]);
        }

        $this->validateProfileForNfce($profile, requireCsc: false);
        $this->validateSaleForNfce($sale);

        $number = 900000 + (int) $sale->id;

        return $this->buildPayload($sale, $profile, $number, true);
    }

    protected function resolveMode(FiscalProfile $profile, ?string $mode = null): string
    {
        $mode = strtolower(trim((string) $mode));

        if (in_array($mode, ['sefaz', 'local_test'], true)) {
            return $mode;
        }

        return filled($profile->csc_id) && filled($profile->csc_token)
            ? 'sefaz'
            : 'local_test';
    }

    protected function validateProfileForNfce(FiscalProfile $profile, bool $requireCsc = true): void
    {
        $missing = [];

        foreach ([
            'company_name' => 'razao social',
            'cnpj' => 'CNPJ',
            'ie' => 'inscricao estadual',
            'street' => 'logradouro',
            'number' => 'numero',
            'district' => 'bairro',
            'city_code' => 'codigo do municipio',
            'city_name' => 'municipio',
            'state' => 'UF',
            'zip_code' => 'CEP',
            'operation_nature' => 'natureza da operacao',
        ] as $field => $label) {
            if (blank($profile->{$field})) {
                $missing[] = "Configure {$label} no perfil fiscal.";
            }
        }

        if (!preg_match('/^\d{14}$/', (string) $profile->cnpj)) {
            $missing[] = 'O CNPJ do perfil fiscal precisa ter 14 digitos numericos.';
        }

        if (!preg_match('/^\d{7}$/', (string) $profile->city_code)) {
            $missing[] = 'O codigo do municipio precisa ter 7 digitos.';
        }

        if (!preg_match('/^\d{8}$/', (string) $profile->zip_code)) {
            $missing[] = 'O CEP do perfil fiscal precisa ter 8 digitos.';
        }

        if ($requireCsc && (blank($profile->csc_id) || blank($profile->csc_token))) {
            $missing[] = 'Configure CSC ID e CSC Token do ambiente NFC-e antes de emitir.';
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'fiscal_profile' => implode(' ', array_unique($missing)),
            ]);
        }
    }

    protected function buildPayload(Sale $sale, FiscalProfile $profile, int $number, bool $localTest = false): array
    {
        $randomCode = str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT);
        $notes = trim((string) $sale->notes);
        $consumer = $this->resolveConsumerPayload($sale);

        if ($localTest) {
            $notes = trim(implode(' | ', array_filter([
                $notes,
                'ENSAIO LOCAL NFC-E SEM TRANSMISSAO SEFAZ',
            ])));
        }

        return [
            'profile' => [
                'environment' => (int) $profile->environment,
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
                'issued_at' => now()->format('Y-m-d\TH:i:sP'),
                'total' => (float) $sale->total,
                'change_amount' => 0.0,
                'requested_document_model' => (string) ($this->saleValue($sale, 'requested_document_model') ?: '65'),
            ],
            'items' => $sale->items->map(function ($item) {
                /** @var Product|null $product */
                $product = $item->product;

                return [
                    'code' => $product?->code ?: (string) $item->product_id,
                    'barcode' => $product?->barcode,
                    'name' => $product?->name ?: 'Item sem nome',
                    'fiscal_enabled' => (bool) ($product?->fiscal_enabled ?? true),
                    'ncm' => $product?->ncm,
                    'cfop' => $product?->cfop,
                    'cest' => $product?->cest,
                    'origin_code' => $product?->origin_code ?: '0',
                    'icms_csosn' => $product?->icms_csosn ?: '102',
                    'icms_rate' => (float) ($product?->icms_rate ?? 0),
                    'pis_cst' => $product?->pis_cst ?: '49',
                    'pis_rate' => (float) ($product?->pis_rate ?? 0),
                    'cofins_cst' => $product?->cofins_cst ?: '49',
                    'cofins_rate' => (float) ($product?->cofins_rate ?? 0),
                    'ipi_rate' => (float) ($product?->ipi_rate ?? 0),
                    'unit' => $product?->unit ?: 'UN',
                    'commercial_unit' => $product?->commercial_unit ?: ($product?->unit ?: 'UN'),
                    'taxable_unit' => $product?->taxable_unit ?: ($product?->unit ?: 'UN'),
                    'quantity' => (float) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'total' => (float) $item->total,
                    'tax_total' => 0.0,
                ];
            })->values()->all(),
            'payments' => $sale->payments->map(function ($payment) {
                $mapped = $this->paymentMapper->toTpag((string) $payment->payment_method);

                return [
                    'method' => $payment->payment_method,
                    'amount' => (float) $payment->amount,
                    'tPag' => $mapped['tPag'],
                    'xPag' => $mapped['xPag'],
                ];
            })->values()->all(),
            'consumer' => $consumer,
            'additional_info' => $notes,
            'flags' => [
                'local_test' => $localTest,
                'mode' => $localTest ? 'local_test' : 'sefaz',
                'document_model' => '65',
            ],
        ];
    }

    protected function resolveConsumerPayload(Sale $sale, ?array $override = null): array
    {
        $payload = is_array($override) && $override !== []
            ? $override
            : (is_array($this->saleValue($sale, 'recipient_payload')) ? $this->saleValue($sale, 'recipient_payload') : []);

        $document = filled($payload['document'] ?? null)
            ? preg_replace('/\D+/', '', (string) $payload['document'])
            : null;

        if (($payload['type'] ?? null) === 'document' || ($document && filled($payload['name'] ?? null))) {
            return [
                'name' => trim((string) ($payload['name'] ?? '')),
                'document' => $document,
                'email' => $payload['email'] ?? null,
            ];
        }

        if ($this->supportsCompanyRecipients() && (filled($payload['company_id'] ?? null) || ($payload['type'] ?? null) === 'company')) {
            $company = $sale->company;

            if ($company) {
                return [
                    'name' => $company->trade_name ?: $company->name,
                    'document' => preg_replace('/\D+/', '', (string) ($company->document ?? '')),
                    'email' => $company->email,
                    'state_registration' => $company->state_registration,
                ];
            }
        }

        if (filled($payload['customer_id'] ?? null) || ($payload['type'] ?? null) === 'customer') {
            $customer = $sale->customer;

            if ($customer) {
                return [
                    'name' => $customer->name,
                    'document' => preg_replace('/\D+/', '', (string) ($customer->document ?? '')),
                    'email' => $customer->email,
                ];
            }
        }

        if ($this->supportsCompanyRecipients() && $sale->company && filled($sale->company->document)) {
            return [
                'name' => $sale->company->trade_name ?: $sale->company->name,
                'document' => preg_replace('/\D+/', '', (string) $sale->company->document),
                'email' => $sale->company->email,
                'state_registration' => $sale->company->state_registration,
            ];
        }

        if ($sale->customer && filled($sale->customer->document)) {
            return [
                'name' => $sale->customer->name,
                'document' => preg_replace('/\D+/', '', (string) $sale->customer->document),
                'email' => $sale->customer->email,
            ];
        }

        return [
            'name' => filled($payload['name'] ?? null) ? trim((string) $payload['name']) : null,
            'document' => $document,
            'email' => $payload['email'] ?? null,
        ];
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

    protected function validateSaleForNfce(Sale $sale): void
    {
        if ($sale->items->isEmpty()) {
            throw ValidationException::withMessages([
                'sale' => 'A venda precisa ter itens para emissao fiscal.',
            ]);
        }

        $missing = [];

        foreach ($sale->items as $item) {
            $product = $item->product;

            if (!$product) {
                $missing[] = "Produto vinculado ao item {$item->id} nao encontrado.";
                continue;
            }

            if (array_key_exists('fiscal_enabled', $product->getAttributes()) && !$product->fiscal_enabled) {
                $missing[] = "Produto {$product->name} esta com movimentacao fiscal desativada e nao pode ser emitido.";
                continue;
            }

            if (!$product->ncm || !$product->cfop) {
                $missing[] = "Produto {$product->name} precisa ter NCM e CFOP configurados.";
            }
        }

        $paymentsTotal = round((float) $sale->payments->sum('amount'), 2);

        if ($paymentsTotal <= 0) {
            $missing[] = 'A venda precisa ter pagamentos validos para emissao fiscal.';
        } elseif ($paymentsTotal !== round((float) $sale->total, 2)) {
            $missing[] = 'A soma dos pagamentos da venda precisa ser igual ao total antes da emissao fiscal.';
        }

        if ($missing !== []) {
            throw ValidationException::withMessages([
                'products' => implode(' ', $missing),
            ]);
        }
    }
}
