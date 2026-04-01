export const CUSTOM_PRESET = 'personalizado'
export const SERVICE_PRESET = 'atendimento'
export const DIRECT_SALES_PRESET = 'venda_direta'

export const MODULE_DEFAULTS = {
    comandas: true,
    pdv_simples: true,
    pdv_avancado: false,
    estoque: true,
    prazo: true,
    delivery: false,
    caixa: true,
    relatorios_avancados: true,
    clientes: true,
    fornecedores: true,
    compras: false,
    controle_lotes: false,
    controle_validade: false,
    mesas: false,
    impressao_automatica: false,
}

export const PRESET_LABELS = {
    [SERVICE_PRESET]: 'Atendimento',
    [DIRECT_SALES_PRESET]: 'Venda direta',
    [CUSTOM_PRESET]: 'Personalizado',
}

function normalizePresetAlias(preset) {
    if (preset === 'restaurante') {
        return SERVICE_PRESET
    }

    if (preset === 'mercearia') {
        return DIRECT_SALES_PRESET
    }

    return preset
}

export function normalizeModules(modules = {}) {
    const withAliases = {
        ...modules,
        prazo: modules?.prazo ?? modules?.fiado,
        pdv_avancado: modules?.pdv_avancado ?? modules?.pdv_restaurante,
    }

    const normalized = Object.fromEntries(
        Object.keys(MODULE_DEFAULTS).map((key) => [key, Boolean(withAliases?.[key] ?? MODULE_DEFAULTS[key])]),
    )

    if (!normalized.comandas) {
        normalized.mesas = false
    }

    return normalized
}

export function deriveCapabilities(inputModules = {}) {
    const modules = normalizeModules(inputModules)

    return {
        pdv: modules.pdv_simples || modules.pdv_avancado,
        caixa: modules.caixa,
        pedidos: modules.comandas,
        prazo: modules.prazo,
        crediario: modules.prazo,
        produtos: modules.estoque || modules.controle_lotes || modules.controle_validade,
        categorias: modules.estoque,
        clientes: modules.clientes,
        fornecedores: modules.fornecedores,
        entrada_estoque: modules.estoque,
        ajuste_estoque: modules.estoque,
        movimentacao_estoque: modules.estoque,
        relatorios: modules.relatorios_avancados,
        vendas: modules.relatorios_avancados,
        demanda: modules.relatorios_avancados,
        faltas: modules.relatorios_avancados && modules.estoque,
        usuarios: true,
        delivery: modules.delivery,
        compras: modules.compras,
    }
}

export function normalizeSettings(settings = {}) {
    const modules = normalizeModules(settings?.modules || {})
    const preset = normalizePresetAlias(settings?.business?.preset)
    const resolvedPreset = PRESET_LABELS[preset] ? preset : CUSTOM_PRESET

    return {
        ...settings,
        business: {
            preset: resolvedPreset,
        },
        cash_closing: {
            require_conference: settings?.cash_closing?.require_conference !== false,
        },
        modules,
        capabilities: settings?.capabilities || deriveCapabilities(modules),
    }
}

export function getPresetLabel(preset) {
    return PRESET_LABELS[normalizePresetAlias(preset)] || PRESET_LABELS[CUSTOM_PRESET]
}

export function getPdvLabel(modules) {
    return modules.pdv_avancado ? 'Checkout integrado' : 'Checkout'
}

export function getOrdersLabel(modules) {
    return modules.mesas ? 'Atendimentos' : 'Pedidos'
}

export function getProductsLabel() {
    return 'Produtos'
}
