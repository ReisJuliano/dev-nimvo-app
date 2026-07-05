<?php

namespace App\Http\Controllers\Tenant\CashRegister;

use App\Http\Controllers\Controller;
use App\Models\Tenant\CashRegister;
use App\Services\Tenant\CashRegisterReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;

class CashRegisterPanelApiController extends Controller
{
    public function openRegisters(CashRegisterReportService $reportService): JsonResponse
    {
        $this->authorizeManager();

        $registers = CashRegister::query()
            ->with(['till:id,name', 'user:id,name'])
            ->where('status', 'open')
            ->orderBy('opened_at')
            ->get()
            ->map(function (CashRegister $register) use ($reportService) {
                $report = $reportService->build($register);

                return [
                    'id' => $register->id,
                    'till_id' => $register->till_id,
                    'till_name' => $register->till?->name ?? 'Caixa principal',
                    'user_name' => $register->user?->name,
                    'opened_at' => $register->opened_at?->toIso8601String(),
                    ...Arr::only($report, ['total_sales', 'sales_count', 'expected_cash']),
                ];
            })
            ->values();

        return response()->json(['registers' => $registers]);
    }

    public function closedRegisters(CashRegisterReportService $reportService): JsonResponse
    {
        $this->authorizeManager();

        $from = request()->query('from')
            ? Carbon::parse((string) request()->query('from'))->startOfDay()
            : now()->subDays(30)->startOfDay();
        $to = request()->query('to')
            ? Carbon::parse((string) request()->query('to'))->endOfDay()
            : now()->endOfDay();
        $tillId = request()->integer('till_id') ?: null;
        $perPage = min(100, max(1, request()->integer('per_page', 30)));

        $paginator = CashRegister::query()
            ->with(['till:id,name', 'user:id,name'])
            ->where('status', 'closed')
            ->whereBetween('closed_at', [$from, $to])
            ->when($tillId, fn ($query) => $query->where('till_id', $tillId))
            ->latest('closed_at')
            ->paginate($perPage)
            ->through(function (CashRegister $register) use ($reportService) {
                $report = $reportService->build($register);

                return [
                    'id' => $register->id,
                    'till_id' => $register->till_id,
                    'till_name' => $register->till?->name ?? 'Caixa principal',
                    'user_name' => $register->user?->name,
                    'opened_at' => $register->opened_at?->toIso8601String(),
                    'closed_at' => $register->closed_at?->toIso8601String(),
                    'difference' => (float) ($report['total_difference'] ?? $report['difference'] ?? 0),
                    'sales_count' => (int) ($report['sales_count'] ?? 0),
                    'total_sales' => (float) ($report['total_sales'] ?? 0),
                ];
            });

        return response()->json([
            'registers' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
            'filters' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'till_id' => $tillId,
            ],
        ]);
    }

    protected function authorizeManager(): void
    {
        abort_unless(in_array(auth()->user()?->role, ['admin', 'manager'], true), 403);
    }
}
