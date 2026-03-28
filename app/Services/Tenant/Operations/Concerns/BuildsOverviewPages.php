<?php

namespace App\Services\Tenant\Operations\Concerns;

use App\Models\Tenant\Sale;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;
use Illuminate\Support\Collection;

trait BuildsOverviewPages
{
    protected function salesQuery(Carbon $from, Carbon $to)
    {
        return Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);
    }

    protected function resolvePeriod(array $filters): array
    {
        $from = filled($filters['from'] ?? null)
            ? Carbon::parse((string) $filters['from'])
            : now()->startOfMonth();
        $to = filled($filters['to'] ?? null)
            ? Carbon::parse((string) $filters['to'])
            : now();

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        return [$from->startOfDay(), $to->endOfDay()];
    }

    protected function page(
        string $title,
        string $description,
        array $metrics,
        array $panels,
        array $tables,
        ?Carbon $from = null,
        ?Carbon $to = null,
    ): array {
        return [
            'title' => $title,
            'description' => $description,
            'metrics' => $metrics,
            'panels' => $panels,
            'tables' => $tables,
            'filters' => [
                'from' => $from?->format('Y-m-d'),
                'to' => $to?->format('Y-m-d'),
                'showDateRange' => $from !== null && $to !== null,
            ],
        ];
    }

    protected function metric(string $label, mixed $value, string $format = 'number', ?string $caption = null): array
    {
        return compact('label', 'value', 'format', 'caption');
    }

    protected function panel(string $title, Collection $items): array
    {
        return [
            'title' => $title,
            'items' => $items->values()->all(),
        ];
    }

    protected function table(string $title, array $columns, iterable $rows, string $emptyText): array
    {
        $normalizedRows = collect($rows)->map(function ($row) {
            if (is_array($row)) {
                return $row;
            }

            return (array) $row;
        })->values()->all();

        return compact('title', 'columns', 'emptyText') + ['rows' => $normalizedRows];
    }

    protected function paymentLabel(string $method): string
    {
        return PaymentMethod::label($method);
    }

    protected function currency(mixed $value): string
    {
        return 'R$ '.number_format((float) $value, 2, ',', '.');
    }

    protected function number(mixed $value): string
    {
        return number_format((float) $value, 0, ',', '.');
    }
}
