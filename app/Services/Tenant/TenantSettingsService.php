<?php

namespace App\Services\Tenant;

use App\Models\Central\TenantSetting;
use App\Models\Tenant\AppSetting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TenantSettingsService
{
    public const SETTINGS_KEY = 'general';

    public const CUSTOM_PRESET = 'personalizado';

    public const SERVICE_PRESET = 'atendimento';

    public const DIRECT_SALES_PRESET = 'venda_direta';

    public function defaults(): array
    {
        return [
            'business' => [
                'preset' => self::CUSTOM_PRESET,
            ],
            'cash_closing' => [
                'require_conference' => true,
            ],
            'modules' => $this->defaultModules(),
        ];
    }

    public function defaultModules(): array
    {
        return [
            'comandas' => true,
            'pdv_simples' => true,
            'pdv_avancado' => false,
            'estoque' => true,
            'prazo' => true,
            'delivery' => false,
            'caixa' => true,
            'relatorios_avancados' => true,
            'clientes' => true,
            'fornecedores' => true,
            'compras' => false,
            'controle_lotes' => false,
            'controle_validade' => false,
            'mesas' => false,
            'impressao_automatica' => false,
        ];
    }

    public function moduleKeys(): array
    {
        return array_keys($this->defaultModules());
    }

    public function businessPresets(): array
    {
        return [
            [
                'key' => self::SERVICE_PRESET,
                'label' => 'Atendimento',
                'description' => 'Fluxo integrado com pedidos, preparo e acompanhamento.',
                'modules' => $this->presetModules(self::SERVICE_PRESET),
            ],
            [
                'key' => self::DIRECT_SALES_PRESET,
                'label' => 'Venda direta',
                'description' => 'Checkout simples com estoque, clientes e rotinas essenciais.',
                'modules' => $this->presetModules(self::DIRECT_SALES_PRESET),
            ],
            [
                'key' => self::CUSTOM_PRESET,
                'label' => 'Personalizado',
                'description' => 'Ligacao manual de modulos.',
                'modules' => $this->defaultModules(),
            ],
        ];
    }

    public function presetKeys(): array
    {
        return [
            self::SERVICE_PRESET,
            self::DIRECT_SALES_PRESET,
            self::CUSTOM_PRESET,
        ];
    }

    public function moduleDefinitions(): array
    {
        return [
            [
                'section' => 'Atendimento',
                'items' => [
                    ['key' => 'comandas', 'label' => 'Pedidos', 'description' => 'Organiza atendimentos antes da cobranca.'],
                    ['key' => 'pdv_simples', 'label' => 'Checkout', 'description' => 'Fluxo direto para vendas rapidas.'],
                    ['key' => 'pdv_avancado', 'label' => 'Checkout integrado', 'description' => 'Integra checkout, pedidos e cobranca.'],
                    ['key' => 'mesas', 'label' => 'Referencias', 'description' => 'Agrupa atendimentos por contexto ou origem.'],
                    ['key' => 'delivery', 'label' => 'Entregas', 'description' => 'Acompanha pedidos externos.'],
                    ['key' => 'prazo', 'label' => 'A Prazo', 'description' => 'Permite registrar saldo pendente por cliente.'],
                    ['key' => 'caixa', 'label' => 'Caixa', 'description' => 'Controla abertura, conferencia e fechamento.'],
                    ['key' => 'impressao_automatica', 'label' => 'Impressao automatica', 'description' => 'Automatiza impressoes operacionais.'],
                ],
            ],
            [
                'section' => 'Operacao',
                'items' => [
                    ['key' => 'compras', 'label' => 'Compras', 'description' => 'Organiza reposicao e entrada planejada.'],
                ],
            ],
            [
                'section' => 'Catalogo',
                'items' => [
                    ['key' => 'estoque', 'label' => 'Estoque', 'description' => 'Controla saldo e movimentacoes.'],
                    ['key' => 'controle_lotes', 'label' => 'Lotes', 'description' => 'Rastreia itens por lote.'],
                    ['key' => 'controle_validade', 'label' => 'Validade', 'description' => 'Monitora datas e vencimentos.'],
                    ['key' => 'clientes', 'label' => 'Clientes', 'description' => 'Mantem cadastros ativos.'],
                    ['key' => 'fornecedores', 'label' => 'Fornecedores', 'description' => 'Mantem origem de compra e contato.'],
                ],
            ],
            [
                'section' => 'Gestao',
                'items' => [
                    ['key' => 'relatorios_avancados', 'label' => 'Relatorios', 'description' => 'Libera visoes consolidadas.'],
                ],
            ],
        ];
    }

    public function generalOptions(): array
    {
        return [
            [
                'key' => 'cash_closing.require_conference',
                'label' => 'Conferencia no fechamento',
                'description' => 'Revisa os totais antes de concluir o caixa.',
            ],
        ];
    }

    public function get(?string $tenantId = null): array
    {
        $stored = $this->readStoredSettings($this->resolveTenantId($tenantId));

        return $this->enrich($this->mergeWithDefaults($stored));
    }

    public function update(array $data, ?string $tenantId = null): array
    {
        $settings = $this->applyPresetRules($this->mergeWithDefaults($data));
        $payload = $this->payloadForStorage($settings);
        $tenantId = $this->resolveTenantId($tenantId);

        if ($tenantId && $this->tenantSettingsTableExists()) {
            TenantSetting::query()->updateOrCreate(
                ['tenant_id' => $tenantId],
                ['payload' => $payload],
            );

            return $this->enrich($payload);
        }

        if (!$this->appSettingsTableExists()) {
            $this->storeInFile($payload, $tenantId);

            return $this->enrich($payload);
        }

        AppSetting::query()->updateOrCreate(
            ['key' => self::SETTINGS_KEY],
            ['payload' => $payload],
        );

        return $this->enrich($payload);
    }

    public function isModuleEnabled(?string $moduleKey): bool
    {
        if (!$moduleKey) {
            return true;
        }

        $settings = $this->get();
        $moduleKey = $this->normalizeModuleAlias($moduleKey);

        if (array_key_exists($moduleKey, $settings['modules'] ?? [])) {
            return (bool) data_get($settings, "modules.{$moduleKey}", true);
        }

        return (bool) data_get($settings, "capabilities.{$moduleKey}", false);
    }

    public function moduleCapabilities(array $modules): array
    {
        $modules = $this->normalizeModules($modules);

        return [
            'pdv' => $modules['pdv_simples'] || $modules['pdv_avancado'],
            'caixa' => $modules['caixa'],
            'pedidos' => $modules['comandas'],
            'prazo' => $modules['prazo'],
            'crediario' => $modules['prazo'],
            'produtos' => $modules['estoque'] || $modules['controle_lotes'] || $modules['controle_validade'],
            'categorias' => $modules['estoque'],
            'clientes' => $modules['clientes'],
            'fornecedores' => $modules['fornecedores'],
            'entrada_estoque' => $modules['estoque'],
            'ajuste_estoque' => $modules['estoque'],
            'movimentacao_estoque' => $modules['estoque'],
            'relatorios' => $modules['relatorios_avancados'],
            'vendas' => $modules['relatorios_avancados'],
            'demanda' => $modules['relatorios_avancados'],
            'faltas' => $modules['relatorios_avancados'] && $modules['estoque'],
            'usuarios' => true,
            'delivery' => $modules['delivery'],
            'compras' => $modules['compras'],
        ];
    }

    protected function readStoredSettings(?string $tenantId = null): array
    {
        if ($tenantId && $this->tenantSettingsTableExists()) {
            $stored = TenantSetting::query()
                ->where('tenant_id', $tenantId)
                ->value('payload');

            if (is_array($stored)) {
                return $stored;
            }
        }

        if (!$this->appSettingsTableExists()) {
            return $this->getFromFile($tenantId);
        }

        $stored = AppSetting::query()
            ->where('key', self::SETTINGS_KEY)
            ->value('payload');

        if (is_array($stored)) {
            return $stored;
        }

        return $this->getFromFile($tenantId);
    }

    protected function enrich(array $settings): array
    {
        return $settings + [
            'capabilities' => $this->moduleCapabilities($settings['modules'] ?? []),
        ];
    }

    protected function mergeWithDefaults(array $settings): array
    {
        $settings = $this->normalizeIncomingSettings($settings);
        $defaults = $this->defaults();
        $merged = array_replace_recursive($defaults, Arr::only($settings, ['business', 'cash_closing', 'modules']));

        $merged['business']['preset'] = $this->normalizePreset(data_get($merged, 'business.preset'));
        $merged['cash_closing']['require_conference'] = (bool) data_get(
            $merged,
            'cash_closing.require_conference',
            true,
        );
        $merged['modules'] = $this->normalizeModules($merged['modules'] ?? []);

        return $merged;
    }

    protected function normalizeIncomingSettings(array $settings): array
    {
        if ($this->looksLikeLegacySettings($settings)) {
            return [
                'business' => [
                    'preset' => self::CUSTOM_PRESET,
                ],
                'cash_closing' => $settings['cash_closing'] ?? [],
                'modules' => $this->mapLegacyModules((array) ($settings['modules'] ?? [])),
            ];
        }

        if (isset($settings['business'])) {
            $settings['business']['preset'] = $this->normalizePreset(data_get($settings, 'business.preset'));
        }

        if (isset($settings['modules'])) {
            $settings['modules'] = $this->normalizeModules((array) $settings['modules']);
        }

        return $settings;
    }

    protected function looksLikeLegacySettings(array $settings): bool
    {
        $legacyKeys = [
            'pdv',
            'caixa',
            'pedidos',
            'crediario',
            'produtos',
            'categorias',
            'clientes',
            'fornecedores',
            'entrada_estoque',
            'ajuste_estoque',
            'movimentacao_estoque',
            'relatorios',
            'vendas',
            'demanda',
            'faltas',
            'usuarios',
        ];

        $moduleKeys = array_keys((array) ($settings['modules'] ?? []));

        return !isset($settings['business'])
            && count(array_intersect($legacyKeys, $moduleKeys)) > 0;
    }

    protected function mapLegacyModules(array $legacyModules): array
    {
        $inventoryEnabled = (bool) data_get($legacyModules, 'produtos', true)
            || (bool) data_get($legacyModules, 'categorias', true)
            || (bool) data_get($legacyModules, 'entrada_estoque', true)
            || (bool) data_get($legacyModules, 'ajuste_estoque', true)
            || (bool) data_get($legacyModules, 'movimentacao_estoque', true);

        $reportsEnabled = (bool) data_get($legacyModules, 'relatorios', true)
            || (bool) data_get($legacyModules, 'vendas', true)
            || (bool) data_get($legacyModules, 'demanda', true)
            || (bool) data_get($legacyModules, 'faltas', true);

        $ordersEnabled = (bool) data_get($legacyModules, 'pedidos', true);

        return array_replace($this->defaultModules(), [
            'comandas' => $ordersEnabled,
            'pdv_simples' => (bool) data_get($legacyModules, 'pdv', true),
            'pdv_avancado' => $ordersEnabled,
            'estoque' => $inventoryEnabled,
            'prazo' => (bool) data_get($legacyModules, 'crediario', true),
            'caixa' => (bool) data_get($legacyModules, 'caixa', true),
            'relatorios_avancados' => $reportsEnabled,
            'clientes' => (bool) data_get($legacyModules, 'clientes', true),
            'fornecedores' => (bool) data_get($legacyModules, 'fornecedores', true),
            'mesas' => $ordersEnabled,
        ]);
    }

    protected function normalizeModules(array $modules): array
    {
        $modules = $this->mapLegacyModuleAliases($modules);
        $normalized = array_replace($this->defaultModules(), Arr::only($modules, $this->moduleKeys()));

        foreach ($this->moduleKeys() as $moduleKey) {
            $normalized[$moduleKey] = (bool) data_get($normalized, $moduleKey, false);
        }

        if (!$normalized['comandas']) {
            $normalized['mesas'] = false;
        }

        return $normalized;
    }

    protected function applyPresetRules(array $settings): array
    {
        $preset = $this->normalizePreset(data_get($settings, 'business.preset'));

        if ($preset !== self::CUSTOM_PRESET) {
            $settings['modules'] = $this->presetModules($preset);
        }

        $settings['business']['preset'] = $preset;
        $settings['modules'] = $this->normalizeModules($settings['modules'] ?? []);

        return $settings;
    }

    protected function presetModules(string $preset): array
    {
        $base = [
            'comandas' => false,
            'pdv_simples' => false,
            'pdv_avancado' => false,
            'estoque' => false,
            'prazo' => false,
            'delivery' => false,
            'caixa' => true,
            'relatorios_avancados' => true,
            'clientes' => false,
            'fornecedores' => false,
            'compras' => false,
            'controle_lotes' => false,
            'controle_validade' => false,
            'mesas' => false,
            'impressao_automatica' => false,
        ];

        return match ($this->normalizePreset($preset)) {
            self::SERVICE_PRESET => array_replace($base, [
                'comandas' => true,
                'pdv_avancado' => true,
                'estoque' => true,
                'delivery' => true,
                'mesas' => true,
                'clientes' => true,
                'fornecedores' => true,
            ]),
            self::DIRECT_SALES_PRESET => array_replace($base, [
                'pdv_simples' => true,
                'estoque' => true,
                'prazo' => true,
                'clientes' => true,
                'fornecedores' => true,
                'controle_validade' => true,
            ]),
            default => $this->defaultModules(),
        };
    }

    protected function normalizePreset(?string $preset): string
    {
        $preset = trim((string) $preset);

        $preset = match ($preset) {
            'restaurante' => self::SERVICE_PRESET,
            'mercearia' => self::DIRECT_SALES_PRESET,
            default => $preset,
        };

        return in_array($preset, $this->presetKeys(), true)
            ? $preset
            : self::CUSTOM_PRESET;
    }

    protected function normalizeModuleAlias(string $moduleKey): string
    {
        return match ($moduleKey) {
            'fiado' => 'prazo',
            'pdv_restaurante' => 'pdv_avancado',
            default => $moduleKey,
        };
    }

    protected function mapLegacyModuleAliases(array $modules): array
    {
        if (array_key_exists('fiado', $modules) && !array_key_exists('prazo', $modules)) {
            $modules['prazo'] = $modules['fiado'];
        }

        if (array_key_exists('pdv_restaurante', $modules) && !array_key_exists('pdv_avancado', $modules)) {
            $modules['pdv_avancado'] = $modules['pdv_restaurante'];
        }

        return $modules;
    }

    protected function payloadForStorage(array $settings): array
    {
        return Arr::only($settings, ['business', 'cash_closing', 'modules']);
    }

    protected function appSettingsTableExists(): bool
    {
        return Schema::connection((new AppSetting())->getConnectionName())->hasTable('app_settings');
    }

    protected function tenantSettingsTableExists(): bool
    {
        return Schema::connection((new TenantSetting())->getConnectionName())->hasTable('tenant_settings');
    }

    protected function getFromFile(?string $tenantId = null): array
    {
        if (!Storage::disk('local')->exists($this->settingsPath($tenantId))) {
            return [];
        }

        $stored = json_decode((string) Storage::disk('local')->get($this->settingsPath($tenantId)), true);

        return is_array($stored) ? $stored : [];
    }

    protected function storeInFile(array $settings, ?string $tenantId = null): void
    {
        Storage::disk('local')->put(
            $this->settingsPath($tenantId),
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    protected function settingsPath(?string $tenantId = null): string
    {
        return sprintf('private/tenant-runtime/%s/settings.json', $tenantId ?: 'central');
    }

    protected function resolveTenantId(?string $tenantId = null): ?string
    {
        if (filled($tenantId)) {
            return (string) $tenantId;
        }

        return tenant()?->getTenantKey()
            ? (string) tenant()->getTenantKey()
            : null;
    }
}
