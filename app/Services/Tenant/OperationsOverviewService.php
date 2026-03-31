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
            'fiado' => $this->sales->credit($filters),
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
            'producao' => $this->moduleWorkspace(
                'Producao',
                'Centralize a producao diaria, separando preparos internos do fluxo direto de venda no caixa.',
                [
                    ['label' => 'Uso recomendado', 'value' => 'Preparo interno', 'meta' => 'Bom para organizar lotes, rotinas e reposicao do estoque.'],
                    ['label' => 'Conexao com estoque', 'value' => 'Entrada de itens prontos', 'meta' => 'Ajuda a transformar insumos em itens disponiveis para venda.'],
                    ['label' => 'Rotina sugerida', 'value' => 'Planejamento por turno', 'meta' => 'Separe a producao por horario para evitar ruptura.'],
                ],
                [
                    ['item' => 'Planejamento diario', 'status' => 'Pronto para configurar', 'observacao' => 'Organize o que sera produzido por turno, dia e equipe.'],
                    ['item' => 'Apontamento de producao', 'status' => 'Pronto para configurar', 'observacao' => 'Registre quantidade prevista, produzida e disponivel para venda.'],
                    ['item' => 'Transferencia para estoque/PDV', 'status' => 'Em evolucao', 'observacao' => 'Padronize quando a producao conclui e volta para o catalogo de venda.'],
                ],
            ),
            'fichas-tecnicas' => $this->moduleWorkspace(
                'Fichas tecnicas',
                'Estruture receitas, rendimento e consumo de insumos para preparos internos e operacoes com custo tecnico.',
                [
                    ['label' => 'Uso recomendado', 'value' => 'Restaurante e preparo interno', 'meta' => 'Ideal para receitas, pratos, porcoes e insumos base.'],
                    ['label' => 'Conexao com estoque', 'value' => 'Baixa por insumo', 'meta' => 'Ajuda a relacionar consumo previsto com o item vendido ou produzido.'],
                    ['label' => 'Resultado esperado', 'value' => 'Padrao operacional', 'meta' => 'Reduz variacao de custo, rendimento e preparo.'],
                ],
                [
                    ['item' => 'Receitas e rendimento', 'status' => 'Pronto para configurar', 'observacao' => 'Defina porcoes, peso final e margem de perda aceitavel.'],
                    ['item' => 'Lista de insumos', 'status' => 'Pronto para configurar', 'observacao' => 'Relacione ingredientes, unidade e quantidade consumida por preparo.'],
                    ['item' => 'Revisao de ficha', 'status' => 'Em evolucao', 'observacao' => 'Padronize revisoes quando custo, preparo ou rendimento mudarem.'],
                ],
            ),
            'cozinha' => $this->moduleWorkspace(
                'Cozinha',
                'Crie uma frente operacional para acompanhar preparo, prioridade e expedicao dos pedidos antes da cobranca.',
                [
                    ['label' => 'Uso recomendado', 'value' => 'Restaurante e cozinha de apoio', 'meta' => 'Bom para separar fila de preparo do caixa.'],
                    ['label' => 'Conexao com pedidos', 'value' => 'Fila de producao', 'meta' => 'Ajuda a organizar mesa, balcao, retirada e entrega.'],
                    ['label' => 'Rotina sugerida', 'value' => 'Status por etapa', 'meta' => 'Use estados como recebido, em preparo e pronto.'],
                ],
                [
                    ['item' => 'Painel da cozinha', 'status' => 'Pronto para configurar', 'observacao' => 'Defina como os pedidos chegam e como a equipe muda o status.'],
                    ['item' => 'Separacao por tipo', 'status' => 'Pronto para configurar', 'observacao' => 'Organize pedidos por mesa, retirada e delivery.'],
                    ['item' => 'Conferencia de expedicao', 'status' => 'Em evolucao', 'observacao' => 'Padronize saida do pedido pronto para o salao ou entrega.'],
                ],
            ),
            'perdas' => $this->moduleWorkspace(
                'Controle de perdas',
                'Acompanhe quebras, vencimentos e perdas operacionais para entender o que sai do estoque sem virar venda.',
                [
                    ['label' => 'Uso recomendado', 'value' => 'Operacao com pereciveis', 'meta' => 'Importante para produto perecivel e preparos internos.'],
                    ['label' => 'Conexao com estoque', 'value' => 'Saidas nao vendidas', 'meta' => 'Ajuda a separar perda de consumo real e de acerto de inventario.'],
                    ['label' => 'Resultado esperado', 'value' => 'Menos desperdicio', 'meta' => 'Facilita investigar motivos e horarios de maior perda.'],
                ],
                [
                    ['item' => 'Motivos padrao', 'status' => 'Pronto para configurar', 'observacao' => 'Use categorias como quebra, vencimento, teste e descarte.'],
                    ['item' => 'Rotina de registro', 'status' => 'Pronto para configurar', 'observacao' => 'Defina quem aponta e em que momento a perda entra no fluxo.'],
                    ['item' => 'Analise por periodo', 'status' => 'Em evolucao', 'observacao' => 'Cruze perdas com producao, vendas e validade para agir mais cedo.'],
                ],
            ),
            'pesagem' => $this->moduleWorkspace(
                'Pesagem',
                'Destaque a operacao por peso para vendas fracionadas, balanca e produtos que exigem quantidade variavel.',
                [
                    ['label' => 'Fluxo do modulo', 'value' => 'Ativo na configuracao', 'meta' => 'Aparece quando a pesagem esta liberada no tenant.'],
                    ['label' => 'Uso recomendado', 'value' => 'Varejo por peso', 'meta' => 'Bom para produtos vendidos em KG ou fracionados.'],
                    ['label' => 'Conexao com PDV', 'value' => 'Venda fracionada destacada', 'meta' => 'O PDV pode operar com quantidades decimais e leitura de peso.'],
                ],
                [
                    ['item' => 'Produtos por peso', 'status' => 'Pronto para configuracao', 'observacao' => 'Cadastre itens com unidade adequada para pesagem.'],
                    ['item' => 'Conferencia operacional', 'status' => 'Planejado', 'observacao' => 'Valide balancas e rotinas de atendimento.'],
                    ['item' => 'Padrao de etiquetas', 'status' => 'Planejado', 'observacao' => 'Defina como o peso chega ao PDV.'],
                ],
            ),
            'delivery' => $this->moduleWorkspace(
                'Delivery',
                'Organize entrega e retirada sem misturar o atendimento externo com o fluxo do balcao e do salao.',
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
            'ordens-servico' => $this->moduleWorkspace(
                'Ordens de servico',
                'Separe atendimentos tecnicos e servicos recorrentes em um modulo proprio quando o negocio precisar.',
                [
                    ['label' => 'Fluxo do modulo', 'value' => 'Ativo na configuracao', 'meta' => 'Aparece apenas para operacoes com OS.'],
                    ['label' => 'Uso recomendado', 'value' => 'Assistencia e servicos', 'meta' => 'Bom para tecnico, oficina ou atendimento com checklist.'],
                    ['label' => 'Conexao com clientes', 'value' => 'Historico organizado', 'meta' => 'Ajuda a manter chamados e entregas separados do PDV.'],
                ],
                [
                    ['item' => 'Abertura de OS', 'status' => 'Planejado', 'observacao' => 'Defina entrada, responsavel e previsao de entrega.'],
                    ['item' => 'Checklist tecnico', 'status' => 'Planejado', 'observacao' => 'Padronize diagnostico e execucao.'],
                    ['item' => 'Fechamento e cobranca', 'status' => 'Planejado', 'observacao' => 'Amarre a conclusao ao faturamento do servico.'],
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
