<?php

namespace App\Http\Controllers\Tenant\Audit;

use App\Http\Controllers\Controller;
use App\Models\Tenant\AuditLog;
use App\Support\Tenant\AuditActions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AuditApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeView();

        $from = $request->query('from')
            ? Carbon::parse((string) $request->query('from'))->startOfDay()
            : now()->subDays(30)->startOfDay();
        $to = $request->query('to')
            ? Carbon::parse((string) $request->query('to'))->endOfDay()
            : now()->endOfDay();
        $action = $request->query('action');
        $userId = $request->integer('user_id') ?: null;
        $search = trim((string) $request->query('search', ''));
        $perPage = min(100, max(1, $request->integer('per_page', 30)));

        $paginator = AuditLog::query()
            ->with('user:id,name')
            ->whereBetween('occurred_at', [$from, $to])
            ->when($action, fn ($query) => $query->where('action', $action))
            ->when($userId, fn ($query) => $query->where('user_id', $userId))
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($inner) use ($search) {
                    $inner->where('auditable_type', 'like', "%{$search}%")
                        ->orWhere('auditable_id', 'like', "%{$search}%");
                });
            })
            ->latest('occurred_at')
            ->paginate($perPage)
            ->through(fn (AuditLog $log) => $this->serialize($log));

        return response()->json([
            'logs' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
            'filters' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'action' => $action,
                'user_id' => $userId,
                'search' => $search,
            ],
        ]);
    }

    public function show(AuditLog $auditLog): JsonResponse
    {
        $this->authorizeView();

        $auditLog->load('user:id,name');

        return response()->json([
            'log' => $this->serialize($auditLog, includePayload: true),
        ]);
    }

    protected function serialize(AuditLog $log, bool $includePayload = false): array
    {
        $data = [
            'id' => $log->id,
            'action' => $log->action,
            'action_label' => AuditActions::label($log->action),
            'user_id' => $log->user_id,
            'user_name' => $log->user?->name,
            'auditable_type' => $log->auditable_type,
            'auditable_id' => $log->auditable_id,
            'occurred_at' => $log->occurred_at?->toIso8601String(),
        ];

        if ($includePayload) {
            $data['before'] = $log->before;
            $data['after'] = $log->after;
            $data['metadata'] = $log->metadata;
        }

        return $data;
    }

    protected function authorizeView(): void
    {
        abort_unless(auth()->user()?->hasPermission('auditoria.visualizar'), 403);
    }
}
