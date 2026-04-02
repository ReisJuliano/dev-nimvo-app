import { formatMoney } from '@/lib/format'

export default function FiscalDecisionModal({ open, onClose, onCloseSale, onEmitCoupon, totals, busy = false }) {
    if (!open) {
        return null
    }

    return (
        <div className="pos-quick-customer" onClick={onClose}>
            <div className="pos-quick-customer-card pos-fiscal-decision-card" onClick={(event) => event.stopPropagation()}>
                <div className="pos-quick-customer-header">
                    <div>
                        <h2>Finalizacao fiscal</h2>
                        <p>Escolha se a venda sera encerrada silenciosamente ou se deve seguir para emissao fiscal.</p>
                    </div>
                    <button className="ui-button-ghost" type="button" onClick={onClose}>
                        Fechar
                    </button>
                </div>

                <div className="pos-payment-summary-grid">
                    <article>
                        <span>Subtotal</span>
                        <strong>{formatMoney(totals.subtotal)}</strong>
                    </article>
                    <article>
                        <span>Desconto</span>
                        <strong>{formatMoney(totals.discount)}</strong>
                    </article>
                    <article>
                        <span>Total</span>
                        <strong>{formatMoney(totals.total)}</strong>
                    </article>
                </div>

                <div className="pos-fiscal-decision-grid">
                    <button type="button" className="pos-fiscal-decision-option" onClick={onCloseSale} disabled={busy}>
                        <i className="fa-solid fa-receipt" />
                        <strong>Fechar</strong>
                        <span>Encerra a venda sem emitir cupom fiscal e imprime apenas o comprovante de pagamento.</span>
                    </button>

                    <button type="button" className="pos-fiscal-decision-option active" onClick={onEmitCoupon} disabled={busy}>
                        <i className="fa-solid fa-file-invoice" />
                        <strong>Emitir cupom</strong>
                        <span>Segue para a identificacao do destinatario e para a etapa fiscal normal.</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
