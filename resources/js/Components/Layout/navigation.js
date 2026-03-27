export const navItems = [
    {
        section: 'Gerencial',
        items: [
            { href: '/dashboard', label: 'Inicio', icon: 'fa-chart-pie' },
        ],
    },
    {
        section: 'Vendas / Pedidos',
        items: [
            { href: '/pdv', label: 'Caixa', icon: 'fa-cash-register' },
            { href: '/pedidos', label: 'Pedidos / Comandas', icon: 'fa-clipboard-list' },
            { href: '/caixa', label: 'Abertura / Fechamento', icon: 'fa-cash-register' },
        ],
    },
    {
        section: 'Fiado',
        items: [
            { href: '/fiado', label: 'Fiado / A Receber', icon: 'fa-handshake' },
        ],
    },
    {
        section: 'Cadastros',
        items: [
            { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked' },
            { href: '/fornecedores', label: 'Fornecedores', icon: 'fa-building' },
            { href: '/categorias', label: 'Categorias', icon: 'fa-tags' },
            { href: '/clientes', label: 'Clientes', icon: 'fa-users' },
        ],
    },
    {
        section: 'Estoque',
        items: [
            { href: '/estoque/entrada', label: 'Entrada de Estoque', icon: 'fa-arrow-down' },
            { href: '/estoque/ajuste', label: 'Ajuste de Estoque', icon: 'fa-sliders' },
            { href: '/estoque/historico', label: 'Historico Estoque', icon: 'fa-timeline' },
        ],
    },
    {
        section: 'Relatorios',
        items: [
            { href: '/relatorios', label: 'Relatorios', icon: 'fa-chart-bar' },
            { href: '/faltas', label: 'Faltas & Giro', icon: 'fa-cart-plus' },
            { href: '/vendas', label: 'Vendas Gerais', icon: 'fa-receipt' },
            { href: '/demanda', label: 'Vendas por Produto', icon: 'fa-chart-line' },
        ],
    },
]

export const adminItems = {
    section: 'Admin',
    items: [
        { href: '/usuarios', label: 'Usuarios', icon: 'fa-user-gear' },
    ],
}
