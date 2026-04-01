<?php

namespace App\Http\Controllers\Central;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\Tenant\TenantSettingsService;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class AdminPageController extends Controller
{
    public function dashboard(TenantSettingsService $settingsService): Response
    {
        return Inertia::render('CentralAdmin/Dashboard', [
            ...$this->buildProps($settingsService),
            'pageMode' => 'home',
        ]);
    }

    public function clients(TenantSettingsService $settingsService): Response
    {
        return Inertia::render('CentralAdmin/Clients', [
            ...$this->buildProps($settingsService),
            'pageMode' => 'tenants',
        ]);
    }

    public function featureFlags(TenantSettingsService $settingsService): Response
    {
        return Inertia::render('CentralAdmin/Clients', [
            ...$this->buildProps($settingsService),
            'pageMode' => 'feature-flags',
        ]);
    }

    public function placeholder(string $section): Response
    {
        $pages = [
            'usuarios' => [
                'title' => 'Usuários',
                'description' => 'Gestão de usuários do admin central.',
                'icon' => 'fa-user-gear',
            ],
            'fornecedores' => [
                'title' => 'Fornecedores',
                'description' => 'Cadastro e gestão de fornecedores (em construção).',
                'icon' => 'fa-building',
            ],
            'categorias' => [
                'title' => 'Categorias',
                'description' => 'Cadastro e gestão de categorias (em construção).',
                'icon' => 'fa-tags',
            ],
            'produtos' => [
                'title' => 'Produtos',
                'description' => 'Cadastro e gestão de produtos (em construção).',
                'icon' => 'fa-boxes-stacked',
            ],
            'receitas-producao' => [
                'title' => 'Receitas / Produção',
                'description' => 'Módulos de receitas e produção (em construção).',
                'icon' => 'fa-gears',
            ],
            'estoque-entrada' => [
                'title' => 'Entrada de estoque',
                'description' => 'Entrada de estoque (em construção).',
                'icon' => 'fa-arrow-down',
            ],
            'estoque-conferencia' => [
                'title' => 'Conferência de estoque',
                'description' => 'Conferência e ajustes de estoque (em construção).',
                'icon' => 'fa-list-check',
            ],
            'estoque-movimentacao' => [
                'title' => 'Movimentação de estoque',
                'description' => 'Movimentação e histórico (em construção).',
                'icon' => 'fa-timeline',
            ],
            'comandas' => [
                'title' => 'Comandas',
                'description' => 'Módulo de comandas (em construção).',
                'icon' => 'fa-clipboard-list',
            ],
            'cozinha' => [
                'title' => 'Cozinha',
                'description' => 'Módulo de cozinha (em construção).',
                'icon' => 'fa-utensils',
            ],
            'vendas' => [
                'title' => 'Vendas',
                'description' => 'Visões de vendas (em construção).',
                'icon' => 'fa-chart-line',
            ],
            'configuracoes' => [
                'title' => 'Configurações gerais',
                'description' => 'Configurações do admin central (em construção).',
                'icon' => 'fa-sliders',
            ],
            'integracoes' => [
                'title' => 'Integrações',
                'description' => 'Integrações do admin central (em construção).',
                'icon' => 'fa-plug',
            ],
        ];

        abort_unless(array_key_exists($section, $pages), 404);

        return Inertia::render('CentralAdmin/Placeholder', [
            'section' => $section,
            'title' => $pages[$section]['title'],
            'description' => $pages[$section]['description'],
            'icon' => $pages[$section]['icon'],
        ]);
    }

    protected function buildProps(TenantSettingsService $settingsService): array
    {
        $tenants = [];

        if (Schema::hasTable('tenants')) {
            $tenants = Tenant::query()
                ->with(['client', 'domains'])
                ->orderBy('name')
                ->get()
                ->map(function (Tenant $tenant) use ($settingsService): array {
                    $domain = $tenant->domains->first()?->domain ?? $tenant->client?->domain;

                    return [
                        'id' => (string) $tenant->id,
                        'name' => $tenant->name ?: $tenant->client?->name ?: (string) $tenant->id,
                        'email' => $tenant->email ?: $tenant->client?->email,
                        'client_name' => $tenant->client?->name,
                        'document' => $tenant->client?->document,
                        'domain' => $domain,
                        'url' => $this->tenantUrl($domain),
                        'active' => (bool) ($tenant->client?->active ?? true),
                        'created_at' => optional($tenant->created_at)?->format('d/m/Y H:i'),
                        'settings' => $settingsService->get((string) $tenant->id),
                    ];
                })
                ->sortByDesc(fn (array $tenant): int => $tenant['active'] ? 1 : 0)
                ->values()
                ->all();
        }

        return [
            'tenantStats' => [
                'total' => count($tenants),
                'active' => count(array_filter($tenants, fn (array $tenant): bool => $tenant['active'])),
                'inactive' => count(array_filter($tenants, fn (array $tenant): bool => !$tenant['active'])),
            ],
            'tenants' => $tenants,
            'businessPresets' => $settingsService->businessPresets(),
            'generalOptions' => $settingsService->generalOptions(),
            'moduleSections' => $settingsService->moduleDefinitions(),
        ];
    }

    protected function tenantUrl(?string $domain): ?string
    {
        if (!filled($domain)) {
            return null;
        }

        if (str_starts_with($domain, 'http://') || str_starts_with($domain, 'https://')) {
            return $domain;
        }

        $scheme = request()->isSecure() ? 'https' : 'http';

        return sprintf('%s://%s', $scheme, $domain);
    }
}
