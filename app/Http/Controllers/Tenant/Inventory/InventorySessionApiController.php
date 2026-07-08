<?php

namespace App\Http\Controllers\Tenant\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Tenant\InventorySession;
use App\Models\Tenant\InventorySessionItem;
use App\Services\Tenant\Inventory\InventoryAdjustmentService;
use App\Services\Tenant\Inventory\InventoryCycleCountService;
use App\Services\Tenant\Inventory\InventorySessionService;
use App\Services\Tenant\SupervisorAuthorizationService;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InventorySessionApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeManage();

        $status = $request->query('status');
        $perPage = min(100, max(1, $request->integer('per_page', 20)));

        $paginator = InventorySession::query()
            ->with(['createdBy:id,name', 'approvedBy:id,name'])
            ->withCount('items')
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest('id')
            ->paginate($perPage)
            ->through(fn (InventorySession $session) => $this->serializeSession($session));

        return response()->json([
            'sessions' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'type' => ['required', Rule::in(['general', 'partial'])],
            'mode' => ['required', Rule::in(['snapshot', 'frozen'])],
            'count_resolution' => ['required', Rule::in(['last_count_wins', 'two_matching_counts', 'manual_review'])],
            'blind_count' => ['nullable', 'boolean'],
            'filters' => ['nullable', 'array'],
            'filters.category_ids' => ['nullable', 'array'],
            'filters.supplier_ids' => ['nullable', 'array'],
            'filters.product_ids' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $session = $service->create($validated, (int) auth()->id());

        return response()->json([
            'message' => 'Sessão de inventário criada.',
            'session' => $this->serializeSession($session),
        ], 201);
    }

    public function show(InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $data = $this->serializeSession($inventorySession);
        $data['progress_summary'] = $service->progressSummary($inventorySession);
        $data['divergence_summary'] = $this->isBlindCounting($inventorySession)
            ? null
            : $service->divergenceSummary($inventorySession);

        return response()->json(['session' => $data]);
    }

    public function progress(InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        return response()->json([
            'category_progress' => $service->categoryProgress($inventorySession),
            'movement_breakdown' => $this->isBlindCounting($inventorySession) ? [] : $service->movementBreakdown($inventorySession),
        ]);
    }

    public function accuracyHistory(Request $request, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        return response()->json([
            'history' => $service->accuracyHistory((int) $request->integer('limit', 6) ?: 6),
        ]);
    }

    public function cycleCountSuggestion(Request $request, InventoryCycleCountService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate(['class' => ['required', Rule::in(['A', 'B', 'C'])]]);

        return response()->json($service->suggestForCycle($validated['class']));
    }

    public function itemReconciliation(InventorySession $inventorySession, InventorySessionItem $item, InventoryAdjustmentService $service): JsonResponse
    {
        $this->authorizeManage();

        abort_unless((int) $item->inventory_session_id === $inventorySession->id, 404);

        return response()->json(['reconciliation' => $service->itemReconciliation($item)]);
    }

    public function start(InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $session = $service->start($inventorySession);

        return response()->json([
            'message' => 'Sessão iniciada. Estoque fotografado para '.$session->items()->count().' produto(s).',
            'session' => $this->serializeSession($session),
        ]);
    }

    public function cancel(InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $session = $service->cancel($inventorySession);

        return response()->json([
            'message' => 'Sessão cancelada.',
            'session' => $this->serializeSession($session),
        ]);
    }

    public function finishCounting(InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $session = $service->finishCounting($inventorySession);

        return response()->json([
            'message' => 'Contagem encerrada. Sessão em conferência.',
            'session' => $this->serializeSession($session),
        ]);
    }

    public function items(Request $request, InventorySession $inventorySession): JsonResponse
    {
        $this->authorizeManage();

        $perPage = min(200, max(1, $request->integer('per_page', 50)));
        $status = $request->query('status');
        $search = trim((string) $request->query('search', ''));
        $categoryId = $request->integer('category_id');
        $divergentOnly = $request->boolean('divergent_only');

        $paginator = $inventorySession->items()
            ->with('product:id,code,barcode,name,category_id,sold_by')
            ->with('product.category:id,name')
            ->when($status, fn ($query) => $query->where('status', $status))
            ->when($divergentOnly, fn ($query) => $query->whereIn('status', ['divergent', 'recount']))
            ->when($categoryId, fn ($query) => $query->whereHas('product', fn ($inner) => $inner->where('category_id', $categoryId)))
            ->when($search !== '', fn ($query) => $query->whereHas('product', function ($inner) use ($search) {
                $inner->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            }))
            ->orderBy('id')
            ->paginate($perPage)
            ->through(fn (InventorySessionItem $item) => $this->serializeItem($item, $this->isBlindCounting($inventorySession)));

        return response()->json([
            'items' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function recordCount(Request $request, InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate([
            'item_id' => ['required_without:barcode', 'integer'],
            'barcode' => ['required_without:item_id', 'string'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'source' => ['nullable', Rule::in(['manual', 'scanner'])],
        ]);

        $item = isset($validated['item_id'])
            ? $inventorySession->items()->findOrFail($validated['item_id'])
            : $inventorySession->items()->whereHas('product', fn ($query) => $query
                ->where('barcode', $validated['barcode'])
                ->orWhere('code', $validated['barcode']))
                ->first();

        if (!$item) {
            throw ValidationException::withMessages(['barcode' => 'Produto não encontrado nesta sessão de inventário.']);
        }

        $item = $service->recordCount($item, (float) $validated['quantity'], $validated['source'] ?? 'manual', (int) auth()->id());

        return response()->json([
            'message' => 'Contagem registrada.',
            'item' => $this->serializeItem($item->fresh('product'), $this->isBlindCounting($inventorySession)),
        ]);
    }

    public function bulkRecount(Request $request, InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate(['item_ids' => ['required', 'array', 'min:1'], 'item_ids.*' => ['integer']]);
        $count = $service->sendToRecount($inventorySession, $validated['item_ids']);

        return response()->json(['message' => "{$count} item(ns) enviado(s) para recontagem."]);
    }

    public function bulkMarkZero(Request $request, InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate(['item_ids' => ['required', 'array', 'min:1'], 'item_ids.*' => ['integer']]);
        $count = $service->markUncountedAsZero($inventorySession, $validated['item_ids'], (int) auth()->id());

        return response()->json(['message' => "{$count} item(ns) marcado(s) com contagem zero."]);
    }

    public function bulkMarkSkipped(Request $request, InventorySession $inventorySession, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        $validated = $request->validate(['item_ids' => ['required', 'array', 'min:1'], 'item_ids.*' => ['integer']]);
        $count = $service->markUncountedAsSkipped($inventorySession, $validated['item_ids']);

        return response()->json(['message' => "{$count} item(ns) marcado(s) como não contados (sem ajuste)."]);
    }

    public function resolveItem(Request $request, InventorySession $inventorySession, InventorySessionItem $item, InventorySessionService $service): JsonResponse
    {
        $this->authorizeManage();

        abort_unless((int) $item->inventory_session_id === $inventorySession->id, 404);

        $validated = $request->validate([
            'resolution' => ['required', Rule::in(['accept_count', 'keep_system'])],
            'resolution_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $item = $service->resolveItem($item, $validated['resolution'], $validated['resolution_reason'] ?? null, (int) auth()->id());

        return response()->json([
            'message' => 'Item resolvido.',
            'item' => $this->serializeItem($item->fresh('product')),
        ]);
    }

    public function approve(
        Request $request,
        InventorySession $inventorySession,
        InventorySessionService $sessionService,
        InventoryAdjustmentService $adjustmentService,
        SupervisorAuthorizationService $supervisorAuthorizationService,
        TenantSettingsService $settingsService,
    ): JsonResponse {
        $this->authorizeApprove();

        $settings = $settingsService->get();

        if ($sessionService->requiresSupervisorApproval($inventorySession, $settings)) {
            $validated = $request->validate([
                'supervisor_user_id' => ['required', 'integer', 'exists:users,id'],
                'supervisor_password' => ['required', 'string'],
            ]);

            $supervisorAuthorizationService->authorize(
                $validated['supervisor_user_id'],
                $validated['supervisor_password'],
                ['inventory_session_id' => $inventorySession->id],
            );
        }

        $session = $adjustmentService->approve($inventorySession, (int) auth()->id());

        return response()->json([
            'message' => 'Inventário aprovado e ajustes aplicados.',
            'session' => $this->serializeSession($session),
        ]);
    }

    protected function serializeSession(InventorySession $session): array
    {
        return [
            'id' => $session->id,
            'code' => $session->code,
            'type' => $session->type,
            'mode' => $session->mode,
            'count_resolution' => $session->count_resolution,
            'blind_count' => (bool) $session->blind_count,
            'status' => $session->status,
            'filters' => $session->filters,
            'notes' => $session->notes,
            'items_count' => $session->items_count ?? $session->items()->count(),
            'created_by_name' => $session->createdBy?->name,
            'approved_by_name' => $session->approvedBy?->name,
            'started_at' => $session->started_at?->toIso8601String(),
            'counting_finished_at' => $session->counting_finished_at?->toIso8601String(),
            'approved_at' => $session->approved_at?->toIso8601String(),
            'completed_at' => $session->completed_at?->toIso8601String(),
            'created_at' => $session->created_at?->toIso8601String(),
        ];
    }

    protected function serializeItem(InventorySessionItem $item, bool $blind = false): array
    {
        return [
            'id' => $item->id,
            'product_id' => $item->product_id,
            'product_name' => $item->product?->name,
            'product_code' => $item->product?->code,
            'product_barcode' => $item->product?->barcode,
            'category_name' => $item->product?->category?->name,
            'sold_by' => $item->product?->sold_by ?? 'unit',
            'snapshot_quantity' => $blind ? null : (float) $item->snapshot_quantity,
            'counted_quantity' => $item->counted_quantity !== null ? (float) $item->counted_quantity : null,
            'interim_delta' => $blind ? null : (float) $item->interim_delta,
            'final_delta' => $item->final_delta !== null ? (float) $item->final_delta : null,
            'unit_cost' => (float) $item->unit_cost,
            'delta' => $blind ? null : $item->delta(),
            'delta_value' => $blind ? null : $item->deltaValue(),
            'divergence_percent' => $blind ? null : ((float) $item->snapshot_quantity !== 0.0
                ? round(($item->delta() / (float) $item->snapshot_quantity) * 100, 2)
                : ($item->delta() != 0 ? 100.0 : 0.0)),
            'status' => $item->status,
            'resolution' => $item->resolution,
            'resolution_reason' => $item->resolution_reason,
        ];
    }

    protected function isBlindCounting(InventorySession $session): bool
    {
        return (bool) $session->blind_count && $session->status === 'counting';
    }

    protected function authorizeManage(): void
    {
        abort_unless(auth()->user()?->hasPermission('inventario.gerenciar'), 403);
    }

    protected function authorizeApprove(): void
    {
        abort_unless(auth()->user()?->hasPermission('inventario.aprovar'), 403);
    }
}
