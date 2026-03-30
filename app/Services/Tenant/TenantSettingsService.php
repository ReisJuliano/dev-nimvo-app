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
            'pdv_restaurante' => false,
            'estoque' => true,
            'producao' => false,
            'fichas_tecnicas' => false,
            'controle_perdas' => false,
            'cozinha' => false,
            'pesagem' => false,
            'fiado' => true,
            'delivery' => false,
            'caixa' => true,
            'relatorios_avancados' => true,
            'clientes' => true,
            'fornecedores' => true,
            'produtores' => false,
            'compras' => false,
            'ordens_servico' => false,
            'produtos_variacao' => false,
            'controle_lotes' => false,
            'controle_validade' => false,
            'trocas_devolucoes' => false,
            'promocoes' => false,
            'catalogo_online' => false,
            'pedidos_online' => false,
            'whatsapp_pedidos' => false,
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
                'key' => 'restaurante',
                'label' => 'Restaurante',
                'description' => 'Ativa comandas, mesas e o fluxo de PDV para atendimento em restaurante.',
                'modules' => $this->presetModules('restaurante'),
            ],
            [
                'key' => 'padaria',
                'label' => 'Padaria',
                'description' => 'Combina PDV rapido, estoque por insumo, fichas tecnicas, producao e perdas.',
                'modules' => $this->presetModules('padaria'),
            ],
            [
                'key' => 'loja_roupas',
                'label' => 'Loja de roupas',
                'description' => 'Ativa grade por variacao, vendas, trocas, promocoes e a frente digital com site e WhatsApp.',
                'modules' => $this->presetModules('loja_roupas'),
            ],
            [
                'key' => 'mercearia',
                'label' => 'Mercearia',
                'description' => 'Mantem PDV simples, estoque, codigo de barras, validade, fiado e caixa.',
                'modules' => $this->presetModules('mercearia'),
            ],
            [
                'key' => 'agropecuaria',
                'label' => 'Agropecuaria',
                'description' => 'Combina estoque com lotes, validade, pesagem, compras, produtores e relatorios.',
                'modules' => $this->presetModules('agropecuaria'),
            ],
            [
                'key' => self::CUSTOM_PRESET,
                'label' => 'Personalizado',
                'description' => 'Permite ligar e desligar cada modulo manualmente.',
                'modules' => $this->defaultModules(),
            ],
        ];
    }

    public function presetKeys(): array
    {
        return array_column($this->businessPresets(), 'key');
    }

    public function moduleDefinitions(): array
    {
        return [
            [
                'section' => 'Atendimento e vendas',
                'items' => [
                    ['key' => 'comandas', 'label' => 'Usar Comandas', 'description' => 'Exibe a tela de comandas e o fluxo de pedidos enviados para o caixa.'],
                    ['key' => 'pdv_simples', 'label' => 'Usar PDV rapido', 'description' => 'Mantem o PDV focado em vendas avulsas, leitura rapida e atendimento direto no caixa.'],
                    ['key' => 'pdv_restaurante', 'label' => 'Usar PDV Restaurante', 'description' => 'Prepara o PDV para trabalhar junto com comandas, mesas e filas de cobranca.'],
                    ['key' => 'mesas', 'label' => 'Usar Mesa', 'description' => 'Habilita o contexto de mesas dentro da operacao de comandas.'],
                    ['key' => 'delivery', 'label' => 'Usar Delivery', 'description' => 'Mostra o modulo de delivery para acompanhar pedidos de entrega.'],
                    ['key' => 'fiado', 'label' => 'Usar Fiado', 'description' => 'Disponibiliza crediario e consultas de limite do cliente.'],
                    ['key' => 'trocas_devolucoes', 'label' => 'Usar Trocas e devolucoes', 'description' => 'Cria uma area dedicada para acompanhar devolucoes, estornos e reaproveitamento do estoque.'],
                    ['key' => 'promocoes', 'label' => 'Usar Promocoes e descontos', 'description' => 'Destaca campanhas, regras comerciais e acompanhamento de descontos praticados.'],
                    ['key' => 'caixa', 'label' => 'Usar Caixa', 'description' => 'Mantem a abertura, conferencia e fechamento do caixa ativos.'],
                    ['key' => 'impressao_automatica', 'label' => 'Usar Impressao automatica', 'description' => 'Liga automatizacoes de impressao em fluxos de venda e atendimento.'],
                ],
            ],
            [
                'section' => 'Operacao',
                'items' => [
                    ['key' => 'producao', 'label' => 'Usar Producao', 'description' => 'Libera o modulo de producao para padaria e preparos internos.'],
                    ['key' => 'fichas_tecnicas', 'label' => 'Usar Fichas tecnicas', 'description' => 'Organiza receitas, rendimento, insumos e padroes operacionais por item.'],
                    ['key' => 'controle_perdas', 'label' => 'Usar Controle de perdas', 'description' => 'Acompanha quebras, perdas operacionais e motivos de descarte.'],
                    ['key' => 'cozinha', 'label' => 'Usar Cozinha', 'description' => 'Cria um quadro operacional para separar preparo, expedicao e conferencias de pedidos.'],
                    ['key' => 'pesagem', 'label' => 'Usar Pesagem', 'description' => 'Destaca a operacao por peso, com apoio a vendas fracionadas.'],
                    ['key' => 'ordens_servico', 'label' => 'Usar Ordens de servico', 'description' => 'Mostra o modulo de OS para atendimentos tecnicos e servicos.'],
                    ['key' => 'compras', 'label' => 'Usar Compras', 'description' => 'Abre uma area para acompanhar abastecimento, entradas planejadas e reposicoes por fornecedor.'],
                ],
            ],
            [
                'section' => 'Catalogo e estoque',
                'items' => [
                    ['key' => 'estoque', 'label' => 'Usar Estoque', 'description' => 'Controla produtos, entradas, ajustes e movimentacoes do estoque.'],
                    ['key' => 'produtos_variacao', 'label' => 'Produtos com variacao', 'description' => 'Prepara o catalogo para tamanhos, cores e outras variacoes.'],
                    ['key' => 'controle_lotes', 'label' => 'Usar Controle de Lotes', 'description' => 'Marca a operacao para rastreabilidade por lote.'],
                    ['key' => 'controle_validade', 'label' => 'Usar Validade', 'description' => 'Destaca acompanhamento de validade nos fluxos de estoque.'],
                    ['key' => 'clientes', 'label' => 'Usar Clientes', 'description' => 'Mantem o cadastro e os atalhos para clientes disponiveis.'],
                    ['key' => 'fornecedores', 'label' => 'Usar Fornecedores', 'description' => 'Mantem o cadastro e consultas de fornecedores ativos.'],
                    ['key' => 'produtores', 'label' => 'Usar Produtores', 'description' => 'Cria um cadastro especifico para produtores rurais e relacionamento comercial.'],
                ],
            ],
            [
                'section' => 'Digital',
                'items' => [
                    ['key' => 'catalogo_online', 'label' => 'Usar Catalogo online', 'description' => 'Separa uma frente digital para site padrao, vitrine de produtos e carrinho.'],
                    ['key' => 'pedidos_online', 'label' => 'Usar Pedidos online', 'description' => 'Mostra uma area para acompanhar pedidos vindos do site e de canais digitais.'],
                    ['key' => 'whatsapp_pedidos', 'label' => 'Usar Integracao com WhatsApp', 'description' => 'Organiza mensagens padrao, checkout via WhatsApp e fluxo de atendimento digital.'],
                ],
            ],
            [
                'section' => 'Gestao',
                'items' => [
                    ['key' => 'relatorios_avancados', 'label' => 'Usar Relatorios avancados', 'description' => 'Libera os paineis consolidados, demanda e visoes gerenciais.'],
                ],
            ],
        ];
    }

    public function generalOptions(): array
    {
        return [
            [
                'key' => 'cash_closing.require_conference',
                'label' => 'Conferencia obrigatoria no fechamento',
                'description' => 'Exige a revisao por forma de pagamento antes de concluir o fechamento do caixa.',
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

        if (array_key_exists($moduleKey, $settings['modules'] ?? [])) {
            return (bool) data_get($settings, "modules.{$moduleKey}", true);
        }

        return (bool) data_get($settings, "capabilities.{$moduleKey}", true);
    }

    public function moduleCapabilities(array $modules): array
    {
        $modules = $this->normalizeModules($modules);

        return [
            'pdv' => $modules['pdv_simples'] || $modules['pdv_restaurante'],
            'caixa' => $modules['caixa'],
            'pedidos' => $modules['comandas'],
            'crediario' => $modules['fiado'],
            'produtos' => $modules['estoque'] || $modules['produtos_variacao'] || $modules['controle_lotes'] || $modules['controle_validade'],
            'categorias' => $modules['estoque'],
            'clientes' => $modules['clientes'],
            'fornecedores' => $modules['fornecedores'],
            'produtores' => $modules['produtores'],
            'entrada_estoque' => $modules['estoque'],
            'ajuste_estoque' => $modules['estoque'],
            'movimentacao_estoque' => $modules['estoque'],
            'relatorios' => $modules['relatorios_avancados'],
            'vendas' => $modules['relatorios_avancados'],
            'demanda' => $modules['relatorios_avancados'],
            'faltas' => $modules['relatorios_avancados'] && $modules['estoque'],
            'usuarios' => true,
            'producao' => $modules['producao'],
            'fichas_tecnicas' => $modules['fichas_tecnicas'],
            'perdas' => $modules['controle_perdas'],
            'cozinha' => $modules['cozinha'],
            'pesagem' => $modules['pesagem'],
            'delivery' => $modules['delivery'],
            'compras' => $modules['compras'],
            'ordens_servico' => $modules['ordens_servico'],
            'trocas_devolucoes' => $modules['trocas_devolucoes'],
            'promocoes' => $modules['promocoes'],
            'catalogo_online' => $modules['catalogo_online'],
            'pedidos_online' => $modules['pedidos_online'],
            'whatsapp_pedidos' => $modules['whatsapp_pedidos'],
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
        if (!$this->looksLikeLegacySettings($settings)) {
            return $settings;
        }

        return [
            'business' => [
                'preset' => self::CUSTOM_PRESET,
            ],
            'cash_closing' => $settings['cash_closing'] ?? [],
            'modules' => $this->mapLegacyModules((array) ($settings['modules'] ?? [])),
        ];
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
            'pdv_restaurante' => $ordersEnabled,
            'estoque' => $inventoryEnabled,
            'fiado' => (bool) data_get($legacyModules, 'crediario', true),
            'caixa' => (bool) data_get($legacyModules, 'caixa', true),
            'relatorios_avancados' => $reportsEnabled,
            'clientes' => (bool) data_get($legacyModules, 'clientes', true),
            'fornecedores' => (bool) data_get($legacyModules, 'fornecedores', true),
            'mesas' => $ordersEnabled,
        ]);
    }

    protected function normalizeModules(array $modules): array
    {
        $normalized = array_replace($this->defaultModules(), $modules);

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
            'pdv_restaurante' => false,
            'estoque' => false,
            'producao' => false,
            'fichas_tecnicas' => false,
            'controle_perdas' => false,
            'cozinha' => false,
            'pesagem' => false,
            'fiado' => false,
            'delivery' => false,
            'caixa' => true,
            'relatorios_avancados' => true,
            'clientes' => false,
            'fornecedores' => false,
            'produtores' => false,
            'compras' => false,
            'ordens_servico' => false,
            'produtos_variacao' => false,
            'controle_lotes' => false,
            'controle_validade' => false,
            'trocas_devolucoes' => false,
            'promocoes' => false,
            'catalogo_online' => false,
            'pedidos_online' => false,
            'whatsapp_pedidos' => false,
            'mesas' => false,
            'impressao_automatica' => false,
        ];

        return match ($preset) {
            'restaurante' => array_replace($base, [
                'comandas' => true,
                'pdv_restaurante' => true,
                'estoque' => true,
                'fichas_tecnicas' => true,
                'cozinha' => true,
                'delivery' => true,
                'mesas' => true,
                'clientes' => true,
                'fornecedores' => true,
            ]),
            'padaria' => array_replace($base, [
                'pdv_simples' => true,
                'estoque' => true,
                'producao' => true,
                'fichas_tecnicas' => true,
                'controle_perdas' => true,
                'fornecedores' => true,
            ]),
            'loja_roupas' => array_replace($base, [
                'pdv_simples' => true,
                'estoque' => true,
                'caixa' => true,
                'clientes' => true,
                'fornecedores' => true,
                'produtos_variacao' => true,
                'trocas_devolucoes' => true,
                'promocoes' => true,
                'catalogo_online' => true,
                'pedidos_online' => true,
                'whatsapp_pedidos' => true,
            ]),
            'mercearia' => array_replace($base, [
                'pdv_simples' => true,
                'estoque' => true,
                'fiado' => true,
                'clientes' => true,
                'fornecedores' => true,
                'controle_validade' => true,
            ]),
            'agropecuaria' => array_replace($base, [
                'pdv_simples' => true,
                'estoque' => true,
                'pesagem' => true,
                'fiado' => true,
                'clientes' => true,
                'fornecedores' => true,
                'produtores' => true,
                'compras' => true,
                'controle_lotes' => true,
                'controle_validade' => true,
            ]),
            default => $this->defaultModules(),
        };
    }

    protected function normalizePreset(?string $preset): string
    {
        $preset = trim((string) $preset);

        return in_array($preset, $this->presetKeys(), true)
            ? $preset
            : self::CUSTOM_PRESET;
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
