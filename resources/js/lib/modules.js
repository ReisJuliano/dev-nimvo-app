export const CUSTOM_PRESET = 'personalizado'

export const MODULE_DEFAULTS = {
    comandas: true,
    pdv_simples: true,
    pdv_restaurante: false,
    estoque: true,
    producao: false,
    fichas_tecnicas: false,
    controle_perdas: false,
    cozinha: false,
    pesagem: false,
    fiado: true,
    delivery: false,
    caixa: true,
    relatorios_avancados: true,
    clientes: true,
    fornecedores: true,
    compras: false,
    ordens_servico: false,
    controle_lotes: false,
    controle_validade: false,
    mesas: false,
    impressao_automatica: false,
}

export const PRESET_LABELS = {
    restaurante: 'Restaurante',
    mercearia: 'Mercearia',
    [CUSTOM_PRESET]: 'Personalizado',
}

export function normalizeModules(modules = {}) {
    const normalized = Object.fromEntries(Object.keys(MODULE_DEFAULTS).map((key) => [key, Boolean(modules?.[key] ?? MODULE_DEFAULTS[key])]))

    if (!normalized.comandas) {
        normalized.mesas = false
    }

    return normalized
}

export function deriveCapabilities(inputModules = {}) {
    const modules = normalizeModules(inputModules)

    return {
        pdv: modules.pdv_simples || modules.pdv_restaurante,
        caixa: modules.caixa,
        pedidos: modules.comandas,
        crediario: modules.fiado,
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
        producao: modules.producao,
        fichas_tecnicas: modules.fichas_tecnicas,
        perdas: modules.controle_perdas,
        cozinha: modules.cozinha,
        pesagem: modules.pesagem,
        delivery: modules.delivery,
        compras: modules.compras,
        ordens_servico: modules.ordens_servico,
    }
}

export function normalizeSettings(settings = {}) {
    const modules = normalizeModules(settings?.modules || {})
    const preset = PRESET_LABELS[settings?.business?.preset] ? settings.business.preset : CUSTOM_PRESET

    return {
        ...settings,
        business: {
            preset,
        },
        cash_closing: {
            require_conference: settings?.cash_closing?.require_conference !== false,
        },
        modules,
        capabilities: settings?.capabilities || deriveCapabilities(modules),
    }
}

export function getPresetLabel(preset) {
    return PRESET_LABELS[preset] || PRESET_LABELS[CUSTOM_PRESET]
}

export function getPdvLabel(modules) {
    return modules.pdv_restaurante ? 'PDV Restaurante' : 'PDV Rapido'
}

export function getOrdersLabel(modules) {
    return modules.mesas ? 'Comandas e Mesas' : 'Comandas'
}

export function getProductsLabel(modules) {
    return 'Produtos'
}
