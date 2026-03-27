export const navItems = [
    {
        section: 'Gerencial',
        items: [
            { href: '/dashboard', label: 'Inicio', icon: 'fa-chart-pie' },
        ],
    },
    {
        section: 'Operacao',
        items: [
            { href: '/pdv', label: 'Caixa', icon: 'fa-cash-register' },
            { href: '/caixa', label: 'Abertura / Fechamento', icon: 'fa-cash-register' },
        ],
    },
    {
        section: 'Cadastros',
        items: [
            { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked' },
            { href: '/dashboard', label: 'Painel Geral', icon: 'fa-table-columns' },
        ],
    },
]

export const adminItems = {
    section: 'Admin',
    items: [
        { href: '/usuarios', label: 'Usuarios', icon: 'fa-user-gear' },
    ],
}
