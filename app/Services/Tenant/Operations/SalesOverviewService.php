<?php

namespace App\Services\Tenant\Operations;

use App\Models\Tenant\CashRegister;
use App\Models\Tenant\Customer;
use App\Models\Tenant\Sale;
use App\Services\Tenant\Operations\Concerns\BuildsOverviewPages;
use App\Support\Tenant\PaymentMethod;
use Illuminate\Support\Facades\DB;

class SalesOverviewService
{
    use BuildsOverviewPages;

    public function orders(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);

        $sales = $this->salesQuery($from, $to)->with(['customer:id,name', 'user:id,name'])->latest()->limit(12)->get();
        $operators = Sale::query()
            ->with('user:id,name')
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->where('status', 'finalized')
            ->selectRaw('user_id, COUNT(*) as qty, COALESCE(SUM(total), 0) as total')
            ->groupBy('user_id')
            ->orderByDesc('qty')
            ->limit(5)
            ->get();

        return $this->page(
            'Pedidos e comandas',
            'Pedidos do periodo e operadores com vendas.',
            [
                $this->metric('Atendimentos', $sales->count()),
                $this->metric('Faturamento', $sales->sum('total'), 'money', 'Periodo selecionado'),
                $this->metric('Ticket medio', $sales->avg('total'), 'money'),
                $this->metric('Caixas abertos', CashRegister::query()->where('status', 'open')->count()),
            ],
            [
                $this->panel('Equipe em destaque', $operators->map(fn (Sale $sale) => [
                    'label' => $sale->user?->name ?? 'Operador',
                    'value' => $this->currency($sale->total),
                    'meta' => "{$sale->qty} atendimento(s)",
                ])),
            ],
            [
                $this->table('Fila recente', [
                    ['key' => 'sale_number', 'label' => 'Pedido'],
                    ['key' => 'created_at', 'label' => 'Horario', 'format' => 'datetime'],
                    ['key' => 'customer_name', 'label' => 'Cliente'],
                    ['key' => 'user_name', 'label' => 'Operador'],
                    ['key' => 'payment_method', 'label' => 'Pagamento'],
                    ['key' => 'total', 'label' => 'Total', 'format' => 'money'],
                ], $sales->map(fn (Sale $sale) => [
                    'sale_number' => $sale->sale_number,
                    'created_at' => $sale->created_at?->toIso8601String(),
                    'customer_name' => $sale->customer?->name ?? 'Balcao',
                    'user_name' => $sale->user?->name ?? '-',
                    'payment_method' => $this->paymentLabel($sale->payment_method),
                    'total' => (float) $sale->total,
                ]), 'Nenhum atendimento encontrado no periodo.'),
            ],
            $from,
            $to,
        );
    }

    public function credit(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);

        $creditSales = Sale::query()
            ->with(['customer:id,name', 'user:id,name'])
            ->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->where('status', 'finalized')
            ->whereHas('payments', fn ($query) => $query->where('payment_method', PaymentMethod::CREDIT))
            ->latest()
            ->get();

        $customers = Customer::query()
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(function (Customer $customer) {
                $openCredit = (float) $customer->sales()
                    ->where('status', 'finalized')
                    ->whereHas('payments', fn ($query) => $query->where('payment_method', PaymentMethod::CREDIT))
                    ->join('sale_payments', 'sale_payments.sale_id', '=', 'sales.id')
                    ->where('sale_payments.payment_method', PaymentMethod::CREDIT)
                    ->sum('sale_payments.amount');

                return [
                    'name' => $customer->name,
                    'phone' => $customer->phone ?: '-',
                    'credit_limit' => (float) $customer->credit_limit,
                    'open_credit' => $openCredit,
                    'available_credit' => max(0, (float) $customer->credit_limit - $openCredit),
                ];
            })
            ->filter(fn (array $customer) => $customer['credit_limit'] > 0 || $customer['open_credit'] > 0)
            ->values();

        return $this->page(
            'Crediario e a receber',
            'Limites, saldo em aberto e lancamentos a credito.',
            [
                $this->metric('Clientes com limite', $customers->count()),
                $this->metric('Em aberto', $customers->sum('open_credit'), 'money'),
                $this->metric('Limite total', $customers->sum('credit_limit'), 'money'),
                $this->metric('Disponivel', $customers->sum('available_credit'), 'money'),
            ],
            [],
            [
                $this->table('Clientes', [
                    ['key' => 'name', 'label' => 'Cliente'],
                    ['key' => 'phone', 'label' => 'Telefone'],
                    ['key' => 'credit_limit', 'label' => 'Limite', 'format' => 'money'],
                    ['key' => 'open_credit', 'label' => 'Em aberto', 'format' => 'money'],
                    ['key' => 'available_credit', 'label' => 'Disponivel', 'format' => 'money'],
                ], $customers, 'Nenhum cliente com controle de credito.'),
                $this->table('Lancamentos recentes', [
                    ['key' => 'sale_number', 'label' => 'Venda'],
                    ['key' => 'created_at', 'label' => 'Data', 'format' => 'datetime'],
                    ['key' => 'customer_name', 'label' => 'Cliente'],
                    ['key' => 'user_name', 'label' => 'Operador'],
                    ['key' => 'total', 'label' => 'Total', 'format' => 'money'],
                ], $creditSales->map(fn (Sale $sale) => [
                    'sale_number' => $sale->sale_number,
                    'created_at' => $sale->created_at?->toIso8601String(),
                    'customer_name' => $sale->customer?->name ?? 'Balcao',
                    'user_name' => $sale->user?->name ?? '-',
                    'total' => (float) $sale->total,
                ]), 'Nenhuma venda a credito no periodo.'),
            ],
            $from,
            $to,
        );
    }

    public function customers(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);

        $customers = Customer::query()
            ->withCount(['sales as sales_count' => fn ($query) => $query->where('status', 'finalized')])
            ->orderBy('name')
            ->get()
            ->map(fn (Customer $customer) => [
                'name' => $customer->name,
                'phone' => $customer->phone ?: '-',
                'credit_limit' => (float) $customer->credit_limit,
                'sales_count' => (int) $customer->sales_count,
                'status' => $customer->active ? 'Ativo' : 'Inativo',
            ]);

        return $this->page(
            'Clientes',
            'Clientes cadastrados, vendas e limite de credito.',
            [
                $this->metric('Total', $customers->count()),
                $this->metric('Ativos', $customers->where('status', 'Ativo')->count()),
                $this->metric('Novos no periodo', Customer::query()->whereBetween('created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])->count()),
                $this->metric('Limite concedido', $customers->sum('credit_limit'), 'money'),
            ],
            [],
            [
                $this->table('Base de clientes', [
                    ['key' => 'name', 'label' => 'Cliente'],
                    ['key' => 'phone', 'label' => 'Telefone'],
                    ['key' => 'sales_count', 'label' => 'Vendas', 'format' => 'number'],
                    ['key' => 'credit_limit', 'label' => 'Limite', 'format' => 'money'],
                    ['key' => 'status', 'label' => 'Status'],
                ], $customers, 'Nenhum cliente cadastrado.'),
            ],
            $from,
            $to,
        );
    }

    public function reports(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);
        $summary = $this->salesQuery($from, $to)
            ->selectRaw('COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(cost_total), 0) as cost, COALESCE(SUM(profit), 0) as profit')
            ->first();
        $salesByDay = $this->salesQuery($from, $to)
            ->selectRaw('DATE(created_at) as day, COUNT(*) as qty, COALESCE(SUM(total), 0) as total, COALESCE(SUM(profit), 0) as profit')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy('day')
            ->get();
        $payments = DB::table('sale_payments')
            ->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->groupBy('sale_payments.payment_method')
            ->orderByDesc(DB::raw('SUM(sale_payments.amount)'))
            ->get(['sale_payments.payment_method', DB::raw('COUNT(*) as qty'), DB::raw('SUM(sale_payments.amount) as total')]);
        $topProducts = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(sale_items.total)'))
            ->limit(10)
            ->get(['products.name', DB::raw('SUM(sale_items.quantity) as qty'), DB::raw('SUM(sale_items.total) as revenue'), DB::raw('SUM(sale_items.profit) as profit')]);

        return $this->page(
            'Relatorios',
            'Resumo de faturamento, custo, lucro e pagamentos.',
            [
                $this->metric('Vendas', (int) ($summary->qty ?? 0)),
                $this->metric('Faturamento', (float) ($summary->total ?? 0), 'money'),
                $this->metric('Custo', (float) ($summary->cost ?? 0), 'money'),
                $this->metric('Lucro', (float) ($summary->profit ?? 0), 'money'),
            ],
            [
                $this->panel('Pagamento no periodo', $payments->map(fn ($payment) => [
                    'label' => $this->paymentLabel($payment->payment_method),
                    'value' => $this->currency($payment->total),
                    'meta' => "{$payment->qty} lancamento(s)",
                ])),
            ],
            [
                $this->table('Resumo diario', [
                    ['key' => 'day', 'label' => 'Dia', 'format' => 'date'],
                    ['key' => 'qty', 'label' => 'Vendas', 'format' => 'number'],
                    ['key' => 'total', 'label' => 'Faturamento', 'format' => 'money'],
                    ['key' => 'profit', 'label' => 'Lucro', 'format' => 'money'],
                ], $salesByDay, 'Nenhuma venda registrada no periodo.'),
                $this->table('Top produtos', [
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'qty', 'label' => 'Quantidade', 'format' => 'number'],
                    ['key' => 'revenue', 'label' => 'Faturamento', 'format' => 'money'],
                    ['key' => 'profit', 'label' => 'Lucro', 'format' => 'money'],
                ], $topProducts, 'Nenhum produto com venda no periodo.'),
            ],
            $from,
            $to,
        );
    }

    public function sales(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);
        $sales = $this->salesQuery($from, $to)->with(['customer:id,name', 'user:id,name'])->latest()->limit(30)->get();

        return $this->page(
            'Vendas gerais',
            'Vendas, lucro e formas de pagamento no periodo.',
            [
                $this->metric('Vendas', $sales->count()),
                $this->metric('Faturamento', $sales->sum('total'), 'money'),
                $this->metric('Lucro', $sales->sum('profit'), 'money'),
                $this->metric('Margem media', $sales->sum('total') > 0 ? ($sales->sum('profit') / $sales->sum('total')) * 100 : 0, 'percent'),
            ],
            [],
            [
                $this->table('Lancamentos', [
                    ['key' => 'sale_number', 'label' => 'Venda'],
                    ['key' => 'created_at', 'label' => 'Data', 'format' => 'datetime'],
                    ['key' => 'customer_name', 'label' => 'Cliente'],
                    ['key' => 'user_name', 'label' => 'Operador'],
                    ['key' => 'payment_method', 'label' => 'Pagamento'],
                    ['key' => 'total', 'label' => 'Total', 'format' => 'money'],
                    ['key' => 'profit', 'label' => 'Lucro', 'format' => 'money'],
                ], $sales->map(fn (Sale $sale) => [
                    'sale_number' => $sale->sale_number,
                    'created_at' => $sale->created_at?->toIso8601String(),
                    'customer_name' => $sale->customer?->name ?? 'Balcao',
                    'user_name' => $sale->user?->name ?? '-',
                    'payment_method' => $this->paymentLabel($sale->payment_method),
                    'total' => (float) $sale->total,
                    'profit' => (float) $sale->profit,
                ]), 'Nenhuma venda registrada no periodo.'),
            ],
            $from,
            $to,
        );
    }

    public function demand(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);
        $products = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->groupBy('products.id', 'products.name', 'products.code', 'categories.name')
            ->orderByDesc(DB::raw('SUM(sale_items.quantity)'))
            ->limit(20)
            ->get([
                'products.code',
                'products.name',
                DB::raw("COALESCE(categories.name, 'Sem categoria') as category_name"),
                DB::raw('SUM(sale_items.quantity) as qty'),
                DB::raw('SUM(sale_items.total) as revenue'),
                DB::raw('SUM(sale_items.profit) as profit'),
            ]);

        return $this->page(
            'Vendas por produto',
            'Quantidade vendida por produto no periodo.',
            [
                $this->metric('Itens com giro', $products->count()),
                $this->metric('Quantidade vendida', $products->sum('qty'), 'number'),
                $this->metric('Receita', $products->sum('revenue'), 'money'),
                $this->metric('Lucro', $products->sum('profit'), 'money'),
            ],
            [],
            [
                $this->table('Curva de demanda', [
                    ['key' => 'code', 'label' => 'Codigo'],
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'category_name', 'label' => 'Categoria'],
                    ['key' => 'qty', 'label' => 'Quantidade', 'format' => 'number'],
                    ['key' => 'revenue', 'label' => 'Receita', 'format' => 'money'],
                    ['key' => 'profit', 'label' => 'Lucro', 'format' => 'money'],
                ], $products, 'Nenhuma saida registrada no periodo.'),
            ],
            $from,
            $to,
        );
    }
}
