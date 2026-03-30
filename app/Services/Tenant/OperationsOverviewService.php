<?php

namespace App\Services\Tenant;

use App\Services\Tenant\Operations\InventoryOverviewService;
use App\Services\Tenant\Operations\SalesOverviewService;
use App\Services\Tenant\Operations\UsersOverviewService;

class OperationsOverviewService
{
    public function __construct(
        protected SalesOverviewService $sales,
        protected InventoryOverviewService $inventory,
        protected UsersOverviewService $users,
    ) {
    }

    public function build(string $module, array $filters = [], array $context = []): array
    {
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
                'Centralize preparos, receitas e rotinas internas quando a operacao pedir um fluxo de padaria ou manufatura leve.',
                [
                    ['label' => 'Fluxo do modulo', 'value' => 'Ativo na configuracao', 'meta' => 'Aparece apenas quando a producao esta habilitada.'],
                    ['label' => 'Uso recomendado', 'value' => 'Padaria e preparo interno', 'meta' => 'Bom para separar processos de venda e fabricacao.'],
                    ['label' => 'Conexao com estoque', 'value' => 'Apoia insumos e saidas', 'meta' => 'Ajuda a manter o catalogo alinhado com a producao.'],
                ],
                [
                    ['item' => 'Receitas e fichas', 'status' => 'Planejado', 'observacao' => 'Organize receitas base e etapas por produto.'],
                    ['item' => 'Separacao de producao', 'status' => 'Planejado', 'observacao' => 'Use o modulo para acompanhar lotes produzidos.'],
                    ['item' => 'Saida para venda', 'status' => 'Planejado', 'observacao' => 'Defina como itens prontos voltam ao PDV e estoque.'],
                ],
            ),
            'pesagem' => $this->moduleWorkspace(
                'Pesagem',
                'Destaque a operacao por peso para vendas fracionadas, balanca e produtos que exigem quantidade variavel.',
                [
                    ['label' => 'Fluxo do modulo', 'value' => 'Ativo na configuracao', 'meta' => 'Aparece quando a pesagem esta liberada no tenant.'],
                    ['label' => 'Uso recomendado', 'value' => 'Agropecuaria e varejo por peso', 'meta' => 'Bom para produtos vendidos em KG ou fracionados.'],
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
                'Organize pedidos de entrega sem poluir o menu de negocios que trabalham apenas no balcao.',
                [
                    ['label' => 'Fluxo do modulo', 'value' => 'Ativo na configuracao', 'meta' => 'Aparece somente quando o tenant usa entrega.'],
                    ['label' => 'Uso recomendado', 'value' => 'Pedidos externos e retirada', 'meta' => 'Separe atendimento presencial do fluxo de entrega.'],
                    ['label' => 'Conexao com vendas', 'value' => 'Expande o atendimento', 'meta' => 'Permite crescer para canais extras sem duplicar o sistema.'],
                ],
                [
                    ['item' => 'Cadastro de entregas', 'status' => 'Planejado', 'observacao' => 'Estruture taxas, bairros e janelas de entrega.'],
                    ['item' => 'Fila de expedicao', 'status' => 'Planejado', 'observacao' => 'Acompanhe pedidos em preparo e saida.'],
                    ['item' => 'Integracoes', 'status' => 'Planejado', 'observacao' => 'Conecte canais externos quando fizer sentido.'],
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
        return [
            'title' => $title,
            'description' => $description,
            'metrics' => [
                [
                    'label' => 'Modulo ativo',
                    'value' => 1,
                    'format' => 'number',
                    'caption' => 'Esta tela so aparece quando o switch esta ligado.',
                ],
                [
                    'label' => 'Resumo operacional',
                    'value' => count($highlights),
                    'format' => 'number',
                    'caption' => 'Pontos rapidos para orientar a configuracao inicial.',
                ],
                [
                    'label' => 'Checklist sugerido',
                    'value' => count($rows),
                    'format' => 'number',
                    'caption' => 'Itens recomendados para colocar o modulo em operacao.',
                ],
            ],
            'panels' => [
                [
                    'title' => 'Como usar este modulo',
                    'items' => $highlights,
                ],
            ],
            'tables' => [
                [
                    'title' => 'Escopo inicial do modulo',
                    'columns' => [
                        ['key' => 'item', 'label' => 'Item'],
                        ['key' => 'status', 'label' => 'Status'],
                        ['key' => 'observacao', 'label' => 'Observacao'],
                    ],
                    'rows' => $rows,
                    'emptyText' => 'Nenhum item configurado para este modulo.',
                ],
            ],
            'filters' => [
                'showDateRange' => false,
            ],
        ];
    }
}
