export const TYPE_LABELS = {
    promo_price: 'Preço promocional (De/Por)',
    buy_x_pay_y: 'Leve X pague Y',
    quantity_discount: 'Desconto por quantidade',
    category_discount: 'Desconto de categoria',
}

export const WEEKDAYS = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
    { value: 6, label: 'Sáb' },
    { value: 7, label: 'Dom' },
]

export const PROMOTION_STATUS_TONES = {
    ativa: 'success',
    agendada: 'info',
    expirada: 'neutral',
    inativa: 'neutral',
}

export const CAMPAIGN_STATUS_TONES = {
    ativo: 'success',
    agendado: 'info',
    encerrado: 'neutral',
    inativo: 'neutral',
}

export function typeLabel(type) {
    return TYPE_LABELS[type] || type
}

export function promotionStatusTone(status) {
    return PROMOTION_STATUS_TONES[status] || 'neutral'
}

export function campaignStatusTone(status) {
    return CAMPAIGN_STATUS_TONES[status] || 'neutral'
}

export function emptyPromotionForm() {
    return {
        id: null,
        campaign_id: '',
        name: '',
        description: '',
        type: 'promo_price',
        scope: 'product',
        product_id: '',
        category_id: '',
        discount_value: '',
        tiers: [{ min_quantity: '', unit_price: '' }],
        buy_quantity: '',
        pay_quantity: '',
        highlight_text: '',
        start_at: '',
        end_at: '',
        weekdays: [],
        active: true,
    }
}

export function emptyCampaignForm() {
    return {
        id: null,
        name: '',
        description: '',
        cover_note: '',
        starts_at: '',
        ends_at: '',
        active: true,
    }
}
