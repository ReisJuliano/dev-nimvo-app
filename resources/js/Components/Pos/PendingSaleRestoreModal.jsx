import { formatMoney } from '@/lib/format'

function resolveLineTotal(item) {
    if (item.lineTotal != null) {
        return Number(item.lineTotal)
    }

    return (Number(item.sale_price || 0) * Number(item.qty || 0)) - Number(item.lineDiscount || 0)
}

function resolveSavedAtLabel(value) {
    const savedAt = value ? new Date(value) : null

    if (!savedAt || Number.isNaN(savedAt.getTime())) {
        return 'Agora'
    }

    const minutesAgo = Math.round((Date.now() - savedAt.getTime()) / 60000)

    if (minutesAgo < 1) {
        return 'Menos de 1 min atrás'
    }

    if (minutesAgo < 60) {
        return `${minutesAgo} min atrás`
    }

    return `${Math.round(minutesAgo / 60)}h atrás`
}

export default function PendingSaleRestoreModal({ open, pendingSale, busy = false, onRestore, onDiscard }) {
    if (!open || !pendingSale) {
        return null
    }

    const itemsCount = (pendingSale.cart || []).length

    if (itemsCount === 0) {
        return null
    }

    const total = (pendingSale.cart || []).reduce((accumulator, item) => accumulator + resolveLineTotal(item), 0)
    const timeLabel = resolveSavedAtLabel(pendingSale.updated_at)

    if (import.meta.env.DEV) {
        pendingSale.cart?.forEach((item) => {
            const expected = (Number(item.sale_price || 0) * Number(item.qty || 0)) - Number(item.lineDiscount || 0)

            if (Math.abs(Number(item.lineTotal) - expected) > 0.01) {
                console.warn('[PendingSale] lineTotal mismatch', item)
            }
        })
    }

    return (
        <div className="pos-quick-customer">
            <div className="pos-quick-customer-card pos-pending-sale-card">
                <div className="pos-quick-customer-header">
                    <div>
                        <h2>Venda pendente encontrada</h2>
                        <p>O sistema localizou uma venda em andamento. Deseja restaurar ou descartar?</p>
                    </div>
                </div>

                {pendingSale.has_dropped_items && (
                    <div className="pos-pending-sale-alert">
                        <i className="fa-solid fa-circle-exclamation" />
                        Alguns produtos não estão mais disponíveis e serão removidos ao restaurar.
                    </div>
                )}

                <div className="pos-payment-summary-grid">
                    <article>
                        <span>Itens</span>
                        <strong>{itemsCount}</strong>
                    </article>
                    <article>
                        <span>Total da venda</span>
                        <strong>{formatMoney(total)}</strong>
                    </article>
                    <article>
                        <span>Salva</span>
                        <strong>{timeLabel}</strong>
                    </article>
                    {pendingSale.customer?.name && (
                        <article>
                            <span>Cliente</span>
                            <strong>{pendingSale.customer.name}</strong>
                        </article>
                    )}
                </div>

                <div className="pos-quick-customer-actions">
                    <button className="ui-button-ghost" type="button" onClick={onDiscard} disabled={busy}>
                        <i className="fa-solid fa-trash-can" />
                        {busy ? 'Descartando...' : 'Descartar'}
                    </button>
                    <button className="pos-finalize-button" type="button" onClick={onRestore} disabled={busy}>
                        <i className="fa-solid fa-rotate-left" />
                        {busy ? 'Restaurando...' : 'Restaurar venda'}
                    </button>
                </div>
            </div>
        </div>
    )
}
