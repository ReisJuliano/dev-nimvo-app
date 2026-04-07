<?php

declare(strict_types=1);

namespace App\Services\Tenant\Reports;

use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Models\Tenant\Sale;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ReportBrowserService
{
    public function catalog(array $enabledModules = []): array
    {
        $categories = collect($this->categoryDefinitions())
            ->map(function (array $category) {
                $reports = collect($this->reportDefinitions())
                    ->where('category', $category['key'])
                    ->map(fn (array $report) => $this->catalogReportItem($report))
                    ->values()
                    ->all();

                return $category + [
                    'reports' => $reports,
                    'report_count' => count($reports),
                ];
            })
            ->filter(fn (array $category) => $category['report_count'] > 0)
            ->values();

        $activeCategory = (string) data_get($categories->first(), 'key', 'sales');
        $totalReports = (int) $categories->sum('report_count');

        return [
            'view' => 'reports_catalog',
            'title' => 'Relatorios',
            'description' => 'Abra os relatorios por categoria, em uma guia separada, com filtros e dados reais.',
            'metrics' => [
                [
                    'label' => 'Categorias',
                    'value' => $categories->count(),
                    'format' => 'number',
                    'caption' => 'Blocos disponiveis para navegacao.',
                ],
                [
                    'label' => 'Relatorios',
                    'value' => $totalReports,
                    'format' => 'number',
                    'caption' => 'Opcoes prontas para abrir em nova guia.',
                ],
                [
                    'label' => 'Base inicial',
                    'value' => 'Receitas',
                    'format' => 'text',
                    'caption' => 'A categoria de vendas abre primeiro.',
                ],
                [
                    'label' => 'Filtro padrao',
                    'value' => 'Mes atual',
                    'format' => 'text',
                    'caption' => 'Todos os relatorios nascem no mesmo recorte.',
                ],
            ],
            'filters' => [
                'showDateRange' => false,
                'activeCategory' => $activeCategory,
            ],
            'catalog' => [
                'activeCategory' => $activeCategory,
                'categories' => $categories->all(),
            ],
        ];
    }

    public function show(string $reportKey, array $filters = []): array
    {
        $definition = $this->reportDefinition($reportKey);
        abort_if($definition === null, 404);

        $resolvedFilters = $this->resolveFilters($filters);

        $payload = match ($reportKey) {
            'sales-daily' => $this->salesDailyReport($resolvedFilters),
            'sales-payments' => $this->salesPaymentsReport($resolvedFilters),
            'sales-products', 'product-demand' => $this->salesProductsReport($resolvedFilters),
            'sales-operators' => $this->salesOperatorsReport($resolvedFilters),
            'sales-customers', 'customer-ranking' => $this->salesCustomersReport($resolvedFilters),
            'stock-position' => $this->stockPositionReport($resolvedFilters),
            'cashflow-daily' => $this->cashFlowDailyReport($resolvedFilters),
            'receivables-open' => $this->receivablesOpenReport($resolvedFilters),
            default => abort(404),
        };

        $category = collect($this->categoryDefinitions())->firstWhere('key', $definition['category']);

        return array_merge($payload, [
            'report' => [
                'key' => $definition['key'],
                'title' => $definition['title'],
                'description' => $definition['description'],
                'icon' => $definition['icon'],
                'tags' => $definition['tags'],
                'category' => [
                    'key' => data_get($category, 'key'),
                    'label' => data_get($category, 'label'),
                    'icon' => data_get($category, 'icon'),
                ],
            ],
            'filters' => $this->responseFilters($resolvedFilters),
            'backHref' => '/relatorios',
        ]);
    }

    protected function categoryDefinitions(): array
    {
        return [
            [
                'key' => 'sales',
                'label' => 'Receitas/Vendas',
                'icon' => 'fa-chart-line',
                'description' => 'Faturamento, pagamento, operadores e clientes em relatorios de receita.',
            ],
            [
                'key' => 'products',
                'label' => 'Produtos',
                'icon' => 'fa-boxes-stacked',
                'description' => 'Giro, participacao na receita e ranking por item vendido.',
            ],
            [
                'key' => 'stock',
                'label' => 'Estoque',
                'icon' => 'fa-warehouse',
                'description' => 'Posicao atual, cobertura basica e valor do saldo estocado.',
            ],
            [
                'key' => 'cashflow',
                'label' => 'Fluxo',
                'icon' => 'fa-arrow-right-arrow-left',
                'description' => 'Entradas de vendas e movimentos de caixa consolidados por dia.',
            ],
            [
                'key' => 'receivables',
                'label' => 'Receber',
                'icon' => 'fa-credit-card',
                'description' => 'Carteira a prazo com limite, saldo lancado e disponibilidade.',
            ],
            [
                'key' => 'customers',
                'label' => 'Clientes',
                'icon' => 'fa-users',
                'description' => 'Ranking por faturamento e frequencia de compra.',
            ],
        ];
    }

    protected function reportDefinitions(): array
    {
        return [
            [
                'key' => 'sales-daily',
                'category' => 'sales',
                'title' => 'Faturamento por dia',
                'description' => 'Agrupa as vendas finalizadas por data com receita, ticket e lucro.',
                'icon' => 'fa-calendar-day',
                'tags' => ['Data', 'Ticket', 'Lucro'],
            ],
            [
                'key' => 'sales-payments',
                'category' => 'sales',
                'title' => 'Receita por pagamento',
                'description' => 'Mostra quanto cada forma de pagamento representou no periodo.',
                'icon' => 'fa-wallet',
                'tags' => ['Pagamento', 'Participacao', 'Receita'],
            ],
            [
                'key' => 'sales-products',
                'category' => 'sales',
                'title' => 'Produtos mais vendidos',
                'description' => 'Ranking de produtos com quantidade, faturamento e margem.',
                'icon' => 'fa-box-open',
                'tags' => ['Produto', 'Margem', 'Ranking'],
            ],
            [
                'key' => 'sales-operators',
                'category' => 'sales',
                'title' => 'Receita por operador',
                'description' => 'Compara vendas, ticket medio e lucro por usuario.',
                'icon' => 'fa-user-tie',
                'tags' => ['Equipe', 'Ticket', 'Lucro'],
            ],
            [
                'key' => 'sales-customers',
                'category' => 'sales',
                'title' => 'Clientes por faturamento',
                'description' => 'Ranking de clientes com frequencia de compra e ultima venda.',
                'icon' => 'fa-user-group',
                'tags' => ['Cliente', 'Recorrencia', 'Faturamento'],
            ],
            [
                'key' => 'product-demand',
                'category' => 'products',
                'title' => 'Demanda por produto',
                'description' => 'Curva de demanda dos itens vendidos no periodo.',
                'icon' => 'fa-arrow-trend-up',
                'tags' => ['Giro', 'Receita', 'Produto'],
            ],
            [
                'key' => 'stock-position',
                'category' => 'stock',
                'title' => 'Posicao atual do estoque',
                'description' => 'Saldo atual com minimo, valor estocado e giro do periodo.',
                'icon' => 'fa-layer-group',
                'tags' => ['Saldo', 'Minimo', 'Valor'],
            ],
            [
                'key' => 'cashflow-daily',
                'category' => 'cashflow',
                'title' => 'Fluxo diario de caixa',
                'description' => 'Entradas de vendas, suprimentos e sangrias por dia.',
                'icon' => 'fa-money-bill-transfer',
                'tags' => ['Entradas', 'Saidas', 'Saldo'],
            ],
            [
                'key' => 'receivables-open',
                'category' => 'receivables',
                'title' => 'Carteira a prazo',
                'description' => 'Clientes com limite, saldo lancado a prazo e disponibilidade.',
                'icon' => 'fa-file-invoice-dollar',
                'tags' => ['Limite', 'Carteira', 'Credito'],
            ],
            [
                'key' => 'customer-ranking',
                'category' => 'customers',
                'title' => 'Ranking de clientes',
                'description' => 'Clientes ordenados por faturamento e frequencia de compra.',
                'icon' => 'fa-ranking-star',
                'tags' => ['Ranking', 'Ticket', 'Recorrencia'],
            ],
        ];
    }

    protected function reportDefinition(string $reportKey): ?array
    {
        return collect($this->reportDefinitions())->firstWhere('key', $reportKey);
    }

    protected function catalogReportItem(array $report): array
    {
        return [
            'key' => $report['key'],
            'title' => $report['title'],
            'description' => $report['description'],
            'icon' => $report['icon'],
            'tags' => $report['tags'],
            'href' => route('reports.show', ['report' => $report['key']]),
        ];
    }

    protected function resolveFilters(array $filters): array
    {
        $today = now();
        $scope = in_array(($filters['scope'] ?? 'month'), ['date', 'month', 'months', 'range', 'year'], true)
            ? (string) $filters['scope']
            : 'month';

        $selectedDate = $this->parseDateOrDefault($filters['date'] ?? null, $today->copy()->startOfDay());
        $selectedMonth = $this->parseMonthOrDefault($filters['month'] ?? null, $today->copy()->startOfMonth());
        $selectedMonthFrom = $this->parseMonthOrDefault($filters['month_from'] ?? null, $selectedMonth->copy());
        $selectedMonthTo = $this->parseMonthOrDefault($filters['month_to'] ?? null, $selectedMonth->copy());

        if ($selectedMonthFrom->greaterThan($selectedMonthTo)) {
            [$selectedMonthFrom, $selectedMonthTo] = [$selectedMonthTo->copy(), $selectedMonthFrom->copy()];
        }

        $selectedYear = (int) ($filters['year'] ?? $today->year);

        if ($selectedYear < 2000 || $selectedYear > 2100) {
            $selectedYear = $today->year;
        }

        $rangeFrom = $this->parseDateOrDefault($filters['from'] ?? null, $today->copy()->startOfMonth()->startOfDay());
        $rangeTo = $this->parseDateOrDefault($filters['to'] ?? null, $today->copy()->endOfDay())->endOfDay();

        [$from, $to] = match ($scope) {
            'date' => [$selectedDate->copy()->startOfDay(), $selectedDate->copy()->endOfDay()],
            'months' => [$selectedMonthFrom->copy()->startOfMonth()->startOfDay(), $selectedMonthTo->copy()->endOfMonth()->endOfDay()],
            'year' => [
                Carbon::create($selectedYear, 1, 1)->startOfDay(),
                Carbon::create($selectedYear, 12, 31)->endOfDay(),
            ],
            'range' => [$rangeFrom->copy()->startOfDay(), $rangeTo->copy()->endOfDay()],
            default => [$selectedMonth->copy()->startOfMonth()->startOfDay(), $selectedMonth->copy()->endOfMonth()->endOfDay()],
        };

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to->copy(), $from->copy()];
        }

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = (int) ($filters['per_page'] ?? 20);
        $perPage = min(max($perPage, 10), 100);

        return [
            'scope' => $scope,
            'date' => $selectedDate,
            'month' => $selectedMonth,
            'month_from' => $selectedMonthFrom,
            'month_to' => $selectedMonthTo,
            'year' => $selectedYear,
            'from' => $from,
            'to' => $to,
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    protected function responseFilters(array $filters): array
    {
        return [
            'scope' => $filters['scope'],
            'date' => $filters['date']->format('Y-m-d'),
            'month' => $filters['month']->format('Y-m'),
            'month_from' => $filters['month_from']->format('Y-m'),
            'month_to' => $filters['month_to']->format('Y-m'),
            'year' => (string) $filters['year'],
            'from' => $filters['from']->format('Y-m-d'),
            'to' => $filters['to']->format('Y-m-d'),
            'page' => $filters['page'],
            'per_page' => $filters['per_page'],
        ];
    }

    protected function parseDateOrDefault(mixed $value, Carbon $fallback): Carbon
    {
        if (! filled($value)) {
            return $fallback;
        }

        try {
            return Carbon::parse((string) $value);
        } catch (\Throwable) {
            return $fallback;
        }
    }

    protected function parseMonthOrDefault(mixed $value, Carbon $fallback): Carbon
    {
        if (! filled($value)) {
            return $fallback;
        }

        try {
            return Carbon::createFromFormat('Y-m', (string) $value)->startOfMonth();
        } catch (\Throwable) {
            return $fallback;
        }
    }

    protected function salesDailyReport(array $filters): array
    {
        $summary = $this->baseSalesQuery($filters)
            ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $query = $this->baseSalesQuery($filters)
            ->selectRaw('DATE(created_at) as reference_date, COUNT(*) as sales_count, COALESCE(SUM(total), 0) as total, COALESCE(AVG(total), 0) as avg_ticket, COALESCE(SUM(profit), 0) as profit')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderByDesc('reference_date');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'reference_date' => $row->reference_date,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'avg_ticket' => (float) $row->avg_ticket,
            'profit' => (float) $row->profit,
        ])->all();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Faturamento', (float) ($summary->total ?? 0), 'money', 'fa-wallet'),
                $this->summaryCard('Vendas', (int) ($summary->sales_count ?? 0), 'number', 'fa-receipt'),
                $this->summaryCard(
                    'Ticket medio',
                    (float) ($summary->sales_count ?? 0) > 0 ? (float) $summary->total / (float) $summary->sales_count : 0,
                    'money',
                    'fa-chart-column'
                ),
                $this->summaryCard('Lucro', (float) ($summary->profit ?? 0), 'money', 'fa-sack-dollar'),
            ],
            columns: [
                ['key' => 'reference_date', 'label' => 'Data', 'format' => 'date'],
                ['key' => 'sales_count', 'label' => 'Vendas', 'format' => 'number'],
                ['key' => 'total', 'label' => 'Faturamento', 'format' => 'money'],
                ['key' => 'avg_ticket', 'label' => 'Ticket', 'format' => 'money'],
                ['key' => 'profit', 'label' => 'Lucro', 'format' => 'money'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhuma venda finalizada no recorte selecionado.',
        );
    }

    protected function salesPaymentsReport(array $filters): array
    {
        $baseQuery = DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']]);

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as launches, COUNT(DISTINCT sale_payments.payment_method) as methods_count, COALESCE(SUM(sale_payments.amount), 0) as total')
            ->first();

        $grandTotal = (float) ($summary->total ?? 0);
        $query = (clone $baseQuery)
            ->selectRaw('sale_payments.payment_method, COUNT(*) as launches, COUNT(DISTINCT sales.id) as sales_count, COALESCE(SUM(sale_payments.amount), 0) as total, COALESCE(AVG(sale_payments.amount), 0) as avg_amount')
            ->groupBy('sale_payments.payment_method')
            ->orderByDesc('total');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'payment_method' => PaymentMethod::label((string) $row->payment_method),
            'launches' => (int) $row->launches,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'share' => $grandTotal > 0 ? ((float) $row->total / $grandTotal) * 100 : 0,
            'avg_amount' => (float) $row->avg_amount,
        ])->all();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Receita', $grandTotal, 'money', 'fa-coins'),
                $this->summaryCard('Lancamentos', (int) ($summary->launches ?? 0), 'number', 'fa-list'),
                $this->summaryCard('Metodos', (int) ($summary->methods_count ?? 0), 'number', 'fa-credit-card'),
                $this->summaryCard(
                    'Media',
                    (int) ($summary->launches ?? 0) > 0 ? $grandTotal / (int) $summary->launches : 0,
                    'money',
                    'fa-calculator'
                ),
            ],
            columns: [
                ['key' => 'payment_method', 'label' => 'Pagamento'],
                ['key' => 'launches', 'label' => 'Lancamentos', 'format' => 'number'],
                ['key' => 'sales_count', 'label' => 'Vendas', 'format' => 'number'],
                ['key' => 'total', 'label' => 'Valor', 'format' => 'money'],
                ['key' => 'share', 'label' => 'Participacao', 'format' => 'percent'],
                ['key' => 'avg_amount', 'label' => 'Media', 'format' => 'money'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhum pagamento encontrado no recorte selecionado.',
        );
    }

    protected function salesProductsReport(array $filters): array
    {
        $baseQuery = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']]);

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(DISTINCT products.id) as products_count, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold, COALESCE(SUM(sale_items.total), 0) as revenue, COALESCE(SUM(sale_items.profit), 0) as profit')
            ->first();

        $query = (clone $baseQuery)
            ->selectRaw("products.code, products.name, COALESCE(categories.name, 'Sem categoria') as category_name, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold, COALESCE(SUM(sale_items.total), 0) as revenue, COALESCE(SUM(sale_items.profit), 0) as profit")
            ->groupBy('products.id', 'products.code', 'products.name', 'categories.name')
            ->orderByDesc('quantity_sold');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'code' => $row->code ?: '-',
            'name' => $row->name,
            'category_name' => $row->category_name,
            'quantity_sold' => (float) $row->quantity_sold,
            'revenue' => (float) $row->revenue,
            'profit' => (float) $row->profit,
            'margin' => (float) $row->revenue > 0 ? ((float) $row->profit / (float) $row->revenue) * 100 : 0,
        ])->all();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Itens com giro', (int) ($summary->products_count ?? 0), 'number', 'fa-boxes-stacked'),
                $this->summaryCard('Qtd. vendida', (float) ($summary->quantity_sold ?? 0), 'number', 'fa-arrow-trend-up'),
                $this->summaryCard('Receita', (float) ($summary->revenue ?? 0), 'money', 'fa-cash-register'),
                $this->summaryCard('Lucro', (float) ($summary->profit ?? 0), 'money', 'fa-sack-dollar'),
            ],
            columns: [
                ['key' => 'code', 'label' => 'Codigo'],
                ['key' => 'name', 'label' => 'Produto'],
                ['key' => 'category_name', 'label' => 'Categoria'],
                ['key' => 'quantity_sold', 'label' => 'Quantidade', 'format' => 'decimal'],
                ['key' => 'revenue', 'label' => 'Receita', 'format' => 'money'],
                ['key' => 'margin', 'label' => 'Margem', 'format' => 'percent'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhum produto com venda no recorte selecionado.',
        );
    }

    protected function salesOperatorsReport(array $filters): array
    {
        $summary = $this->baseSalesQuery($filters)
            ->selectRaw('COUNT(*) as sales_count, COUNT(DISTINCT user_id) as users_count, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $query = $this->baseSalesQuery($filters)
            ->join('users', 'users.id', '=', 'sales.user_id')
            ->selectRaw('users.name as user_name, COUNT(*) as sales_count, COALESCE(SUM(sales.total), 0) as total, COALESCE(AVG(sales.total), 0) as avg_ticket, COALESCE(SUM(sales.profit), 0) as profit')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'user_name' => $row->user_name,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'avg_ticket' => (float) $row->avg_ticket,
            'profit' => (float) $row->profit,
        ])->all();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Receita', (float) ($summary->total ?? 0), 'money', 'fa-money-bill-wave'),
                $this->summaryCard('Operadores', (int) ($summary->users_count ?? 0), 'number', 'fa-users'),
                $this->summaryCard(
                    'Ticket medio',
                    (int) ($summary->sales_count ?? 0) > 0 ? (float) $summary->total / (int) $summary->sales_count : 0,
                    'money',
                    'fa-chart-line'
                ),
                $this->summaryCard('Lucro', (float) ($summary->profit ?? 0), 'money', 'fa-sack-dollar'),
            ],
            columns: [
                ['key' => 'user_name', 'label' => 'Operador'],
                ['key' => 'sales_count', 'label' => 'Vendas', 'format' => 'number'],
                ['key' => 'total', 'label' => 'Receita', 'format' => 'money'],
                ['key' => 'avg_ticket', 'label' => 'Ticket', 'format' => 'money'],
                ['key' => 'profit', 'label' => 'Lucro', 'format' => 'money'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhum operador com venda no recorte selecionado.',
        );
    }

    protected function salesCustomersReport(array $filters): array
    {
        $summary = $this->baseSalesQuery($filters)
            ->selectRaw('COUNT(*) as sales_count, COUNT(DISTINCT customer_id) as customers_count, COALESCE(SUM(total), 0) as total')
            ->first();

        $query = $this->baseSalesQuery($filters)
            ->leftJoin('customers', 'customers.id', '=', 'sales.customer_id')
            ->selectRaw("COALESCE(customers.name, 'Nao identificado') as customer_name, COUNT(*) as sales_count, COALESCE(SUM(sales.total), 0) as total, COALESCE(AVG(sales.total), 0) as avg_ticket, MAX(sales.created_at) as last_sale_at")
            ->groupBy('sales.customer_id', 'customers.name')
            ->orderByDesc('total');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'customer_name' => $row->customer_name,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'avg_ticket' => (float) $row->avg_ticket,
            'last_sale_at' => $row->last_sale_at,
        ])->all();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Receita', (float) ($summary->total ?? 0), 'money', 'fa-wallet'),
                $this->summaryCard('Clientes', (int) ($summary->customers_count ?? 0), 'number', 'fa-user-group'),
                $this->summaryCard('Vendas', (int) ($summary->sales_count ?? 0), 'number', 'fa-receipt'),
                $this->summaryCard(
                    'Ticket medio',
                    (int) ($summary->sales_count ?? 0) > 0 ? (float) $summary->total / (int) $summary->sales_count : 0,
                    'money',
                    'fa-chart-column'
                ),
            ],
            columns: [
                ['key' => 'customer_name', 'label' => 'Cliente'],
                ['key' => 'sales_count', 'label' => 'Vendas', 'format' => 'number'],
                ['key' => 'total', 'label' => 'Receita', 'format' => 'money'],
                ['key' => 'avg_ticket', 'label' => 'Ticket', 'format' => 'money'],
                ['key' => 'last_sale_at', 'label' => 'Ultima venda', 'format' => 'datetime'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhum cliente com venda no recorte selecionado.',
        );
    }

    protected function stockPositionReport(array $filters): array
    {
        $salesSubquery = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']])
            ->groupBy('sale_items.product_id')
            ->selectRaw('sale_items.product_id, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold, COALESCE(SUM(sale_items.total), 0) as revenue');

        $query = Product::query()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->leftJoinSub($salesSubquery, 'period_sales', fn ($join) => $join->on('period_sales.product_id', '=', 'products.id'))
            ->where('products.active', true)
            ->selectRaw("products.code, products.name, COALESCE(categories.name, 'Sem categoria') as category_name, products.stock_quantity, products.min_stock, products.cost_price, COALESCE(period_sales.quantity_sold, 0) as quantity_sold, COALESCE(period_sales.revenue, 0) as revenue, (products.stock_quantity * products.cost_price) as stock_value")
            ->orderBy('products.name');

        $summary = Product::query()
            ->where('active', true)
            ->selectRaw('COUNT(*) as products_count, COALESCE(SUM(stock_quantity * cost_price), 0) as stock_value, COALESCE(SUM(CASE WHEN stock_quantity <= min_stock THEN 1 ELSE 0 END), 0) as low_stock')
            ->first();

        $periodSummary = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']])
            ->selectRaw('COALESCE(SUM(sale_items.quantity), 0) as quantity_sold')
            ->first();

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'code' => $row->code ?: '-',
            'name' => $row->name,
            'category_name' => $row->category_name,
            'stock_quantity' => (float) $row->stock_quantity,
            'min_stock' => (float) $row->min_stock,
            'quantity_sold' => (float) $row->quantity_sold,
            'stock_value' => (float) $row->stock_value,
            'status' => (float) $row->stock_quantity <= 0
                ? 'Sem saldo'
                : ((float) $row->stock_quantity <= (float) $row->min_stock ? 'Abaixo do minimo' : 'Saudavel'),
        ])->all();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Itens ativos', (int) ($summary->products_count ?? 0), 'number', 'fa-boxes-stacked'),
                $this->summaryCard('Valor em estoque', (float) ($summary->stock_value ?? 0), 'money', 'fa-warehouse'),
                $this->summaryCard('Baixo estoque', (int) ($summary->low_stock ?? 0), 'number', 'fa-triangle-exclamation'),
                $this->summaryCard('Saida no periodo', (float) ($periodSummary->quantity_sold ?? 0), 'number', 'fa-arrow-trend-down'),
            ],
            columns: [
                ['key' => 'code', 'label' => 'Codigo'],
                ['key' => 'name', 'label' => 'Produto'],
                ['key' => 'category_name', 'label' => 'Categoria'],
                ['key' => 'stock_quantity', 'label' => 'Saldo', 'format' => 'decimal'],
                ['key' => 'min_stock', 'label' => 'Minimo', 'format' => 'decimal'],
                ['key' => 'stock_value', 'label' => 'Valor', 'format' => 'money'],
                ['key' => 'status', 'label' => 'Status'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhum produto ativo encontrado para o estoque.',
        );
    }

    protected function cashFlowDailyReport(array $filters): array
    {
        $salesByDay = DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']])
            ->groupBy(DB::raw('DATE(sales.created_at)'))
            ->orderBy('day')
            ->get([
                DB::raw('DATE(sales.created_at) as day'),
                DB::raw('COALESCE(SUM(sale_payments.amount), 0) as incoming_sales'),
            ])
            ->keyBy('day');

        $movementsByDay = DB::table('cash_movements')
            ->whereBetween('cash_movements.created_at', [$filters['from'], $filters['to']])
            ->groupBy(DB::raw('DATE(cash_movements.created_at)'))
            ->orderBy('day')
            ->get([
                DB::raw('DATE(cash_movements.created_at) as day'),
                DB::raw("COALESCE(SUM(CASE WHEN cash_movements.type = 'supply' THEN cash_movements.amount ELSE 0 END), 0) as supplies"),
                DB::raw("COALESCE(SUM(CASE WHEN cash_movements.type = 'withdrawal' THEN cash_movements.amount ELSE 0 END), 0) as withdrawals"),
            ])
            ->keyBy('day');

        $days = collect();
        $cursor = $filters['from']->copy()->startOfDay();

        while ($cursor->lessThanOrEqualTo($filters['to'])) {
            $days->push($cursor->format('Y-m-d'));
            $cursor->addDay();
        }

        $rows = $days->map(function (string $day) use ($salesByDay, $movementsByDay) {
            $sales = $salesByDay->get($day);
            $movements = $movementsByDay->get($day);
            $incomingSales = (float) ($sales->incoming_sales ?? 0);
            $supplies = (float) ($movements->supplies ?? 0);
            $withdrawals = (float) ($movements->withdrawals ?? 0);

            return [
                'reference_date' => $day,
                'incoming_sales' => $incomingSales,
                'supplies' => $supplies,
                'withdrawals' => $withdrawals,
                'balance' => ($incomingSales + $supplies) - $withdrawals,
            ];
        })->filter(fn (array $row) => $row['incoming_sales'] > 0 || $row['supplies'] > 0 || $row['withdrawals'] > 0)->values();

        $paginator = $this->paginateCollection(
            $rows->sortByDesc('reference_date')->values(),
            $filters['per_page'],
            $filters['page']
        );

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Entradas em vendas', $rows->sum('incoming_sales'), 'money', 'fa-money-bill-trend-up'),
                $this->summaryCard('Suprimentos', $rows->sum('supplies'), 'money', 'fa-arrow-up'),
                $this->summaryCard('Sangrias', $rows->sum('withdrawals'), 'money', 'fa-arrow-down'),
                $this->summaryCard('Saldo liquido', $rows->sum('balance'), 'money', 'fa-scale-balanced'),
            ],
            columns: [
                ['key' => 'reference_date', 'label' => 'Data', 'format' => 'date'],
                ['key' => 'incoming_sales', 'label' => 'Entradas', 'format' => 'money'],
                ['key' => 'supplies', 'label' => 'Suprimento', 'format' => 'money'],
                ['key' => 'withdrawals', 'label' => 'Sangria', 'format' => 'money'],
                ['key' => 'balance', 'label' => 'Saldo', 'format' => 'money'],
            ],
            rows: $paginator->items(),
            paginator: $paginator,
            emptyText: 'Nenhum movimento de caixa encontrado no recorte selecionado.',
        );
    }

    protected function receivablesOpenReport(array $filters): array
    {
        $customers = Customer::query()
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Customer $customer) {
                $launchedCredit = (float) $customer->sales()
                    ->where('status', 'finalized')
                    ->whereHas('payments', fn ($query) => $query->where('payment_method', PaymentMethod::CREDIT))
                    ->join('sale_payments', 'sale_payments.sale_id', '=', 'sales.id')
                    ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
                    ->sum('sale_payments.amount');

                return [
                    'name' => $customer->name,
                    'phone' => $customer->phone ?: '-',
                    'credit_limit' => (float) $customer->credit_limit,
                    'launched_credit' => $launchedCredit,
                    'available_credit' => max(0, (float) $customer->credit_limit - $launchedCredit),
                ];
            })
            ->filter(fn (array $customer) => $customer['credit_limit'] > 0 || $customer['launched_credit'] > 0)
            ->sortByDesc('launched_credit')
            ->values();

        $paginator = $this->paginateCollection($customers, $filters['per_page'], $filters['page']);

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Clientes', $customers->count(), 'number', 'fa-users'),
                $this->summaryCard('Carteira lancada', $customers->sum('launched_credit'), 'money', 'fa-file-invoice-dollar'),
                $this->summaryCard('Limite total', $customers->sum('credit_limit'), 'money', 'fa-sack-dollar'),
                $this->summaryCard('Disponivel', $customers->sum('available_credit'), 'money', 'fa-wallet'),
            ],
            columns: [
                ['key' => 'name', 'label' => 'Cliente'],
                ['key' => 'phone', 'label' => 'Telefone'],
                ['key' => 'credit_limit', 'label' => 'Limite', 'format' => 'money'],
                ['key' => 'launched_credit', 'label' => 'Lancado', 'format' => 'money'],
                ['key' => 'available_credit', 'label' => 'Disponivel', 'format' => 'money'],
            ],
            rows: $paginator->items(),
            paginator: $paginator,
            emptyText: 'Nenhum cliente com limite ou saldo a prazo encontrado.',
        );
    }

    protected function reportPayload(array $summary, array $columns, array $rows, LengthAwarePaginator $paginator, string $emptyText): array
    {
        return [
            'summary' => $summary,
            'columns' => $columns,
            'rows' => $rows,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'emptyText' => $emptyText,
        ];
    }

    protected function paginateCollection(Collection $items, int $perPage, int $page): LengthAwarePaginator
    {
        $page = max(1, $page);
        $total = $items->count();
        $sliced = $items->forPage($page, $perPage)->values();

        return new LengthAwarePaginator(
            $sliced->all(),
            $total,
            $perPage,
            $page,
            ['path' => LengthAwarePaginator::resolveCurrentPath()]
        );
    }

    protected function baseSalesQuery(array $filters)
    {
        return Sale::query()
            ->where('status', 'finalized')
            ->whereBetween('created_at', [$filters['from'], $filters['to']]);
    }

    protected function summaryCard(string $label, mixed $value, string $format, string $icon): array
    {
        return compact('label', 'value', 'format', 'icon');
    }
}
