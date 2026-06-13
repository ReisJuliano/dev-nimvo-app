<?php

declare(strict_types=1);

namespace App\Services\Tenant\Reports;

use App\Models\Tenant\Customer;
use App\Models\Tenant\Product;
use App\Models\Tenant\Purchase;
use App\Models\Tenant\Sale;
use App\Support\TextSearch;
use App\Support\Tenant\PaymentMethod;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
        $filterSchema = $this->reportFilterSchema($reportKey);

        $payload = $resolvedFilters['applied']
            ? match ($reportKey) {
                'sales-daily' => $this->salesDailyReport($resolvedFilters),
                'sales-payments' => $this->salesPaymentsReport($resolvedFilters),
                'sales-products', 'product-demand' => $this->salesProductsReport($resolvedFilters),
                'sales-operators' => $this->salesOperatorsReport($resolvedFilters),
                'sales-customers', 'customer-ranking' => $this->salesCustomersReport($resolvedFilters),
                'stock-shortages' => $this->stockShortagesReport($resolvedFilters),
                'stock-position' => $this->stockPositionReport($resolvedFilters),
                'stock-inbounds' => $this->stockInboundsReport($resolvedFilters),
                'cashflow-daily' => $this->cashFlowDailyReport($resolvedFilters),
                'receivables-open' => $this->receivablesOpenReport($resolvedFilters),
                default => abort(404),
            }
            : $this->reportPayload(
                summary: [],
                columns: [],
                rows: [],
                paginator: null,
                emptyText: 'Aplique filtros para visualizar.',
            );

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
            'filtersApplied' => $resolvedFilters['applied'],
            'filterSchema' => $filterSchema,
            'filterOptions' => $this->reportFilterOptions(),
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
                'description' => 'Fiados em aberto com limite, saldo lancado e disponibilidade.',
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
                'key' => 'stock-shortages',
                'category' => 'stock',
                'title' => 'Faltas e giro',
                'description' => 'Itens abaixo do minimo com saldo atual, falta e saida no periodo.',
                'icon' => 'fa-triangle-exclamation',
                'tags' => ['Falta', 'Giro', 'Reposicao'],
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
                'key' => 'stock-inbounds',
                'category' => 'stock',
                'title' => 'Entradas de mercadoria',
                'description' => 'Recebimentos por fornecedor, nota, quantidade e dados de boleto.',
                'icon' => 'fa-dolly',
                'tags' => ['Entrada', 'Nota', 'Boleto'],
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
                'title' => 'Fiados em aberto',
                'description' => 'Clientes com limite, saldo fiado e disponibilidade.',
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
        $requestedScope = trim((string) ($filters['scope'] ?? ''));
        $scope = in_array($requestedScope, ['date', 'month', 'months', 'range', 'year'], true)
            ? $requestedScope
            : 'month';
        $applied = $this->hasAppliedFilters($filters);

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
        $exportFormat = $this->normalizeSelection($filters['export'] ?? null, ['pdf', 'excel']);
        $perPage = (int) ($filters['per_page'] ?? 20);
        $perPage = min(max($perPage, 10), $exportFormat ? 5000 : 100);
        $query = trim((string) ($filters['query'] ?? ''));
        $sortBy = trim((string) ($filters['sort_by'] ?? ''));

        return [
            'applied' => $applied,
            'export' => $exportFormat,
            'scope' => $scope,
            'date' => $selectedDate,
            'month' => $selectedMonth,
            'month_from' => $selectedMonthFrom,
            'month_to' => $selectedMonthTo,
            'year' => $selectedYear,
            'from' => $from,
            'to' => $to,
            'query' => $query !== '' ? $query : null,
            'payment_method' => $this->normalizeSelection($filters['payment_method'] ?? null, PaymentMethod::saleMethods()),
            'operator_id' => $this->normalizePositiveInt($filters['operator_id'] ?? null),
            'customer_id' => $this->normalizePositiveInt($filters['customer_id'] ?? null),
            'category_id' => $this->normalizePositiveInt($filters['category_id'] ?? null),
            'supplier_id' => $this->normalizePositiveInt($filters['supplier_id'] ?? null),
            'stock_status' => $this->normalizeSelection($filters['stock_status'] ?? null, ['healthy', 'low', 'out']),
            'balance_status' => $this->normalizeSelection($filters['balance_status'] ?? null, ['with_balance', 'near_limit', 'without_limit']),
            'sort_by' => $sortBy !== '' ? $sortBy : null,
            'sort_direction' => $this->normalizeSelection($filters['sort_direction'] ?? null, ['asc', 'desc']) ?? 'desc',
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    protected function responseFilters(array $filters): array
    {
        return [
            'applied' => $filters['applied'],
            'export' => $filters['export'] ?? '',
            'scope' => $filters['scope'],
            'date' => $filters['date']->format('Y-m-d'),
            'month' => $filters['month']->format('Y-m'),
            'month_from' => $filters['month_from']->format('Y-m'),
            'month_to' => $filters['month_to']->format('Y-m'),
            'year' => (string) $filters['year'],
            'from' => $filters['from']->format('Y-m-d'),
            'to' => $filters['to']->format('Y-m-d'),
            'query' => $filters['query'] ?? '',
            'payment_method' => $filters['payment_method'] ?? '',
            'operator_id' => $filters['operator_id'] ? (string) $filters['operator_id'] : '',
            'customer_id' => $filters['customer_id'] ? (string) $filters['customer_id'] : '',
            'category_id' => $filters['category_id'] ? (string) $filters['category_id'] : '',
            'supplier_id' => $filters['supplier_id'] ? (string) $filters['supplier_id'] : '',
            'stock_status' => $filters['stock_status'] ?? '',
            'balance_status' => $filters['balance_status'] ?? '',
            'sort_by' => $filters['sort_by'] ?? '',
            'sort_direction' => $filters['sort_direction'],
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

    protected function hasAppliedFilters(array $filters): bool
    {
        if (filter_var($filters['applied'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return true;
        }

        foreach ([
            'scope',
            'date',
            'month',
            'month_from',
            'month_to',
            'year',
            'from',
            'to',
            'query',
            'payment_method',
            'operator_id',
            'customer_id',
            'category_id',
            'supplier_id',
            'stock_status',
            'balance_status',
            'sort_by',
        ] as $key) {
            if (filled($filters[$key] ?? null)) {
                return true;
            }
        }

        return false;
    }

    protected function normalizePositiveInt(mixed $value): ?int
    {
        $normalized = (int) $value;

        return $normalized > 0 ? $normalized : null;
    }

    protected function normalizeSelection(mixed $value, array $allowed): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        if ($normalized === '') {
            return null;
        }

        return in_array($normalized, $allowed, true) ? $normalized : null;
    }

    protected function reportFilterSchema(string $reportKey): array
    {
        return match ($reportKey) {
            'sales-daily' => [
                'fields' => ['scope', 'operator_id', 'customer_id', 'payment_method', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'reference_date', 'label' => 'Data'],
                    ['value' => 'sales_count', 'label' => 'Vendas'],
                    ['value' => 'total', 'label' => 'Receita'],
                    ['value' => 'avg_ticket', 'label' => 'Ticket'],
                    ['value' => 'profit', 'label' => 'Lucro'],
                ],
                'default_sort' => ['by' => 'reference_date', 'direction' => 'desc'],
            ],
            'sales-payments' => [
                'fields' => ['scope', 'operator_id', 'customer_id', 'payment_method', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'total', 'label' => 'Receita'],
                    ['value' => 'launches', 'label' => 'Lancamentos'],
                    ['value' => 'sales_count', 'label' => 'Vendas'],
                    ['value' => 'avg_amount', 'label' => 'Media'],
                    ['value' => 'payment_method', 'label' => 'Metodo'],
                ],
                'default_sort' => ['by' => 'total', 'direction' => 'desc'],
            ],
            'sales-products', 'product-demand' => [
                'fields' => ['scope', 'query', 'category_id', 'operator_id', 'customer_id', 'payment_method', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'quantity_sold', 'label' => 'Quantidade'],
                    ['value' => 'revenue', 'label' => 'Receita'],
                    ['value' => 'profit', 'label' => 'Lucro'],
                    ['value' => 'margin', 'label' => 'Margem'],
                    ['value' => 'name', 'label' => 'Produto'],
                ],
                'default_sort' => ['by' => 'quantity_sold', 'direction' => 'desc'],
                'search_placeholder' => 'Produto ou codigo',
            ],
            'sales-operators' => [
                'fields' => ['scope', 'operator_id', 'customer_id', 'payment_method', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'total', 'label' => 'Receita'],
                    ['value' => 'sales_count', 'label' => 'Vendas'],
                    ['value' => 'avg_ticket', 'label' => 'Ticket'],
                    ['value' => 'profit', 'label' => 'Lucro'],
                    ['value' => 'user_name', 'label' => 'Operador'],
                ],
                'default_sort' => ['by' => 'total', 'direction' => 'desc'],
            ],
            'sales-customers', 'customer-ranking' => [
                'fields' => ['scope', 'query', 'customer_id', 'operator_id', 'payment_method', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'total', 'label' => 'Receita'],
                    ['value' => 'sales_count', 'label' => 'Vendas'],
                    ['value' => 'avg_ticket', 'label' => 'Ticket'],
                    ['value' => 'last_sale_at', 'label' => 'Ultima venda'],
                    ['value' => 'customer_name', 'label' => 'Cliente'],
                ],
                'default_sort' => ['by' => 'total', 'direction' => 'desc'],
                'search_placeholder' => 'Cliente',
            ],
            'stock-position' => [
                'fields' => ['scope', 'query', 'category_id', 'supplier_id', 'stock_status', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'stock_value', 'label' => 'Valor'],
                    ['value' => 'stock_quantity', 'label' => 'Saldo'],
                    ['value' => 'quantity_sold', 'label' => 'Giro'],
                    ['value' => 'name', 'label' => 'Produto'],
                    ['value' => 'status', 'label' => 'Status'],
                ],
                'default_sort' => ['by' => 'name', 'direction' => 'asc'],
                'search_placeholder' => 'Produto ou codigo',
            ],
            'stock-shortages' => [
                'fields' => ['scope', 'query', 'category_id', 'supplier_id', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'missing', 'label' => 'Falta'],
                    ['value' => 'quantity_sold', 'label' => 'Giro'],
                    ['value' => 'stock_quantity', 'label' => 'Saldo'],
                    ['value' => 'name', 'label' => 'Produto'],
                    ['value' => 'supplier_name', 'label' => 'Fornecedor'],
                ],
                'default_sort' => ['by' => 'missing', 'direction' => 'desc'],
                'search_placeholder' => 'Produto ou codigo',
            ],
            'stock-inbounds' => [
                'fields' => ['scope', 'query', 'supplier_id', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'received_at', 'label' => 'Recebido'],
                    ['value' => 'total', 'label' => 'Total'],
                    ['value' => 'quantity_total', 'label' => 'Qtd'],
                    ['value' => 'items_count', 'label' => 'Itens'],
                    ['value' => 'supplier_name', 'label' => 'Fornecedor'],
                ],
                'default_sort' => ['by' => 'received_at', 'direction' => 'desc'],
                'search_placeholder' => 'Codigo ou fornecedor',
            ],
            'cashflow-daily' => [
                'fields' => ['scope', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'reference_date', 'label' => 'Data'],
                    ['value' => 'incoming_sales', 'label' => 'Entradas'],
                    ['value' => 'supplies', 'label' => 'Suprimento'],
                    ['value' => 'withdrawals', 'label' => 'Sangria'],
                    ['value' => 'balance', 'label' => 'Saldo'],
                ],
                'default_sort' => ['by' => 'reference_date', 'direction' => 'desc'],
            ],
            'receivables-open' => [
                'fields' => ['query', 'customer_id', 'balance_status', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [
                    ['value' => 'launched_credit', 'label' => 'Lancado'],
                    ['value' => 'available_credit', 'label' => 'Disponivel'],
                    ['value' => 'credit_limit', 'label' => 'Limite'],
                    ['value' => 'name', 'label' => 'Cliente'],
                ],
                'default_sort' => ['by' => 'launched_credit', 'direction' => 'desc'],
                'search_placeholder' => 'Cliente ou telefone',
            ],
            default => [
                'fields' => ['scope', 'sort_by', 'sort_direction', 'per_page'],
                'sort_options' => [],
                'default_sort' => ['by' => 'created_at', 'direction' => 'desc'],
            ],
        };
    }

    protected function reportFilterOptions(): array
    {
        return [
            'payment_methods' => collect(PaymentMethod::saleMethods())
                ->map(fn (string $method) => [
                    'value' => $method,
                    'label' => PaymentMethod::label($method),
                ])
                ->all(),
            'operators' => $this->operatorFilterOptions(),
            'customers' => $this->customerFilterOptions(),
            'categories' => $this->namedLookupFilterOptions('categories'),
            'suppliers' => $this->namedLookupFilterOptions('suppliers', 120),
            'stock_statuses' => [
                ['value' => 'healthy', 'label' => 'Saudavel'],
                ['value' => 'low', 'label' => 'Baixo estoque'],
                ['value' => 'out', 'label' => 'Sem saldo'],
            ],
            'balance_statuses' => [
                ['value' => 'with_balance', 'label' => 'Com saldo'],
                ['value' => 'near_limit', 'label' => 'Perto do limite'],
                ['value' => 'without_limit', 'label' => 'Sem limite'],
            ],
        ];
    }

    protected function operatorFilterOptions(): array
    {
        if (! $this->hasTableColumns('users', ['id', 'name'])) {
            return [];
        }

        return DB::table('users')
            ->orderBy('name')
            ->limit(80)
            ->get(['id', 'name'])
            ->map(fn ($user) => [
                'value' => (string) $user->id,
                'label' => (string) $user->name,
            ])
            ->all();
    }

    protected function customerFilterOptions(): array
    {
        if (! $this->hasTableColumns('customers', ['id', 'name'])) {
            return [];
        }

        $columns = ['id', 'name'];

        if ($this->hasTableColumn('customers', 'phone')) {
            $columns[] = 'phone';
        }

        $query = Customer::query()
            ->orderBy('name')
            ->limit(120);

        if ($this->hasTableColumn('customers', 'active')) {
            $query->where('active', true);
        }

        return $query
            ->get($columns)
            ->map(fn (Customer $customer) => [
                'value' => (string) $customer->getKey(),
                'label' => $customer->phone
                    ? "{$customer->name} - {$customer->phone}"
                    : $customer->name,
            ])
            ->all();
    }

    protected function namedLookupFilterOptions(string $table, ?int $limit = null): array
    {
        if (! $this->hasTableColumns($table, ['id', 'name'])) {
            return [];
        }

        $query = DB::table($table)->orderBy('name');

        if ($limit !== null) {
            $query->limit($limit);
        }

        return $query
            ->get(['id', 'name'])
            ->map(fn ($record) => [
                'value' => (string) $record->id,
                'label' => (string) $record->name,
            ])
            ->all();
    }

    protected function hasTableColumns(string $table, array $columns): bool
    {
        if (! $this->reportSchema()->hasTable($table)) {
            return false;
        }

        foreach ($columns as $column) {
            if (! $this->hasTableColumn($table, $column)) {
                return false;
            }
        }

        return true;
    }

    protected function hasTableColumn(string $table, string $column): bool
    {
        return $this->reportSchema()->hasColumn($table, $column);
    }

    protected function reportSchema(): \Illuminate\Database\Schema\Builder
    {
        return Schema::connection((new Product())->getConnectionName());
    }

    protected function salesDailyReport(array $filters): array
    {
        $referenceDateExpression = 'DATE(sales.created_at)';
        $summary = $this->baseSalesQuery($filters)
            ->selectRaw('COUNT(*) as sales_count, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $trendRows = $this->baseSalesQuery($filters)
            ->selectRaw("{$referenceDateExpression} as reference_date, COUNT(*) as sales_count, COALESCE(SUM(total), 0) as total, COALESCE(AVG(total), 0) as avg_ticket, COALESCE(SUM(profit), 0) as profit")
            ->groupBy(DB::raw($referenceDateExpression))
            ->orderByRaw("{$referenceDateExpression} asc")
            ->get()
            ->map(fn ($row) => [
                'reference_date' => $row->reference_date,
                'sales_count' => (int) $row->sales_count,
                'total' => (float) $row->total,
                'avg_ticket' => (float) $row->avg_ticket,
                'profit' => (float) $row->profit,
            ])
            ->values();

        $sortedRows = $this->sortCollection($trendRows, $filters, [
            'reference_date' => 'reference_date',
            'sales_count' => 'sales_count',
            'total' => 'total',
            'avg_ticket' => 'avg_ticket',
            'profit' => 'profit',
        ], 'reference_date', 'desc');
        $paginator = $this->paginateCollection($sortedRows, $filters['per_page'], $filters['page']);
        $rows = $paginator->items();
        $bestDay = $trendRows->sortByDesc('total')->first();
        $highestTicketDay = $trendRows->sortByDesc('avg_ticket')->first();
        $margin = (float) ($summary->total ?? 0) > 0
            ? ((float) ($summary->profit ?? 0) / (float) $summary->total) * 100
            : 0;

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Faturamento', (float) ($summary->total ?? 0), 'money', 'fa-wallet', $this->percentLabel($margin)),
                $this->summaryCard('Vendas', (int) ($summary->sales_count ?? 0), 'number', 'fa-receipt', $trendRows->count().' dias'),
                $this->summaryCard(
                    'Ticket medio',
                    (float) ($summary->sales_count ?? 0) > 0 ? (float) $summary->total / (float) $summary->sales_count : 0,
                    'money',
                    'fa-chart-column',
                    $highestTicketDay ? $this->shortDate($highestTicketDay['reference_date']) : null
                ),
                $this->summaryCard('Lucro', (float) ($summary->profit ?? 0), 'money', 'fa-sack-dollar', $bestDay ? $this->shortDate($bestDay['reference_date']) : null),
            ],
            highlights: [
                $bestDay
                    ? $this->highlight('Melhor dia', $bestDay['total'], 'money', $this->shortDate($bestDay['reference_date']), 'success')
                    : null,
                $highestTicketDay
                    ? $this->highlight('Maior ticket', $highestTicketDay['avg_ticket'], 'money', $this->shortDate($highestTicketDay['reference_date']), 'primary')
                    : null,
                $this->highlight('Margem', $margin, 'percent', 'No periodo', 'warning'),
            ],
            charts: [
                [
                    'key' => 'sales-daily-volume',
                    'type' => 'area',
                    'title' => 'Receita diaria',
                    'meta' => 'Receita e lucro',
                    'data' => $trendRows->map(fn (array $row) => [
                        'label' => Carbon::parse($row['reference_date'])->format('d/m'),
                        'total' => $row['total'],
                        'profit' => $row['profit'],
                    ])->all(),
                    'series' => [
                        ['key' => 'total', 'label' => 'Receita', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'area'],
                        ['key' => 'profit', 'label' => 'Lucro', 'color' => '#14b8a6', 'format' => 'money', 'variant' => 'line'],
                    ],
                ],
                [
                    'key' => 'sales-daily-count',
                    'type' => 'bar',
                    'title' => 'Volume diario',
                    'meta' => 'Vendas por dia',
                    'data' => $trendRows->map(fn (array $row) => [
                        'label' => Carbon::parse($row['reference_date'])->format('d/m'),
                        'sales_count' => $row['sales_count'],
                    ])->all(),
                    'series' => [
                        ['key' => 'sales_count', 'label' => 'Vendas', 'color' => '#7c3aed', 'format' => 'number', 'variant' => 'bar'],
                    ],
                ],
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
            table: ['title' => 'Dias'],
        );
    }

    protected function salesPaymentsReport(array $filters): array
    {
        $baseQuery = $this->applySaleDimensionFilters(DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']]), $filters);
        $baseQuery->when($filters['payment_method'], fn ($builder, $paymentMethod) => $builder->where('sale_payments.payment_method', $paymentMethod));

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(*) as launches, COUNT(DISTINCT sale_payments.payment_method) as methods_count, COALESCE(SUM(sale_payments.amount), 0) as total')
            ->first();

        $grandTotal = (float) ($summary->total ?? 0);
        $distributionRows = (clone $baseQuery)
            ->selectRaw('sale_payments.payment_method, COUNT(*) as launches, COUNT(DISTINCT sales.id) as sales_count, COALESCE(SUM(sale_payments.amount), 0) as total, COALESCE(AVG(sale_payments.amount), 0) as avg_amount')
            ->groupBy('sale_payments.payment_method')
            ->get()
            ->map(fn ($row) => [
                'payment_method' => PaymentMethod::label((string) $row->payment_method),
                'launches' => (int) $row->launches,
                'sales_count' => (int) $row->sales_count,
                'total' => (float) $row->total,
                'share' => $grandTotal > 0 ? ((float) $row->total / $grandTotal) * 100 : 0,
                'avg_amount' => (float) $row->avg_amount,
            ])
            ->sortByDesc('total')
            ->values();
        $query = (clone $baseQuery)
            ->selectRaw('sale_payments.payment_method, COUNT(*) as launches, COUNT(DISTINCT sales.id) as sales_count, COALESCE(SUM(sale_payments.amount), 0) as total, COALESCE(AVG(sale_payments.amount), 0) as avg_amount')
            ->groupBy('sale_payments.payment_method');

        $this->applyOrderBy($query, [
            'payment_method' => 'sale_payments.payment_method',
            'launches' => 'launches',
            'sales_count' => 'sales_count',
            'total' => 'total',
            'avg_amount' => 'avg_amount',
        ], $filters, 'total', 'desc');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'payment_method' => PaymentMethod::label((string) $row->payment_method),
            'launches' => (int) $row->launches,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'share' => $grandTotal > 0 ? ((float) $row->total / $grandTotal) * 100 : 0,
            'avg_amount' => (float) $row->avg_amount,
        ])->all();
        $topMethod = $distributionRows->first();
        $highestAverage = $distributionRows->sortByDesc('avg_amount')->first();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Receita', $grandTotal, 'money', 'fa-coins', $topMethod ? $topMethod['payment_method'] : null),
                $this->summaryCard('Lancamentos', (int) ($summary->launches ?? 0), 'number', 'fa-list', (int) ($summary->methods_count ?? 0).' metodos'),
                $this->summaryCard('Metodos', (int) ($summary->methods_count ?? 0), 'number', 'fa-credit-card', $topMethod ? $this->percentLabel((float) $topMethod['share']) : null),
                $this->summaryCard(
                    'Media',
                    (int) ($summary->launches ?? 0) > 0 ? $grandTotal / (int) $summary->launches : 0,
                    'money',
                    'fa-calculator',
                    $highestAverage ? $highestAverage['payment_method'] : null
                ),
            ],
            highlights: [
                $topMethod
                    ? $this->highlight('Metodo lider', $topMethod['total'], 'money', $topMethod['payment_method'], 'success')
                    : null,
                $topMethod
                    ? $this->highlight('Participacao', $topMethod['share'], 'percent', $topMethod['payment_method'], 'primary')
                    : null,
                $highestAverage
                    ? $this->highlight('Maior medio', $highestAverage['avg_amount'], 'money', $highestAverage['payment_method'], 'warning')
                    : null,
            ],
            charts: [
                [
                    'key' => 'sales-payments-share',
                    'type' => 'donut',
                    'title' => 'Mix de pagamentos',
                    'meta' => 'Participacao no total',
                    'data' => $distributionRows->map(fn (array $row) => [
                        'label' => $row['payment_method'],
                        'total' => $row['total'],
                        'share' => $row['share'],
                    ])->all(),
                    'value_key' => 'total',
                    'name_key' => 'label',
                    'format' => 'money',
                ],
                [
                    'key' => 'sales-payments-volume',
                    'type' => 'bar',
                    'title' => 'Lancamentos',
                    'meta' => 'Volume por metodo',
                    'data' => $distributionRows->map(fn (array $row) => [
                        'label' => $row['payment_method'],
                        'launches' => $row['launches'],
                    ])->all(),
                    'series' => [
                        ['key' => 'launches', 'label' => 'Lancamentos', 'color' => '#7c3aed', 'format' => 'number', 'variant' => 'bar'],
                    ],
                ],
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
            table: ['title' => 'Metodos'],
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

        $this->applySaleDimensionFilters($baseQuery, $filters);
        $this->applyProductDimensionFilters($baseQuery, $filters);

        $summary = (clone $baseQuery)
            ->selectRaw('COUNT(DISTINCT products.id) as products_count, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold, COALESCE(SUM(sale_items.total), 0) as revenue, COALESCE(SUM(sale_items.profit), 0) as profit')
            ->first();

        $topProducts = (clone $baseQuery)
            ->selectRaw("products.code, products.name, COALESCE(categories.name, 'Sem categoria') as category_name, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold, COALESCE(SUM(sale_items.total), 0) as revenue, COALESCE(SUM(sale_items.profit), 0) as profit")
            ->groupBy('products.id', 'products.code', 'products.name', 'categories.name')
            ->orderByDesc('revenue')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'code' => $row->code ?: '-',
                'name' => $row->name,
                'category_name' => $row->category_name,
                'quantity_sold' => (float) $row->quantity_sold,
                'revenue' => (float) $row->revenue,
                'profit' => (float) $row->profit,
                'margin' => (float) $row->revenue > 0 ? ((float) $row->profit / (float) $row->revenue) * 100 : 0,
            ])
            ->values();

        $categoryRows = (clone $baseQuery)
            ->selectRaw("COALESCE(categories.name, 'Sem categoria') as category_name, COALESCE(SUM(sale_items.total), 0) as revenue")
            ->groupBy('categories.name')
            ->orderByDesc('revenue')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'category_name' => $row->category_name,
                'revenue' => (float) $row->revenue,
            ])
            ->values();

        $query = (clone $baseQuery)
            ->selectRaw("products.code, products.name, COALESCE(categories.name, 'Sem categoria') as category_name, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold, COALESCE(SUM(sale_items.total), 0) as revenue, COALESCE(SUM(sale_items.profit), 0) as profit")
            ->groupBy('products.id', 'products.code', 'products.name', 'categories.name');

        $this->applyOrderBy($query, [
            'name' => 'products.name',
            'quantity_sold' => 'quantity_sold',
            'revenue' => 'revenue',
            'profit' => 'profit',
            'margin' => 'profit',
        ], $filters, 'quantity_sold', 'desc');

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
        $leader = $topProducts->first();
        $bestMargin = $topProducts->sortByDesc('margin')->first();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Itens com giro', (int) ($summary->products_count ?? 0), 'number', 'fa-boxes-stacked', $topProducts->count().' em destaque'),
                $this->summaryCard('Qtd. vendida', (float) ($summary->quantity_sold ?? 0), 'number', 'fa-arrow-trend-up', $leader ? $leader['name'] : null),
                $this->summaryCard('Receita', (float) ($summary->revenue ?? 0), 'money', 'fa-cash-register', $leader ? $leader['category_name'] : null),
                $this->summaryCard('Lucro', (float) ($summary->profit ?? 0), 'money', 'fa-sack-dollar', $bestMargin ? $this->percentLabel((float) $bestMargin['margin']) : null),
            ],
            highlights: [
                $leader
                    ? $this->highlight('Produto lider', $leader['revenue'], 'money', $leader['name'], 'success')
                    : null,
                $bestMargin
                    ? $this->highlight('Maior margem', $bestMargin['margin'], 'percent', $bestMargin['name'], 'warning')
                    : null,
                $leader
                    ? $this->highlight('Categoria lider', $categoryRows->first()['revenue'] ?? 0, 'money', $categoryRows->first()['category_name'] ?? '-', 'primary')
                    : null,
            ],
            charts: [
                [
                    'key' => 'sales-products-revenue',
                    'type' => 'bar',
                    'title' => 'Top produtos',
                    'meta' => 'Receita por item',
                    'data' => $topProducts->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['name'], 0, 18, '...'),
                        'revenue' => $row['revenue'],
                    ])->all(),
                    'series' => [
                        ['key' => 'revenue', 'label' => 'Receita', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
                [
                    'key' => 'sales-products-categories',
                    'type' => 'donut',
                    'title' => 'Receita por categoria',
                    'meta' => 'Mix do periodo',
                    'data' => $categoryRows->map(fn (array $row) => [
                        'label' => $row['category_name'],
                        'total' => $row['revenue'],
                    ])->all(),
                    'value_key' => 'total',
                    'name_key' => 'label',
                    'format' => 'money',
                ],
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
            table: ['title' => 'Produtos'],
        );
    }

    protected function salesOperatorsReport(array $filters): array
    {
        $summary = $this->baseSalesQuery($filters)
            ->selectRaw('COUNT(*) as sales_count, COUNT(DISTINCT user_id) as users_count, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->first();

        $operatorRows = $this->baseSalesQuery($filters)
            ->join('users', 'users.id', '=', 'sales.user_id')
            ->selectRaw('users.name as user_name, COUNT(*) as sales_count, COALESCE(SUM(sales.total), 0) as total, COALESCE(AVG(sales.total), 0) as avg_ticket, COALESCE(SUM(sales.profit), 0) as profit')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'user_name' => $row->user_name,
                'sales_count' => (int) $row->sales_count,
                'total' => (float) $row->total,
                'avg_ticket' => (float) $row->avg_ticket,
                'profit' => (float) $row->profit,
            ])
            ->values();

        $query = $this->baseSalesQuery($filters)
            ->join('users', 'users.id', '=', 'sales.user_id')
            ->selectRaw('users.name as user_name, COUNT(*) as sales_count, COALESCE(SUM(sales.total), 0) as total, COALESCE(AVG(sales.total), 0) as avg_ticket, COALESCE(SUM(sales.profit), 0) as profit')
            ->groupBy('users.id', 'users.name');

        $this->applyOrderBy($query, [
            'user_name' => 'users.name',
            'sales_count' => 'sales_count',
            'total' => 'total',
            'avg_ticket' => 'avg_ticket',
            'profit' => 'profit',
        ], $filters, 'total', 'desc');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'user_name' => $row->user_name,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'avg_ticket' => (float) $row->avg_ticket,
            'profit' => (float) $row->profit,
        ])->all();
        $leader = $operatorRows->first();
        $highestTicket = $operatorRows->sortByDesc('avg_ticket')->first();
        $profitLeader = $operatorRows->sortByDesc('profit')->first();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Receita', (float) ($summary->total ?? 0), 'money', 'fa-money-bill-wave', $leader ? $leader['user_name'] : null),
                $this->summaryCard('Operadores', (int) ($summary->users_count ?? 0), 'number', 'fa-users', $operatorRows->count().' com vendas'),
                $this->summaryCard(
                    'Ticket medio',
                    (int) ($summary->sales_count ?? 0) > 0 ? (float) $summary->total / (int) $summary->sales_count : 0,
                    'money',
                    'fa-chart-line',
                    $highestTicket ? $highestTicket['user_name'] : null
                ),
                $this->summaryCard('Lucro', (float) ($summary->profit ?? 0), 'money', 'fa-sack-dollar', $profitLeader ? $profitLeader['user_name'] : null),
            ],
            highlights: [
                $leader
                    ? $this->highlight('Operador lider', $leader['total'], 'money', $leader['user_name'], 'success')
                    : null,
                $highestTicket
                    ? $this->highlight('Maior ticket', $highestTicket['avg_ticket'], 'money', $highestTicket['user_name'], 'primary')
                    : null,
                $profitLeader
                    ? $this->highlight('Lucro lider', $profitLeader['profit'], 'money', $profitLeader['user_name'], 'warning')
                    : null,
            ],
            charts: [
                [
                    'key' => 'sales-operators-revenue',
                    'type' => 'bar',
                    'title' => 'Receita por operador',
                    'meta' => 'Equipe em destaque',
                    'data' => $operatorRows->take(8)->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['user_name'], 0, 16, '...'),
                        'total' => $row['total'],
                    ])->all(),
                    'series' => [
                        ['key' => 'total', 'label' => 'Receita', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
                [
                    'key' => 'sales-operators-ticket',
                    'type' => 'bar',
                    'title' => 'Ticket por operador',
                    'meta' => 'Media por venda',
                    'data' => $operatorRows->take(8)->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['user_name'], 0, 16, '...'),
                        'avg_ticket' => $row['avg_ticket'],
                    ])->all(),
                    'series' => [
                        ['key' => 'avg_ticket', 'label' => 'Ticket', 'color' => '#14b8a6', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
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
            table: ['title' => 'Operadores'],
        );
    }

    protected function salesCustomersReport(array $filters): array
    {
        $customersBaseQuery = $this->baseSalesQuery($filters)
            ->leftJoin('customers', 'customers.id', '=', 'sales.customer_id')
            ->when($filters['query'], fn ($builder, $term) => $this->applyLikeFilter($builder, $term, ['customers.name']))
            ->selectRaw("COALESCE(customers.name, 'Nao identificado') as customer_name, COUNT(*) as sales_count, COALESCE(SUM(sales.total), 0) as total, COALESCE(AVG(sales.total), 0) as avg_ticket, MAX(sales.created_at) as last_sale_at")
            ->groupBy('sales.customer_id', 'customers.name');

        $customerRows = (clone $customersBaseQuery)
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'customer_name' => $row->customer_name,
                'sales_count' => (int) $row->sales_count,
                'total' => (float) $row->total,
                'avg_ticket' => (float) $row->avg_ticket,
                'last_sale_at' => $row->last_sale_at,
            ])
            ->values();

        $query = (clone $customersBaseQuery);

        $this->applyOrderBy($query, [
            'customer_name' => 'customers.name',
            'sales_count' => 'sales_count',
            'total' => 'total',
            'avg_ticket' => 'avg_ticket',
            'last_sale_at' => 'last_sale_at',
        ], $filters, 'total', 'desc');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'customer_name' => $row->customer_name,
            'sales_count' => (int) $row->sales_count,
            'total' => (float) $row->total,
            'avg_ticket' => (float) $row->avg_ticket,
            'last_sale_at' => $row->last_sale_at,
        ])->all();
        $leader = $customerRows->first();
        $mostRecurring = $customerRows->sortByDesc('sales_count')->first();
        $recentCustomer = $customerRows->sortByDesc('last_sale_at')->first();
        $summary = [
            'sales_count' => (int) $customerRows->sum('sales_count'),
            'customers_count' => $customerRows->count(),
            'total' => (float) $customerRows->sum('total'),
        ];

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Receita', (float) ($summary['total'] ?? 0), 'money', 'fa-wallet', $leader ? $leader['customer_name'] : null),
                $this->summaryCard('Clientes', (int) ($summary['customers_count'] ?? 0), 'number', 'fa-user-group', $customerRows->count().' no ranking'),
                $this->summaryCard('Vendas', (int) ($summary['sales_count'] ?? 0), 'number', 'fa-receipt'),
                $this->summaryCard(
                    'Ticket medio',
                    (int) ($summary['sales_count'] ?? 0) > 0 ? (float) $summary['total'] / (int) $summary['sales_count'] : 0,
                    'money',
                    'fa-chart-column',
                    $mostRecurring ? $mostRecurring['customer_name'] : null
                ),
            ],
            highlights: [
                $leader
                    ? $this->highlight('Cliente lider', $leader['total'], 'money', $leader['customer_name'], 'success')
                    : null,
                $mostRecurring
                    ? $this->highlight('Mais recorrente', $mostRecurring['sales_count'], 'number', $mostRecurring['customer_name'], 'primary')
                    : null,
                $recentCustomer
                    ? $this->highlight('Ultima compra', $recentCustomer['last_sale_at'], 'datetime', $recentCustomer['customer_name'], 'warning')
                    : null,
            ],
            charts: [
                [
                    'key' => 'sales-customers-revenue',
                    'type' => 'bar',
                    'title' => 'Top clientes',
                    'meta' => 'Receita acumulada',
                    'data' => $customerRows->take(8)->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['customer_name'], 0, 18, '...'),
                        'total' => $row['total'],
                    ])->all(),
                    'series' => [
                        ['key' => 'total', 'label' => 'Receita', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
                [
                    'key' => 'sales-customers-volume',
                    'type' => 'bar',
                    'title' => 'Recorrencia',
                    'meta' => 'Volume de compras',
                    'data' => $customerRows->take(8)->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['customer_name'], 0, 18, '...'),
                        'sales_count' => $row['sales_count'],
                    ])->all(),
                    'series' => [
                        ['key' => 'sales_count', 'label' => 'Vendas', 'color' => '#7c3aed', 'format' => 'number', 'variant' => 'bar'],
                    ],
                ],
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
            table: ['title' => 'Clientes'],
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
            ->leftJoin('suppliers', 'suppliers.id', '=', 'products.supplier_id')
            ->leftJoinSub($salesSubquery, 'period_sales', fn ($join) => $join->on('period_sales.product_id', '=', 'products.id'))
            ->where('products.active', true)
            ->selectRaw("products.code, products.name, COALESCE(categories.name, 'Sem categoria') as category_name, COALESCE(suppliers.name, 'Sem fornecedor') as supplier_name, products.stock_quantity, products.min_stock, products.cost_price, COALESCE(period_sales.quantity_sold, 0) as quantity_sold, COALESCE(period_sales.revenue, 0) as revenue, (products.stock_quantity * products.cost_price) as stock_value");

        $this->applyProductDimensionFilters($query, $filters);

        $summaryQuery = Product::query()
            ->where('products.active', true);
        $this->applyProductDimensionFilters($summaryQuery, $filters);
        $summary = $summaryQuery
            ->selectRaw('COUNT(*) as products_count, COALESCE(SUM(stock_quantity * cost_price), 0) as stock_value, COALESCE(SUM(CASE WHEN stock_quantity <= min_stock THEN 1 ELSE 0 END), 0) as low_stock')
            ->first();

        $periodSummaryQuery = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']]);
        $this->applyProductDimensionFilters($periodSummaryQuery, $filters);
        $periodSummary = $periodSummaryQuery
            ->selectRaw('COALESCE(SUM(sale_items.quantity), 0) as quantity_sold')
            ->first();

        $categoryRows = Product::query()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->where('products.active', true)
            ->tap(fn ($builder) => $this->applyProductDimensionFilters($builder, $filters))
            ->selectRaw("COALESCE(categories.name, 'Sem categoria') as category_name, COALESCE(SUM(products.stock_quantity * products.cost_price), 0) as stock_value")
            ->groupBy('categories.name')
            ->orderByDesc('stock_value')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'category_name' => $row->category_name,
                'stock_value' => (float) $row->stock_value,
            ])
            ->values();

        $statusRows = collect([
            [
                'label' => 'Saudavel',
                'total' => tap(Product::query()->where('products.active', true), fn ($builder) => $this->applyProductDimensionFilters($builder, array_merge($filters, ['stock_status' => 'healthy'])))->count(),
            ],
            [
                'label' => 'Baixo estoque',
                'total' => tap(Product::query()->where('products.active', true), fn ($builder) => $this->applyProductDimensionFilters($builder, array_merge($filters, ['stock_status' => 'low'])))->count(),
            ],
            [
                'label' => 'Sem saldo',
                'total' => tap(Product::query()->where('products.active', true), fn ($builder) => $this->applyProductDimensionFilters($builder, array_merge($filters, ['stock_status' => 'out'])))->count(),
            ],
        ])->filter(fn (array $row) => $row['total'] > 0)->values();

        $this->applyOrderBy($query, [
            'name' => 'products.name',
            'stock_quantity' => 'products.stock_quantity',
            'quantity_sold' => 'quantity_sold',
            'stock_value' => 'stock_value',
            'status' => 'products.stock_quantity',
        ], $filters, 'name', 'asc');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'code' => $row->code ?: '-',
            'name' => $row->name,
            'category_name' => $row->category_name,
            'supplier_name' => $row->supplier_name,
            'stock_quantity' => (float) $row->stock_quantity,
            'min_stock' => (float) $row->min_stock,
            'quantity_sold' => (float) $row->quantity_sold,
            'stock_value' => (float) $row->stock_value,
            'status' => (float) $row->stock_quantity <= 0
                ? 'Sem saldo'
                : ((float) $row->stock_quantity <= (float) $row->min_stock ? 'Abaixo do minimo' : 'Saudavel'),
        ])->all();
        $largestCategory = $categoryRows->first();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Itens ativos', (int) ($summary->products_count ?? 0), 'number', 'fa-boxes-stacked', $statusRows->sum('total').' status'),
                $this->summaryCard('Valor em estoque', (float) ($summary->stock_value ?? 0), 'money', 'fa-warehouse', $largestCategory ? $largestCategory['category_name'] : null),
                $this->summaryCard('Baixo estoque', (int) ($summary->low_stock ?? 0), 'number', 'fa-triangle-exclamation'),
                $this->summaryCard('Saida no periodo', (float) ($periodSummary->quantity_sold ?? 0), 'number', 'fa-arrow-trend-down'),
            ],
            highlights: [
                $largestCategory
                    ? $this->highlight('Categoria lider', $largestCategory['stock_value'], 'money', $largestCategory['category_name'], 'success')
                    : null,
                $this->highlight('Baixo estoque', (int) ($summary->low_stock ?? 0), 'number', 'Itens criticos', 'warning'),
                $statusRows->first()
                    ? $this->highlight('Status dominante', $statusRows->first()['total'], 'number', $statusRows->first()['label'], 'primary')
                    : null,
            ],
            charts: [
                [
                    'key' => 'stock-position-categories',
                    'type' => 'bar',
                    'title' => 'Valor por categoria',
                    'meta' => 'Saldo atual',
                    'data' => $categoryRows->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['category_name'], 0, 18, '...'),
                        'stock_value' => $row['stock_value'],
                    ])->all(),
                    'series' => [
                        ['key' => 'stock_value', 'label' => 'Valor', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
                [
                    'key' => 'stock-position-status',
                    'type' => 'donut',
                    'title' => 'Saude do estoque',
                    'meta' => 'Distribuicao atual',
                    'data' => $statusRows->map(fn (array $row) => [
                        'label' => $row['label'],
                        'total' => $row['total'],
                    ])->all(),
                    'value_key' => 'total',
                    'name_key' => 'label',
                    'format' => 'number',
                ],
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
            table: ['title' => 'Estoque atual'],
        );
    }

    protected function stockShortagesReport(array $filters): array
    {
        $salesSubquery = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']])
            ->groupBy('sale_items.product_id')
            ->selectRaw('sale_items.product_id, COALESCE(SUM(sale_items.quantity), 0) as quantity_sold');

        $query = Product::query()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'products.supplier_id')
            ->leftJoinSub($salesSubquery, 'period_sales', fn ($join) => $join->on('period_sales.product_id', '=', 'products.id'))
            ->where('products.active', true)
            ->whereColumn('products.stock_quantity', '<=', 'products.min_stock')
            ->selectRaw("
                products.code,
                products.name,
                COALESCE(categories.name, 'Sem categoria') as category_name,
                COALESCE(suppliers.name, 'Sem fornecedor') as supplier_name,
                products.stock_quantity,
                products.min_stock,
                GREATEST(products.min_stock - products.stock_quantity, 0) as missing,
                COALESCE(period_sales.quantity_sold, 0) as quantity_sold
            ");

        $this->applyProductDimensionFilters($query, $filters);

        $summary = Product::query()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->leftJoin('suppliers', 'suppliers.id', '=', 'products.supplier_id')
            ->leftJoinSub($salesSubquery, 'period_sales', fn ($join) => $join->on('period_sales.product_id', '=', 'products.id'))
            ->where('products.active', true)
            ->whereColumn('products.stock_quantity', '<=', 'products.min_stock')
            ->tap(fn ($builder) => $this->applyProductDimensionFilters($builder, $filters))
            ->selectRaw('
                COUNT(*) as low_stock,
                COALESCE(SUM(CASE WHEN products.stock_quantity <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock,
                COALESCE(SUM(GREATEST(products.min_stock - products.stock_quantity, 0)), 0) as missing_total,
                COALESCE(SUM(period_sales.quantity_sold), 0) as quantity_sold
            ')
            ->first();

        $supplierRows = Product::query()
            ->leftJoin('suppliers', 'suppliers.id', '=', 'products.supplier_id')
            ->where('products.active', true)
            ->whereColumn('products.stock_quantity', '<=', 'products.min_stock')
            ->when($filters['query'], fn ($builder, $term) => $this->applyLikeFilter($builder, $term, ['products.code', 'products.barcode', 'products.name', 'products.description']))
            ->when($filters['category_id'], fn ($builder, $categoryId) => $builder->where('products.category_id', $categoryId))
            ->when($filters['supplier_id'], fn ($builder, $supplierId) => $builder->where('products.supplier_id', $supplierId))
            ->selectRaw("COALESCE(suppliers.name, 'Sem fornecedor') as supplier_name, COALESCE(SUM(GREATEST(products.min_stock - products.stock_quantity, 0)), 0) as missing_total")
            ->groupBy('suppliers.name')
            ->orderByDesc('missing_total')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'supplier_name' => $row->supplier_name,
                'missing_total' => (float) $row->missing_total,
            ])
            ->values();

        $topShortages = (clone $query)
            ->orderByDesc('missing')
            ->limit(8)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'missing' => (float) $row->missing,
                'quantity_sold' => (float) $row->quantity_sold,
            ])
            ->values();

        $this->applyOrderBy($query, [
            'missing' => 'missing',
            'quantity_sold' => 'quantity_sold',
            'stock_quantity' => 'products.stock_quantity',
            'name' => 'products.name',
            'supplier_name' => 'supplier_name',
        ], $filters, 'missing', 'desc');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(fn ($row) => [
            'code' => $row->code ?: '-',
            'name' => $row->name,
            'category_name' => $row->category_name,
            'supplier_name' => $row->supplier_name,
            'stock_quantity' => (float) $row->stock_quantity,
            'min_stock' => (float) $row->min_stock,
            'missing' => (float) $row->missing,
            'quantity_sold' => (float) $row->quantity_sold,
        ])->all();
        $leader = $topShortages->first();
        $supplierLeader = $supplierRows->first();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Itens em falta', (int) ($summary->out_of_stock ?? 0), 'number', 'fa-ban', $leader ? $leader['name'] : null),
                $this->summaryCard('Baixo estoque', (int) ($summary->low_stock ?? 0), 'number', 'fa-triangle-exclamation'),
                $this->summaryCard('Falta minima', (float) ($summary->missing_total ?? 0), 'number', 'fa-box-open', $supplierLeader ? $supplierLeader['supplier_name'] : null),
                $this->summaryCard('Saida no periodo', (float) ($summary->quantity_sold ?? 0), 'number', 'fa-arrow-trend-down'),
            ],
            highlights: [
                $leader
                    ? $this->highlight('Maior falta', $leader['missing'], 'number', $leader['name'], 'warning')
                    : null,
                $supplierLeader
                    ? $this->highlight('Fornecedor critico', $supplierLeader['missing_total'], 'number', $supplierLeader['supplier_name'], 'primary')
                    : null,
                $this->highlight('Sem saldo', (int) ($summary->out_of_stock ?? 0), 'number', 'Itens zerados', 'danger'),
            ],
            charts: [
                [
                    'key' => 'stock-shortages-products',
                    'type' => 'bar',
                    'title' => 'Itens com maior falta',
                    'meta' => 'Reposicao sugerida',
                    'data' => $topShortages->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['name'], 0, 18, '...'),
                        'missing' => $row['missing'],
                    ])->all(),
                    'series' => [
                        ['key' => 'missing', 'label' => 'Falta', 'color' => '#ef4444', 'format' => 'number', 'variant' => 'bar'],
                    ],
                ],
                [
                    'key' => 'stock-shortages-suppliers',
                    'type' => 'donut',
                    'title' => 'Falta por fornecedor',
                    'meta' => 'Pressao de reposicao',
                    'data' => $supplierRows->map(fn (array $row) => [
                        'label' => $row['supplier_name'],
                        'total' => $row['missing_total'],
                    ])->all(),
                    'value_key' => 'total',
                    'name_key' => 'label',
                    'format' => 'number',
                ],
            ],
            columns: [
                ['key' => 'code', 'label' => 'Codigo'],
                ['key' => 'name', 'label' => 'Produto'],
                ['key' => 'category_name', 'label' => 'Categoria'],
                ['key' => 'supplier_name', 'label' => 'Fornecedor'],
                ['key' => 'stock_quantity', 'label' => 'Saldo', 'format' => 'decimal'],
                ['key' => 'min_stock', 'label' => 'Minimo', 'format' => 'decimal'],
                ['key' => 'missing', 'label' => 'Falta', 'format' => 'decimal'],
                ['key' => 'quantity_sold', 'label' => 'Giro', 'format' => 'decimal'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhum item com falta ou baixo estoque.',
            table: ['title' => 'Faltas'],
        );
    }

    protected function stockInboundsReport(array $filters): array
    {
        $itemsSubquery = DB::table('purchase_items')
            ->groupBy('purchase_id')
            ->selectRaw('purchase_id, COUNT(*) as items_count, COALESCE(SUM(quantity), 0) as quantity_total');

        $query = Purchase::query()
            ->leftJoin('suppliers', 'suppliers.id', '=', 'purchases.supplier_id')
            ->leftJoinSub($itemsSubquery, 'purchase_summary', fn ($join) => $join->on('purchase_summary.purchase_id', '=', 'purchases.id'))
            ->where('purchases.status', 'received')
            ->where(function ($builder) use ($filters) {
                $builder
                    ->whereBetween('purchases.received_at', [$filters['from'], $filters['to']])
                    ->orWhere(function ($fallback) use ($filters) {
                        $fallback
                            ->whereNull('purchases.received_at')
                            ->whereBetween('purchases.created_at', [$filters['from'], $filters['to']]);
                    });
            })
            ->selectRaw("
                purchases.id,
                purchases.code,
                purchases.received_at,
                purchases.created_at,
                purchases.total,
                purchases.freight,
                purchases.notes,
                COALESCE(suppliers.name, 'Sem fornecedor') as supplier_name,
                COALESCE(purchase_summary.items_count, 0) as items_count,
                COALESCE(purchase_summary.quantity_total, 0) as quantity_total
            ")
            ->when($filters['supplier_id'], fn ($builder, $supplierId) => $builder->where('purchases.supplier_id', $supplierId))
            ->when($filters['query'], fn ($builder, $term) => $this->applyLikeFilter($builder, $term, ['purchases.code', 'suppliers.name']));

        $summary = (clone $query)->get()->reduce(function (array $carry, $row) {
            $metadata = $this->decodePurchaseNotes($row->notes);

            $carry['entries']++;
            $carry['quantity_total'] += (float) $row->quantity_total;
            $carry['total'] += (float) $row->total;
            $carry['billing_amount'] += (float) ($metadata['billing_amount'] ?? 0);

            return $carry;
        }, [
            'entries' => 0,
            'quantity_total' => 0,
            'total' => 0,
            'billing_amount' => 0,
        ]);

        $supplierRows = (clone $query)
            ->selectRaw("COALESCE(suppliers.name, 'Sem fornecedor') as supplier_name, COALESCE(SUM(purchases.total), 0) as total")
            ->groupBy('suppliers.name')
            ->orderByDesc('total')
            ->limit(6)
            ->get()
            ->map(fn ($row) => [
                'supplier_name' => $row->supplier_name,
                'total' => (float) $row->total,
            ])
            ->values();

        $dailyRows = (clone $query)
            ->selectRaw("DATE(COALESCE(purchases.received_at, purchases.created_at)) as reference_date, COALESCE(SUM(purchases.total), 0) as total")
            ->groupBy(DB::raw("DATE(COALESCE(purchases.received_at, purchases.created_at))"))
            ->orderBy('reference_date')
            ->get()
            ->map(fn ($row) => [
                'reference_date' => $row->reference_date,
                'total' => (float) $row->total,
            ])
            ->values();

        $this->applyOrderBy($query, [
            'received_at' => DB::raw('COALESCE(purchases.received_at, purchases.created_at)'),
            'supplier_name' => 'supplier_name',
            'items_count' => 'items_count',
            'quantity_total' => 'quantity_total',
            'total' => 'purchases.total',
        ], $filters, 'received_at', 'desc');

        $paginator = $query->paginate($filters['per_page'], ['*'], 'page', $filters['page']);
        $rows = collect($paginator->items())->map(function ($row) {
            $metadata = $this->decodePurchaseNotes($row->notes);

            return [
                'code' => $row->code,
                'supplier_name' => $row->supplier_name,
                'invoice_number' => $metadata['invoice_number'] ?? '-',
                'items_count' => (int) $row->items_count,
                'quantity_total' => (float) $row->quantity_total,
                'total' => (float) $row->total,
                'billing_amount' => array_key_exists('billing_amount', $metadata) ? (float) $metadata['billing_amount'] : null,
                'billing_due_date' => $metadata['billing_due_date'] ?? null,
                'received_at' => $row->received_at ?: $row->created_at,
            ];
        })->all();
        $supplierLeader = $supplierRows->first();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Entradas', (int) $summary['entries'], 'number', 'fa-dolly', $supplierLeader ? $supplierLeader['supplier_name'] : null),
                $this->summaryCard('Volume', (float) $summary['quantity_total'], 'number', 'fa-boxes-stacked'),
                $this->summaryCard('Total', (float) $summary['total'], 'money', 'fa-money-bill-wave'),
                $this->summaryCard('Boletos', (float) $summary['billing_amount'], 'money', 'fa-barcode'),
            ],
            highlights: [
                $supplierLeader
                    ? $this->highlight('Fornecedor lider', $supplierLeader['total'], 'money', $supplierLeader['supplier_name'], 'success')
                    : null,
                $dailyRows->sortByDesc('total')->first()
                    ? $this->highlight(
                        'Maior entrada',
                        $dailyRows->sortByDesc('total')->first()['total'],
                        'money',
                        $this->shortDate($dailyRows->sortByDesc('total')->first()['reference_date']),
                        'primary'
                    )
                    : null,
                $this->highlight('Boletos', (float) $summary['billing_amount'], 'money', 'Compromissos', 'warning'),
            ],
            charts: [
                [
                    'key' => 'stock-inbounds-daily',
                    'type' => 'area',
                    'title' => 'Entradas no tempo',
                    'meta' => 'Total por dia',
                    'data' => $dailyRows->map(fn (array $row) => [
                        'label' => Carbon::parse($row['reference_date'])->format('d/m'),
                        'total' => $row['total'],
                    ])->all(),
                    'series' => [
                        ['key' => 'total', 'label' => 'Total', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'area'],
                    ],
                ],
                [
                    'key' => 'stock-inbounds-suppliers',
                    'type' => 'bar',
                    'title' => 'Entradas por fornecedor',
                    'meta' => 'Acumulado no periodo',
                    'data' => $supplierRows->map(fn (array $row) => [
                        'label' => mb_strimwidth($row['supplier_name'], 0, 18, '...'),
                        'total' => $row['total'],
                    ])->all(),
                    'series' => [
                        ['key' => 'total', 'label' => 'Total', 'color' => '#14b8a6', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
            ],
            columns: [
                ['key' => 'code', 'label' => 'Codigo'],
                ['key' => 'supplier_name', 'label' => 'Fornecedor'],
                ['key' => 'invoice_number', 'label' => 'Nota'],
                ['key' => 'items_count', 'label' => 'Itens', 'format' => 'number'],
                ['key' => 'quantity_total', 'label' => 'Qtd', 'format' => 'decimal'],
                ['key' => 'total', 'label' => 'Total', 'format' => 'money'],
                ['key' => 'billing_due_date', 'label' => 'Venc.', 'format' => 'date'],
                ['key' => 'received_at', 'label' => 'Recebido', 'format' => 'datetime'],
            ],
            rows: $rows,
            paginator: $paginator,
            emptyText: 'Nenhuma entrada de mercadoria encontrada no recorte selecionado.',
            table: ['title' => 'Entradas'],
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

        $sortedRows = $this->sortCollection($rows, $filters, [
            'reference_date' => 'reference_date',
            'incoming_sales' => 'incoming_sales',
            'supplies' => 'supplies',
            'withdrawals' => 'withdrawals',
            'balance' => 'balance',
        ], 'reference_date', 'desc');
        $paginator = $this->paginateCollection(
            $sortedRows,
            $filters['per_page'],
            $filters['page']
        );
        $bestDay = $rows->sortByDesc('balance')->first();
        $highestWithdrawal = $rows->sortByDesc('withdrawals')->first();
        $positiveDays = $rows->filter(fn (array $row) => $row['balance'] > 0)->count();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Entradas em vendas', $rows->sum('incoming_sales'), 'money', 'fa-money-bill-trend-up', $bestDay ? $this->shortDate($bestDay['reference_date']) : null),
                $this->summaryCard('Suprimentos', $rows->sum('supplies'), 'money', 'fa-arrow-up'),
                $this->summaryCard('Sangrias', $rows->sum('withdrawals'), 'money', 'fa-arrow-down', $highestWithdrawal ? $this->shortDate($highestWithdrawal['reference_date']) : null),
                $this->summaryCard('Saldo liquido', $rows->sum('balance'), 'money', 'fa-scale-balanced', $positiveDays.' dias positivos'),
            ],
            highlights: [
                $bestDay
                    ? $this->highlight('Melhor saldo', $bestDay['balance'], 'money', $this->shortDate($bestDay['reference_date']), 'success')
                    : null,
                $highestWithdrawal
                    ? $this->highlight('Maior sangria', $highestWithdrawal['withdrawals'], 'money', $this->shortDate($highestWithdrawal['reference_date']), 'warning')
                    : null,
                $this->highlight('Dias positivos', $positiveDays, 'number', 'No periodo', 'primary'),
            ],
            charts: [
                [
                    'key' => 'cashflow-daily-main',
                    'type' => 'area',
                    'title' => 'Fluxo diario',
                    'meta' => 'Entradas e saldo',
                    'data' => $rows->map(fn (array $row) => [
                        'label' => Carbon::parse($row['reference_date'])->format('d/m'),
                        'incoming_sales' => $row['incoming_sales'],
                        'balance' => $row['balance'],
                    ])->all(),
                    'series' => [
                        ['key' => 'incoming_sales', 'label' => 'Entradas', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'area'],
                        ['key' => 'balance', 'label' => 'Saldo', 'color' => '#14b8a6', 'format' => 'money', 'variant' => 'line'],
                    ],
                ],
                [
                    'key' => 'cashflow-daily-movements',
                    'type' => 'bar',
                    'title' => 'Movimentos de caixa',
                    'meta' => 'Suprimentos e sangrias',
                    'data' => $rows->map(fn (array $row) => [
                        'label' => Carbon::parse($row['reference_date'])->format('d/m'),
                        'supplies' => $row['supplies'],
                        'withdrawals' => $row['withdrawals'],
                    ])->all(),
                    'series' => [
                        ['key' => 'supplies', 'label' => 'Suprimento', 'color' => '#7c3aed', 'format' => 'money', 'variant' => 'bar'],
                        ['key' => 'withdrawals', 'label' => 'Sangria', 'color' => '#ef4444', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
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
            table: ['title' => 'Movimentos'],
        );
    }

    protected function receivablesOpenReport(array $filters): array
    {
        $customers = Customer::query()
            ->where('active', true)
            ->when($filters['customer_id'], fn ($builder, $customerId) => $builder->whereKey($customerId))
            ->when($filters['query'], function ($builder, $term) {
                $this->applyLikeFilter($builder, $term, ['customers.name', 'customers.phone']);
            })
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
                    'utilization_percent' => (float) $customer->credit_limit > 0
                        ? ($launchedCredit / (float) $customer->credit_limit) * 100
                        : ($launchedCredit > 0 ? 100 : 0),
                ];
            })
            ->filter(fn (array $customer) => $customer['credit_limit'] > 0 || $customer['launched_credit'] > 0)
            ->filter(function (array $customer) use ($filters) {
                return match ($filters['balance_status']) {
                    'with_balance' => $customer['launched_credit'] > 0,
                    'near_limit' => $customer['utilization_percent'] >= 80,
                    'without_limit' => $customer['credit_limit'] <= 0 && $customer['launched_credit'] > 0,
                    default => true,
                };
            })
            ->sortByDesc('launched_credit')
            ->values();

        $sortedCustomers = $this->sortCollection($customers, $filters, [
            'name' => 'name',
            'credit_limit' => 'credit_limit',
            'launched_credit' => 'launched_credit',
            'available_credit' => 'available_credit',
        ], 'launched_credit', 'desc');
        $paginator = $this->paginateCollection($sortedCustomers, $filters['per_page'], $filters['page']);
        $leader = $customers->sortByDesc('launched_credit')->first();
        $nearLimit = $customers->filter(fn (array $customer) => $customer['utilization_percent'] >= 80);
        $statusRows = collect([
            ['label' => 'Com saldo', 'total' => $customers->filter(fn (array $customer) => $customer['launched_credit'] > 0)->count()],
            ['label' => 'Perto do limite', 'total' => $nearLimit->count()],
            ['label' => 'Sem limite', 'total' => $customers->filter(fn (array $customer) => $customer['credit_limit'] <= 0 && $customer['launched_credit'] > 0)->count()],
        ])->filter(fn (array $row) => $row['total'] > 0)->values();

        return $this->reportPayload(
            summary: [
                $this->summaryCard('Clientes', $customers->count(), 'number', 'fa-users', $nearLimit->count().' perto do limite'),
                $this->summaryCard('Carteira lancada', $customers->sum('launched_credit'), 'money', 'fa-file-invoice-dollar', $leader ? $leader['name'] : null),
                $this->summaryCard('Limite total', $customers->sum('credit_limit'), 'money', 'fa-sack-dollar'),
                $this->summaryCard('Disponivel', $customers->sum('available_credit'), 'money', 'fa-wallet'),
            ],
            highlights: [
                $leader
                    ? $this->highlight('Maior exposicao', $leader['launched_credit'], 'money', $leader['name'], 'warning')
                    : null,
                $this->highlight('Perto do limite', $nearLimit->count(), 'number', 'Clientes', 'primary'),
                $this->highlight('Disponivel', $customers->sum('available_credit'), 'money', 'Carteira livre', 'success'),
            ],
            charts: [
                [
                    'key' => 'receivables-customers',
                    'type' => 'bar',
                    'title' => 'Exposicao por cliente',
                    'meta' => 'Saldo lancado',
                    'data' => $customers->take(8)->map(fn (array $customer) => [
                        'label' => mb_strimwidth($customer['name'], 0, 18, '...'),
                        'launched_credit' => $customer['launched_credit'],
                    ])->all(),
                    'series' => [
                        ['key' => 'launched_credit', 'label' => 'Lancado', 'color' => '#2563eb', 'format' => 'money', 'variant' => 'bar'],
                    ],
                ],
                [
                    'key' => 'receivables-status',
                    'type' => 'donut',
                    'title' => 'Saude da carteira',
                    'meta' => 'Distribuicao atual',
                    'data' => $statusRows->map(fn (array $row) => [
                        'label' => $row['label'],
                        'total' => $row['total'],
                    ])->all(),
                    'value_key' => 'total',
                    'name_key' => 'label',
                    'format' => 'number',
                ],
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
            emptyText: 'Nenhum cliente com limite ou saldo fiado encontrado.',
            table: ['title' => 'Fiado'],
        );
    }

    protected function decodePurchaseNotes(?string $notes): array
    {
        if (! filled($notes)) {
            return [];
        }

        $decoded = json_decode((string) $notes, true);

        if (! is_array($decoded)) {
            return ['notes' => $notes];
        }

        if (($decoded['schema'] ?? null) === 'ops_purchase_v1') {
            return is_array($decoded['meta'] ?? null) ? $decoded['meta'] : [];
        }

        return ['notes' => $notes];
    }

    protected function applyLikeFilter($query, ?string $term, array $columns): void
    {
        if (! $term || empty($columns)) {
            return;
        }

        if (TextSearch::matchesAll($term)) {
            return;
        }

        $like = TextSearch::likePattern($term);

        $query->where(function ($nestedQuery) use ($columns, $like) {
            foreach ($columns as $index => $column) {
                $method = $index === 0 ? 'where' : 'orWhere';
                $nestedQuery->{$method}($column, 'like', $like);
            }
        });
    }

    protected function applySaleDimensionFilters($query, array $filters, string $saleTable = 'sales')
    {
        return $query
            ->when($filters['operator_id'], fn ($builder, $operatorId) => $builder->where("{$saleTable}.user_id", $operatorId))
            ->when($filters['customer_id'], fn ($builder, $customerId) => $builder->where("{$saleTable}.customer_id", $customerId))
            ->when($filters['payment_method'], function ($builder, $paymentMethod) use ($saleTable) {
                $builder->whereExists(function ($subquery) use ($saleTable, $paymentMethod) {
                    $subquery
                        ->selectRaw('1')
                        ->from('sale_payments')
                        ->whereColumn('sale_payments.sale_id', "{$saleTable}.id")
                        ->where('sale_payments.payment_method', $paymentMethod);
                });
            });
    }

    protected function applyProductDimensionFilters($query, array $filters, string $productTable = 'products')
    {
        return $query
            ->when($filters['query'], function ($builder, $term) use ($productTable) {
                $this->applyLikeFilter($builder, $term, [
                    "{$productTable}.code",
                    "{$productTable}.barcode",
                    "{$productTable}.name",
                    "{$productTable}.description",
                ]);
            })
            ->when($filters['category_id'], fn ($builder, $categoryId) => $builder->where("{$productTable}.category_id", $categoryId))
            ->when($filters['supplier_id'], fn ($builder, $supplierId) => $builder->where("{$productTable}.supplier_id", $supplierId))
            ->when($filters['stock_status'], function ($builder, $stockStatus) use ($productTable) {
                match ($stockStatus) {
                    'healthy' => $builder->where("{$productTable}.stock_quantity", '>', DB::raw("{$productTable}.min_stock")),
                    'low' => $builder->where("{$productTable}.stock_quantity", '>', 0)->whereColumn("{$productTable}.stock_quantity", '<=', "{$productTable}.min_stock"),
                    'out' => $builder->where("{$productTable}.stock_quantity", '<=', 0),
                    default => null,
                };
            });
    }

    protected function applyOrderBy($query, array $allowedSorts, array $filters, string $defaultSort, string $defaultDirection = 'desc')
    {
        $sortBy = array_key_exists($filters['sort_by'] ?? '', $allowedSorts)
            ? $filters['sort_by']
            : $defaultSort;
        $direction = ($filters['sort_direction'] ?? $defaultDirection) === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($allowedSorts[$sortBy], $direction);
    }

    protected function sortCollection(Collection $items, array $filters, array $allowedSorts, string $defaultSort, string $defaultDirection = 'desc'): Collection
    {
        $sortBy = array_key_exists($filters['sort_by'] ?? '', $allowedSorts)
            ? $filters['sort_by']
            : $defaultSort;
        $direction = ($filters['sort_direction'] ?? $defaultDirection) === 'asc' ? 'asc' : 'desc';
        $sortKey = $allowedSorts[$sortBy];

        return $direction === 'asc'
            ? $items->sortBy($sortKey, SORT_NATURAL)->values()
            : $items->sortByDesc($sortKey, SORT_NATURAL)->values();
    }

    protected function percentLabel(float $value): string
    {
        return number_format($value, 1, ',', '.').'%';
    }

    protected function shortDate(?string $value): ?string
    {
        return $value ? Carbon::parse($value)->format('d/m/Y') : null;
    }

    protected function reportPayload(array $summary, array $columns, array $rows, ?LengthAwarePaginator $paginator, string $emptyText, array $charts = [], array $highlights = [], array $table = []): array
    {
        $pagination = $paginator
            ? [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ]
            : [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 20,
                'total' => 0,
                'from' => null,
                'to' => null,
            ];

        return [
            'summary' => $summary,
            'highlights' => $highlights,
            'charts' => $charts,
            'columns' => $columns,
            'rows' => $rows,
            'table' => array_merge([
                'title' => 'Detalhamento',
            ], $table),
            'pagination' => $pagination,
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
        return $this->applySaleDimensionFilters(
            Sale::query()
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$filters['from'], $filters['to']]),
            $filters
        );
    }

    protected function summaryCard(string $label, mixed $value, string $format, string $icon, ?string $meta = null): array
    {
        return compact('label', 'value', 'format', 'icon', 'meta');
    }

    protected function highlight(string $label, mixed $value, string $format = 'text', ?string $meta = null, string $tone = 'neutral'): array
    {
        return compact('label', 'value', 'format', 'meta', 'tone');
    }
}
