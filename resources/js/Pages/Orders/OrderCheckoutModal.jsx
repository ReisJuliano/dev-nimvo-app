import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'
import { cardPaymentOptions, paymentTabs } from './orderUtils'

export default function OrderCheckoutModal({
    draft,
    feedback,
    selectedCustomer,
    pricing,
    paymentTab,
    setPaymentTab,
    cardType,
    setCardType,
    cashReceived,
    setCashReceived,
    cashChange,
    cashShortfall,
    creditStatus,
    submittingCheckout,
    onClose,
    onOpenDiscountModal,
    onOpenPartialCheckout,
    onConfirm,
}) {
    if (!draft) {
        return null
    }

    return (
        <OrdersModal
            title="Finalizar Pedido"
            subtitle="Resumo completo do atendimento com pagamento em abas."
            size="lg"
            onClose={onClose}
        >
            <div className="orders-modal-stack">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type} orders-modal-inline-alert`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Nao foi possivel concluir a acao' : 'Atualizacao realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <div className="orders-checkout-summary">
                    <div>
                        <span>Atendimento</span>
                        <strong>{draft.label}</strong>
                        <small>{selectedCustomer?.name || 'Cliente nao identificado'}</small>
                    </div>
                    <div>
                        <span>Itens</span>
                        <strong>{formatNumber(draft.items.length)}</strong>
                        <small>{formatNumber(pricing.items.reduce((accumulator, item) => accumulator + Number(item.qty), 0))} unidade(s)</small>
                    </div>
                    <div className="highlight">
                        <span>Total</span>
                        <strong>{formatMoney(pricing.total)}</strong>
                        <small>{pricing.discount > 0 ? `Inclui ${formatMoney(pricing.discount)} de desconto` : 'Sem desconto aplicado'}</small>
                    </div>
                </div>

                <div className="ui-tabs orders-payment-tabs">
                    {paymentTabs.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            className={`ui-tab ${paymentTab === option.key ? 'active' : ''}`}
                            onClick={() => setPaymentTab(option.key)}
                        >
                            <i className={`fa-solid ${option.icon}`} />
                            <span>{option.label}</span>
                        </button>
                    ))}
                </div>

                {paymentTab === 'card' ? (
                    <div className="orders-card-toggle">
                        {cardPaymentOptions.map((option) => (
                            <button key={option.key} type="button" className={cardType === option.key ? 'active' : ''} onClick={() => setCardType(option.key)}>
                                <i className={`fa-solid ${option.icon}`} />
                                {option.label}
                            </button>
                        ))}
                    </div>
                ) : null}

                {paymentTab === 'cash' ? (
                    <div className="orders-cash-panel">
                        <label className="orders-form-field">
                            <span>Valor entregue</span>
                            <input
                                className="ui-input"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0,00"
                                value={cashReceived}
                                onChange={(event) => setCashReceived(event.target.value)}
                            />
                        </label>

                        <div className={`orders-summary-box compact ${cashShortfall > 0 ? 'alert' : ''}`}>
                            <div>
                                <span>{cashShortfall > 0 ? 'Faltando' : 'Troco'}</span>
                                <strong>{formatMoney(cashShortfall > 0 ? cashShortfall : cashChange)}</strong>
                            </div>
                        </div>
                    </div>
                ) : null}

                {paymentTab === 'credit' ? (
                    <div className="orders-credit-panel">
                        {selectedCustomer ? (
                            <div className="orders-credit-grid">
                                <div>
                                    <span>Limite</span>
                                    <strong>{formatMoney(creditStatus?.credit_limit || 0)}</strong>
                                </div>
                                <div>
                                    <span>Em aberto</span>
                                    <strong>{formatMoney(creditStatus?.open_credit || 0)}</strong>
                                </div>
                                <div>
                                    <span>Disponivel</span>
                                    <strong>{formatMoney(creditStatus?.available_credit || 0)}</strong>
                                </div>
                            </div>
                        ) : (
                            <div className="orders-inline-empty wide">
                                <i className="fa-solid fa-user-tag" />
                                <div>
                                    <strong>Cliente obrigatorio para A Prazo</strong>
                                    <p>Vincule um cliente antes de concluir com esta forma de pagamento.</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                <div className="orders-summary-box checkout-total">
                    <div>
                        <span>Subtotal</span>
                        <strong>{formatMoney(pricing.subtotal)}</strong>
                    </div>
                    <div>
                        <span>Desconto</span>
                        <strong>{formatMoney(pricing.discount)}</strong>
                    </div>
                    <div className="total">
                        <span>Total destacado</span>
                        <strong>{formatMoney(pricing.total)}</strong>
                    </div>
                </div>

                <div className="orders-modal-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Cancelar
                    </button>
                    <button type="button" className="ui-button-secondary" onClick={onOpenPartialCheckout}>
                        <i className="fa-solid fa-people-group" />
                        Pagamento parcial
                    </button>
                    <button type="button" className="ui-button-secondary" onClick={onOpenDiscountModal}>
                        <i className="fa-solid fa-percent" />
                        Desconto
                    </button>
                    <button type="button" className="ui-button" onClick={onConfirm} disabled={submittingCheckout}>
                        <i className="fa-solid fa-check" />
                        {submittingCheckout ? 'Confirmando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </OrdersModal>
    )
}
