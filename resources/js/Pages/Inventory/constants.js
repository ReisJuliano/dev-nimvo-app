export const STATUS_LABELS = {
    draft: 'Rascunho',
    counting: 'Em contagem',
    review: 'Em conferência',
    adjusting: 'Aplicando ajustes',
    completed: 'Concluída',
    cancelled: 'Cancelada',
}

export const ITEM_STATUS_LABELS = {
    pending: 'Pendente',
    counted: 'Contado',
    divergent: 'Divergente',
    recount: 'Recontagem',
    resolved: 'Resolvido',
    skipped: 'Não contado',
}

export const ITEM_STATUS_TONES = {
    pending: 'neutral',
    counted: 'success',
    divergent: 'danger',
    recount: 'warning',
    resolved: 'info',
    skipped: 'neutral',
}

export const MOVEMENT_TYPE_LABELS = {
    sale: 'Vendas',
    sale_cancelled: 'Vendas canceladas',
    purchase: 'Entradas',
    manual_adjustment: 'Ajustes manuais',
    loss: 'Perdas',
    conditional_outbound: 'Saídas condicional',
    conditional_return: 'Devoluções condicional',
    inventory_count_adjustment: 'Ajuste de inventário',
}

export const CYCLE_CLASS_LABELS = {
    A: 'Classe A — alto giro',
    B: 'Classe B — giro médio',
    C: 'Classe C — baixo giro',
}

export function statusLabel(status) {
    return STATUS_LABELS[status] || status
}

export function itemStatusLabel(status) {
    return ITEM_STATUS_LABELS[status] || status
}

export function itemStatusTone(status) {
    return ITEM_STATUS_TONES[status] || 'neutral'
}

export function movementTypeLabel(type) {
    return MOVEMENT_TYPE_LABELS[type] || type
}
