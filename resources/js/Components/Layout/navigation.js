export const navItems = [
    {
        section: 'Gerencial',
        items: [
            { href: '/dashboard', label: 'Inicio', icon: 'fa-chart-pie' },
            { href: '/relatorios', label: 'Relatorios', icon: 'fa-chart-bar' },
            { href: '/vendas', label: 'Vendas Gerais', icon: 'fa-receipt' },
            { href: '/demanda', label: 'Vendas por Produto', icon: 'fa-chart-line' },
            { href: '/faltas', label: 'Faltas e Giro', icon: 'fa-triangle-exclamation' },
        ],
    },
    {
        section: 'Vendas',
        items: [
            { href: '/pdv', label: 'PDV', icon: 'fa-cash-register' },
            { href: '/pedidos', label: 'Pedidos', icon: 'fa-clipboard-list' },
            { href: '/fiado', label: 'Fiado', icon: 'fa-handshake' },
        ],
    },
    {
        section: 'Cadastros',
        items: [
            { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked' },
            { href: '/categorias', label: 'Categorias', icon: 'fa-tags' },
            { href: '/clientes', label: 'Clientes', icon: 'fa-users' },
            { href: '/fornecedores', label: 'Fornecedores', icon: 'fa-building' },
        ],
    },
    {
        section: 'Estoque',
        items: [
            { href: '/entrada-estoque', label: 'Entrada', icon: 'fa-arrow-down' },
            { href: '/ajuste-estoque', label: 'Conferencia', icon: 'fa-sliders' },
            { href: '/movimentacao-estoque', label: 'Movimentacao', icon: 'fa-timeline' },
        ],
    },
]

export const adminItems = {
    section: 'Admin',
    items: [
        { href: '/usuarios', label: 'Usuarios', icon: 'fa-user-gear' },
    ],
}
