<?php

namespace App\Http\Controllers\Tenant\Suppliers;

use App\Http\Controllers\Controller;
use App\Services\Tenant\SupplierImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierImportController extends Controller
{
    public function preview(Request $request, SupplierImportService $importService): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('fornecedores.adicionar'), 403);

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
            ],
        ]);
    }

    public function commit(Request $request, SupplierImportService $importService): JsonResponse
    {
        abort_unless(auth()->user()?->hasPermission('fornecedores.adicionar'), 403);

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.row_number' => ['required', 'integer'],
            'rows.*.supplier_id' => ['nullable', 'integer'],
            'rows.*.errors' => ['present', 'array'],
            'rows.*.data' => ['required', 'array'],
            'rows.*.data.name' => ['nullable', 'string'],
            'rows.*.data.document' => ['nullable', 'string', 'max:20'],
            'rows.*.data.document_type' => ['nullable', 'string', 'max:10'],
            'rows.*.data.trade_name' => ['nullable', 'string', 'max:255'],
            'rows.*.data.phone' => ['nullable', 'string', 'max:30'],
            'rows.*.data.email' => ['nullable', 'string', 'max:255'],
        ]);

        $result = $importService->commit($validated['rows']);

        return response()->json([
            'message' => sprintf(
                '%d fornecedor(es) criado(s), %d atualizado(s), %d ignorado(s).',
                $result['created'],
                $result['updated'],
                $result['skipped'],
            ),
            ...$result,
        ]);
    }
}
