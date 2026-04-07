<?php

namespace App\Services\Tenant;

use Illuminate\Http\Request;

class TenantNavigationService
{
    public function catalog(): array
    {
        return [
            [
                'section' => 'Gerencial',
                'items' => [
                    [
                        'href' => '/dashboard',
                        'label' => 'Inicio',
                        'icon' => 'fa-chart-pie',
                        'request_patterns' => ['dashboard'],
                    ],
                ],
            ],
            [
                'section' => 'Vendas',
                'items' => [
                    [
                        'href' => '/pdv',
                        'label_type' => 'pdv',
                        'icon' => 'fa-cash-register',
                        'access_key' => 'pdv',
                        'request_patterns' => ['pdv', 'api/pdv*'],
                    ],
                    [
                        'href' => '/pedidos',
                        'label_type' => 'orders',
                        'icon' => 'fa-clipboard-list',
                        'access_key' => 'pedidos',
                        'request_patterns' => ['pedidos', 'api/orders*'],
                    ],
                    [
                        'href' => '/a-prazo',
                        'label' => 'A Prazo',
                        'icon' => 'fa-handshake',
                        'access_key' => 'prazo',
                        'request_patterns' => ['a-prazo', 'fiado'],
                    ],
                ],
            ],
            [
                'section' => 'Operacao',
                'items' => [
                    [
                        'href' => '/compras',
                        'label' => 'Compras',
                        'icon' => 'fa-cart-shopping',
                        'access_key' => 'compras',
                        'request_patterns' => ['compras', 'api/operations/compras*'],
                    ],
                ],
            ],
            [
                'section' => 'Cadastros',
                'items' => [
                    [
                        'href' => '/produtos',
                        'label_type' => 'products',
                        'icon' => 'fa-boxes-stacked',
                        'access_key' => 'produtos',
                        'request_patterns' => ['produtos', 'api/products*'],
                    ],
                    [
                        'href' => '/categorias',
                        'label' => 'Categorias',
                        'icon' => 'fa-tags',
                        'access_key' => 'categorias',
                        'request_patterns' => ['categorias'],
                    ],
                    [
                        'href' => '/clientes',
                        'label' => 'Clientes',
                        'icon' => 'fa-users',
                        'access_key' => 'clientes',
                        'request_patterns' => ['clientes'],
                    ],
                    [
                        'href' => '/fornecedores',
                        'label' => 'Fornecedores',
                        'icon' => 'fa-building',
                        'access_key' => 'fornecedores',
                        'request_patterns' => ['fornecedores'],
                    ],
                ],
            ],
            [
                'section' => 'Estoque',
                'items' => [
                    [
                        'href' => '/entrada-estoque',
                        'label' => 'Entrada',
                        'icon' => 'fa-arrow-down',
                        'access_key' => 'entrada_estoque',
                        'request_patterns' => ['entrada-estoque'],
                    ],
                    [
                        'href' => '/ajuste-estoque',
                        'label' => 'Conferencia',
                        'icon' => 'fa-sliders',
                        'access_key' => 'ajuste_estoque',
                        'request_patterns' => ['ajuste-estoque'],
                    ],
                    [
                        'href' => '/movimentacao-estoque',
                        'label' => 'Movimentacao',
                        'icon' => 'fa-timeline',
                        'access_key' => 'movimentacao_estoque',
                        'request_patterns' => ['movimentacao-estoque'],
                    ],
                ],
            ],
            [
                'section' => 'Relatorios',
                'items' => [
                    [
                        'href' => '/relatorios',
                        'label' => 'Relatorios',
                        'icon' => 'fa-chart-bar',
                        'access_key' => 'relatorios',
                        'request_patterns' => ['relatorios*', 'vendas', 'demanda', 'faltas'],
                    ],
                ],
            ],
            [
                'section' => 'Admin',
                'items' => [
                    [
                        'href' => '/usuarios',
                        'label' => 'Usuarios',
                        'icon' => 'fa-user-gear',
                        'access_key' => 'usuarios',
                        'required_role' => 'admin',
                        'request_patterns' => ['usuarios'],
                    ],
                    [
                        'href' => '/configuracoes',
                        'label' => 'Configuracoes',
                        'icon' => 'fa-gear',
                        'required_role' => 'admin',
                        'request_patterns' => ['configuracoes', 'api/settings'],
                    ],
                ],
            ],
        ];
    }

    public function resolveAccessKey(Request $request): ?string
    {
        return $this->resolveItem($request)['access_key'] ?? null;
    }

    public function resolveItem(Request $request): ?array
    {
        foreach ($this->catalog() as $group) {
            foreach ($group['items'] ?? [] as $item) {
                foreach ($item['request_patterns'] ?? [] as $pattern) {
                    if ($request->is($pattern)) {
                        return $item;
                    }
                }
            }
        }

        return null;
    }

    public function userHasRequiredRole(Request $request, ?array $item = null): bool
    {
        $item ??= $this->resolveItem($request);
        $requiredRole = $item['required_role'] ?? null;

        return ! $requiredRole || $request->user()?->role === $requiredRole;
    }
}
