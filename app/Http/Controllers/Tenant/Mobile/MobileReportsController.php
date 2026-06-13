<?php

namespace App\Http\Controllers\Tenant\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Tenant\Mobile\Concerns\FormatsMobileResponses;
use App\Models\Tenant\Sale;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MobileReportsController extends Controller
{
    use FormatsMobileResponses;

    public function cmv(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request->query());
        $summary = $this->salesSummary($from, $to);

        return response()->json($this->success([
            'period' => $this->periodPayload($from, $to),
            ...$this->cmvPayload($summary),
            'weekly_trend' => $this->weeklyCmvTrend(),
        ]));
    }

    public function period(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request->query());
        $summary = $this->salesSummary($from, $to);

        return response()->json($this->success([
            'period' => $this->periodPayload($from, $to),
            'summary' => [
                'sales_total' => (float) $summary->revenue,
                'sales_qty' => (int) $summary->qty,
                'profit' => (float) $summary->gross_profit,
                'cost' => (float) $summary->cost,
                'average_ticket' => (int) $summary->qty > 0 ? (float) $summary->revenue / (int) $summary->qty : 0.0,
                'cmv_percentage' => $this->percentage((float) $summary->cost, (float) $summary->revenue),
                'margin_percentage' => $this->percentage((float) $summary->gross_profit, (float) $summary->revenue),
            ],
            'daily_trend' => $this->dailyTrend($from, $to),
            'top_products' => $this->topProductsForPeriod($from, $to),
            'payment_methods' => $this->paymentMethodsForPeriod($from, $to),
        ]));
    }

    public function topProducts(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request->query());
        $limit = min(max((int) $request->integer('limit', 10), 1), 50);

        return response()->json($this->success([
            'period' => $this->periodPayload($from, $to),
            'items' => $this->topProductsForPeriod($from, $to, $limit),
        ]));
    }

    public function paymentMethods(Request $request): JsonResponse
    {
        [$from, $to] = $this->dateRange($request->query());

        return response()->json($this->success([
            'period' => $this->periodPayload($from, $to),
            'items' => $this->paymentMethodsForPeriod($from, $to),
        ]));
    }

    protected function salesSummary(Carbon $from, Carbon $to): object
    {
        return Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as revenue, COALESCE(SUM(cost_total), 0) as cost, COALESCE(SUM(profit), 0) as gross_profit')
            ->first();
    }

    protected function cmvPayload(object $summary): array
    {
        $revenue = (float) $summary->revenue;
        $cost = (float) $summary->cost;
        $grossProfit = (float) $summary->gross_profit;

        return [
            'revenue' => $revenue,
            'cost' => $cost,
            'gross_profit' => $grossProfit,
            'cmv_percentage' => $this->percentage($cost, $revenue),
            'margin_percentage' => $this->percentage($grossProfit, $revenue),
        ];
    }

    protected function weeklyCmvTrend(): array
    {
        $start = Carbon::now()->startOfWeek()->subWeeks(7);

        return collect(range(0, 7))
            ->map(function (int $week) use ($start) {
                $from = $start->copy()->addWeeks($week);
                $to = $from->copy()->endOfWeek();
                $summary = $this->salesSummary($from, $to);
                $payload = $this->cmvPayload($summary);

                return [
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'label' => $from->format('d/m').' - '.$to->format('d/m'),
                    ...$payload,
                ];
            })
            ->all();
    }

    protected function dailyTrend(Carbon $from, Carbon $to): array
    {
        $rows = Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as day, COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $days = min($from->diffInDays($to), 180);

        return collect(range(0, $days))
            ->map(function (int $offset) use ($from, $rows) {
                $day = $from->copy()->addDays($offset);
                $key = $day->toDateString();
                $row = $rows->get($key);

                return [
                    'date' => $key,
                    'label' => $day->format('d/m'),
                    'qty' => (int) ($row->qty ?? 0),
                    'total' => (float) ($row->total ?? 0),
                    'profit' => (float) ($row->profit ?? 0),
                ];
            })
            ->values()
            ->all();
    }

    protected function topProductsForPeriod(Carbon $from, Carbon $to, int $limit = 10): array
    {
        return DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(sale_items.total)'))
            ->limit($limit)
            ->get([
                'products.id',
                'products.name',
                DB::raw('SUM(sale_items.quantity) as qty_sold'),
                DB::raw('SUM(sale_items.total) as revenue'),
                DB::raw('SUM(sale_items.profit) as profit'),
            ])
            ->map(fn ($product) => [
                'id' => $product->id,
                'name' => $product->name,
                'qty_sold' => (float) $product->qty_sold,
                'revenue' => (float) $product->revenue,
                'profit' => (float) $product->profit,
            ])
            ->values()
            ->all();
    }

    protected function paymentMethodsForPeriod(Carbon $from, Carbon $to): array
    {
        return DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to])
            ->groupBy('sale_payments.payment_method')
            ->orderByDesc(DB::raw('SUM(sale_payments.amount)'))
            ->get([
                'sale_payments.payment_method',
                DB::raw('COUNT(*) as qty'),
                DB::raw('SUM(sale_payments.amount) as total'),
            ])
            ->map(fn ($payment) => [
                'method' => $payment->payment_method,
                'label' => PaymentMethod::label((string) $payment->payment_method),
                'qty' => (int) $payment->qty,
                'total' => (float) $payment->total,
            ])
            ->values()
            ->all();
    }

    protected function percentage(float $value, float $base): float
    {
        return $base > 0 ? ($value / $base) * 100 : 0.0;
    }
}
