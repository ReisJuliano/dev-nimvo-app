<?php

namespace App\Http\Controllers\Tenant\Labels;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Services\Tenant\LabelPayloadService;
use App\Services\Tenant\LabelSheetPdfService;
use App\Services\Tenant\LocalAgentPrintQueueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Validation\Rule;

class LabelsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->integer('category_id');
        $pendingOnly = $request->boolean('pending_only');
        $purchaseId = $request->integer('purchase_id');

        $query = Product::query()->where('active', true);

        if ($search !== '') {
            $query->where(function ($inner) use ($search) {
                $inner->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }

        if ($pendingOnly) {
            $query->whereNull('label_printed_at');
        }

        if ($purchaseId) {
            $productIds = Purchase::query()->findOrFail($purchaseId)->items()->pluck('product_id');
            $query->whereIn('id', $productIds);
        }

        $products = $query->orderBy('name')->limit(200)->get();

        return response()->json([
            'products' => $products->map(fn (Product $product) => [
                'id' => $product->id,
                'code' => $product->code,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'sale_price' => (float) $product->sale_price,
                'sold_by' => $product->sold_by ?? 'unit',
                'label_printed_at' => $product->label_printed_at?->toIso8601String(),
                'pending' => $product->label_printed_at === null,
            ])->values(),
        ]);
    }

    public function print(
        Request $request,
        LabelPayloadService $labelPayloadService,
        LocalAgentPrintQueueService $printQueueService,
    ): JsonResponse {
        $this->authorizeManage();

        $validated = $this->validateRequest($request);
        $products = Product::query()->whereIn('id', $validated['product_ids'])->get();

        $labels = $products->map(fn (Product $product) => $labelPayloadService->build($product, $validated['template'], $validated['copies']))->all();

        $result = $printQueueService->queueLabelPrint($labels);

        if ($result['status'] === 'queued') {
            Product::query()->whereIn('id', $validated['product_ids'])->update(['label_printed_at' => now()]);
        }

        return response()->json($result);
    }

    public function pdf(Request $request, LabelSheetPdfService $labelSheetPdfService): HttpResponse
    {
        $this->authorizeManage();

        $validated = $this->validateRequest($request, requirePreset: true);
        $products = Product::query()->whereIn('id', $validated['product_ids'])->get();

        $response = $labelSheetPdfService->build($products, $validated['template'], $validated['preset'], $validated['copies']);

        Product::query()->whereIn('id', $validated['product_ids'])->update(['label_printed_at' => now()]);

        return $response;
    }

    protected function validateRequest(Request $request, bool $requirePreset = false): array
    {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'template' => ['required', 'string', Rule::in(['gondola', 'oferta', 'adesiva_ean', 'adesiva_interno'])],
            'copies' => ['nullable', 'integer', 'min:1', 'max:20'],
            'preset' => [$requirePreset ? 'required' : 'nullable', 'string', Rule::in(array_keys(LabelSheetPdfService::PRESETS))],
        ]);

        $validated['copies'] = max(1, (int) ($validated['copies'] ?? 1));

        return $validated;
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('produtos.imprimir_etiquetas'), 403);
    }
}
