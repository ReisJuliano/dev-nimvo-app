<?php

namespace App\Http\Controllers\Central;

use App\Models\Central\LocalAgent;
use App\Models\Central\Client;
use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Services\Central\LocalAgentBootstrapService;
use App\Services\Central\LocalAgentConfigService;
use App\Services\Central\TenantLicenseService;
use App\Services\Tenant\TenantSettingsService;
use App\Support\Tenancy\TenantDomainManager;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class AdminPageController extends Controller
{
    protected function clientsTableExists(): bool
    {
        return Schema::connection((new Client())->getConnectionName())->hasTable('clients');
    }

    protected function localAgentsTableExists(): bool
    {
        return Schema::connection((new LocalAgent())->getConnectionName())->hasTable('local_agents');
    }

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
        $domainManager = app(TenantDomainManager::class);
        $licenseService = app(TenantLicenseService::class);
        $localAgentConfigService = app(LocalAgentConfigService::class);
        $localAgentBootstrapService = app(LocalAgentBootstrapService::class);
        $agentStats = [
            'total' => 0,
            'online' => 0,
            'offline' => 0,
        ];
        $agentLookup = collect();

        if (Schema::hasTable('tenants')) {
            $query = Tenant::query()
                ->with(['domains'])
                ->orderBy('name')
                ;

            if ($this->clientsTableExists()) {
                $query->with('client');
            }

            $tenantModels = $query->get();

            if ($this->localAgentsTableExists()) {
                $agentLookup = LocalAgent::query()
                    ->whereIn('tenant_id', $tenantModels->pluck('id'))
                    ->orderByDesc('last_seen_at')
                    ->orderByDesc('id')
                    ->get()
                    ->unique('tenant_id')
                    ->keyBy('tenant_id');
            }

            $tenants = $tenantModels
                ->map(function (Tenant $tenant) use (
                    $settingsService,
                    $domainManager,
                    $licenseService,
                    $agentLookup,
                    $localAgentConfigService,
                    $localAgentBootstrapService,
                ): array {
                    $domain = $tenant->domains->first()?->domain ?? $tenant->client?->domain;
                    $licenseState = $licenseService->stateForTenant((string) $tenant->id);
                    $agent = $agentLookup->get((string) $tenant->id);

                    return [
                        'id' => (string) $tenant->id,
                        'name' => $tenant->name ?: $tenant->client?->name ?: (string) $tenant->id,
                        'email' => $tenant->email ?: $tenant->client?->email,
                        'client_name' => $tenant->client?->name,
                        'document' => $tenant->client?->document,
                        'domain' => $domain,
                        'subdomain' => $domainManager->normalizeSubdomain($domain),
                        'url' => $this->tenantUrl($domain),
                        'active' => (bool) ($tenant->client?->active ?? true),
                        'created_at' => optional($tenant->created_at)?->format('d/m/Y H:i'),
                        'settings' => $settingsService->get((string) $tenant->id),
                        'license' => $licenseState,
                        'local_agent' => $this->serializeLocalAgent(
                            $agent,
                            $localAgentConfigService,
                            $localAgentBootstrapService,
                        ),
                    ];
                })
                ->sortByDesc(fn (array $tenant): int => $tenant['active'] ? 1 : 0)
                ->values()
                ->all();

            $agentStats = [
                'total' => count(array_filter($tenants, fn (array $tenant): bool => filled($tenant['local_agent']))),
                'online' => count(array_filter($tenants, fn (array $tenant): bool => data_get($tenant, 'local_agent.status') === 'online')),
                'offline' => count(array_filter($tenants, fn (array $tenant): bool => data_get($tenant, 'local_agent.status') === 'offline')),
            ];
        }

        return [
            'tenantStats' => [
                'total' => count($tenants),
                'active' => count(array_filter($tenants, fn (array $tenant): bool => $tenant['active'])),
                'inactive' => count(array_filter($tenants, fn (array $tenant): bool => !$tenant['active'])),
            ],
            'agentStats' => $agentStats,
            'tenants' => $tenants,
            'businessPresets' => $settingsService->businessPresets(),
            'generalOptions' => $settingsService->generalOptions(),
            'moduleSections' => $settingsService->moduleDefinitions(),
            'tenantBaseDomain' => $domainManager->tenantBaseDomain(),
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

    protected function serializeLocalAgent(
        ?LocalAgent $agent,
        LocalAgentConfigService $configService,
        LocalAgentBootstrapService $bootstrapService,
    ): ?array {
        if (!$agent) {
            return null;
        }

        $runtime = $configService->buildRuntimeConfig($agent);
        $pollInterval = max(1, (int) ($runtime['poll_interval_seconds'] ?? config('fiscal.agents.poll_interval_seconds', 3)));
        $heartbeatWindowSeconds = max(90, $pollInterval * 20);
        $isOnline = $agent->active
            && $agent->last_seen_at
            && $agent->last_seen_at->greaterThanOrEqualTo(now()->subSeconds($heartbeatWindowSeconds));
        $status = !$agent->active ? 'inactive' : ($isOnline ? 'online' : 'offline');

        return [
            'id' => $agent->id,
            'name' => $agent->name,
            'agent_key' => $agent->agent_key,
            'active' => (bool) $agent->active,
            'status' => $status,
            'last_ip' => $agent->last_ip,
            'last_seen_at' => optional($agent->last_seen_at)?->toIso8601String(),
            'last_seen_label' => optional($agent->last_seen_at)?->format('d/m/Y H:i'),
            'activation' => $bootstrapService->activationStatus($agent),
            'runtime_config' => $runtime,
            'device' => [
                'machine_name' => data_get($agent->metadata, 'device.machine.name'),
                'machine_user' => data_get($agent->metadata, 'device.machine.user'),
                'certificate_path' => data_get($agent->metadata, 'device.certificate.path'),
                'printer_enabled' => data_get($agent->metadata, 'device.printer.enabled'),
                'printer_connector' => data_get($agent->metadata, 'device.printer.connector'),
                'printer_name' => data_get($agent->metadata, 'device.printer.name'),
                'printer_host' => data_get($agent->metadata, 'device.printer.host'),
                'printer_port' => data_get($agent->metadata, 'device.printer.port'),
                'logo_path' => data_get($agent->metadata, 'device.printer.logo_path'),
                'local_api_enabled' => data_get($agent->metadata, 'device.local_api.enabled'),
                'local_api_host' => data_get($agent->metadata, 'device.local_api.host'),
                'local_api_port' => data_get($agent->metadata, 'device.local_api.port'),
                'local_api_url' => data_get($agent->metadata, 'device.local_api.url'),
                'project_root' => data_get($agent->metadata, 'device.software.project_root'),
                'php_path' => data_get($agent->metadata, 'device.software.php_path'),
                'version' => data_get($agent->metadata, 'device.software.version'),
                'config_path' => data_get($agent->metadata, 'device.software.config_path'),
                'installed_at' => data_get($agent->metadata, 'device.software.installed_at'),
                'last_sync_at' => data_get($agent->metadata, 'device.last_sync_at'),
            ],
        ];
    }
}
