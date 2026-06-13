<?php

namespace App\Http\Controllers\Tenant\Mobile\Concerns;

use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

trait FormatsMobileResponses
{
    protected function success(mixed $data = [], ?string $message = null): array
    {
        return [
            'data' => $data,
            'message' => $message ?? 'OK',
        ];
    }

    protected function dateRange(array $input, string $default = 'month'): array
    {
        $now = Carbon::now();

        $from = filled($input['from'] ?? null)
            ? Carbon::parse((string) $input['from'])->startOfDay()
            : match ($default) {
                'today' => $now->copy()->startOfDay(),
                'week' => $now->copy()->startOfWeek(),
                default => $now->copy()->startOfMonth(),
            };

        $to = filled($input['to'] ?? null)
            ? Carbon::parse((string) $input['to'])->endOfDay()
            : $now->copy()->endOfDay();

        return [$from, $to];
    }

    protected function periodPayload(Carbon $from, Carbon $to): array
    {
        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ];
    }

    protected function applySaleFilters(Builder $query, array $filters): Builder
    {
        [$from, $to] = $this->dateRange($filters);

        $query
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from, $to]);

        if (filled($filters['seller_id'] ?? null)) {
            $query->where('sales.user_id', (int) $filters['seller_id']);
        }

        if (filled($filters['payment_method'] ?? null)) {
            $method = PaymentMethod::normalize((string) $filters['payment_method']);
            $query->where(function (Builder $builder) use ($method) {
                $builder
                    ->where('sales.payment_method', $method)
                    ->orWhereHas('payments', fn (Builder $paymentQuery) => $paymentQuery->where('payment_method', $method));
            });
        }

        return $query;
    }

    protected function growthPercentage(float $current, float $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return (($current - $previous) / $previous) * 100;
    }
}
