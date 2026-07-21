<?php

namespace App\Services\Tenant\Sales;

use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Models\Tenant\SaleReturn;
use App\Models\Tenant\SaleReturnItem;
use App\Services\Tenant\AuditLogService;
use App\Services\Tenant\Fiscal\FiscalDocumentService;
use App\Services\Tenant\InventoryMovementService;
use App\Support\CfopMirror;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SaleReturnService
{
    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
        protected AuditLogService $auditLogService,
        protected CfopMirror $cfopMirror,
        protected FiscalDocumentService $fiscalDocumentService,
    ) {
    }

    /**
     * @param array<int, array{sale_item_id: int, quantity: float}> $items
     */
    public function createCommercial(
        int $saleId,
        array $items,
        string $reason,
        string $refundMethod,
        float $refundAmount,
        int $userId,
        ?string $notes = null,
    ): SaleReturn {
        return DB::transaction(function () use ($saleId, $items, $reason, $refundMethod, $refundAmount, $userId, $notes) {
            $sale = Sale::query()
                ->with(['items.product.kitItems.component'])
                ->lockForUpdate()
                ->findOrFail($saleId);

            if ($items === []) {
                throw ValidationException::withMessages([
                    'items' => 'Informe ao menos um item para devolver.',
                ]);
            }

            $reason = trim($reason);

            if (mb_strlen($reason) < 5) {
                throw ValidationException::withMessages([
                    'reason' => 'Informe um motivo para a devolução.',
                ]);
            }

            if (! in_array($refundMethod, ['cash', 'store_credit', 'none'], true)) {
                throw ValidationException::withMessages([
                    'refund_method' => 'Forma de reembolso inválida.',
                ]);
            }

            $saleReturn = SaleReturn::query()->create([
                'sale_id' => $sale->id,
                'customer_id' => $sale->customer_id,
                'status' => 'completed',
                'reason' => $reason,
                'refund_method' => $refundMethod,
                'refund_amount' => round($refundAmount, 2),
                'notes' => $notes,
                'processed_by' => $userId,
                'processed_at' => now(),
            ]);

            foreach ($items as $itemInput) {
                $saleItem = $sale->items->firstWhere('id', (int) $itemInput['sale_item_id']);

                if (! $saleItem) {
                    throw ValidationException::withMessages([
                        'items' => 'Um dos itens informados não pertence a esta venda.',
                    ]);
                }

                $quantity = round((float) $itemInput['quantity'], 3);

                if ($quantity <= 0) {
                    throw ValidationException::withMessages([
                        'items' => 'Informe uma quantidade válida para devolver.',
                    ]);
                }

                $alreadyReturned = (float) SaleReturnItem::query()
                    ->where('sale_item_id', $saleItem->id)
                    ->sum('quantity');
                $availableQuantity = round((float) $saleItem->quantity - $alreadyReturned, 3);

                if ($quantity > $availableQuantity) {
                    throw ValidationException::withMessages([
                        'items' => "Quantidade a devolver maior que a disponível ({$availableQuantity}) para este item.",
                    ]);
                }

                /** @var Product|null $product */
                $product = $saleItem->product;
                $unitPrice = round((float) $saleItem->unit_price, 2);
                $total = round($unitPrice * $quantity, 2);

                $returnCfop = $product?->cfop
                    ? $this->cfopMirror->mirrorForSaleReturn((string) $product->cfop)
                    : null;

                $saleReturn->items()->create([
                    'sale_item_id' => $saleItem->id,
                    'product_id' => $saleItem->product_id,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total' => $total,
                    'cfop' => $returnCfop,
                ]);

                $this->restoreStock($product, $quantity, $sale, $saleReturn, $reason, $userId);
            }

            $this->auditLogService->record(
                AuditActions::SALE_RETURN_REGISTERED,
                $saleReturn,
                after: [
                    'sale_id' => $sale->id,
                    'reason' => $reason,
                    'refund_method' => $refundMethod,
                    'refund_amount' => round($refundAmount, 2),
                ],
                userId: $userId,
            );

            return $saleReturn->fresh(['items']);
        });
    }

    public function issueFiscal(int $saleReturnId, int $userId): FiscalDocument
    {
        $saleReturn = SaleReturn::query()->findOrFail($saleReturnId);

        $document = $this->fiscalDocumentService->issueReturnForSale($saleReturn, $userId);

        $saleReturn->forceFill(['fiscal_document_id' => $document->id])->save();

        return $document;
    }

    protected function restoreStock(
        ?Product $product,
        float $quantity,
        Sale $sale,
        SaleReturn $saleReturn,
        string $reason,
        int $userId,
    ): void {
        if (! $product) {
            return;
        }

        if ($product->is_kit && $product->kitItems->isNotEmpty()) {
            foreach ($product->kitItems as $kitItem) {
                if (! $kitItem->component) {
                    continue;
                }

                $this->inventoryMovementService->apply($kitItem->component, (float) $kitItem->quantity * $quantity, 'sale_returned', [
                    'user_id' => $userId,
                    'reference' => $saleReturn,
                    'unit_cost' => $kitItem->component->cost_price,
                    'notes' => sprintf('Devolução do kit %s na venda %s. Motivo: %s', $product->name, $sale->sale_number, $reason),
                ]);
            }

            return;
        }

        $this->inventoryMovementService->apply($product, $quantity, 'sale_returned', [
            'user_id' => $userId,
            'reference' => $saleReturn,
            'unit_cost' => $product->cost_price,
            'notes' => sprintf('Devolução da venda %s. Motivo: %s', $sale->sale_number, $reason),
        ]);
    }
}
