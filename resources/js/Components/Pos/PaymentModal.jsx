import { formatMoney } from '@/lib/format'

export default function PaymentModal({
    open,
    onClose,
    onConfirm,
    paymentOptions,
    paymentMethod,
    onPaymentChange,
    mixedPayments,
    mixedDraft,
    mixedRemaining,
    onMixedDraftChange,
    onMixedPaymentChange,
    onMixedPaymentRemove,
    onAddMixedPayment,
    totals,
    cashReceived,
    onCashReceivedChange,
    cashChange,
    cashShortfall,
    selectedCustomerData,
    creditStatus,
    busy = false,
}) {
    if (!open) {
        return null
    }

    const paymentLabels = Object.fromEntries(paymentOptions.map((option) => [option.value, option.label]))

    return (
        <div className="pos-quick-customer" onClick={onClose}>
            <div className="pos-quick-customer-card pos-payment-modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="pos-quick-customer-header">
                    <div>
                        <h2>Pagamento</h2>
                        <p>Confirme os valores recebidos antes de decidir a etapa fiscal.</p>
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
                    <article>
                        <span>{paymentMethod === 'cash' ? 'Troco' : 'Recebido'}</span>
                        <strong>{paymentMethod === 'cash' ? formatMoney(cashChange) : formatMoney(totals.total)}</strong>
                    </article>
                </div>

                <div className="pos-payment-method-grid">
                    {paymentOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`pos-payment-method-card ${paymentMethod === option.value ? 'active' : ''}`}
                            onClick={() => onPaymentChange(option.value)}
                        >
                            <i className={`fa-solid ${option.icon}`} />
                            <strong>{option.label}</strong>
                        </button>
                    ))}
                </div>

                {paymentMethod === 'mixed' ? (
                    <div className="pos-mixed-box pos-modal-section">
                        <div className="pos-mixed-summary">
                            <div>
                                <span>Pagamento misto</span>
                                <strong>Restante {formatMoney(mixedRemaining)}</strong>
                            </div>
                        </div>

                        <div className="pos-mixed-form">
                            <select
                                className="ui-select"
                                value={mixedDraft.method}
                                onChange={(event) => onMixedDraftChange('method', event.target.value)}
                            >
                                {paymentOptions
                                    .filter((option) => option.value !== 'mixed')
                                    .map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                            </select>
                            <input
                                className="ui-input"
                                type="number"
                                step="0.01"
                                value={mixedDraft.amount}
                                onChange={(event) => onMixedDraftChange('amount', event.target.value)}
                                placeholder="Valor"
                            />
                            <button type="button" onClick={onAddMixedPayment}>
                                <i className="fa-solid fa-plus" />
                                Adicionar
                            </button>
                        </div>

                        <div className="pos-mixed-list">
                            {mixedPayments.length ? (
                                mixedPayments.map((payment, index) => (
                                    <div key={`${payment.method}-${index}`} className="pos-mixed-item">
                                        <span>{paymentLabels[payment.method] ?? payment.method}</span>
                                        <input
                                            className="ui-input"
                                            type="number"
                                            step="0.01"
                                            value={payment.amount}
                                            onChange={(event) => onMixedPaymentChange(index, event.target.value)}
                                        />
                                        <button type="button" onClick={() => onMixedPaymentRemove(index)}>
                                            <i className="fa-solid fa-trash-can" />
                                            Remover
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="pos-empty-state">Adicione as parcelas para distribuir o recebimento.</div>
                            )}
                        </div>
                    </div>
                ) : null}

                {paymentMethod === 'cash' ? (
                    <div className="pos-cash-change-panel pos-modal-section">
                        <div className="pos-cash-change-copy">
                            <label htmlFor="pos-payment-cash-received">Valor entregue</label>
                            <small>Use para validar o troco antes de concluir.</small>
                        </div>

                        <div className="pos-cash-change-input-wrap">
                            <span>R$</span>
                            <input
                                id="pos-payment-cash-received"
                                className="ui-input pos-cash-change-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={cashReceived}
                                onChange={(event) => onCashReceivedChange(event.target.value)}
                                placeholder="0,00"
                            />
                        </div>

                        <div className={`pos-total-support-row ${cashShortfall > 0 ? 'alert' : ''}`}>
                            <span>{cashShortfall > 0 ? 'Faltando' : 'Troco'}</span>
                            <strong>{formatMoney(cashShortfall > 0 ? cashShortfall : cashChange)}</strong>
                        </div>
                    </div>
                ) : null}

                {paymentMethod === 'credit' && selectedCustomerData && creditStatus ? (
                    <div className="pos-credit-card pos-modal-section">
                        <div>
                            <span>Cliente</span>
                            <strong>{selectedCustomerData.name}</strong>
                        </div>
                        <div>
                            <span>Limite</span>
                            <strong>{formatMoney(creditStatus.credit_limit)}</strong>
                        </div>
                        <div>
                            <span>Disponivel</span>
                            <strong>{formatMoney(creditStatus.available_credit)}</strong>
                        </div>
                    </div>
                ) : null}

                <div className="pos-quick-customer-actions">
                    <button className="ui-button-ghost" type="button" onClick={onClose}>
                        Voltar
                    </button>
                    <button className="pos-finalize-button" type="button" onClick={onConfirm} disabled={busy}>
                        <i className="fa-solid fa-arrow-right" />
                        {busy ? 'Validando...' : 'Confirmar pagamento'}
                    </button>
                </div>
            </div>
        </div>
    )
}
