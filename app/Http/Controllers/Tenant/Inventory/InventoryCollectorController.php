<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Tenant\InventoryCollectorLayout;
use App\Models\Tenant\InventoryCount;
use App\Models\Tenant\InventoryImportBatch;
use App\Models\Tenant\InventorySession;
use App\Models\Tenant\InventorySessionItem;
use App\Models\Tenant\Product;
use App\Services\Tenant\Inventory\CollectorFileService;
use App\Services\Tenant\Inventory\InventorySessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventoryCollectorController extends Controller
{
    public function layouts(): JsonResponse
    {
        $this->authorizeManage();

        $layouts = InventoryCollectorLayout::query()
            ->orderBy('direction')
            ->orderBy('name')
            ->get()
            ->map(fn (InventoryCollectorLayout $layout) => $this->serializeLayout($layout));

        return response()->json(['layouts' => $layouts]);
    }

    public function storeLayout(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $layout = InventoryCollectorLayout::query()->create($this->validateLayout($request));

        return response()->json([
            'message' => 'Layout criado com sucesso.',
            'layout' => $this->serializeLayout($layout),
        ], 201);
    }

    public function updateLayout(Request $request, InventoryCollectorLayout $layout): JsonResponse
    {
        $this->authorizeManage();

        $layout->fill($this->validateLayout($request))->save();

        return response()->json([
            'message' => 'Layout atualizado com sucesso.',
            'layout' => $this->serializeLayout($layout),
        ]);
    }

    public function destroyLayout(InventoryCollectorLayout $layout): JsonResponse
    {
        $this->authorizeManage();

        if ($layout->is_default) {
            throw ValidationException::withMessages(['layout' => 'Layouts padrão não podem ser excluídos.']);
        }

        $layout->delete();

        return response()->json(['message' => 'Layout removido.']);
    }

    public function previewLayout(Request $request, CollectorFileService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'format' => ['required', Rule::in(['delimited', 'fixed_width'])],
            'config' => ['required', 'array'],
            'sample_lines' => ['required', 'array', 'min:1', 'max:10'],
            'sample_lines.*' => ['string'],
        ]);

        $config = array_merge($validated['config'], ['format' => $validated['format']]);
        $preview = $service->preview($config, $validated['sample_lines']);

        return response()->json(['preview' => $preview]);
    }

    public function export(Request $request, InventorySession $inventorySession, CollectorFileService $service): HttpResponse
    {
        $this->authorizeManage();

        $validated = $request->validate(['layout_id' => ['required', 'integer', 'exists:inventory_collector_layouts,id']]);
        $layout = InventoryCollectorLayout::query()->where('direction', 'export')->findOrFail($validated['layout_id']);

        $contents = $service->export($inventorySession, $layout);
        $filename = "{$inventorySession->code}-carga.txt";

        return response($contents, 200, [
            'Content-Type' => 'text/plain',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    public function import(Request $request, InventorySession $inventorySession, CollectorFileService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'layout_id' => ['required', 'integer', 'exists:inventory_collector_layouts,id'],
            'count_round' => ['required', 'integer', 'min:1', 'max:5'],
        ]);

        $layout = InventoryCollectorLayout::query()->where('direction', 'import')->findOrFail($validated['layout_id']);
        $file = $request->file('file');
        $contents = file_get_contents((string) $file->getRealPath());

        if ($contents === false) {
            throw ValidationException::withMessages(['file' => 'Não foi possível ler o arquivo enviado.']);
        }

        $batch = $service->import(
            $inventorySession,
            (string) $file->getClientOriginalName(),
            $contents,
            $layout,
            (int) $validated['count_round'],
            (int) auth()->id(),
        );

        return response()->json([
            'message' => 'Arquivo processado.',
            'batch' => [
                'id' => $batch->id,
                'total_lines' => $batch->total_lines,
                'matched_lines' => $batch->matched_lines,
                'unmatched_lines' => $batch->unmatched_lines,
                'duplicate_lines' => $batch->duplicate_lines,
                'status' => $batch->status,
                'unmatched_payload' => $batch->unmatched_payload,
            ],
        ]);
    }

    public function resolveUnmatchedLine(
        Request $request,
        InventorySession $inventorySession,
        InventoryImportBatch $batch,
        InventorySessionService $sessionService,
    ): JsonResponse {
        $this->authorizeManage();

        abort_unless((int) $batch->inventory_session_id === $inventorySession->id, 404);

        $validated = $request->validate([
            'line_index' => ['required', 'integer', 'min:0'],
            'action' => ['required', Rule::in(['link', 'include', 'discard'])],
            'product_id' => ['required_if:action,link,include', 'integer', 'exists:products,id'],
        ]);

        $payload = (array) $batch->unmatched_payload;

        if (!array_key_exists($validated['line_index'], $payload)) {
            throw ValidationException::withMessages(['line_index' => 'Linha não encontrada nesta pendência.']);
        }

        $entry = $payload[$validated['line_index']];

        DB::transaction(function () use ($validated, $entry, $inventorySession, $batch, $sessionService) {
            if ($validated['action'] !== 'discard') {
                $product = Product::query()->findOrFail($validated['product_id']);

                $sessionItem = $inventorySession->items()->where('product_id', $product->id)->first();

                if (!$sessionItem) {
                    $sessionItem = InventorySessionItem::query()->create([
                        'inventory_session_id' => $inventorySession->id,
                        'product_id' => $product->id,
                        'snapshot_quantity' => round((float) $product->stock_quantity, 3),
                        'unit_cost' => round((float) $product->cost_price, 2),
                        'status' => 'pending',
                    ]);
                }

                InventoryCount::query()->create([
                    'inventory_session_item_id' => $sessionItem->id,
                    'count_round' => $batch->count_round,
                    'quantity' => (float) $entry['quantity'],
                    'source' => 'collector_import',
                    'import_batch_id' => $batch->id,
                    'counted_by' => auth()->id(),
                    'counted_at' => now(),
                ]);

                $sessionService->resolveItemCounts($sessionItem->fresh());
            }

            $payload = (array) $batch->unmatched_payload;
            unset($payload[$validated['line_index']]);

            $batch->update([
                'unmatched_payload' => array_values($payload),
                'unmatched_lines' => count($payload),
                'matched_lines' => $validated['action'] === 'discard' ? $batch->matched_lines : $batch->matched_lines + 1,
            ]);
        });

        return response()->json(['message' => 'Pendência resolvida.']);
    }

    protected function validateLayout(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'direction' => ['required', Rule::in(['import', 'export'])],
            'format' => ['required', Rule::in(['delimited', 'fixed_width'])],
            'config' => ['required', 'array'],
        ]);
    }

    protected function serializeLayout(InventoryCollectorLayout $layout): array
    {
        return [
            'id' => $layout->id,
            'name' => $layout->name,
            'direction' => $layout->direction,
            'format' => $layout->format,
            'config' => $layout->config,
            'is_default' => (bool) $layout->is_default,
        ];
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('inventario.gerenciar'), 403);
    }
}
