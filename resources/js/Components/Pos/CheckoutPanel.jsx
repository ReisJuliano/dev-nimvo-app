import { formatMoney } from '@/lib/format'

const paymentOptions = [
    { value: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave', tone: 'success' },
    { value: 'pix', label: 'Pix', icon: 'fa-qrcode', tone: 'info' },
    { value: 'debit_card', label: 'Debito', icon: 'fa-credit-card', tone: 'primary' },
    { value: 'credit_card', label: 'Credito', icon: 'fa-credit-card', tone: 'primary' },
    { value: 'credit', label: 'Fiado', icon: 'fa-handshake', tone: 'warning' },
    { value: 'mixed', label: 'Misto', icon: 'fa-layer-group', tone: 'danger' },
]

const paymentLabels = Object.fromEntries(paymentOptions.map((option) => [option.value, option.label]))

export default function CheckoutPanel({
    selectedCustomer,
    selectedCustomerData,
    onOpenCustomerPicker,
    onClearCustomer,
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
                    <p>{cashRegister ? 'Caixa aberto' : 'Abra o caixa para vender'}</p>
                </div>
                {cashRegister ? (
                    <div className="pos-register-chip">
                        <span>Caixa ativo</span>
                        <strong>{formatMoney(cashRegister.opening_amount)}</strong>
                    </div>
                ) : null}
            </div>

            <div className="pos-checkout-grid">
                <div className="pos-customer-field span-2">
                    <div className="pos-customer-field-header">
                        <div>
                            <label>Cliente</label>
                            <small>{selectedCustomer ? 'Venda vinculada a um cadastro' : 'Cliente nao identificado'}</small>
                        </div>

                        {selectedCustomer ? (
                            <button type="button" className="pos-customer-clear" onClick={onClearCustomer}>
                                Remover
                            </button>
                        ) : null}
                    </div>

                    <div className="pos-customer-row">
                        <button
                            type="button"
                            className={`pos-customer-trigger ${selectedCustomerData ? 'selected' : ''}`}
                            onClick={onOpenCustomerPicker}
                        >
                            <span className="pos-customer-trigger-icon">
                                <i className={`fa-solid ${selectedCustomerData ? 'fa-id-card' : 'fa-user-plus'}`} aria-hidden="true" />
                            </span>
                            <span className="pos-customer-trigger-copy">
                                <strong>{selectedCustomerData?.name ?? 'Nao identificado'}</strong>
                                <small>
                                    {selectedCustomerData?.phone
                                        ? selectedCustomerData.phone
                                        : selectedCustomerData
                                            ? 'Cliente selecionado para esta venda'
                                            : 'Adicione um cliente a esta venda'}
                                </small>
                            </span>
                            <span className="pos-customer-trigger-action">
                                <i className={`fa-solid ${selectedCustomerData ? 'fa-pen' : 'fa-magnifying-glass'}`} />
                                {selectedCustomerData ? 'Trocar cliente' : 'Adicionar cliente'}
                            </span>
                        </button>

                        <button
                            type="button"
                            className="pos-inline-button pos-customer-action ui-tooltip"
                            data-tooltip="Cadastrar cliente rapido"
                            onClick={onQuickCustomer}
                        >
                            <i className="fa-solid fa-user-plus" />
                            Novo cliente
                        </button>
                    </div>
                </div>

                <div className="pos-payment-tabs-field">
                    <span>Pagamento</span>
                    <div className="ui-tabs pos-payment-tabs">
                        {paymentOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`ui-tab ${paymentMethod === option.value ? 'active' : ''}`}
                                onClick={() => onPaymentChange(option.value)}
                            >
                                <i className={`fa-solid ${option.icon}`} />
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <label>
                    Desconto
                    <input className="ui-input" type="number" step="0.01" value={discount} onChange={(event) => onDiscountChange(event.target.value)} />
                </label>

                <label className="span-2">
                    Observacoes
                    <textarea className="ui-textarea" rows="3" value={notes} onChange={(event) => onNotesChange(event.target.value)} />
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
                            placeholder="Valor"
                            value={mixedDraft.amount}
                            onChange={(event) => onMixedDraftChange('amount', event.target.value)}
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
                <i className="fa-solid fa-check" />
                {disabled && !cashRegister ? 'Abra o caixa para vender' : 'Finalizar venda'}
            </button>
        </section>
    )
}
