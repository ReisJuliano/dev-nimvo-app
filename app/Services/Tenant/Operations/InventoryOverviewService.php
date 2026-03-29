<?php

namespace App\Services\Tenant\Operations;

use App\Models\Tenant\Category;
use App\Models\Tenant\Product;
use App\Models\Tenant\Supplier;
use App\Services\Tenant\Operations\Concerns\BuildsOverviewPages;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class InventoryOverviewService
{
    use BuildsOverviewPages;

    public function suppliers(): array
    {
        $suppliers = Supplier::query()
            ->withCount(['products as products_count' => fn ($query) => $query->where('active', true)])
            ->orderBy('name')
            ->get()
            ->map(fn (Supplier $supplier) => [
                'name' => $supplier->name,
                'phone' => $supplier->phone ?: '-',
                'email' => $supplier->email ?: '-',
                'products_count' => (int) $supplier->products_count,
                'status' => $supplier->active ? 'Ativo' : 'Inativo',
            ]);

        return $this->page(
            'Fornecedores',
            'Cadastro de fornecedores e produtos vinculados.',
            [
                $this->metric('Total', $suppliers->count()),
                $this->metric('Ativos', $suppliers->where('status', 'Ativo')->count()),
                $this->metric('Com produtos', $suppliers->where('products_count', '>', 0)->count()),
                $this->metric('Sem cobertura', $suppliers->where('products_count', 0)->count()),
            ],
            [],
            [
                $this->table('Cadastro de fornecedores', [
                    ['key' => 'name', 'label' => 'Fornecedor'],
                    ['key' => 'phone', 'label' => 'Telefone'],
                    ['key' => 'email', 'label' => 'E-mail'],
                    ['key' => 'products_count', 'label' => 'Produtos', 'format' => 'number'],
                    ['key' => 'status', 'label' => 'Status'],
                ], $suppliers, 'Nenhum fornecedor cadastrado.'),
            ],
        );
    }

    public function categories(): array
    {
        $categories = Category::query()
            ->withCount(['products as products_count' => fn ($query) => $query->where('active', true)])
            ->orderBy('name')
            ->get()
            ->map(function (Category $category) {
                return [
                    'name' => $category->name,
                    'description' => $category->description ?: '-',
                    'products_count' => (int) $category->products_count,
                    'stock_value' => Product::query()
                        ->where('active', true)
                        ->where('category_id', $category->id)
                        ->get()
                        ->sum(fn (Product $product) => (float) $product->stock_quantity * (float) $product->cost_price),
                    'status' => $category->active ? 'Ativa' : 'Inativa',
                ];
            });

        return $this->page(
            'Categorias',
            'Categorias cadastradas e valor em estoque.',
            [
                $this->metric('Total', $categories->count()),
                $this->metric('Ativas', $categories->where('status', 'Ativa')->count()),
                $this->metric('Com produtos', $categories->where('products_count', '>', 0)->count()),
                $this->metric('Valor em estoque', $categories->sum('stock_value'), 'money'),
            ],
            [],
            [
                $this->table('Estrutura do catalogo', [
                    ['key' => 'name', 'label' => 'Categoria'],
                    ['key' => 'description', 'label' => 'Descricao'],
                    ['key' => 'products_count', 'label' => 'Produtos', 'format' => 'number'],
                    ['key' => 'stock_value', 'label' => 'Valor estoque', 'format' => 'money'],
                    ['key' => 'status', 'label' => 'Status'],
                ], $categories, 'Nenhuma categoria cadastrada.'),
            ],
        );
    }

    public function stockInbound(): array
    {
        $products = Product::query()
            ->with(['supplier:id,name'])
            ->where('active', true)
            ->whereColumn('stock_quantity', '<=', 'min_stock')
            ->orderBy('stock_quantity')
            ->get()
            ->map(function (Product $product) {
                return [
                    'code' => $product->code,
                    'name' => $product->name,
                    'supplier_name' => $product->supplier?->name ?? 'Sem fornecedor',
                    'stock_quantity' => (float) $product->stock_quantity,
                    'min_stock' => (float) $product->min_stock,
                    'suggested_inbound' => max(0, ((float) $product->min_stock * 2) - (float) $product->stock_quantity),
                ];
            });

        return $this->page(
            'Entrada de estoque',
            'Itens com necessidade de reposicao.',
            [
                $this->metric('Itens prioritarios', $products->count()),
                $this->metric('Reposicao sugerida', $products->sum('suggested_inbound'), 'number'),
                $this->metric('Fornecedores acionados', $products->pluck('supplier_name')->unique()->count()),
                $this->metric('Itens sem fornecedor', $products->where('supplier_name', 'Sem fornecedor')->count()),
            ],
            [
                $this->panel('Carga por fornecedor', $products
                    ->groupBy('supplier_name')
                    ->map(fn (Collection $group, string $name) => [
                        'label' => $name,
                        'value' => $this->number($group->sum('suggested_inbound')),
                        'meta' => "{$group->count()} item(ns)",
                    ])
                    ->values()),
            ],
            [
                $this->table('Reposicao sugerida', [
                    ['key' => 'code', 'label' => 'Codigo'],
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'supplier_name', 'label' => 'Fornecedor'],
                    ['key' => 'stock_quantity', 'label' => 'Atual', 'format' => 'number'],
                    ['key' => 'min_stock', 'label' => 'Minimo', 'format' => 'number'],
                    ['key' => 'suggested_inbound', 'label' => 'Sugerido', 'format' => 'number'],
                ], $products, 'Nenhum produto precisa de reposicao agora.'),
            ],
        );
    }

    public function stockAdjustments(): array
    {
        $products = Product::query()
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product) => [
                'code' => $product->code,
                'name' => $product->name,
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'gap' => (float) $product->stock_quantity - (float) $product->min_stock,
                'updated_at' => $product->updated_at?->toIso8601String(),
            ])
            ->filter(fn (array $product) => $product['gap'] <= 0 || $product['stock_quantity'] <= 0)
            ->values();

        return $this->page(
            'Conferencia de estoque',
            'Itens para conferencia e ajuste de saldo.',
            [
                $this->metric('Itens criticos', $products->count()),
                $this->metric('Sem saldo', $products->where('stock_quantity', '<=', 0)->count()),
                $this->metric('Abaixo do minimo', $products->where('gap', '<=', 0)->count()),
                $this->metric('Defasagem total', abs($products->sum('gap')), 'number'),
            ],
            [],
            [
                $this->table('Itens para revisar', [
                    ['key' => 'code', 'label' => 'Codigo'],
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'stock_quantity', 'label' => 'Atual', 'format' => 'number'],
                    ['key' => 'min_stock', 'label' => 'Minimo', 'format' => 'number'],
                    ['key' => 'gap', 'label' => 'Diferenca', 'format' => 'number'],
                    ['key' => 'updated_at', 'label' => 'Ultima revisao', 'format' => 'datetime'],
                ], $products, 'Nenhum item critico no estoque.'),
            ],
        );
    }

    public function stockHistory(array $filters): array
    {
        [$from, $to] = $this->resolvePeriod($filters);
        $outbound = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->join('products', 'products.id', '=', 'sale_items.product_id')
            ->where('sales.status', 'finalized')
            ->whereBetween('sales.created_at', [$from->copy()->startOfDay(), $to->copy()->endOfDay()])
            ->groupBy('products.id', 'products.name', 'products.code')
            ->orderByDesc(DB::raw('SUM(sale_items.quantity)'))
            ->limit(15)
            ->get(['products.code', 'products.name', DB::raw('SUM(sale_items.quantity) as quantity'), DB::raw('SUM(sale_items.total) as total')]);
        $recentUpdates = Product::query()
            ->where('active', true)
            ->latest('updated_at')
            ->limit(12)
            ->get()
            ->map(fn (Product $product) => [
                'code' => $product->code,
                'name' => $product->name,
                'stock_quantity' => (float) $product->stock_quantity,
                'updated_at' => $product->updated_at?->toIso8601String(),
            ]);

        return $this->page(
            'Movimentacao de estoque',
            'Saidas do periodo e ultimas atualizacoes.',
            [
                $this->metric('Saidas registradas', $outbound->sum('quantity'), 'number'),
                $this->metric('Valor movimentado', $outbound->sum('total'), 'money'),
                $this->metric('Itens com giro', $outbound->count()),
                $this->metric('Atualizacoes recentes', $recentUpdates->count()),
            ],
            [],
            [
                $this->table('Saidas por produto', [
                    ['key' => 'code', 'label' => 'Codigo'],
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'quantity', 'label' => 'Quantidade', 'format' => 'number'],
                    ['key' => 'total', 'label' => 'Valor', 'format' => 'money'],
                ], $outbound, 'Nenhuma saida registrada no periodo.'),
                $this->table('Ultimas atualizacoes', [
                    ['key' => 'code', 'label' => 'Codigo'],
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'stock_quantity', 'label' => 'Saldo', 'format' => 'number'],
                    ['key' => 'updated_at', 'label' => 'Atualizado em', 'format' => 'datetime'],
                ], $recentUpdates, 'Nenhuma atualizacao encontrada.'),
            ],
            $from,
            $to,
        );
    }

    public function shortages(): array
    {
        $products = Product::query()
            ->with(['category:id,name', 'supplier:id,name'])
            ->where('active', true)
            ->whereColumn('stock_quantity', '<=', 'min_stock')
            ->orderBy('stock_quantity')
            ->get()
            ->map(fn (Product $product) => [
                'code' => $product->code,
                'name' => $product->name,
                'category_name' => $product->category?->name ?? 'Sem categoria',
                'supplier_name' => $product->supplier?->name ?? 'Sem fornecedor',
                'stock_quantity' => (float) $product->stock_quantity,
                'min_stock' => (float) $product->min_stock,
                'missing' => max(0, (float) $product->min_stock - (float) $product->stock_quantity),
            ]);

        return $this->page(
            'Faltas e giro',
            'Itens em falta ou abaixo do estoque minimo.',
            [
                $this->metric('Itens em falta', $products->where('stock_quantity', '<=', 0)->count()),
                $this->metric('Baixo estoque', $products->count()),
                $this->metric('Reposicao minima', $products->sum('missing'), 'number'),
                $this->metric('Sem fornecedor', $products->where('supplier_name', 'Sem fornecedor')->count()),
            ],
            [],
            [
                $this->table('Itens criticos', [
                    ['key' => 'code', 'label' => 'Codigo'],
                    ['key' => 'name', 'label' => 'Produto'],
                    ['key' => 'category_name', 'label' => 'Categoria'],
                    ['key' => 'supplier_name', 'label' => 'Fornecedor'],
                    ['key' => 'stock_quantity', 'label' => 'Atual', 'format' => 'number'],
                    ['key' => 'min_stock', 'label' => 'Minimo', 'format' => 'number'],
                    ['key' => 'missing', 'label' => 'Falta', 'format' => 'number'],
                ], $products, 'Nenhum item com falta ou baixo estoque.'),
            ],
        );
    }
}
