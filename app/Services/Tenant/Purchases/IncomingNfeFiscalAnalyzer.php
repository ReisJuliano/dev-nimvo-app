<?php

namespace App\Services\Tenant\Purchases;

use App\Models\Tenant\IncomingNfeBookEntry;
use App\Models\Tenant\IncomingNfeDocument;
use App\Models\Tenant\IncomingNfeItem;
use App\Models\Tenant\IncomingNfeTaxCredit;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\PurchaseItem;
use Illuminate\Support\Carbon;

class IncomingNfeFiscalAnalyzer
{
    public function analyze(IncomingNfeDocument $document): array
    {
        $document->loadMissing(['supplier:id,name,document', 'purchase.items', 'items.product:id,name,code,ncm,cfop']);
        $purchase = $document->purchase;
        $profileCrt = (string) data_get($document->metadata, 'recipient.crt', '');
        $periodReference = $this->periodReference($document);
        $supplierState = (string) data_get($document->metadata, 'supplier.state', '');
        $recipientState = (string) data_get($document->metadata, 'recipient.state', '');
        $isInterstate = $supplierState !== '' && $recipientState !== '' && $supplierState !== $recipientState;
        $plannedPurchaseItems = collect(data_get($document->metadata, 'linked_purchase_before_receipt', []));

        if ($plannedPurchaseItems->isEmpty() && $purchase) {
            $plannedPurchaseItems = $purchase->items->map(fn (PurchaseItem $entry) => [
                'purchase_item_id' => $entry->id,
                'product_id' => $entry->product_id,
                'product_name' => $entry->product_name,
                'quantity' => (float) $entry->quantity,
                'unit_cost' => (float) $entry->unit_cost,
                'total' => (float) $entry->total,
            ]);
        }
        $taxTotals = [
            'icms' => 0.0,
            'icms_st' => 0.0,
            'ipi' => 0.0,
            'pis' => 0.0,
            'cofins' => 0.0,
            'difal' => 0.0,
            'fcp_st' => 0.0,
        ];
        $alerts = [];
        $itemUpdates = [];
        $taxCredits = [];
        $purchaseMatches = [];

        foreach ($document->items->sortBy('item_number')->values() as $index => $item) {
            $analysis = $this->analyzeItem($document, $item, $purchase, $plannedPurchaseItems, $index, $isInterstate, $profileCrt);
            $itemUpdates[$item->id] = [
                'fiscal_snapshot' => $analysis['fiscal_snapshot'],
                'validation_warnings' => $analysis['validation_warnings'],
            ];
            $purchaseMatches[] = $analysis['purchase_match'];
            $alerts = [...$alerts, ...$analysis['alerts']];
            $taxCredits = [...$taxCredits, ...$analysis['credits']];

            $taxTotals['icms'] += (float) ($item->icms_amount ?? 0);
            $taxTotals['icms_st'] += (float) ($item->icms_st_amount ?? 0);
            $taxTotals['ipi'] += (float) ($item->ipi_amount ?? 0);
            $taxTotals['pis'] += (float) ($item->pis_amount ?? 0);
            $taxTotals['cofins'] += (float) ($item->cofins_amount ?? 0);
            $taxTotals['difal'] += (float) ($item->difal_amount ?? 0);
            $taxTotals['fcp_st'] += (float) ($item->fcp_st_amount ?? 0);
        }

        $alerts = $this->documentAlerts($document, $purchase, $alerts, $isInterstate);
        $uniqueAlerts = $this->uniqueAlerts($alerts);
        $divergentMatches = collect($purchaseMatches)->whereIn('status', ['divergent', 'unmatched'])->count();
        $recoverableCredits = collect($taxCredits)->where('recoverable', true)->sum('amount');
        $matchSnapshot = $this->buildMatchSnapshot($document, $purchase, $purchaseMatches, $divergentMatches);
        $bookkeepingStatus = $this->resolveBookkeepingStatus($document, $uniqueAlerts);
        $physicalReceiptStatus = $this->resolvePhysicalReceiptStatus($document, $divergentMatches, $purchase);
        $fiscalSnapshot = [
            'document_model' => $document->document_model,
            'fiscal_status' => $document->fiscal_status,
            'authenticity_status' => $document->authenticity_status,
            'signature_status' => $document->signature_status,
            'interstate' => $isInterstate,
            'taxes' => [
                'icms' => round($taxTotals['icms'], 2),
                'icms_st' => round($taxTotals['icms_st'], 2),
                'ipi' => round($taxTotals['ipi'], 2),
                'pis' => round($taxTotals['pis'], 2),
                'cofins' => round($taxTotals['cofins'], 2),
                'difal' => round($taxTotals['difal'], 2),
                'fcp_st' => round($taxTotals['fcp_st'], 2),
            ],
            'credits' => [
                'recoverable_total' => round((float) $recoverableCredits, 2),
                'suggested_total' => round((float) collect($taxCredits)->sum('amount'), 2),
                'recoverable_count' => collect($taxCredits)->where('recoverable', true)->count(),
                'review_count' => collect($taxCredits)->where('status', 'review')->count(),
            ],
            'attention_points' => $uniqueAlerts,
        ];
        $bookkeepingEntries = $this->buildBookkeepingEntries($document, $periodReference, $bookkeepingStatus, $taxCredits);

        return [
            'validation_snapshot' => [
                'matched_items' => (int) $document->items->filter(fn (IncomingNfeItem $item) => filled($item->product_id))->count(),
                'pending_items' => (int) $document->items->filter(fn (IncomingNfeItem $item) => blank($item->product_id))->count(),
                'new_products' => (int) $document->items->where('match_status', 'pending')->count(),
                'price_changes' => collect($uniqueAlerts)->where('code', 'price_change')->count(),
                'ncm_mismatches' => collect($uniqueAlerts)->where('code', 'ncm_mismatch')->count(),
                'tax_gaps' => collect($uniqueAlerts)->whereIn('code', [
                    'cfop_missing',
                    'ncm_missing',
                    'icms_tax_code_missing',
                    'pis_tax_code_missing',
                    'cofins_tax_code_missing',
                ])->count(),
                'three_way_divergences' => $divergentMatches,
                'credit_suggestions' => collect($taxCredits)->count(),
                'alerts' => $uniqueAlerts,
            ],
            'fiscal_snapshot' => $fiscalSnapshot,
            'match_snapshot' => $matchSnapshot,
            'bookkeeping_snapshot' => [
                'status' => $bookkeepingStatus,
                'period_reference' => $periodReference,
                'entries' => collect($bookkeepingEntries)
                    ->map(fn (array $entry) => [
                        'entry_type' => $entry['entry_type'],
                        'status' => $entry['status'],
                        'period_reference' => $entry['period_reference'],
                        'reference_code' => $entry['reference_code'],
                    ])
                    ->values()
                    ->all(),
                'credit_total' => round((float) collect($taxCredits)->sum('amount'), 2),
            ],
            'bookkeeping_status' => $bookkeepingStatus,
            'physical_receipt_status' => $physicalReceiptStatus,
            'item_updates' => $itemUpdates,
            'bookkeeping_entries' => $bookkeepingEntries,
            'tax_credits' => $taxCredits,
        ];
    }

    public function syncArtifacts(IncomingNfeDocument $document, array $analysis): void
    {
        foreach ($analysis['item_updates'] as $itemId => $payload) {
            IncomingNfeItem::query()->whereKey($itemId)->update($payload);
        }

        IncomingNfeTaxCredit::query()->where('document_id', $document->id)->delete();

        foreach ($analysis['tax_credits'] as $credit) {
            IncomingNfeTaxCredit::query()->create($credit);
        }

        foreach ($analysis['bookkeeping_entries'] as $entry) {
            IncomingNfeBookEntry::query()->updateOrCreate(
                [
                    'document_id' => $document->id,
                    'entry_type' => $entry['entry_type'],
                ],
                $entry,
            );
        }
    }

    protected function analyzeItem(
        IncomingNfeDocument $document,
        IncomingNfeItem $item,
        ?Purchase $purchase,
        $plannedPurchaseItems,
        int $index,
        bool $isInterstate,
        string $profileCrt,
    ): array {
        $alerts = is_array($item->validation_warnings) ? $item->validation_warnings : [];

        if (blank($item->cfop)) {
            $alerts[] = $this->alert('cfop_missing', 'CFOP não informado no item da NF-e.');
        }

        if (blank($item->ncm)) {
            $alerts[] = $this->alert('ncm_missing', 'NCM não informado no item da NF-e.');
        }

        if (blank($item->icms_cst_csosn)) {
            $alerts[] = $this->alert('icms_tax_code_missing', 'CST/CSOSN de ICMS ausente no item.');
        }

        if (blank($item->pis_cst)) {
            $alerts[] = $this->alert('pis_tax_code_missing', 'CST de PIS ausente no item.');
        }

        if (blank($item->cofins_cst)) {
            $alerts[] = $this->alert('cofins_tax_code_missing', 'CST de COFINS ausente no item.');
        }

        if ($isInterstate && !$this->cfopMatchesInterstate((string) $item->cfop)) {
            $alerts[] = $this->alert('cfop_interstate_mismatch', "CFOP {$item->cfop} não parece interestadual para fornecedor e destinatário em UFs diferentes.");
        }

        if ((float) ($item->icms_st_amount ?? 0) > 0) {
            $alerts[] = $this->alert('icms_st_review', 'ICMS-ST destacado na entrada; revisar ressarcimento ou compensacao.');
        }

        if ($this->requiresDifalReview($item, $isInterstate)) {
            $alerts[] = $this->alert('difal_review', 'Compra interestadual com perfil de uso/consumo ou ativo exige revisao de DIFAL.');
        }

        if (in_array((string) $item->origin_code, ['1', '2', '3', '8'], true)) {
            $alerts[] = $this->alert('fci_review', 'Produto com origem importada ou conteudo importado requer validacao de FCI.');
        }

        $purchaseMatch = $this->purchaseMatch($item, $purchase, $plannedPurchaseItems, $index);

        if ($purchaseMatch['status'] === 'divergent') {
            foreach ($purchaseMatch['alerts'] as $alert) {
                $alerts[] = $alert;
            }
        }

        if ($purchaseMatch['status'] === 'unmatched') {
            $alerts[] = $this->alert('purchase_item_missing', 'Item da NF-e não encontrado no pedido de compra vinculado.');
        }

        $credits = $this->buildCredits($document, $item, $profileCrt, $isInterstate);

        return [
            'alerts' => $alerts,
            'validation_warnings' => $this->uniqueAlerts($alerts),
            'purchase_match' => $purchaseMatch,
            'credits' => $credits,
            'fiscal_snapshot' => [
                'purchase_match' => $purchaseMatch,
                'credits' => collect($credits)
                    ->map(fn (array $credit) => [
                        'tax_type' => $credit['tax_type'],
                        'amount' => $credit['amount'],
                        'recoverable' => $credit['recoverable'],
                        'status' => $credit['status'],
                    ])
                    ->values()
                    ->all(),
                'acquisition_cost' => [
                    'product_value' => round((float) $item->total_price, 2),
                    'ipi_non_recoverable' => round((float) $this->nonRecoverableIpi($credits, $item), 2),
                    'estimated_freight_share' => round((float) $this->allocatedFreightShare($document, $item), 2),
                    'estimated_total' => round((float) $item->total_price + $this->nonRecoverableIpi($credits, $item) + $this->allocatedFreightShare($document, $item), 2),
                ],
                'alerts' => $this->uniqueAlerts($alerts),
            ],
        ];
    }

    protected function buildCredits(
        IncomingNfeDocument $document,
        IncomingNfeItem $item,
        string $profileCrt,
        bool $isInterstate,
    ): array {
        $credits = [];
        $availableAt = $this->availableAt($document);
        $regime = $profileCrt === '3' ? 'regime_normal' : ($profileCrt === '1' ? 'simples_nacional' : 'analysis_required');
        $usageOrAsset = $this->requiresDifalReview($item, $isInterstate);

        foreach ([
            'icms' => ['amount' => (float) ($item->icms_amount ?? 0), 'basis' => (float) ($item->icms_base ?? 0), 'rate' => (float) ($item->icms_rate ?? 0)],
            'ipi' => ['amount' => (float) ($item->ipi_amount ?? 0), 'basis' => (float) ($item->ipi_base ?? 0), 'rate' => (float) ($item->ipi_rate ?? 0)],
            'pis' => ['amount' => (float) ($item->pis_amount ?? 0), 'basis' => (float) ($item->pis_base ?? 0), 'rate' => (float) ($item->pis_rate ?? 0)],
            'cofins' => ['amount' => (float) ($item->cofins_amount ?? 0), 'basis' => (float) ($item->cofins_base ?? 0), 'rate' => (float) ($item->cofins_rate ?? 0)],
            'icms_st' => ['amount' => (float) ($item->icms_st_amount ?? 0), 'basis' => (float) ($item->icms_st_base ?? 0), 'rate' => (float) ($item->icms_st_rate ?? 0)],
        ] as $taxType => $values) {
            if ($values['amount'] <= 0) {
                continue;
            }

            $recoverable = $profileCrt === '3' && in_array($taxType, ['icms', 'pis', 'cofins'], true) && !$usageOrAsset;
            $status = $recoverable ? 'available' : 'review';
            $description = match ($taxType) {
                'icms' => 'Credito potencial de ICMS a apropriar conforme regime e destinacao da compra.',
                'ipi' => 'IPI destacado na entrada; revisar enquadramento do destinatario para apropriacao.',
                'pis' => 'Crédito potencial de PIS condicionado ao regime não cumulativo.',
                'cofins' => 'Crédito potencial de COFINS condicionado ao regime não cumulativo.',
                'icms_st' => 'ICMS-ST retido pelo fornecedor; revisar ressarcimento ou compensacao.',
                default => 'Credito fiscal sugerido pela analise da NF-e.',
            };

            $credits[] = [
                'document_id' => $document->id,
                'incoming_nfe_item_id' => $item->id,
                'tax_type' => $taxType,
                'status' => $status,
                'recoverable' => $recoverable,
                'amount' => round($values['amount'], 2),
                'basis' => $values['basis'] > 0 ? round($values['basis'], 2) : null,
                'rate' => $values['rate'] > 0 ? round($values['rate'], 4) : null,
                'regime' => $regime,
                'description' => $description,
                'appropriation_reference' => $this->periodReference($document),
                'available_at' => $availableAt,
                'payload' => [
                    'cfop' => $item->cfop,
                    'ncm' => $item->ncm,
                    'origin_code' => $item->origin_code,
                    'is_interstate' => $isInterstate,
                    'usage_or_asset_review' => $usageOrAsset,
                ],
            ];
        }

        return $credits;
    }

    protected function purchaseMatch(IncomingNfeItem $item, ?Purchase $purchase, $plannedPurchaseItems, int $index): array
    {
        if (!$purchase) {
            return [
                'status' => 'pending_purchase',
                'purchase_item_id' => null,
                'alerts' => [],
            ];
        }

        $match = filled($item->product_id)
            ? collect($plannedPurchaseItems)->firstWhere('product_id', $item->product_id)
            : collect($plannedPurchaseItems)->values()->get($index);

        if (!$match) {
            return [
                'status' => 'unmatched',
                'purchase_item_id' => null,
                'alerts' => [],
            ];
        }

        $quantityDiff = round(abs((float) data_get($match, 'quantity', 0) - (float) $item->quantity), 3);
        $unitCostDiff = round(abs((float) data_get($match, 'unit_cost', 0) - (float) $item->unit_price), 2);
        $totalDiff = round(abs((float) data_get($match, 'total', 0) - (float) $item->total_price), 2);
        $alerts = [];

        if ($quantityDiff >= 0.001) {
            $alerts[] = $this->alert('purchase_quantity_divergence', sprintf(
                'Quantidade do pedido (%s) difere da NF-e (%s).',
                number_format((float) data_get($match, 'quantity', 0), 3, ',', '.'),
                number_format((float) $item->quantity, 3, ',', '.')
            ));
        }

        if ($unitCostDiff >= 0.01) {
            $alerts[] = $this->alert('purchase_price_divergence', sprintf(
                'Custo do pedido (%0.2f) difere da NF-e (%0.2f).',
                (float) data_get($match, 'unit_cost', 0),
                (float) $item->unit_price
            ));
        }

        if ($totalDiff >= 0.01 && $unitCostDiff < 0.01) {
            $alerts[] = $this->alert('purchase_total_divergence', sprintf(
                'Total do pedido (%0.2f) difere do item da NF-e (%0.2f).',
                (float) data_get($match, 'total', 0),
                (float) $item->total_price
            ));
        }

        return [
            'status' => $alerts === [] ? 'matched' : 'divergent',
            'purchase_item_id' => data_get($match, 'purchase_item_id'),
            'product_id' => data_get($match, 'product_id'),
            'quantity_diff' => $quantityDiff,
            'unit_cost_diff' => $unitCostDiff,
            'total_diff' => $totalDiff,
            'alerts' => $alerts,
        ];
    }

    protected function documentAlerts(
        IncomingNfeDocument $document,
        ?Purchase $purchase,
        array $alerts,
        bool $isInterstate,
    ): array {
        if ((bool) data_get($document->metadata, 'summary_only', false)) {
            $alerts[] = $this->alert('summary_only', 'A NF-e ainda esta em resumo; baixe o XML completo antes da escrituracao.');
        }

        if (!in_array((string) $document->fiscal_status, ['authorized', 'cancelled', 'denied'], true)) {
            $alerts[] = $this->alert('fiscal_status_review', 'Status fiscal da NF-e ainda precisa de validacao final.');
        }

        if ((string) $document->signature_status !== 'valid') {
            $alerts[] = $this->alert('signature_review', 'Assinatura digital da NF-e precisa de revisao.');
        }

        if (!$document->supplier_id) {
            $alerts[] = $this->alert('supplier_unlinked', 'Fornecedor da NF-e ainda não foi vinculado ao cadastro.');
        }

        if (!$purchase) {
            $alerts[] = $this->alert('purchase_unlinked', 'NF-e ainda não foi vinculada a um pedido de compra para 3-way match.');
        }

        if ($purchase && $document->supplier_id && $purchase->supplier_id && $purchase->supplier_id !== $document->supplier_id) {
            $alerts[] = $this->alert('purchase_supplier_mismatch', 'Fornecedor do pedido vinculado difere do fornecedor da NF-e.');
        }

        if ($isInterstate && (float) ($document->freight_total ?? 0) <= 0) {
            $alerts[] = $this->alert('freight_review', 'Compra interestadual sem frete destacado requer revisao do custo de aquisicao.');
        }

        return $alerts;
    }

    protected function buildMatchSnapshot(
        IncomingNfeDocument $document,
        ?Purchase $purchase,
        array $purchaseMatches,
        int $divergentMatches,
    ): array {
        $status = !$purchase
            ? 'pending_purchase'
            : ($divergentMatches > 0 ? 'divergent' : ($document->purchase?->stock_applied_at || $document->physical_received_at ? 'matched' : 'pending_receipt'));

        return [
            'status' => $status,
            'supplier_linked' => (bool) $document->supplier_id,
            'purchase_id' => $purchase?->id,
            'purchase_code' => $purchase?->code,
            'stock_applied_at' => $purchase?->stock_applied_at?->toIso8601String(),
            'physical_received_at' => $document->physical_received_at?->toIso8601String(),
            'three_way_match' => [
                'status' => $status,
                'divergent_items' => $divergentMatches,
                'items' => $purchaseMatches,
            ],
        ];
    }

    protected function buildBookkeepingEntries(
        IncomingNfeDocument $document,
        string $periodReference,
        string $bookkeepingStatus,
        array $taxCredits,
    ): array {
        $itemPayload = $document->items
            ->sortBy('item_number')
            ->values()
            ->map(fn (IncomingNfeItem $item) => [
                'item_number' => $item->item_number,
                'description' => $item->description,
                'cfop' => $item->cfop,
                'ncm' => $item->ncm,
                'quantity' => (float) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'total_price' => (float) $item->total_price,
                'icms_amount' => (float) ($item->icms_amount ?? 0),
                'ipi_amount' => (float) ($item->ipi_amount ?? 0),
                'pis_amount' => (float) ($item->pis_amount ?? 0),
                'cofins_amount' => (float) ($item->cofins_amount ?? 0),
            ])
            ->all();

        return [
            [
                'document_id' => $document->id,
                'entry_type' => 'livro_entradas',
                'status' => $bookkeepingStatus,
                'period_reference' => $periodReference,
                'reference_code' => sprintf('LE-%s-%s', $document->series ?: 0, $document->number ?: 0),
                'payload' => [
                    'register' => 'livro_entradas',
                    'document' => $this->documentHeader($document),
                    'items' => $itemPayload,
                ],
                'generated_at' => now(),
                'transmitted_at' => null,
            ],
            [
                'document_id' => $document->id,
                'entry_type' => 'efd_icms_ipi',
                'status' => $bookkeepingStatus,
                'period_reference' => $periodReference,
                'reference_code' => sprintf('EFDICMS-%s', $document->access_key),
                'payload' => [
                    'registers' => [
                        [
                            'code' => 'C100',
                            'document' => $this->documentHeader($document),
                        ],
                        ...collect($itemPayload)->map(fn (array $item) => [
                            'code' => 'C170',
                            ...$item,
                        ])->all(),
                    ],
                ],
                'generated_at' => now(),
                'transmitted_at' => null,
            ],
            [
                'document_id' => $document->id,
                'entry_type' => 'efd_contribuicoes',
                'status' => $bookkeepingStatus,
                'period_reference' => $periodReference,
                'reference_code' => sprintf('EFDPISCOFINS-%s', $document->access_key),
                'payload' => [
                    'registers' => [
                        [
                            'code' => 'C100',
                            'document' => $this->documentHeader($document),
                        ],
                        ...collect($itemPayload)->map(fn (array $item) => [
                            'code' => 'C170',
                            'item_number' => $item['item_number'],
                            'description' => $item['description'],
                            'pis_amount' => $item['pis_amount'],
                            'cofins_amount' => $item['cofins_amount'],
                        ])->all(),
                    ],
                ],
                'generated_at' => now(),
                'transmitted_at' => null,
            ],
            [
                'document_id' => $document->id,
                'entry_type' => 'fiscal_credit',
                'status' => $bookkeepingStatus,
                'period_reference' => $periodReference,
                'reference_code' => sprintf('CRED-%s', $document->access_key),
                'payload' => [
                    'document' => $this->documentHeader($document),
                    'credits' => collect($taxCredits)
                        ->map(fn (array $credit) => [
                            'tax_type' => $credit['tax_type'],
                            'amount' => $credit['amount'],
                            'recoverable' => $credit['recoverable'],
                            'status' => $credit['status'],
                            'description' => $credit['description'],
                        ])
                        ->values()
                        ->all(),
                ],
                'generated_at' => now(),
                'transmitted_at' => null,
            ],
        ];
    }

    protected function documentHeader(IncomingNfeDocument $document): array
    {
        return [
            'access_key' => $document->access_key,
            'number' => $document->number,
            'series' => $document->series,
            'document_model' => $document->document_model,
            'fiscal_status' => $document->fiscal_status,
            'issued_at' => $document->issued_at?->toIso8601String(),
            'authorized_at' => $document->authorized_at?->toIso8601String(),
            'supplier_name' => $document->supplier?->name ?? $document->supplier_name,
            'supplier_document' => $document->supplier?->document ?? $document->supplier_document,
            'recipient_name' => $document->recipient_name,
            'recipient_document' => $document->recipient_document,
            'products_total' => (float) $document->products_total,
            'freight_total' => (float) $document->freight_total,
            'invoice_total' => (float) $document->invoice_total,
        ];
    }

    protected function resolveBookkeepingStatus(IncomingNfeDocument $document, array $alerts): string
    {
        if ((bool) data_get($document->metadata, 'summary_only', false)) {
            return 'pending_xml';
        }

        if (collect($alerts)->contains(fn (array $alert) => in_array($alert['code'], [
            'signature_review',
            'purchase_unlinked',
            'supplier_unlinked',
            'purchase_item_missing',
        ], true))) {
            return 'review_required';
        }

        return filled($document->purchase?->stock_applied_at) ? 'posted' : 'ready';
    }

    protected function resolvePhysicalReceiptStatus(IncomingNfeDocument $document, int $divergentMatches, ?Purchase $purchase): string
    {
        if (filled($purchase?->stock_applied_at) || filled($document->physical_received_at)) {
            return $divergentMatches > 0 ? 'divergent' : 'confirmed';
        }

        return $purchase ? 'pending_receipt' : 'pending';
    }

    protected function availableAt(IncomingNfeDocument $document): ?string
    {
        $date = $document->physical_received_at ?: $document->authorized_at ?: $document->issued_at;

        return $date ? Carbon::parse($date)->toDateString() : null;
    }

    protected function periodReference(IncomingNfeDocument $document): string
    {
        $date = $document->authorized_at ?: $document->issued_at ?: now();

        return Carbon::parse($date)->format('Y-m');
    }

    protected function allocatedFreightShare(IncomingNfeDocument $document, IncomingNfeItem $item): float
    {
        $productsTotal = (float) ($document->products_total ?: 0);

        if ($productsTotal <= 0 || (float) ($document->freight_total ?? 0) <= 0) {
            return 0.0;
        }

        return round(((float) $item->total_price / $productsTotal) * (float) $document->freight_total, 2);
    }

    protected function nonRecoverableIpi(array $credits, IncomingNfeItem $item): float
    {
        $ipiCredit = collect($credits)->firstWhere('tax_type', 'ipi');

        if (!$ipiCredit || ($ipiCredit['recoverable'] ?? false)) {
            return 0.0;
        }

        return (float) ($item->ipi_amount ?? 0);
    }

    protected function requiresDifalReview(IncomingNfeItem $item, bool $isInterstate): bool
    {
        if (!$isInterstate) {
            return false;
        }

        return in_array((string) $item->cfop, ['1551', '1556', '2551', '2556', '3551', '3556'], true)
            || (float) ($item->difal_amount ?? 0) > 0;
    }

    protected function cfopMatchesInterstate(string $cfop): bool
    {
        return str_starts_with($cfop, '2') || str_starts_with($cfop, '3');
    }

    protected function uniqueAlerts(array $alerts): array
    {
        $unique = [];

        foreach ($alerts as $alert) {
            $key = ($alert['code'] ?? 'unknown').'|'.($alert['message'] ?? '');
            $unique[$key] = $alert;
        }

        return array_values($unique);
    }

    protected function alert(string $code, string $message, string $level = 'warning'): array
    {
        return [
            'code' => $code,
            'message' => $message,
            'level' => $level,
        ];
    }
}
