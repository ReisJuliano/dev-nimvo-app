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
                        'href' => '/delivery',
                        'label' => 'Delivery',
                        'icon' => 'fa-motorcycle',
                        'access_key' => 'delivery',
                        'request_patterns' => ['delivery'],
                    ],
                    [
                        'href' => '/caixa',
                        'label' => 'Caixa',
                        'icon' => 'fa-vault',
                        'access_key' => 'caixa',
                        'request_patterns' => ['caixa', 'api/cash-registers*'],
                    ],
                    [
                        'href' => '/fiado',
                        'label' => 'Fiado',
                        'icon' => 'fa-handshake',
                        'access_key' => 'crediario',
                        'request_patterns' => ['fiado'],
                    ],
                    [
                        'href' => '/trocas-devolucoes',
                        'label' => 'Trocas e devolucoes',
                        'icon' => 'fa-right-left',
                        'access_key' => 'trocas_devolucoes',
                        'request_patterns' => ['trocas-devolucoes'],
                    ],
                    [
                        'href' => '/promocoes',
                        'label' => 'Promocoes',
                        'icon' => 'fa-tags',
                        'access_key' => 'promocoes',
                        'request_patterns' => ['promocoes'],
                    ],
                ],
            ],
            [
                'section' => 'Operacao',
                'items' => [
                    [
                        'href' => '/producao',
                        'label' => 'Producao',
                        'icon' => 'fa-bread-slice',
                        'access_key' => 'producao',
                        'request_patterns' => ['producao'],
                    ],
                    [
                        'href' => '/fichas-tecnicas',
                        'label' => 'Fichas tecnicas',
                        'icon' => 'fa-book-open',
                        'access_key' => 'fichas_tecnicas',
                        'request_patterns' => ['fichas-tecnicas'],
                    ],
                    [
                        'href' => '/cozinha',
                        'label' => 'Cozinha',
                        'icon' => 'fa-utensils',
                        'access_key' => 'cozinha',
                        'request_patterns' => ['cozinha'],
                    ],
                    [
                        'href' => '/perdas',
                        'label' => 'Perdas',
                        'icon' => 'fa-trash-can',
                        'access_key' => 'controle_perdas',
                        'request_patterns' => ['perdas'],
                    ],
                    [
                        'href' => '/pesagem',
                        'label' => 'Pesagem',
                        'icon' => 'fa-scale-balanced',
                        'access_key' => 'pesagem',
                        'request_patterns' => ['pesagem'],
                    ],
                    [
                        'href' => '/compras',
                        'label' => 'Compras',
                        'icon' => 'fa-cart-shopping',
                        'access_key' => 'compras',
                        'request_patterns' => ['compras'],
                    ],
                    [
                        'href' => '/ordens-servico',
                        'label' => 'Ordens de servico',
                        'icon' => 'fa-screwdriver-wrench',
                        'access_key' => 'ordens_servico',
                        'request_patterns' => ['ordens-servico'],
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
                    [
                        'href' => '/produtores',
                        'label' => 'Produtores',
                        'icon' => 'fa-tractor',
                        'access_key' => 'produtores',
                        'request_patterns' => ['produtores'],
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
                'section' => 'Digital',
                'items' => [
                    [
                        'href' => '/catalogo-online',
                        'label' => 'Catalogo online',
                        'icon' => 'fa-globe',
                        'access_key' => 'catalogo_online',
                        'request_patterns' => ['catalogo-online'],
                    ],
                    [
                        'href' => '/pedidos-online',
                        'label' => 'Pedidos online',
                        'icon' => 'fa-store',
                        'access_key' => 'pedidos_online',
                        'request_patterns' => ['pedidos-online'],
                    ],
                    [
                        'href' => '/whatsapp',
                        'label' => 'WhatsApp',
                        'icon' => 'fa-comment-dots',
                        'access_key' => 'whatsapp_pedidos',
                        'request_patterns' => ['whatsapp'],
                    ],
                ],
            ],
            [
                'section' => 'Relatorios',
                'items' => [
                    [
                        'href' => '/relatorios',
                        'label' => 'Relatorios avancados',
                        'icon' => 'fa-chart-bar',
                        'access_key' => 'relatorios',
                        'request_patterns' => ['relatorios', 'vendas', 'demanda'],
                    ],
                    [
                        'href' => '/faltas',
                        'label' => 'Faltas e Giro',
                        'icon' => 'fa-triangle-exclamation',
                        'access_key' => 'faltas',
                        'request_patterns' => ['faltas'],
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

        return !$requiredRole || $request->user()?->role === $requiredRole;
    }
}
