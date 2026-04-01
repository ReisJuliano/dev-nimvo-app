import { formatDateTime, formatMoney } from '@/lib/format'

export const filterMetaByStatus = {
    draft: {
        title: 'Atendimentos abertos',
        description: 'Rascunhos em andamento.',
    },
    sent_to_cashier: {
        title: 'Pendentes de cobranca',
        description: 'Pedidos aguardando fechamento.',
    },
}

export const paymentTabs = [
    { key: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave' },
    { key: 'card', label: 'Cartao', icon: 'fa-credit-card' },
    { key: 'pix', label: 'Pix', icon: 'fa-qrcode' },
    { key: 'credit', label: 'A Prazo', icon: 'fa-handshake' },
]

export const cardPaymentOptions = [
    { key: 'debit_card', label: 'Debito', icon: 'fa-credit-card' },
    { key: 'credit_card', label: 'Credito', icon: 'fa-credit-card' },
]

export function getInitialNewDraftForm() {
    return {
        type: 'comanda',
        customerName: '',
        customerId: '',
        reference: '',
        notes: '',
    }
}

export function roundCurrency(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

export function normalizeQuantity(value, fallback = 1) {
    const numeric = Number(value)

    if (!Number.isFinite(numeric)) {
        return Math.max(0.001, Number(fallback || 1))
    }

    return Math.max(0.001, numeric)
}

export function buildDiscountDraft(config, fallbackItemId = '') {
    if (config.type === 'percent') {
        return {
            mode: 'percent',
            percent: String(config.percent ?? ''),
            targetTotal: '',
            itemId: fallbackItemId,
            itemDiscountType: 'value',
            itemValue: '',
            itemPercent: '',
        }
    }

    if (config.type === 'target_total') {
        return {
            mode: 'target_total',
            percent: '',
            targetTotal: String(config.targetTotal ?? ''),
            itemId: fallbackItemId,
            itemDiscountType: 'value',
            itemValue: '',
            itemPercent: '',
        }
    }

    if (config.type === 'item') {
        return {
            mode: 'item',
            percent: '',
            targetTotal: '',
            itemId: String(config.itemId ?? fallbackItemId),
            itemDiscountType: config.itemDiscountType ?? 'value',
            itemValue: config.itemDiscountType === 'value' ? String(config.value ?? '') : '',
            itemPercent: config.itemDiscountType === 'percent' ? String(config.value ?? '') : '',
        }
    }

    return {
        mode: 'percent',
        percent: '',
        targetTotal: '',
        itemId: fallbackItemId,
        itemDiscountType: 'value',
        itemValue: '',
        itemPercent: '',
    }
}

export function distributeDiscountAcrossItems(items, totalDiscount) {
    const subtotal = roundCurrency(items.reduce((accumulator, item) => accumulator + item.lineSubtotal, 0))
    let remainingDiscount = Math.min(roundCurrency(totalDiscount), subtotal)
    let remainingBase = subtotal

    return items.map((item, index) => {
        if (remainingDiscount <= 0 || item.lineSubtotal <= 0) {
            remainingBase = roundCurrency(remainingBase - item.lineSubtotal)
            return { ...item, lineDiscount: 0 }
        }

        let lineDiscount

        if (index === items.length - 1 || remainingBase <= 0) {
            lineDiscount = Math.min(item.lineSubtotal, remainingDiscount)
        } else {
            lineDiscount = roundCurrency((remainingDiscount * item.lineSubtotal) / remainingBase)
            lineDiscount = Math.min(item.lineSubtotal, lineDiscount)
        }

        remainingDiscount = roundCurrency(remainingDiscount - lineDiscount)
        remainingBase = roundCurrency(remainingBase - item.lineSubtotal)

        return { ...item, lineDiscount }
    })
}

export function resolvePricing(items, config, selectedItem) {
    const baseItems = items.map((item) => ({
        ...item,
        qty: Number(item.qty),
        lineSubtotal: roundCurrency(Number(item.sale_price) * Number(item.qty)),
        lineDiscount: 0,
    }))

    const subtotal = roundCurrency(baseItems.reduce((accumulator, item) => accumulator + item.lineSubtotal, 0))
    let discountedItems = baseItems
    let summary = {
        title: 'Sem desconto aplicado',
        description: 'O atendimento segue com o total cheio ate que voce aplique um abatimento.',
        itemHint: selectedItem ? `Item em foco: ${selectedItem.name}` : null,
    }

    if (config.type === 'percent') {
        const percent = Math.max(0, Math.min(100, Number(config.percent || 0)))
        const totalDiscount = roundCurrency((subtotal * percent) / 100)
        discountedItems = distributeDiscountAcrossItems(baseItems, totalDiscount)
        summary = {
            title: `${percent}% de desconto no atendimento`,
            description: `Abatimento total de ${formatMoney(totalDiscount)} distribuido entre os itens.`,
            itemHint: null,
        }
    }

    if (config.type === 'target_total') {
        const targetTotal = Math.max(0, Math.min(subtotal, roundCurrency(config.targetTotal || 0)))
        const totalDiscount = roundCurrency(Math.max(0, subtotal - targetTotal))
        discountedItems = distributeDiscountAcrossItems(baseItems, totalDiscount)
        summary = {
            title: `Atendimento ajustado para ${formatMoney(targetTotal)}`,
            description: `Desconto automatico de ${formatMoney(totalDiscount)} no fechamento.`,
            itemHint: null,
        }
    }

    if (config.type === 'item') {
        discountedItems = baseItems.map((item) => {
            if (String(item.id) !== String(config.itemId)) {
                return item
            }

            const maxItemDiscount = item.lineSubtotal
            const requestedDiscount =
                config.itemDiscountType === 'percent'
                    ? roundCurrency((item.lineSubtotal * Number(config.value || 0)) / 100)
                    : roundCurrency(config.value || 0)

            return {
                ...item,
                lineDiscount: Math.max(0, Math.min(maxItemDiscount, requestedDiscount)),
            }
        })

        const discountedItem = items.find((item) => String(item.id) === String(config.itemId))
        summary = {
            title: discountedItem ? `Desconto em ${discountedItem.name}` : 'Desconto por item',
            description:
                config.itemDiscountType === 'percent'
                    ? `${Number(config.value || 0)}% aplicado apenas no item selecionado.`
                    : `${formatMoney(discountedItems.find((item) => String(item.id) === String(config.itemId))?.lineDiscount || 0)} abatido do item selecionado.`,
            itemHint: discountedItem ? `Produto selecionado: ${discountedItem.name}` : null,
        }
    }

    const pricedItems = discountedItems.map((item) => {
        const lineDiscount = roundCurrency(item.lineDiscount || 0)
        const lineTotal = roundCurrency(Math.max(0, item.lineSubtotal - lineDiscount))

        return {
            ...item,
            lineDiscount,
            lineTotal,
        }
    })

    const discount = roundCurrency(pricedItems.reduce((accumulator, item) => accumulator + item.lineDiscount, 0))
    const total = roundCurrency(Math.max(0, subtotal - discount))

    return {
        items: pricedItems,
        subtotal,
        discount,
        total,
        summary,
    }
}

export function buildPreviewConfigFromDraft(draft, subtotal) {
    if (draft.mode === 'percent') {
        return {
            type: 'percent',
            percent: draft.percent === '' ? 0 : roundCurrency(draft.percent),
        }
    }

    if (draft.mode === 'target_total') {
        return {
            type: 'target_total',
            targetTotal: draft.targetTotal === '' ? subtotal : roundCurrency(draft.targetTotal),
        }
    }

    if (draft.mode === 'item') {
        return {
            type: 'item',
            itemId: draft.itemId,
            itemDiscountType: draft.itemDiscountType,
            value:
                draft.itemDiscountType === 'percent'
                    ? draft.itemPercent === ''
                        ? 0
                        : roundCurrency(draft.itemPercent)
                    : draft.itemValue === ''
                      ? 0
                      : roundCurrency(draft.itemValue),
        }
    }

    return { type: 'none' }
}

export function buildDraftPayload(draft) {
    return {
        type: draft.type,
        reference: draft.reference || null,
        customer_id: draft.customerId || null,
        notes: draft.notes || null,
        items: draft.items.map((item) => ({
            id: item.id,
            qty: Number(item.qty),
        })),
    }
}

export function mapOrderToDraft(order) {
    return {
        id: order.id,
        type: order.type,
        reference: order.reference || '',
        status: order.status,
        label: order.label,
        customerId: order.customer?.id ? String(order.customer.id) : '',
        notes: order.notes || '',
        subtotal: Number(order.subtotal || 0),
        total: Number(order.total || 0),
        updatedAt: order.updated_at || null,
        items: (order.items || []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            barcode: item.barcode,
            unit: item.unit,
            qty: Number(item.qty),
            cost_price: Number(item.cost_price || 0),
            sale_price: Number(item.sale_price || 0),
            stock_quantity: Number(item.stock_quantity || 0),
            lineTotal: Number(item.lineTotal || Number(item.sale_price || 0) * Number(item.qty || 0)),
        })),
    }
}

export function sortDrafts(drafts) {
    return [...drafts].sort((left, right) => {
        if (left.status !== right.status) {
            return left.status === 'draft' ? -1 : 1
        }

        return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    })
}

export function getOrderTypeLabel(type) {
    if (type === 'mesa') {
        return 'Referencia'
    }

    if (type === 'pedido') {
        return 'Pedido'
    }

    return 'Atendimento'
}

export function getOrderStatusMeta(status) {
    if (status === 'sent_to_cashier') {
        return {
            label: 'No caixa',
            badge: 'info',
            description: 'Atendimento enviado para cobranca e pronto para fechamento.',
        }
    }

    return {
        label: 'Em aberto',
        badge: 'warning',
        description: 'Edicao ativa com salvamento automatico.',
    }
}

export function getDraftNumberLabel(draft) {
    return draft.reference ? String(draft.reference) : `#${draft.id}`
}

export function formatElapsedTime(value, nowValue = Date.now()) {
    if (!value) {
        return 'Agora'
    }

    const difference = Math.max(0, nowValue - new Date(value).getTime())
    const minutes = Math.floor(difference / 60000)

    if (minutes < 1) {
        return 'Agora'
    }

    if (minutes < 60) {
        return `${minutes} min`
    }

    const hours = Math.floor(minutes / 60)

    if (hours < 24) {
        const remainingMinutes = minutes % 60
        return remainingMinutes ? `${hours}h ${remainingMinutes}min` : `${hours}h`
    }

    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

export function buildPrintMarkup({ draft, customer, statusLabel }) {
    const itemsMarkup = draft.items.length
        ? draft.items.map((item) => `
            <tr>
                <td>
                    <strong>${escapeHtml(item.name)}</strong>
                    ${item.code ? `<small>Cod. ${escapeHtml(item.code)}</small>` : ''}
                </td>
                <td>${escapeHtml(item.qty)}</td>
                <td>${escapeHtml(formatMoney(item.sale_price))}</td>
                <td>${escapeHtml(formatMoney(item.lineTotal ?? Number(item.sale_price) * Number(item.qty)))}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="empty">Sem itens no pedido.</td></tr>'

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>${escapeHtml(draft.label)} - Impressao</title>
                <style>
                    * { box-sizing: border-box; }
                    body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #172131; background: #ffffff; }
                    .sheet { width: min(100%, 720px); margin: 0 auto; border: 1px solid #d8e0ea; border-radius: 18px; padding: 24px; }
                    .header-top, .footer { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
                    .eyebrow { display: inline-block; margin-bottom: 8px; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #506074; }
                    h1 { margin: 0; font-size: 28px; line-height: 1.1; }
                    .badge { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; background: #eef5ff; color: #1d4fd7; font-size: 12px; font-weight: 700; }
                    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
                    .meta-card, .notes { padding: 14px 16px; border-radius: 14px; background: #f6f8fb; border: 1px solid #e2e8f0; }
                    .meta-card span, .notes span { display: block; margin-bottom: 6px; color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
                    .meta-card strong, .notes strong { display: block; font-size: 16px; }
                    .notes p { margin: 0; color: #334155; line-height: 1.5; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
                    th { font-size: 11px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; }
                    td small { display: block; margin-top: 4px; color: #64748b; }
                    .totals { margin-top: 18px; margin-left: auto; width: min(100%, 260px); }
                    .totals-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
                    .totals-row strong { font-size: 18px; }
                    .empty { color: #64748b; text-align: center; }
                    @media print {
                        body { padding: 0; }
                        .sheet { width: 100%; border: 0; border-radius: 0; padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="sheet">
                    <div class="header-top">
                        <div>
                            <span class="eyebrow">Atendimento / comprovante</span>
                            <h1>${escapeHtml(draft.label)}</h1>
                        </div>
                        <span class="badge">${escapeHtml(statusLabel)}</span>
                    </div>

                    <div class="meta-grid">
                        <div class="meta-card">
                            <span>Tipo</span>
                            <strong>${escapeHtml(getOrderTypeLabel(draft.type))}</strong>
                        </div>
                        <div class="meta-card">
                            <span>Referencia</span>
                            <strong>${escapeHtml(draft.reference || 'Sem referencia')}</strong>
                        </div>
                        <div class="meta-card">
                            <span>Cliente</span>
                            <strong>${escapeHtml(customer?.name || 'Nao identificado')}</strong>
                        </div>
                        <div class="meta-card">
                            <span>Atualizado em</span>
                            <strong>${escapeHtml(draft.updatedAt ? formatDateTime(draft.updatedAt) : formatDateTime(new Date().toISOString()))}</strong>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qtd</th>
                                <th>Unit.</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemsMarkup}</tbody>
                    </table>

                    ${draft.notes.trim() ? `
                        <div class="notes" style="margin-top: 20px;">
                            <span>Observacoes</span>
                            <p>${escapeHtml(draft.notes)}</p>
                        </div>
                    ` : ''}

                    <div class="totals">
                        <div class="totals-row">
                            <span>Itens</span>
                            <span>${escapeHtml(String(draft.items.length))}</span>
                        </div>
                        <div class="totals-row">
                            <span>Total</span>
                            <strong>${escapeHtml(formatMoney(draft.total))}</strong>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `
}
