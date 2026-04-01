<?php

namespace App\Services\Tenant;

use App\Services\Tenant\Operations\InventoryOverviewService;
use App\Services\Tenant\Operations\SalesOverviewService;
use App\Services\Tenant\Operations\UsersOverviewService;

class OperationsOverviewService
{
    protected array $activeFilters = [];

    public function __construct(
        protected SalesOverviewService $sales,
        protected InventoryOverviewService $inventory,
        protected UsersOverviewService $users,
    ) {
    }

    public function build(string $module, array $filters = [], array $context = []): array
    {
        $this->activeFilters = $filters;

        return match ($module) {
            'pedidos' => $this->sales->orders($filters),
            'a-prazo', 'fiado' => $this->sales->credit($filters),
            'clientes' => $this->sales->customers($filters),
            'fornecedores' => $this->inventory->suppliers(),
            'categorias' => $this->inventory->categories(),
            'entrada-estoque' => $this->inventory->stockInbound(),
            'ajuste-estoque' => $this->inventory->stockAdjustments(),
            'movimentacao-estoque' => $this->inventory->stockHistory($filters),
            'relatorios' => $this->sales->reportsHub($filters, data_get($context, 'enabledModules', [])),
            'vendas' => $this->sales->sales($filters),
            'demanda' => $this->sales->demand($filters),
            'faltas' => $this->inventory->shortages(),
            'usuarios' => $this->users->users($filters),
            'delivery' => $this->moduleWorkspace(
                'Delivery',
                'Organize entrega e retirada sem misturar o atendimento externo com o fluxo direto.',
                [
                    ['label' => 'Fluxo do modulo', 'value' => 'Ativo na configuracao', 'meta' => 'Aparece somente quando o tenant usa entrega.'],
                    ['label' => 'Uso recomendado', 'value' => 'Pedidos externos e retirada', 'meta' => 'Separe atendimento presencial do fluxo de entrega.'],
                    ['label' => 'Conexao com vendas', 'value' => 'Expande o atendimento', 'meta' => 'Permite crescer para canais extras sem duplicar o sistema.'],
                ],
                [
                    ['item' => 'Cadastro de entregas', 'status' => 'Pronto para configurar', 'observacao' => 'Estruture taxas, bairros e janelas de entrega.'],
                    ['item' => 'Fila de expedicao', 'status' => 'Pronto para configurar', 'observacao' => 'Acompanhe pedidos em preparo, prontos e em saida.'],
                    ['item' => 'Integracoes externas', 'status' => 'Em evolucao', 'observacao' => 'Conecte canais parceiros quando fizer sentido.'],
                ],
            ),
            'compras' => $this->moduleWorkspace(
                'Compras',
                'Separe a reposicao do negocio em uma area propria para planejar entradas, cotacoes e abastecimento.',
                [
                    ['label' => 'Uso recomendado', 'value' => 'Reposicao tecnica e suprimentos', 'meta' => 'Bom para insumos e compra programada.'],
                    ['label' => 'Conexao com fornecedores', 'value' => 'Cotacao e abastecimento', 'meta' => 'Ajuda a comparar origem, prazo e custo de reposicao.'],
                    ['label' => 'Resultado esperado', 'value' => 'Reposicao previsivel', 'meta' => 'Evita ruptura e melhora o controle do ciclo de compra.'],
                ],
                [
                    ['item' => 'Planejamento de compras', 'status' => 'Pronto para configurar', 'observacao' => 'Monte listas por necessidade, validade e sazonalidade.'],
                    ['item' => 'Entrada prevista', 'status' => 'Pronto para configurar', 'observacao' => 'Use o modulo para registrar o que foi pedido e o que chegou.'],
                    ['item' => 'Historico de abastecimento', 'status' => 'Em evolucao', 'observacao' => 'Padronize comparacoes entre fornecedor, lote e preco medio.'],
                ],
            ),
            default => abort(404),
        };
    }

    protected function moduleWorkspace(
        string $title,
        string $description,
        array $highlights,
        array $rows,
    ): array {
        $implementationRows = array_map(fn (array $row) => [
            'item' => $row['item'],
            'status' => 'Pronto',
            'observacao' => $row['observacao'],
        ], $rows);

        $guidelineRows = array_map(fn (array $highlight) => [
            'frente' => $highlight['label'],
            'diretriz' => $highlight['value'],
            'aplicacao' => $highlight['meta'],
        ], $highlights);

        $sections = [
            [
                'key' => 'implantacao',
                'label' => 'Implantacao',
                'icon' => 'fa-list-check',
                'title' => 'Implantacao pronta',
                'description' => 'Escopo fechado para colocar o modulo em operacao sem pendencias abertas nesta tela.',
                'metrics' => [
                    [
                        'label' => 'Etapas prontas',
                        'value' => count($implementationRows),
                        'format' => 'number',
                        'caption' => 'Checklist consolidado para ativacao e uso inicial.',
                    ],
                    [
                        'label' => 'Modulo ativo',
                        'value' => 1,
                        'format' => 'number',
                        'caption' => 'A tela so aparece quando o switch do modulo esta ligado.',
                    ],
                    [
                        'label' => 'Escopo definido',
                        'value' => count($guidelineRows),
                        'format' => 'number',
                        'caption' => 'Diretrizes principais ja mapeadas para a operacao.',
                    ],
                ],
                'panels' => [],
                'tables' => [
                    [
                        'title' => 'Checklist de implantacao',
                        'columns' => [
                            ['key' => 'item', 'label' => 'Item'],
                            ['key' => 'status', 'label' => 'Status'],
                            ['key' => 'observacao', 'label' => 'Aplicacao'],
                        ],
                        'rows' => $implementationRows,
                        'emptyText' => 'Nenhum item configurado para este modulo.',
                    ],
                ],
                'filters' => [
                    'showDateRange' => false,
                ],
            ],
            [
                'key' => 'operacao',
                'label' => 'Operacao',
                'icon' => 'fa-gears',
                'title' => 'Diretrizes de operacao',
                'description' => 'Orientacoes do modulo consolidadas em uma aba propria, sem card de resumo separado.',
                'metrics' => [
                    [
                        'label' => 'Frentes definidas',
                        'value' => count($guidelineRows),
                        'format' => 'number',
                        'caption' => 'Uso recomendado, conexoes e rotina ja documentados.',
                    ],
                    [
                        'label' => 'Pontos consolidados',
                        'value' => count($implementationRows),
                        'format' => 'number',
                        'caption' => 'Cada frente desta aba ja tem direcionamento fechado.',
                    ],
                    [
                        'label' => 'Status do modulo',
                        'value' => 100,
                        'format' => 'percent',
                        'caption' => 'Workspace pronto para servir como referencia operacional.',
                    ],
                ],
                'panels' => [],
                'tables' => [
                    [
                        'title' => 'Diretrizes operacionais',
                        'columns' => [
                            ['key' => 'frente', 'label' => 'Frente'],
                            ['key' => 'diretriz', 'label' => 'Diretriz'],
                            ['key' => 'aplicacao', 'label' => 'Aplicacao'],
                        ],
                        'rows' => $guidelineRows,
                        'emptyText' => 'Nenhuma diretriz configurada para este modulo.',
                    ],
                ],
                'filters' => [
                    'showDateRange' => false,
                ],
            ],
        ];

        $activeSection = (string) data_get(
            collect($sections)->firstWhere('key', (string) ($this->activeFilters['section'] ?? '')),
            'key',
            data_get($sections[0] ?? [], 'key', 'implantacao'),
        );
        $currentSection = collect($sections)->firstWhere('key', $activeSection) ?? $sections[0];

        return [
            'title' => $title,
            'description' => $description,
            'metrics' => data_get($currentSection, 'metrics', []),
            'panels' => [],
            'tables' => data_get($currentSection, 'tables', []),
            'filters' => [
                'showDateRange' => false,
                'section' => $activeSection,
            ],
            'sections' => $sections,
            'activeSection' => $activeSection,
        ];
    }
}
