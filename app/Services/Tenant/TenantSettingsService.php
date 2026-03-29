<?php

namespace App\Services\Tenant;

use App\Models\Tenant\AppSetting;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TenantSettingsService
{
    public const SETTINGS_KEY = 'general';

    public function defaults(): array
    {
        return [
            'cash_closing' => [
                'require_conference' => true,
            ],
            'modules' => [
                'pdv' => true,
                'caixa' => true,
                'pedidos' => true,
                'crediario' => true,
                'produtos' => true,
                'categorias' => true,
                'clientes' => true,
                'fornecedores' => true,
                'entrada_estoque' => true,
                'ajuste_estoque' => true,
                'movimentacao_estoque' => true,
                'relatorios' => true,
                'vendas' => true,
                'demanda' => true,
                'faltas' => true,
                'usuarios' => true,
            ],
        ];
    }

    public function moduleDefinitions(): array
    {
        return [
            [
                'section' => 'Vendas',
                'items' => [
                    ['key' => 'pdv', 'label' => 'PDV', 'description' => 'Permite cobrar vendas avulsas e pedidos enviados do modulo de comandas.'],
                    ['key' => 'caixa', 'label' => 'Caixa', 'description' => 'Libera abertura, sangrias, suprimentos e historico de fechamento do caixa.'],
                    ['key' => 'pedidos', 'label' => 'Pedidos', 'description' => 'Permite registrar comandas, mesas e pedidos persistidos antes da cobranca.'],
                    ['key' => 'crediario', 'label' => 'Crediario', 'description' => 'Mostra consultas e movimentacoes do fiado.'],
                ],
            ],
            [
                'section' => 'Cadastros',
                'items' => [
                    ['key' => 'produtos', 'label' => 'Produtos', 'description' => 'Gerencia o catalogo e a manutencao dos produtos.'],
                    ['key' => 'categorias', 'label' => 'Categorias', 'description' => 'Controla a classificacao do catalogo.'],
                    ['key' => 'clientes', 'label' => 'Clientes', 'description' => 'Permite consultar clientes e vincular vendas.'],
                    ['key' => 'fornecedores', 'label' => 'Fornecedores', 'description' => 'Mostra fornecedores e dados de abastecimento.'],
                ],
            ],
            [
                'section' => 'Estoque',
                'items' => [
                    ['key' => 'entrada_estoque', 'label' => 'Entrada', 'description' => 'Libera entradas e reabastecimento de estoque.'],
                    ['key' => 'ajuste_estoque', 'label' => 'Conferencia', 'description' => 'Permite ajustes e conferencia de saldo.'],
                    ['key' => 'movimentacao_estoque', 'label' => 'Movimentacao', 'description' => 'Exibe o historico de entradas e saidas do estoque.'],
                ],
            ],
            [
                'section' => 'Gerencial',
                'items' => [
                    ['key' => 'relatorios', 'label' => 'Relatorios', 'description' => 'Mostra o painel de relatorios consolidados.'],
                    ['key' => 'vendas', 'label' => 'Vendas gerais', 'description' => 'Exibe resumo e listagem das vendas.'],
                    ['key' => 'demanda', 'label' => 'Vendas por produto', 'description' => 'Analisa demanda e performance por item.'],
                    ['key' => 'faltas', 'label' => 'Faltas e giro', 'description' => 'Monitora giro, faltas e ruptura.'],
                    ['key' => 'usuarios', 'label' => 'Usuarios', 'description' => 'Libera o modulo administrativo de usuarios.'],
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

    public function get(): array
    {
        if (!$this->appSettingsTableExists()) {
            return $this->getFromFile();
        }

        $stored = AppSetting::query()
            ->where('key', self::SETTINGS_KEY)
            ->value('payload');

        return $this->mergeWithDefaults(is_array($stored) ? $stored : []);
    }

    public function update(array $data): array
    {
        $settings = $this->mergeWithDefaults($data);

        if (!$this->appSettingsTableExists()) {
            $this->storeInFile($settings);
            return $settings;
        }

        AppSetting::query()->updateOrCreate(
            ['key' => self::SETTINGS_KEY],
            ['payload' => $settings],
        );

        return $settings;
    }

    public function isModuleEnabled(?string $moduleKey): bool
    {
        if (!$moduleKey) {
            return true;
        }

        return (bool) data_get($this->get(), "modules.{$moduleKey}", true);
    }

    protected function mergeWithDefaults(array $settings): array
    {
        $defaults = $this->defaults();
        $merged = array_replace_recursive($defaults, $settings);

        $merged['cash_closing']['require_conference'] = (bool) data_get(
            $merged,
            'cash_closing.require_conference',
            true,
        );

        foreach (array_keys($defaults['modules']) as $moduleKey) {
            $merged['modules'][$moduleKey] = (bool) data_get($merged, "modules.{$moduleKey}", true);
        }

        return $merged;
    }

    protected function appSettingsTableExists(): bool
    {
        return Schema::connection((new AppSetting())->getConnectionName())->hasTable('app_settings');
    }

    protected function getFromFile(): array
    {
        if (!Storage::disk('local')->exists($this->settingsPath())) {
            return $this->defaults();
        }

        $stored = json_decode((string) Storage::disk('local')->get($this->settingsPath()), true);

        return $this->mergeWithDefaults(is_array($stored) ? $stored : []);
    }

    protected function storeInFile(array $settings): void
    {
        Storage::disk('local')->put(
            $this->settingsPath(),
            json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    protected function settingsPath(): string
    {
        return sprintf('private/tenant-runtime/%s/settings.json', $this->tenantId());
    }

    protected function tenantId(): string
    {
        return (string) (tenant()?->getTenantKey() ?? 'central');
    }
}
