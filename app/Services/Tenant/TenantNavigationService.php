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
                        'label' => 'Checkout integrado',
                        'icon' => 'fa-cash-register',
                        'access_key' => 'pdv',
                        'request_patterns' => ['pdv', 'caixa', 'api/pdv*'],
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
                    [
                        'href' => '/venda-condicional',
                        'label' => 'Condicional',
                        'icon' => 'fa-shirt',
                        'access_key' => 'prazo',
                        'request_patterns' => ['venda-condicional*'],
                    ],
                    [
                        'href' => '/consultas-cancelamentos',
                        'label' => 'Consultas',
                        'icon' => 'fa-magnifying-glass-dollar',
                        'request_patterns' => ['consultas-cancelamentos*'],
                    ],
                ],
            ],
            [
                'section' => 'Operacao',
                'items' => [
                    [
                        'href' => '/delivery',
                        'label' => 'Entregas',
                        'icon' => 'fa-motorcycle',
                        'access_key' => 'delivery',
                        'request_patterns' => ['delivery', 'api/delivery*'],
                    ],
                    [
                        'href' => '/compras',
                        'label' => 'Compras',
                        'icon' => 'fa-cart-shopping',
                        'access_key' => 'compras',
                        'request_patterns' => ['compras', 'api/operations/compras*'],
                    ],
                    [
                        'href' => '/contas-a-pagar',
                        'label' => 'Contas a pagar',
                        'icon' => 'fa-file-invoice-dollar',
                        'access_key' => 'compras',
                        'request_patterns' => ['contas-a-pagar', 'api/operations/contas-a-pagar*'],
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
                        'icon' => 'fa-file-invoice',
                        'access_key' => 'entrada_estoque',
                        'request_patterns' => ['entrada-estoque'],
                    ],
                    [
                        'href' => '/movimentacao-estoque',
                        'label' => 'Ajuste estoque',
                        'icon' => 'fa-arrows-rotate',
                        'access_key' => 'movimentacao_estoque',
                        'request_patterns' => ['movimentacao-estoque', 'ajuste-estoque'],
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
                'section' => 'Digital',
                'items' => [
                    [
                        'href' => '/shop',
                        'label' => 'Shop online',
                        'icon' => 'fa-store',
                        'access_key' => 'catalogo_online',
                        'request_patterns' => ['shop', 'shop/*'],
                    ],
                    [
                        'href' => '/moda/catalog',
                        'label' => 'Moda',
                        'icon' => 'fa-shirt',
                        'access_key' => 'moda',
                        'request_patterns' => ['moda*', 'api/fashion*'],
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

    /**
     * Chave de modulo para o middleware `module.enabled` (inclui fallback por path).
     */
    public function resolveModuleAccessKey(Request $request): ?string
    {
        $item = $this->resolveItem($request);
        $fromNav = $item['access_key'] ?? null;

        if (filled($fromNav)) {
            return $fromNav;
        }

        return $this->fallbackModuleAccessKeyFromRequest($request);
    }

    protected function fallbackModuleAccessKeyFromRequest(Request $request): ?string
    {
        foreach ($this->fallbackPathModuleMap() as $pattern => $key) {
            if ($request->is($pattern)) {
                return $key;
            }
        }

        return null;
    }

    /**
     * @return array<string, string> pattern => access_key
     */
    protected function fallbackPathModuleMap(): array
    {
        return [
            'api/cash-registers*' => 'caixa',
            'api/delivery*' => 'delivery',
            'api/fashion*' => 'moda',
        ];
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
