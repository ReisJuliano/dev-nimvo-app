<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Models\Tenant\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MobileSalesController extends Controller
{
    use FormatsMobileResponses;

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 1), 100);

        $query = Sale::query()
            ->with(['customer:id,name', 'user:id,name', 'payments:id,sale_id,payment_method,amount'])
            ->select('sales.*');

        $this->applySaleFilters($query, $request->query());

        $paginator = $query
            ->latest('sales.created_at')
            ->paginate($perPage);

        return response()->json([
            'data' => $paginator->getCollection()->map(fn (Sale $sale) => [
                'id' => $sale->id,
                'sale_number' => $sale->sale_number,
                'customer_name' => $sale->customer?->name ?? 'Nao identificado',
                'seller_id' => $sale->user_id,
                'seller_name' => $sale->user?->name,
                'payment_method' => $sale->payment_method,
                'payments' => $sale->payments->map(fn ($payment) => [
                    'method' => $payment->payment_method,
                    'amount' => (float) $payment->amount,
                ])->values(),
                'subtotal' => (float) $sale->subtotal,
                'discount' => (float) $sale->discount,
                'total' => (float) $sale->total,
                'cost_total' => (float) $sale->cost_total,
                'profit' => (float) $sale->profit,
                'created_at' => $sale->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
            'message' => 'OK',
        ]);
    }

    public function bySeller(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request->query());

        $rows = Sale::query()
            ->leftJoin('users', 'users.id', '=', 'sales.user_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('sales.user_id', 'users.name')
            ->orderByDesc(DB::raw('SUM(sales.total)'))
            ->get([
                'sales.user_id as seller_id',
                DB::raw("COALESCE(users.name, 'Sem vendedor') as seller_name"),
                DB::raw('COUNT(*) as qty'),
                DB::raw('COALESCE(SUM(sales.total), 0) as total'),
                DB::raw('COALESCE(SUM(sales.profit), 0) as profit'),
            ])
            ->map(fn ($row) => [
                'seller_id' => $row->seller_id,
                'seller_name' => $row->seller_name,
                'qty' => (int) $row->qty,
                'total' => (float) $row->total,
                'profit' => (float) $row->profit,
                'average_ticket' => (int) $row->qty > 0 ? (float) $row->total / (int) $row->qty : 0.0,
            ])
            ->values();

        return response()->json($this->success([
            'period' => $this->periodPayload($from, $to),
            'items' => $rows,
        ]));
    }
}
