<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Models\Tenant\Sale;
use App\Services\Tenant\DashboardService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MobileDashboardController extends Controller
{
    use FormatsMobileResponses;

    public function index(DashboardService $dashboardService): JsonResponse
    {
        $dashboard = $dashboardService->build();

        $summary = $dashboard['summary'];
        $summary['month_growth'] = (float) ($summary['month_growth'] ?? 0);
        $summary['today_growth'] = (float) ($summary['today_growth'] ?? 0);
        $summary['month_profit'] = (float) ($summary['month_profit'] ?? 0);
        $summary['today_profit'] = (float) ($summary['today_profit'] ?? 0);

        return response()->json($this->success([
            'summary' => $summary,
            'sales_trend' => $dashboard['salesTrend'] ?? [],
            'hourly_sales' => $dashboard['hourlySales'] ?? [],
            'top_products' => $dashboard['topProducts'] ?? [],
            'payment_breakdown' => $dashboard['paymentBreakdown'] ?? [],
            'recent_sales' => $dashboard['recentSales'] ?? [],
            'by_seller' => $this->bySellerSnapshot(),
            'stock_alerts' => $dashboard['lowStockItems'] ?? [],
        ]));
    }

    protected function bySellerSnapshot(): array
    {
        $today = Carbon::today();
        $monthStart = Carbon::now()->startOfMonth();

        $todayRows = $this->sellerRows($today->copy()->startOfDay(), $today->copy()->endOfDay())->keyBy('user_id');
        $monthRows = $this->sellerRows($monthStart, Carbon::now()->endOfDay())->keyBy('user_id');

        return $monthRows
            ->map(function ($monthRow) use ($todayRows) {
                $todayRow = $todayRows->get($monthRow->user_id);

                return [
                    'seller_id' => $monthRow->user_id,
                    'user_name' => $monthRow->user_name,
                    'qty' => (int) $todayRow?->qty,
                    'total' => (float) $todayRow?->total,
                    'profit' => (float) $todayRow?->profit,
                    'month_qty' => (int) $monthRow->qty,
                    'month_total' => (float) $monthRow->total,
                    'month_profit' => (float) $monthRow->profit,
                ];
            })
            ->values()
            ->all();
    }

    protected function sellerRows(Carbon $from, Carbon $to)
    {
        return Sale::query()
            ->leftJoin('users', 'users.id', '=', 'sales.user_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('sales.user_id', 'users.name')
            ->orderByDesc(DB::raw('SUM(sales.total)'))
            ->get([
                'sales.user_id',
                DB::raw("COALESCE(users.name, 'Sem vendedor') as user_name"),
                DB::raw('COUNT(*) as qty'),
                DB::raw('COALESCE(SUM(sales.total), 0) as total'),
                DB::raw('COALESCE(SUM(sales.profit), 0) as profit'),
            ]);
    }
}
