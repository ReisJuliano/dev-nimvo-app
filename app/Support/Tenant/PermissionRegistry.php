<?php

namespace App\Support\Tenant;

class PermissionRegistry
{
    public static function categories(): array
    {
        return [
            [
                'key' => 'vendas',
                'label' => 'Vendas/PDV',
                'items' => [
                    ['key' => 'vendas.finalizar_venda', 'label' => 'Finalizar venda', 'description' => 'Permite registrar e finalizar vendas no PDV.'],
                    ['key' => 'vendas.aplicar_desconto', 'label' => 'Aplicar desconto', 'description' => 'Permite aplicar desconto em itens ou no total da venda.'],
                    ['key' => 'vendas.autorizar_desconto', 'label' => 'Autorizar desconto de outro operador', 'description' => 'Libera descontos que exigem autorização gerencial no PDV.'],
                    ['key' => 'vendas.excluir_item_pdv', 'label' => 'Excluir produto do carrinho no PDV', 'description' => 'Permite remover um item já lançado no carrinho antes de finalizar.'],
                    ['key' => 'vendas.venda_condicional', 'label' => 'Registrar venda condicional', 'description' => 'Permite retirar mercadoria como venda condicional (a confirmar depois).'],
                ],
            ],
            [
                'key' => 'caixa',
                'label' => 'Caixa',
                'items' => [
                    ['key' => 'caixa.visualizar', 'label' => 'Visualizar caixa', 'description' => 'Acessa a tela de caixa e acompanha o turno atual.'],
                    ['key' => 'caixa.abrir_fechar', 'label' => 'Abrir e fechar caixa', 'description' => 'Permite abrir um novo turno de caixa e encerrar o turno atual.'],
                    ['key' => 'caixa.sangria_suprimento', 'label' => 'Registrar sangria/suprimento', 'description' => 'Permite registrar retiradas e entradas manuais de dinheiro no caixa.'],
                    ['key' => 'caixa.editar_fechamento_confirmado', 'label' => 'Editar fechamento já confirmado', 'description' => 'Permite reabrir/corrigir um fechamento de caixa que já foi confirmado.'],
                    ['key' => 'caixa.ver_painel_todos_caixas', 'label' => 'Ver painel de todos os caixas', 'description' => 'Acessa o painel gerencial com todos os caixas abertos e fechados da loja.'],
                ],
            ],
            [
                'key' => 'estoque',
                'label' => 'Estoque',
                'items' => [
                    ['key' => 'estoque.visualizar', 'label' => 'Visualizar estoque', 'description' => 'Consulta o saldo e o histórico de movimentações de estoque.'],
                    ['key' => 'estoque.ajustar', 'label' => 'Ajustar estoque', 'description' => 'Permite lançar ajustes manuais de quantidade em estoque.'],
                    ['key' => 'estoque.entrada_mercadoria', 'label' => 'Registrar entrada de mercadoria', 'description' => 'Permite lançar entradas de mercadoria (nota, fornecedor, boleto).'],
                    ['key' => 'inventario.gerenciar', 'label' => 'Gerenciar inventário', 'description' => 'Permite criar sessões de inventário, contar e enviar para conferência.'],
                    ['key' => 'inventario.aprovar', 'label' => 'Aprovar inventário', 'description' => 'Permite aprovar a conferência e aplicar os ajustes de um inventário.'],
                ],
            ],
            [
                'key' => 'produtos',
                'label' => 'Produtos',
                'items' => [
                    ['key' => 'produtos.visualizar', 'label' => 'Visualizar produtos', 'description' => 'Consulta o cadastro de produtos.'],
                    ['key' => 'produtos.adicionar', 'label' => 'Adicionar produto', 'description' => 'Permite cadastrar novos produtos.'],
                    ['key' => 'produtos.editar', 'label' => 'Editar produto', 'description' => 'Permite alterar dados de um produto já cadastrado.'],
                    ['key' => 'produtos.excluir', 'label' => 'Excluir produto', 'description' => 'Permite excluir um produto do cadastro.'],
                ],
            ],
            [
                'key' => 'clientes',
                'label' => 'Clientes',
                'items' => [
                    ['key' => 'clientes.visualizar', 'label' => 'Visualizar clientes', 'description' => 'Consulta o cadastro de clientes.'],
                    ['key' => 'clientes.adicionar', 'label' => 'Adicionar cliente', 'description' => 'Permite cadastrar novos clientes.'],
                    ['key' => 'clientes.editar', 'label' => 'Editar cliente', 'description' => 'Permite alterar dados de um cliente já cadastrado.'],
                    ['key' => 'clientes.excluir', 'label' => 'Excluir cliente', 'description' => 'Permite excluir um cliente do cadastro.'],
                ],
            ],
            [
                'key' => 'fornecedores',
                'label' => 'Fornecedores',
                'items' => [
                    ['key' => 'fornecedores.visualizar', 'label' => 'Visualizar fornecedores', 'description' => 'Consulta o cadastro de fornecedores.'],
                    ['key' => 'fornecedores.adicionar', 'label' => 'Adicionar fornecedor', 'description' => 'Permite cadastrar novos fornecedores.'],
                    ['key' => 'fornecedores.editar', 'label' => 'Editar fornecedor', 'description' => 'Permite alterar dados de um fornecedor já cadastrado.'],
                    ['key' => 'fornecedores.excluir', 'label' => 'Excluir fornecedor', 'description' => 'Permite excluir um fornecedor do cadastro.'],
                ],
            ],
            [
                'key' => 'compras',
                'label' => 'Compras',
                'items' => [
                    ['key' => 'compras.visualizar', 'label' => 'Visualizar compras', 'description' => 'Consulta pedidos de compra e recebimentos.'],
                    ['key' => 'compras.adicionar', 'label' => 'Adicionar compra', 'description' => 'Permite registrar um novo pedido de compra.'],
                    ['key' => 'compras.excluir', 'label' => 'Excluir compra', 'description' => 'Permite excluir um pedido de compra ainda não aplicado ao estoque.'],
                ],
            ],
            [
                'key' => 'contas_a_pagar',
                'label' => 'Contas a pagar',
                'items' => [
                    ['key' => 'contas_a_pagar.visualizar', 'label' => 'Visualizar contas a pagar', 'description' => 'Consulta lançamentos e compromissos financeiros.'],
                    ['key' => 'contas_a_pagar.adicionar', 'label' => 'Adicionar lançamento', 'description' => 'Permite lançar uma nova conta a pagar avulsa.'],
                    ['key' => 'contas_a_pagar.editar', 'label' => 'Editar lançamento', 'description' => 'Permite alterar um lançamento de conta a pagar.'],
                    ['key' => 'contas_a_pagar.excluir', 'label' => 'Excluir lançamento', 'description' => 'Permite excluir um lançamento de conta a pagar.'],
                ],
            ],
            [
                'key' => 'relatorios',
                'label' => 'Relatórios',
                'items' => [
                    ['key' => 'relatorios.visualizar', 'label' => 'Visualizar relatórios', 'description' => 'Acessa os relatórios avançados da loja.'],
                    ['key' => 'relatorios.exportar', 'label' => 'Exportar relatório', 'description' => 'Permite exportar relatórios em PDF ou Excel.'],
                ],
            ],
            [
                'key' => 'usuarios',
                'label' => 'Usuários',
                'items' => [
                    ['key' => 'usuarios.visualizar', 'label' => 'Visualizar usuários', 'description' => 'Consulta a lista de usuários e grupos da loja.'],
                    ['key' => 'usuarios.gerenciar', 'label' => 'Gerenciar usuários e grupos', 'description' => 'Permite criar, editar e excluir usuários e grupos de permissão.'],
                ],
            ],
            [
                'key' => 'configuracoes',
                'label' => 'Configurações',
                'items' => [
                    ['key' => 'configuracoes.visualizar', 'label' => 'Visualizar configurações', 'description' => 'Acessa a tela de configurações da loja.'],
                    ['key' => 'configuracoes.editar', 'label' => 'Editar configurações', 'description' => 'Permite alterar as configurações da loja, incluindo caixas e agente local.'],
                ],
            ],
            [
                'key' => 'auditoria',
                'label' => 'Auditoria',
                'items' => [
                    ['key' => 'auditoria.visualizar', 'label' => 'Visualizar logs de auditoria', 'description' => 'Consulta o histórico de ações auditadas da loja.'],
                ],
            ],
        ];
    }

    public static function allKeys(): array
    {
        return collect(self::categories())
            ->flatMap(fn (array $category) => collect($category['items'])->pluck('key'))
            ->values()
            ->all();
    }

    public static function defaultGrantsForBaseRole(?string $baseRole): array
    {
        $all = self::allKeys();

        return match ($baseRole) {
            'admin' => $all,
            'manager' => collect($all)
                ->reject(fn (string $key) => str_starts_with($key, 'usuarios.') || str_starts_with($key, 'configuracoes.') || str_starts_with($key, 'auditoria.'))
                ->values()
                ->all(),
            'operator' => collect($all)
                ->filter(fn (string $key) => in_array($key, [
                    'vendas.finalizar_venda',
                    'vendas.aplicar_desconto',
                    'vendas.excluir_item_pdv',
                    'vendas.venda_condicional',
                    'caixa.visualizar',
                    'caixa.abrir_fechar',
                    'caixa.sangria_suprimento',
                    'estoque.visualizar',
                    'produtos.visualizar',
                    'clientes.visualizar',
                    'clientes.adicionar',
                    'fornecedores.visualizar',
                    'compras.visualizar',
                    'contas_a_pagar.visualizar',
                    'relatorios.visualizar',
                ], true))
                ->values()
                ->all(),
            default => [],
        };
    }
}
