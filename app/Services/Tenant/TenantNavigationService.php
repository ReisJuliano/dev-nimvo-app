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
                        'href' => '/estoque',
                        'label' => 'Estoque',
                        'icon' => 'fa-warehouse',
                        'access_key' => 'entrada_estoque',
                        'request_patterns' => ['^estoque$'],
                    ],
                    [
                        'href' => '/entrada-estoque',
                        'label' => 'Entrada de mercadoria',
                        'icon' => 'fa-dolly',
                        'access_key' => 'entrada_estoque',
                        'request_patterns' => ['entrada-estoque'],
                    ],
                    [
                        'href' => '/entrada-estoque/manutencao',
                        'label' => 'Manutencao de entradas',
                        'icon' => 'fa-clipboard-check',
                        'access_key' => 'entrada_estoque_avancado',
                        'request_patterns' => ['entrada-estoque/manutencao', 'api/purchases*'],
                    ],
                    [
                        'href' => '/inventario',
                        'label' => 'Inventário',
                        'icon' => 'fa-clipboard-list',
                        'required_permission' => 'inventario.gerenciar',
                        'request_patterns' => ['inventario', 'api/inventory*'],
                    ],
                    [
                        'href' => '/promocoes',
                        'label' => 'Promoções',
                        'icon' => 'fa-tags',
                        'required_permission' => 'promocoes.gerenciar',
                        'request_patterns' => ['promocoes', 'api/promotions*'],
                    ],
                    [
                        'href' => '/etiquetas',
                        'label' => 'Etiquetas',
                        'icon' => 'fa-barcode',
                        'required_permission' => 'produtos.imprimir_etiquetas',
                        'request_patterns' => ['etiquetas*', 'api/labels*'],
                    ],
                    [
                        'href' => '/a-receber',
                        'label' => 'A receber',
                        'icon' => 'fa-handshake',
                        'access_key' => 'prazo',
                        'request_patterns' => ['a-prazo', 'fiado', 'a-receber', 'api/receivables*'],
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
                        'access_key' => 'consultas_fiscais',
                        'allowed_roles' => ['admin', 'operator'],
                        'module_bypass' => true,
                        'request_patterns' => ['consultas-cancelamentos*', 'api/fiscal*'],
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
                        'required_permission' => 'usuarios.gerenciar',
                        'request_patterns' => ['usuarios', 'api/operations/usuarios*', 'api/operations/grupos*'],
                    ],
                    [
                        'href' => '/configuracoes',
                        'label' => 'Configuracoes',
                        'icon' => 'fa-sliders',
                        'required_permission' => 'configuracoes.editar',
                        'request_patterns' => ['configuracoes', 'api/settings*'],
                    ],
                    [
                        'href' => '/auditoria',
                        'label' => 'Auditoria',
                        'icon' => 'fa-clipboard-check',
                        'required_permission' => 'auditoria.visualizar',
                        'request_patterns' => ['auditoria', 'api/audit*'],
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
     * Chave de módulo para o middleware `module.enabled` (inclui fallback por path).
     */
    public function resolveModuleAccessKey(Request $request): ?string
    {
        $item = $this->resolveItem($request);

        if ((bool) ($item['module_bypass'] ?? false)) {
            return null;
        }

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
            'api/receivables*' => 'prazo',
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
        $requiredPermission = $item['required_permission'] ?? null;

        if ($requiredPermission) {
            return (bool) $request->user()?->hasPermission($requiredPermission);
        }

        $allowedRoles = $item['allowed_roles'] ?? null;

        if (is_array($allowedRoles) && $allowedRoles !== []) {
            return in_array($request->user()?->role, $allowedRoles, true);
        }

        $requiredRole = $item['required_role'] ?? null;

        return ! $requiredRole || $request->user()?->role === $requiredRole;
    }
}
