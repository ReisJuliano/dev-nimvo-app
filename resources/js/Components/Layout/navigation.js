import { getOrdersLabel, getPdvLabel, getProductsLabel } from '@/lib/modules'

const LABEL_RESOLVERS = {
    orders: getOrdersLabel,
    pdv: getPdvLabel,
    products: getProductsLabel,
}

function resolveNavigationLabel(item, modules) {
    if (item.label) {
        return item.label
    }

    const resolver = LABEL_RESOLVERS[item.label_type]

    return resolver ? resolver(modules) : item.href
}

function isNavigationItemEnabled(item, authRole, modules, capabilities) {
    if (item.required_role && authRole !== item.required_role) {
        return false
    }

    if (!item.access_key) {
        return true
    }

    if (Object.prototype.hasOwnProperty.call(modules, item.access_key)) {
        return modules[item.access_key] !== false
    }

    return Boolean(capabilities?.[item.access_key])
}

export function buildNavigationGroups({ authRole, modules, capabilities, catalog }) {
    return (catalog ?? [])
        .map((group) => ({
            ...group,
            items: (group.items ?? [])
                .filter((item) => item.href !== '/configuracoes')
                .filter((item) => isNavigationItemEnabled(item, authRole, modules, capabilities))
                .map((item) => ({
                    ...item,
                    label: resolveNavigationLabel(item, modules),
                })),
        }))
        .filter((group) => group.items.length > 0)
}
