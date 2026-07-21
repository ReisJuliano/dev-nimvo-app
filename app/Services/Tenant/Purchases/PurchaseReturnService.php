<?php

namespace App\Services\Tenant\Purchases;

use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Payable;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\PurchaseReturn;
use App\Models\Tenant\PurchaseReturnItem;
use App\Services\Tenant\AuditLogService;
use App\Services\Tenant\Fiscal\FiscalDocumentService;
use App\Services\Tenant\InventoryMovementService;
use App\Support\CfopMirror;
use App\Support\Tenant\AuditActions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseReturnService
{
    public function __construct(
        protected InventoryMovementService $inventoryMovementService,
        protected AuditLogService $auditLogService,
        protected CfopMirror $cfopMirror,
        protected FiscalDocumentService $fiscalDocumentService,
    ) {
    }

    public function issueFiscal(int $purchaseReturnId, int $userId): FiscalDocument
    {
        $purchaseReturn = PurchaseReturn::query()->findOrFail($purchaseReturnId);

        $document = $this->fiscalDocumentService->issueReturnForPurchase($purchaseReturn, $userId);

        $purchaseReturn->forceFill(['fiscal_document_id' => $document->id])->save();

        return $document;
    }

    /**
     * @param array<int, array{purchase_item_id: int, quantity: float}> $items
     */
    public function create(int $purchaseId, array $items, string $reason, int $userId): PurchaseReturn
    {
        return DB::transaction(function () use ($purchaseId, $items, $reason, $userId) {
            $purchase = Purchase::query()
                ->with(['items.incomingNfeItem', 'supplier'])
                ->lockForUpdate()
                ->findOrFail($purchaseId);

            if (blank($purchase->stock_applied_at)) {
                throw ValidationException::withMessages([
                    'purchase' => 'Só é possível devolver itens de uma compra que já teve entrada aplicada no estoque.',
                ]);
            }

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

            $purchaseReturn = PurchaseReturn::query()->create([
                'purchase_id' => $purchase->id,
                'supplier_id' => $purchase->supplier_id,
                'status' => 'completed',
                'reason' => $reason,
                'processed_by' => $userId,
                'processed_at' => now(),
            ]);

            $creditAmount = 0.0;

            foreach ($items as $itemInput) {
                $purchaseItem = $purchase->items->firstWhere('id', (int) $itemInput['purchase_item_id']);

                if (! $purchaseItem) {
                    throw ValidationException::withMessages([
                        'items' => 'Um dos itens informados não pertence a esta compra.',
                    ]);
                }

                $quantity = round((float) $itemInput['quantity'], 3);

                if ($quantity <= 0) {
                    throw ValidationException::withMessages([
                        'items' => "Informe uma quantidade válida para devolver de {$purchaseItem->product_name}.",
                    ]);
                }

                $alreadyReturned = $this->alreadyReturnedQuantity($purchaseItem->id);
                $availableQuantity = round((float) $purchaseItem->quantity - $alreadyReturned, 3);

                if ($quantity > $availableQuantity) {
                    throw ValidationException::withMessages([
                        'items' => "Quantidade a devolver de {$purchaseItem->product_name} maior que a disponível ({$availableQuantity}).",
                    ]);
                }

                $incomingCfop = (string) ($purchaseItem->incomingNfeItem?->cfop ?? '');

                if ($incomingCfop === '') {
                    throw ValidationException::withMessages([
                        'items' => "Não é possível devolver {$purchaseItem->product_name}: esta compra não veio de uma NF-e de entrada importada, então não há CFOP de origem para espelhar na devolução.",
                    ]);
                }

                $returnCfop = $this->cfopMirror->mirrorForPurchaseReturn($incomingCfop);
                $unitCost = round((float) $purchaseItem->unit_cost, 2);
                $total = round($unitCost * $quantity, 2);
                $creditAmount += $total;

                $purchaseReturn->items()->create([
                    'purchase_item_id' => $purchaseItem->id,
                    'product_id' => $purchaseItem->product_id,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'total' => $total,
                    'cfop' => $returnCfop,
                ]);

                if ($purchaseItem->product) {
                    $this->inventoryMovementService->apply($purchaseItem->product, -$quantity, 'purchase_returned', [
                        'user_id' => $userId,
                        'reference' => $purchaseReturn,
                        'unit_cost' => $unitCost,
                        'notes' => "Devolução ao fornecedor referente à compra {$purchase->code}. Motivo: {$reason}",
                    ]);
                }
            }

            $creditAmount = round($creditAmount, 2);

            if ($creditAmount > 0) {
                Payable::query()->create([
                    'purchase_id' => $purchase->id,
                    'supplier_id' => $purchase->supplier_id,
                    'user_id' => $userId,
                    'code' => $this->nextPayableCode(),
                    'description' => "Crédito por devolução de compra {$purchase->code}",
                    'category' => 'purchase_return_credit',
                    'status' => 'paid',
                    'amount' => -$creditAmount,
                    'amount_paid' => -$creditAmount,
                    'paid_at' => now(),
                    'notes' => $reason,
                    'metadata' => [
                        'purchase_return_id' => $purchaseReturn->id,
                        'purchase_code' => $purchase->code,
                    ],
                ]);
            }

            $this->auditLogService->record(
                AuditActions::PURCHASE_RETURN_REGISTERED,
                $purchaseReturn,
                after: ['purchase_id' => $purchase->id, 'reason' => $reason, 'credit_amount' => $creditAmount],
                userId: $userId,
            );

            return $purchaseReturn->fresh(['items']);
        });
    }

    protected function alreadyReturnedQuantity(int $purchaseItemId): float
    {
        return (float) PurchaseReturnItem::query()
            ->where('purchase_item_id', $purchaseItemId)
            ->sum('quantity');
    }

    protected function nextPayableCode(): string
    {
        $datePrefix = now()->format('Ymd');
        $sequence = Payable::query()->count() + 1;

        do {
            $code = sprintf('DEV-%s-%04d', $datePrefix, $sequence);
            $sequence++;
        } while (Payable::query()->where('code', $code)->exists());

        return $code;
    }
}
