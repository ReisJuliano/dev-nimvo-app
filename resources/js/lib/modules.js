export const CUSTOM_PRESET = 'personalizado'

export const MODULE_DEFAULTS = {
    comandas: true,
    pdv_simples: true,
    pdv_restaurante: false,
    estoque: true,
    producao: false,
    pesagem: false,
    fiado: true,
    delivery: false,
    caixa: true,
    relatorios_avancados: true,
    clientes: true,
    fornecedores: true,
    ordens_servico: false,
    produtos_variacao: false,
    controle_lotes: false,
    controle_validade: false,
    mesas: false,
    impressao_automatica: false,
}

export const PRESET_LABELS = {
    restaurante: 'Restaurante',
    padaria: 'Padaria',
    mercearia: 'Mercearia',
    agropecuaria: 'Agropecuaria',
    [CUSTOM_PRESET]: 'Personalizado',
}

export function normalizeModules(modules = {}) {
    const normalized = Object.fromEntries(
        Object.entries({ ...MODULE_DEFAULTS, ...modules }).map(([key, value]) => [key, Boolean(value)]),
    )

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
        produtos: modules.estoque || modules.produtos_variacao || modules.controle_lotes || modules.controle_validade,
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
        pesagem: modules.pesagem,
        delivery: modules.delivery,
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
    return modules.pdv_restaurante ? 'PDV Restaurante' : 'PDV Simples'
}

export function getOrdersLabel(modules) {
    return modules.mesas ? 'Comandas e Mesas' : 'Comandas'
}

export function getProductsLabel(modules) {
    return modules.produtos_variacao ? 'Produtos e Variacoes' : 'Produtos'
}
