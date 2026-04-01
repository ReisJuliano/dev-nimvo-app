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
                'title' => 'UsuÃƒÂ¡rios',
                'description' => 'GestÃƒÂ£o de usuÃƒÂ¡rios do admin central.',
                'icon' => 'fa-user-gear',
            ],
            'fornecedores' => [
                'title' => 'Fornecedores',
                'description' => 'Cadastro e gestÃƒÂ£o de fornecedores (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-building',
            ],
            'categorias' => [
                'title' => 'Categorias',
                'description' => 'Cadastro e gestÃƒÂ£o de categorias (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-tags',
            ],
            'produtos' => [
                'title' => 'Produtos',
                'description' => 'Cadastro e gestÃƒÂ£o de produtos (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-boxes-stacked',
            ],
            'receitas-producao' => [
                'title' => 'Receitas / ProduÃƒÂ§ÃƒÂ£o',
                'description' => 'MÃƒÂ³dulos de receitas e produÃƒÂ§ÃƒÂ£o (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-gears',
            ],
            'estoque-entrada' => [
                'title' => 'Entrada de estoque',
                'description' => 'Entrada de estoque (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-arrow-down',
            ],
            'estoque-conferencia' => [
                'title' => 'ConferÃƒÂªncia de estoque',
                'description' => 'ConferÃƒÂªncia e ajustes de estoque (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-list-check',
            ],
            'estoque-movimentacao' => [
                'title' => 'MovimentaÃƒÂ§ÃƒÂ£o de estoque',
                'description' => 'MovimentaÃƒÂ§ÃƒÂ£o e histÃƒÂ³rico (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-timeline',
            ],
            'comandas' => [
                'title' => 'Atendimentos',
                'description' => 'Modulo de atendimentos (em construcao).',
                'icon' => 'fa-clipboard-list',
            ],
            'cozinha' => [
                'title' => 'Cozinha',
                'description' => 'MÃƒÂ³dulo de cozinha (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-utensils',
            ],
            'vendas' => [
                'title' => 'Vendas',
                'description' => 'VisÃƒÂµes de vendas (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-chart-line',
            ],
            'configuracoes' => [
                'title' => 'ConfiguraÃƒÂ§ÃƒÂµes gerais',
                'description' => 'ConfiguraÃƒÂ§ÃƒÂµes do admin central (em construÃƒÂ§ÃƒÂ£o).',
                'icon' => 'fa-sliders',
            ],
            'integracoes' => [
                'title' => 'IntegraÃƒÂ§ÃƒÂµes',
                'description' => 'IntegraÃƒÂ§ÃƒÂµes do admin central (em construÃƒÂ§ÃƒÂ£o).',
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
