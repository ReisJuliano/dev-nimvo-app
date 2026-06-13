export const CUSTOM_PRESET = 'personalizado'
export const SERVICE_PRESET = 'atendimento'
export const DIRECT_SALES_PRESET = 'venda_direta'

export const MODULE_DEFAULTS = {
    comandas: false,
    pdv_simples: true,
    pdv_avancado: false,
    estoque: true,
    prazo: true,
    delivery: false,
    caixa: true,
    fiscal_basico: false,
    fiscal_avancado: false,
    relatorios_basicos: true,
    relatorios_avancados: false,
    clientes: true,
    fornecedores: true,
    compras: false,
    controle_lotes: false,
    controle_validade: true,
    mesas: false,
    impressao_automatica: false,
    catalogo_online: false,
    pedidos_online: false,
    whatsapp_pedidos: false,
    moda: false,
}

export const PRESET_LABELS = {
    [DIRECT_SALES_PRESET]: 'Balcao simples',
    [SERVICE_PRESET]: 'Mesas e comandas',
    [CUSTOM_PRESET]: 'Avancado',
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
        relatorios_avancados: modules?.relatorios_avancados ?? modules?.relatorios,
        impressao_automatica: modules?.impressao_automatica ?? modules?.impressao,
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
        fiado: modules.prazo,
        produtos: modules.estoque || modules.controle_lotes || modules.controle_validade,
        categorias: modules.estoque,
        clientes: modules.clientes,
        fornecedores: modules.fornecedores,
        entrada_estoque: modules.estoque,
        ajuste_estoque: modules.estoque,
        movimentacao_estoque: modules.estoque,
        resumo: modules.relatorios_basicos,
        relatorios: modules.relatorios_basicos,
        vendas: modules.relatorios_avancados,
        demanda: modules.relatorios_avancados,
        faltas: modules.relatorios_avancados && modules.estoque,
        usuarios: true,
        fiscal_basico: modules.fiscal_basico,
        fiscal_avancado: modules.fiscal_avancado,
        consultas_fiscais: modules.fiscal_avancado,
        delivery: modules.delivery,
        compras: modules.compras,
        catalogo_online: modules.catalogo_online,
        pedidos_online: modules.pedidos_online,
        whatsapp_pedidos: modules.whatsapp_pedidos,
        moda: modules.moda,
    }
}

export function normalizeSettings(settings = {}) {
    const modules = normalizeModules(settings?.modules || {})
    const preset = normalizePresetAlias(settings?.business?.preset)
    const resolvedPreset = PRESET_LABELS[preset] ? preset : DIRECT_SALES_PRESET

    return {
        ...settings,
        business: {
            preset: resolvedPreset,
        },
        cash_closing: {
            require_conference: settings?.cash_closing?.require_conference === true,
        },
        modules,
        capabilities: deriveCapabilities(modules),
    }
}

export function getPresetLabel(preset) {
    return PRESET_LABELS[normalizePresetAlias(preset)] || PRESET_LABELS[DIRECT_SALES_PRESET]
}

export function getPdvLabel(modules) {
    return modules.pdv_avancado ? 'PDV avancado' : 'Vender'
}

export function getOrdersLabel(modules) {
    return modules.mesas ? 'Mesas e comandas' : 'Pedidos'
}

export function getProductsLabel() {
    return 'Produtos'
}
