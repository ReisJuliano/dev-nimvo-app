<?php

namespace App\Http\Controllers\Tenant\Products;

use App\Http\Controllers\Controller;
use App\Services\Tenant\ProductImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductImportController extends Controller
{
    public function preview(Request $request, ProductImportService $importService): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('produtos.adicionar'), 403);

        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $rows = $importService->preview($validated['file']);

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'total' => count($rows),
                'valid' => count(array_filter($rows, fn ($row) => empty($row['errors']))),
                'with_errors' => count(array_filter($rows, fn ($row) => ! empty($row['errors']))),
                'with_warnings' => count(array_filter($rows, fn ($row) => ! empty($row['warnings']))),
            ],
        ]);
    }

    public function commit(Request $request, ProductImportService $importService): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('produtos.adicionar'), 403);

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.row_number' => ['required', 'integer'],
            'rows.*.product_id' => ['nullable', 'integer'],
            'rows.*.errors' => ['present', 'array'],
            'rows.*.data' => ['required', 'array'],
            'rows.*.data.code' => ['nullable', 'string', 'max:255'],
            'rows.*.data.barcode' => ['nullable', 'string', 'max:255'],
            'rows.*.data.name' => ['required', 'string'],
            'rows.*.data.category_id' => ['nullable', 'integer'],
            'rows.*.data.supplier_id' => ['nullable', 'integer'],
            'rows.*.data.unit' => ['nullable', 'string', 'max:20'],
            'rows.*.data.sold_by' => ['nullable', 'string', 'in:unit,weight'],
            'rows.*.data.cost_price' => ['nullable', 'numeric'],
            'rows.*.data.sale_price' => ['required', 'numeric'],
            'rows.*.data.stock_quantity' => ['nullable', 'numeric'],
            'rows.*.data.min_stock' => ['nullable', 'numeric'],
        ]);

        $result = $importService->commit($validated['rows'], auth()->id());

        return response()->json([
            'message' => sprintf(
                '%d produto(s) criado(s), %d atualizado(s), %d ignorado(s).',
                $result['created'],
                $result['updated'],
                $result['skipped'],
            ),
            ...$result,
        ]);
    }
}
