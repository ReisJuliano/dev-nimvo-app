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
                'preset' => self::DIRECT_SALES_PRESET,
            ],
            'cash_closing' => [
                'require_conference' => false,
                'max_cash_before_withdrawal_suggestion' => 0,
            ],
            'modules' => $this->defaultModules(),
        ];
    }

    public function defaultModules(): array
    {
        return [
            'comandas' => false,
            'pdv_simples' => true,
            'pdv_avancado' => false,
            'estoque' => true,
            'prazo' => true,
            'delivery' => false,
            'caixa' => true,
            'fiscal_basico' => false,
            'fiscal_avancado' => false,
            'consultas_fiscais' => false,
            'categorias' => true,
            'entrada_estoque_avancado' => false,
            'relatorios_basicos' => true,
            'relatorios_avancados' => false,
            'clientes' => true,
            'fornecedores' => true,
            'compras' => false,
            'controle_lotes' => false,
            'controle_validade' => true,
            'mesas' => false,
            'impressao_automatica' => false,
            'catalogo_online' => false,
            'pedidos_online' => false,
            'whatsapp_pedidos' => false,
            'moda' => false,
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
                'key' => self::DIRECT_SALES_PRESET,
                'label' => 'Balcao simples',
                'description' => 'Para loja que vende no balcão, controla caixa, estoque e fiado sem complicação.',
                'modules' => $this->presetModules(self::DIRECT_SALES_PRESET),
            ],
            [
                'key' => self::SERVICE_PRESET,
                'label' => 'Mesas e comandas',
                'description' => 'Para restaurante ou lanchonete com operacao por mesa ou comanda.',
                'modules' => $this->presetModules(self::SERVICE_PRESET),
            ],
            [
                'key' => self::CUSTOM_PRESET,
                'label' => 'Configuracao da loja',
                'description' => 'Ajustes guardados para esta loja.',
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
                'section' => 'Loja',
                'items' => [
                    ['key' => 'relatorios_basicos', 'label' => 'Resumo', 'description' => 'Mostra como a loja esta hoje.'],
                    ['key' => 'pdv_simples', 'label' => 'Vender', 'description' => 'Venda rápida no balcão.'],
                    ['key' => 'caixa', 'label' => 'Caixa', 'description' => 'Acompanha dinheiro, Pix e cartoes do dia.'],
                    ['key' => 'estoque', 'label' => 'Estoque', 'description' => 'Controla o que entrou, saiu e esta acabando.'],
                    ['key' => 'prazo', 'label' => 'Fiado', 'description' => 'Permite vender para receber depois.'],
                    ['key' => 'clientes', 'label' => 'Clientes', 'description' => 'Cadastro de quem compra na loja.'],
                    ['key' => 'categorias', 'label' => 'Categorias', 'description' => 'Organiza produtos por categoria.'],
                    ['key' => 'fornecedores', 'label' => 'Fornecedores', 'description' => 'De quem voce compra.'],
                    ['key' => 'controle_validade', 'label' => 'Validade', 'description' => 'Avisa produtos perto de vencer.'],
                ],
            ],
            [
                'section' => 'Avancado',
                'items' => [
                    ['key' => 'comandas', 'label' => 'Mesas e comandas', 'description' => 'Atendimento por mesa ou comanda.'],
                    ['key' => 'pdv_avancado', 'label' => 'PDV avançado', 'description' => 'Integra pedidos, comandas e cobrança.'],
                    ['key' => 'mesas', 'label' => 'Mesas', 'description' => 'Agrupa atendimentos por mesa.'],
                    ['key' => 'delivery', 'label' => 'Entregas', 'description' => 'Acompanha pedidos externos.'],
                    ['key' => 'compras', 'label' => 'Compras e contas a pagar', 'description' => 'Habilita compras com NF-e e o módulo de contas a pagar.'],
                    ['key' => 'entrada_estoque_avancado', 'label' => 'Entrada por NF-e', 'description' => 'Fluxo completo de entrada de estoque via XML da nota fiscal.'],
                    ['key' => 'consultas_fiscais', 'label' => 'Suporte fiscal', 'description' => 'Consulta, cancela e acompanha cupons fiscais.'],
                    ['key' => 'controle_lotes', 'label' => 'Lotes', 'description' => 'Rastreia itens por lote.'],
                    ['key' => 'fiscal_basico', 'label' => 'Fiscal basico', 'description' => 'Configura NFC-e com apoio do contador.'],
                    ['key' => 'fiscal_avancado', 'label' => 'Fiscal avancado', 'description' => 'XML, cancelamento, contingencia e inutilizacao.'],
                    ['key' => 'relatorios_avancados', 'label' => 'Relatorios avancados', 'description' => 'Vendas por periodo, demanda, CMV e analises detalhadas.'],
                    ['key' => 'catalogo_online', 'label' => 'Vendas online', 'description' => 'Catalogo, pedidos pelo site e canais digitais.'],
                    ['key' => 'pedidos_online', 'label' => 'Pedidos online', 'description' => 'Checkout do catalogo online.'],
                    ['key' => 'whatsapp_pedidos', 'label' => 'WhatsApp pedidos', 'description' => 'Pedido via WhatsApp a partir do catalogo.'],
                    ['key' => 'moda', 'label' => 'Moda', 'description' => 'Grade, catalogo de moda e vendas condicionais.'],
                    ['key' => 'impressao_automatica', 'label' => 'Impressao automatica', 'description' => 'Automatiza impressoes operacionais.'],
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
                'description' => 'Confira se os valores batem com o que entrou hoje.',
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
            'fiado' => $modules['prazo'],
            'produtos' => $modules['estoque'] || $modules['controle_lotes'] || $modules['controle_validade'],
            'categorias' => $modules['categorias'],
            'clientes' => $modules['clientes'],
            'fornecedores' => $modules['fornecedores'],
            'entrada_estoque' => $modules['estoque'],
            'ajuste_estoque' => $modules['estoque'],
            'movimentacao_estoque' => $modules['estoque'],
            'resumo' => $modules['relatorios_basicos'],
            'relatorios' => $modules['relatorios_basicos'],
            'vendas' => $modules['relatorios_avancados'],
            'demanda' => $modules['relatorios_avancados'],
            'faltas' => $modules['relatorios_avancados'] && $modules['estoque'],
            'usuarios' => true,
            'fiscal_basico' => $modules['fiscal_basico'],
            'fiscal_avancado' => $modules['fiscal_avancado'],
            'consultas_fiscais' => $modules['consultas_fiscais'],
            'entrada_estoque_avancado' => $modules['entrada_estoque_avancado'],
            'delivery' => $modules['delivery'],
            'compras' => $modules['compras'],
            'catalogo_online' => $modules['catalogo_online'],
            'pedidos_online' => $modules['pedidos_online'],
            'whatsapp_pedidos' => $modules['whatsapp_pedidos'],
            'moda' => $modules['moda'],
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
        $merged['cash_closing']['max_cash_before_withdrawal_suggestion'] = max(0, (float) data_get(
            $merged,
            'cash_closing.max_cash_before_withdrawal_suggestion',
            0,
        ));
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
            if (
                $this->normalizePreset(data_get($settings, 'business.preset')) === self::DIRECT_SALES_PRESET
                && ! array_key_exists('categorias', (array) $settings['modules'])
            ) {
                $settings['modules']['categorias'] = false;
            }

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
            'relatorios_basicos' => true,
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
            'fiscal_basico' => false,
            'fiscal_avancado' => false,
            'consultas_fiscais' => false,
            'categorias' => false,
            'entrada_estoque_avancado' => false,
            'relatorios_basicos' => true,
            'relatorios_avancados' => false,
            'clientes' => false,
            'fornecedores' => false,
            'compras' => false,
            'controle_lotes' => false,
            'controle_validade' => false,
            'mesas' => false,
            'impressao_automatica' => false,
            'catalogo_online' => false,
            'pedidos_online' => false,
            'whatsapp_pedidos' => false,
            'moda' => false,
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
                'categorias' => true,
            ]),
            self::DIRECT_SALES_PRESET => array_replace($base, [
                'pdv_simples' => true,
                'estoque' => true,
                'prazo' => true,
                'clientes' => true,
                'fornecedores' => true,
                'controle_validade' => true,
                'relatorios_basicos' => true,
                'categorias' => false,
                'consultas_fiscais' => false,
                'entrada_estoque_avancado' => false,
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
