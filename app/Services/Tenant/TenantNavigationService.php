<?php

namespace App\Services\Tenant;

use Illuminate\Http\Request;

class TenantNavigationService
{
    public function catalog(): array
    {
        return [
            [
                'section' => 'Loja',
                'items' => [
                    [
                        'href' => '/dashboard',
                        'label' => 'Resumo',
                        'icon' => 'fa-house',
                        'access_key' => 'resumo',
                        'request_patterns' => ['dashboard'],
                    ],
                    [
                        'href' => '/pdv',
                        'label' => 'Vender',
                        'icon' => 'fa-cash-register',
                        'access_key' => 'pdv',
                        'request_patterns' => ['pdv', 'api/pdv*'],
                    ],
                    [
                        'href' => '/caixa',
                        'label' => 'Caixa',
                        'icon' => 'fa-vault',
                        'access_key' => 'caixa',
                        'request_patterns' => ['caixa', 'api/cash-registers*'],
                    ],
                    [
                        'href' => '/produtos',
                        'label_type' => 'products',
                        'icon' => 'fa-boxes-stacked',
                        'access_key' => 'produtos',
                        'request_patterns' => ['produtos', 'api/products*'],
                    ],
                    [
                        'href' => '/entrada-estoque',
                        'label' => 'Estoque',
                        'icon' => 'fa-arrow-down-to-bracket',
                        'access_key' => 'entrada_estoque',
                        'request_patterns' => ['entrada-estoque'],
                    ],
                    [
                        'href' => '/fiado',
                        'label' => 'Fiado',
                        'icon' => 'fa-handshake',
                        'access_key' => 'prazo',
                        'request_patterns' => ['a-prazo', 'fiado'],
                    ],
                    [
                        'href' => '/clientes',
                        'label' => 'Clientes',
                        'icon' => 'fa-users',
                        'access_key' => 'clientes',
                        'request_patterns' => ['clientes'],
                    ],
                ],
            ],
            [
                'section' => 'Avancado',
                'hidden_for_presets' => ['venda_direta'],
                'items' => [
                    [
                        'href' => '/pedidos',
                        'label_type' => 'orders',
                        'icon' => 'fa-clipboard-list',
                        'access_key' => 'pedidos',
                        'request_patterns' => ['pedidos', 'api/orders*'],
                    ],
                    [
                        'href' => '/venda-condicional',
                        'label' => 'Condicional',
                        'icon' => 'fa-shirt',
                        'access_key' => 'moda',
                        'request_patterns' => ['venda-condicional*'],
                    ],
                    [
                        'href' => '/consultas-cancelamentos',
                        'label' => 'Suporte fiscal',
                        'icon' => 'fa-magnifying-glass-dollar',
                        'access_key' => 'fiscal_avancado',
                        'required_role' => 'admin',
                        'request_patterns' => ['consultas-cancelamentos*'],
                    ],
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
                    [
                        'href' => '/categorias',
                        'label' => 'Categorias',
                        'icon' => 'fa-tags',
                        'access_key' => 'categorias',
                        'request_patterns' => ['categorias'],
                    ],
                    [
                        'href' => '/fornecedores',
                        'label' => 'Fornecedores',
                        'icon' => 'fa-building',
                        'access_key' => 'fornecedores',
                        'request_patterns' => ['fornecedores'],
                    ],
                    [
                        'href' => '/entrada-estoque/manutencao',
                        'label' => 'Compras com nota',
                        'icon' => 'fa-clipboard-check',
                        'access_key' => 'compras',
                        'request_patterns' => ['entrada-estoque/manutencao*'],
                    ],
                    [
                        'href' => '/movimentacao-estoque',
                        'label' => 'Historico do estoque',
                        'icon' => 'fa-arrows-rotate',
                        'access_key' => 'movimentacao_estoque',
                        'request_patterns' => ['movimentacao-estoque', 'ajuste-estoque'],
                    ],
                    [
                        'href' => '/relatorios',
                        'label' => 'Relatorios avancados',
                        'icon' => 'fa-chart-bar',
                        'access_key' => 'relatorios_avancados',
                        'request_patterns' => ['relatorios*', 'vendas', 'demanda', 'faltas'],
                    ],
                    [
                        'href' => '/shop',
                        'label' => 'Vendas online',
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
                    [
                        'href' => '/usuarios',
                        'label' => 'Usuarios',
                        'icon' => 'fa-user-gear',
                        'access_key' => 'usuarios',
                        'required_role' => 'admin',
                        'request_patterns' => ['usuarios'],
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
            'api/fiado*' => 'prazo',
            'api/fiscal*' => 'fiscal_avancado',
            'api/purchases*' => 'compras',
            'api/stock*' => 'entrada_estoque',
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
