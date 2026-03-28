import { formatMoney } from '@/lib/format'

const paymentOptions = [
    { value: 'cash', label: 'Dinheiro' },
    { value: 'pix', label: 'Pix' },
    { value: 'debit_card', label: 'Debito' },
    { value: 'credit_card', label: 'Credito' },
    { value: 'credit', label: 'Fiado' },
    { value: 'mixed', label: 'Misto' },
]

const paymentLabels = Object.fromEntries(paymentOptions.map((option) => [option.value, option.label]))

export default function CheckoutPanel({
    customers,
    selectedCustomer,
    onCustomerChange,
    discount,
    onDiscountChange,
    notes,
    onNotesChange,
    paymentMethod,
    onPaymentChange,
    mixedPayments,
    mixedDraft,
    mixedRemaining,
    onMixedDraftChange,
    onMixedPaymentChange,
    onMixedPaymentRemove,
    onAddMixedPayment,
    onQuickCustomer,
    creditStatus,
    totals,
    disabled,
    onFinalize,
    cashRegister,
}) {
    return (
        <section className="pos-card checkout">
            <div className="pos-card-header">
                <div>
                    <h2>Fechamento</h2>
                    <p>{cashRegister ? 'Caixa aberto para vender' : 'Abra o caixa para liberar vendas'}</p>
                </div>
                {cashRegister ? (
                    <div className="pos-register-chip">
                        <span>Caixa ativo</span>
                        <strong>{formatMoney(cashRegister.opening_amount)}</strong>
                    </div>
                ) : null}
            </div>

            <div className="pos-checkout-grid">
                <label>
                    Cliente
                    <select value={selectedCustomer} onChange={(event) => onCustomerChange(event.target.value)}>
                        <option value="">Balcao</option>
                        {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                                {customer.name}
                            </option>
                        ))}
                    </select>
                    <button type="button" className="pos-inline-button" onClick={onQuickCustomer}>
                        Novo cliente rapido
                    </button>
                </label>

                <label>
                    Pagamento
                    <select value={paymentMethod} onChange={(event) => onPaymentChange(event.target.value)}>
                        {paymentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Desconto
                    <input type="number" step="0.01" value={discount} onChange={(event) => onDiscountChange(event.target.value)} />
                </label>

                <label className="span-2">
                    Observacoes
                    <textarea rows="3" value={notes} onChange={(event) => onNotesChange(event.target.value)} />
                </label>
            </div>

            {creditStatus && selectedCustomer ? (
                <div className="pos-credit-card">
                    <div>
                        <span>Limite</span>
                        <strong>{formatMoney(creditStatus.credit_limit)}</strong>
                    </div>
                    <div>
                        <span>Em aberto</span>
                        <strong>{formatMoney(creditStatus.open_credit)}</strong>
                    </div>
                    <div>
                        <span>Disponivel</span>
                        <strong>{formatMoney(creditStatus.available_credit)}</strong>
                    </div>
                </div>
            ) : null}

            {paymentMethod === 'mixed' ? (
                <div className="pos-mixed-box">
                    <div className="pos-mixed-summary">
                        <span>Pagamento misto em andamento</span>
                        <strong>Restante {formatMoney(mixedRemaining)}</strong>
                    </div>

                    <div className="pos-mixed-form">
                        <select
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
                            type="number"
                            step="0.01"
                            placeholder="Valor"
                            value={mixedDraft.amount}
                            onChange={(event) => onMixedDraftChange('amount', event.target.value)}
                        />
                        <button type="button" onClick={onAddMixedPayment}>
                            Adicionar
                        </button>
                    </div>

                    <div className="pos-mixed-list">
                        {mixedPayments.length ? (
                            mixedPayments.map((payment, index) => (
                                <div key={`${payment.method}-${index}`} className="pos-mixed-item">
                                    <span>{paymentLabels[payment.method] ?? payment.method}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={payment.amount}
                                        onChange={(event) => onMixedPaymentChange(index, event.target.value)}
                                    />
                                    <button type="button" onClick={() => onMixedPaymentRemove(index)}>
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

            <div className="pos-total-panel">
                <div>
                    <span>Subtotal</span>
                    <strong>{formatMoney(totals.subtotal)}</strong>
                </div>
                <div>
                    <span>Desconto</span>
                    <strong>{formatMoney(totals.discount)}</strong>
                </div>
                <div className="pos-total-row">
                    <span>Total</span>
                    <strong>{formatMoney(totals.total)}</strong>
                </div>
            </div>

            <button className="pos-finalize-button" disabled={disabled} onClick={onFinalize}>
                {disabled && !cashRegister ? 'Abra o caixa para vender' : 'Finalizar venda'}
            </button>
        </section>
    )
}
