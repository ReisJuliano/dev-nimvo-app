<?php

namespace App\Services\Tenant\Fiscal;

use App\Models\Tenant\FiscalDocument;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Services\Tenant\InventoryMovementService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManualFiscalDocumentService
{
    public function __construct(
        protected FiscalDocumentService $fiscalDocumentService,
        protected InventoryMovementService $inventoryMovementService,
    ) {
    }

    public function create(array $data, int $userId): FiscalDocument
    {
        $sale = DB::transaction(function () use ($data, $userId) {
            $lines = collect($data['items'])->map(function (array $item) {
                /** @var Product $product */
                $product = Product::query()->findOrFail((int) $item['product_id']);
                $quantity = round((float) $item['quantity'], 3);
                $unitPrice = array_key_exists('unit_price', $item) && $item['unit_price'] !== null
                    ? round((float) $item['unit_price'], 2)
                    : round((float) $product->sale_price, 2);
                $unitCost = round((float) $product->cost_price, 2);
                $total = round($unitPrice * $quantity, 2);

                return [
                    'product' => $product,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'unit_cost' => $unitCost,
                    'total' => $total,
                    'profit' => round($total - ($unitCost * $quantity), 2),
                ];
            });

            if ($lines->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'Informe ao menos um item para emitir a nota.',
                ]);
            }

            $subtotal = round($lines->sum('total'), 2);

            $sale = Sale::query()->create([
                'sale_number' => $this->nextManualSaleNumber(),
                'customer_id' => $data['recipient']['customer_id'] ?? null,
                'user_id' => $userId,
                'cash_register_id' => null,
                'origin' => 'manual_fiscal',
                'subtotal' => $subtotal,
                'discount' => 0,
                'total' => $subtotal,
                'cost_total' => round($lines->sum(fn (array $line) => $line['unit_cost'] * $line['quantity']), 2),
                'profit' => round($lines->sum('profit'), 2),
                'payment_method' => $data['payment_method'],
                'requested_document_model' => '55',
                'status' => 'finalized',
                'fiscal_decision' => 'emit',
                'recipient_payload' => $data['recipient'],
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($lines as $line) {
                $sale->items()->create([
                    'product_id' => $line['product']->id,
                    'quantity' => $line['quantity'],
                    'unit_cost' => $line['unit_cost'],
                    'unit_price' => $line['unit_price'],
                    'total' => $line['total'],
                    'profit' => $line['profit'],
                ]);

                if ((bool) ($data['deduct_stock'] ?? false)) {
                    $this->inventoryMovementService->apply(
                        $line['product'],
                        -$line['quantity'],
                        'manual_fiscal_issue',
                        [
                            'user_id' => $userId,
                            'unit_cost' => $line['unit_cost'],
                            'notes' => "Baixa por nota fiscal avulsa {$sale->sale_number}",
                        ],
                    );
                }
            }

            $sale->payments()->create([
                'payment_method' => $data['payment_method'],
                'amount' => $subtotal,
            ]);

            return $sale;
        });

        return $this->fiscalDocumentService->issueFromSale(
            $sale->id,
            null,
            'sefaz',
            $data['recipient'],
        );
    }

    protected function nextManualSaleNumber(): string
    {
        $prefix = now()->format('Ymd');
        $count = Sale::query()
            ->where('origin', 'manual_fiscal')
            ->whereDate('created_at', now())
            ->count() + 1;

        return sprintf('NFA-%s-%04d', $prefix, $count);
    }
}
