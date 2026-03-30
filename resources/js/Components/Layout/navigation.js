import { getOrdersLabel, getPdvLabel, getProductsLabel } from '@/lib/modules'

function isNavigationItemEnabled(item, capabilities) {
    if (Array.isArray(item.moduleKeys)) {
        return item.moduleKeys.some((moduleKey) => capabilities[moduleKey] !== false)
    }

    return item.moduleKey == null || capabilities[item.moduleKey] !== false
}

export function buildNavigationGroups({ authRole, modules, capabilities }) {
    const baseNavigationGroups = [
        {
            section: 'Gerencial',
            items: [
                { href: '/dashboard', label: 'Inicio', icon: 'fa-chart-pie' },
            ],
        },
        {
            section: 'Vendas',
            items: [
                { href: '/pdv', label: getPdvLabel(modules), icon: 'fa-cash-register', moduleKey: 'pdv' },
                { href: '/pedidos', label: getOrdersLabel(modules), icon: 'fa-clipboard-list', moduleKey: 'pedidos' },
                { href: '/delivery', label: 'Delivery', icon: 'fa-motorcycle', moduleKey: 'delivery' },
                { href: '/caixa', label: 'Caixa', icon: 'fa-vault', moduleKey: 'caixa' },
                { href: '/fiado', label: 'Fiado', icon: 'fa-handshake', moduleKey: 'crediario' },
            ],
        },
        {
            section: 'Operacao',
            items: [
                { href: '/producao', label: 'Producao', icon: 'fa-bread-slice', moduleKey: 'producao' },
                { href: '/pesagem', label: 'Pesagem', icon: 'fa-scale-balanced', moduleKey: 'pesagem' },
                { href: '/ordens-servico', label: 'Ordens de servico', icon: 'fa-screwdriver-wrench', moduleKey: 'ordens_servico' },
            ],
        },
        {
            section: 'Cadastros',
            items: [
                { href: '/produtos', label: getProductsLabel(modules), icon: 'fa-boxes-stacked', moduleKey: 'produtos' },
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
        {
            section: 'Relatorios',
            items: [
                { href: '/relatorios', label: 'Relatorios avancados', icon: 'fa-chart-bar', moduleKey: 'relatorios' },
                { href: '/faltas', label: 'Faltas e Giro', icon: 'fa-triangle-exclamation', moduleKey: 'faltas' },
            ],
        },
    ]

    const adminItems = {
        section: 'Admin',
        items: [
            { href: '/usuarios', label: 'Usuarios', icon: 'fa-user-gear', moduleKey: 'usuarios' },
        ],
    }

    const groups = authRole === 'admin' ? [...baseNavigationGroups, adminItems] : baseNavigationGroups

    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => isNavigationItemEnabled(item, capabilities)),
        }))
        .filter((group) => group.items.length > 0)
}
