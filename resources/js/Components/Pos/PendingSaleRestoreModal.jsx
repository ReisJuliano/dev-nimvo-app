import { formatMoney } from '@/lib/format'

export default function PendingSaleRestoreModal({ open, pendingSale, busy = false, onRestore, onDiscard }) {
    if (!open || !pendingSale) {
        return null
    }

    const itemsCount = (pendingSale.cart || []).length
    const total = (pendingSale.cart || []).reduce((accumulator, item) => accumulator + Number(item.lineTotal || Number(item.sale_price || 0) * Number(item.qty || 0)), 0)

    return (
        <div className="pos-quick-customer">
            <div className="pos-quick-customer-card pos-pending-sale-card">
                <div className="pos-quick-customer-header">
                    <div>
                        <h2>Venda pendente encontrada</h2>
                        <p>O sistema localizou uma venda em andamento e pode restaurar exatamente o estado anterior.</p>
                    </div>
                </div>

                <div className="pos-payment-summary-grid">
                    <article>
                        <span>Itens</span>
                        <strong>{itemsCount}</strong>
                    </article>
                    <article>
                        <span>Total estimado</span>
                        <strong>{formatMoney(total)}</strong>
                    </article>
                    <article>
                        <span>Atualizada em</span>
                        <strong>{pendingSale.updated_at ? new Date(pendingSale.updated_at).toLocaleString('pt-BR') : 'Agora'}</strong>
                    </article>
                </div>

                <div className="pos-quick-customer-actions">
                    <button className="ui-button-ghost" type="button" onClick={onDiscard} disabled={busy}>
                        <i className="fa-solid fa-trash-can" />
                        Descartar
                    </button>
                    <button className="pos-finalize-button" type="button" onClick={onRestore} disabled={busy}>
                        <i className="fa-solid fa-rotate-left" />
                        {busy ? 'Processando...' : 'Restaurar venda'}
                    </button>
                </div>
            </div>
        </div>
    )
}
