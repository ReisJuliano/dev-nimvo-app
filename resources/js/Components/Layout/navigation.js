export const navItems = [
    {
        section: 'Gerencial',
        items: [
            { href: '/dashboard', label: 'Inicio', icon: 'fa-chart-pie' },
            { href: '/relatorios', label: 'Relatorios', icon: 'fa-chart-bar', moduleKey: 'relatorios' },
            { href: '/vendas', label: 'Vendas Gerais', icon: 'fa-receipt', moduleKey: 'vendas' },
            { href: '/demanda', label: 'Vendas por Produto', icon: 'fa-chart-line', moduleKey: 'demanda' },
            { href: '/faltas', label: 'Faltas e Giro', icon: 'fa-triangle-exclamation', moduleKey: 'faltas' },
        ],
    },
    {
        section: 'Vendas',
        items: [
            { href: '/pdv', label: 'PDV', icon: 'fa-cash-register', moduleKey: 'pdv' },
            { href: '/caixa', label: 'Caixa', icon: 'fa-vault', moduleKey: 'caixa' },
            { href: '/pedidos', label: 'Pedidos', icon: 'fa-clipboard-list', moduleKey: 'pedidos' },
            { href: '/fiado', label: 'Crediario', icon: 'fa-handshake', moduleKey: 'crediario' },
        ],
    },
    {
        section: 'Cadastros',
        items: [
            { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked', moduleKey: 'produtos' },
            { href: '/categorias', label: 'Categorias', icon: 'fa-tags', moduleKey: 'categorias' },
            { href: '/clientes', label: 'Clientes', icon: 'fa-users', moduleKey: 'clientes' },
            { href: '/fornecedores', label: 'Fornecedores', icon: 'fa-building', moduleKey: 'fornecedores' },
        ],
    },
    {
        section: 'Estoque',
        items: [
            { href: '/entrada-estoque', label: 'Entrada', icon: 'fa-arrow-down', moduleKey: 'entrada_estoque' },
            { href: '/ajuste-estoque', label: 'Conferencia', icon: 'fa-sliders', moduleKey: 'ajuste_estoque' },
            { href: '/movimentacao-estoque', label: 'Movimentacao', icon: 'fa-timeline', moduleKey: 'movimentacao_estoque' },
        ],
    },
]

export const adminItems = {
    section: 'Admin',
    items: [
        { href: '/usuarios', label: 'Usuarios', icon: 'fa-user-gear', moduleKey: 'usuarios' },
        { href: '/configuracoes', label: 'Configuracoes', icon: 'fa-sliders' },
    ],
}
