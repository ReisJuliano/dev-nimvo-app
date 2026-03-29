import { formatDateTime, formatMoney } from '@/lib/format'

const paymentOptions = [
    { value: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave', tone: 'success' },
    { value: 'pix', label: 'Pix', icon: 'fa-qrcode', tone: 'info' },
    { value: 'debit_card', label: 'Debito', icon: 'fa-credit-card', tone: 'primary' },
    { value: 'credit_card', label: 'Credito', icon: 'fa-credit-card', tone: 'primary' },
    { value: 'credit', label: 'Crediario', icon: 'fa-handshake', tone: 'warning' },
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
    openingCashRegister,
    loadingClosePreview,
    closingCashRegister,
    onOpenCashRegister,
    onOpenCloseCashRegister,
    disabled,
    onFinalize,
    cashRegister,
}) {
    return (
        <section className="pos-card checkout">
            <div className="pos-cash-register-box">
                <div className="pos-cash-register-copy">
                    <span className={`ui-badge ${cashRegister ? 'success' : 'warning'}`}>
                        {cashRegister ? 'Caixa aberto' : 'Caixa fechado'}
                    </span>
                    <strong>{cashRegister ? 'Caixa pronto para vender' : 'Abra o caixa antes de finalizar vendas'}</strong>
                    <small>
                        {cashRegister
                            ? `Aberto em ${formatDateTime(cashRegister.opened_at)}`
                            : 'Informe um valor inicial para iniciar a operacao no PDV.'}
                    </small>
                </div>

                {cashRegister ? (
                    <div className="pos-cash-register-actions">
                        <div className="pos-cash-register-status">
                            <span>Fechamento guiado</span>
                            <strong>Conferencia por forma de pagamento</strong>
                        </div>
                        <button
                            type="button"
                            className="pos-cash-register-button danger"
                            onClick={onOpenCloseCashRegister}
                            disabled={loadingClosePreview || closingCashRegister}
                        >
                            <i className="fa-solid fa-lock" />
                            {loadingClosePreview ? 'Carregando conferencia...' : 'Conferir e fechar caixa'}
                        </button>
                    </div>
                ) : (
                    <form className="pos-cash-register-form" onSubmit={onOpenCashRegister}>
                        <label>
                            Valor de abertura
                            <input className="ui-input" name="opening_amount" type="number" step="0.01" min="0" defaultValue="0" />
                        </label>
                        <label>
                            Observacao
                            <input className="ui-input" name="opening_notes" placeholder="Observacao da abertura" />
                        </label>
                        <button type="submit" className="pos-cash-register-button" disabled={openingCashRegister}>
                            <i className="fa-solid fa-lock-open" />
                            {openingCashRegister ? 'Abrindo...' : 'Abrir caixa'}
                        </button>
                    </form>
                )}
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

                <div className="pos-discount-field">
                    <div className="pos-discount-copy">
                        <label htmlFor="checkout-discount">Desconto</label>
                        <small>Abate direto no total</small>
                    </div>

                    <div className="pos-discount-input-wrap">
                        <span>R$</span>
                        <input
                            id="checkout-discount"
                            className="ui-input pos-discount-input"
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={discount}
                            onChange={(event) => onDiscountChange(event.target.value)}
                        />
                    </div>
                </div>

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
