import { useMemo, useState } from 'react'
import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'
import { cardPaymentOptions, paymentTabs, resolvePricing, roundCurrency } from './orderUtils'

function buildSelectionFromDraft(draft) {
    return Object.fromEntries(
        (draft?.items || []).map((item) => [
            String(item.id),
            {
                checked: false,
                qty: String(item.qty ?? 1),
            },
        ]),
    )
}

export default function OrderPartialCheckoutModal({
    draft,
    feedback,
    selectedCustomer,
    discountConfig,
    creditStatus,
    submittingCheckout,
    onClose,
    onConfirm,
}) {
    const [selection, setSelection] = useState(() => buildSelectionFromDraft(draft))
    const [paymentTab, setPaymentTab] = useState('cash')
    const [cardType, setCardType] = useState('credit_card')
    const [cashReceived, setCashReceived] = useState('')

    const selectedItems = useMemo(() => {
        if (!draft?.items?.length) {
            return []
        }

        return draft.items
            .map((item) => {
                const entry = selection[String(item.id)]
                if (!entry?.checked) {
                    return null
                }

                const qty = entry.qty === '' ? 0 : Number(entry.qty)
                if (!Number.isFinite(qty) || qty <= 0) {
                    return null
                }

                return { ...item, qty: Math.min(Number(item.qty), qty) }
            })
            .filter(Boolean)
    }, [draft, selection])

    const selectedItemForDiscount = selectedItems[0] ?? null
    const pricing = useMemo(() => {
        if (!selectedItems.length) {
            return resolvePricing([], { type: 'none' }, null)
        }

        const normalizedDiscountConfig =
            discountConfig?.type === 'item'
                ? selectedItems.some((item) => String(item.id) === String(discountConfig.itemId))
                    ? discountConfig
                    : { type: 'none' }
                : (discountConfig ?? { type: 'none' })

        return resolvePricing(selectedItems, normalizedDiscountConfig, selectedItemForDiscount)
    }, [selectedItems, discountConfig, selectedItemForDiscount])

    const resolvedPaymentMethod = paymentTab === 'card' ? cardType : paymentTab
    const cashReceivedAmount = useMemo(
        () => (cashReceived === '' ? 0 : roundCurrency(cashReceived)),
        [cashReceived],
    )
    const cashChange = useMemo(
        () => Math.max(0, roundCurrency(cashReceivedAmount - pricing.total)),
        [cashReceivedAmount, pricing.total],
    )
    const cashShortfall = useMemo(
        () => (cashReceived === '' ? 0 : Math.max(0, roundCurrency(pricing.total - cashReceivedAmount))),
        [cashReceived, cashReceivedAmount, pricing.total],
    )

    function updateSelection(productId, updater) {
        setSelection((current) => ({
            ...current,
            [String(productId)]: updater(current[String(productId)] ?? { checked: false, qty: '1' }),
        }))
    }

    function handleConfirm() {
        onConfirm({
            resolvedPaymentMethod,
            cashReceived,
            cashShortfall,
            pricing,
            items: pricing.items,
        })
    }

    if (!draft) {
        return null
    }

    return (
        <OrdersModal
            title="Pagamento parcial"
            subtitle="Selecione os itens que a pessoa vai pagar. O restante permanece no atendimento."
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
                        <strong>{formatNumber(selectedItems.length)}</strong>
                        <small>
                            {formatNumber(selectedItems.reduce((accumulator, item) => accumulator + Number(item.qty), 0))} unidade(s)
                        </small>
                    </div>
                    <div className="highlight">
                        <span>Total</span>
                        <strong>{formatMoney(pricing.total)}</strong>
                        <small>{pricing.discount > 0 ? `Inclui ${formatMoney(pricing.discount)} de desconto` : 'Sem desconto aplicado'}</small>
                    </div>
                </div>

                <section className="orders-partial-items">
                    {draft.items.length ? (
                        draft.items.map((item) => {
                            const entry = selection[String(item.id)] ?? { checked: false, qty: String(item.qty ?? 1) }
                            return (
                                <div key={item.id} className="orders-partial-row">
                                    <label className="orders-partial-check">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(entry.checked)}
                                            onChange={(event) => updateSelection(item.id, (current) => ({ ...current, checked: event.target.checked }))}
                                        />
                                        <div>
                                            <strong>{item.name}</strong>
                                            <small>{formatMoney(Number(item.sale_price || 0))} unidade</small>
                                        </div>
                                    </label>

                                    <label className="orders-partial-qty">
                                        <span>Qtd</span>
                                        <input
                                            className="ui-input"
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={entry.qty}
                                            onChange={(event) => updateSelection(item.id, (current) => ({ ...current, qty: event.target.value }))}
                                            disabled={!entry.checked}
                                        />
                                        <small>Max {formatNumber(item.qty)}</small>
                                    </label>
                                </div>
                            )
                        })
                    ) : (
                        <div className="orders-inline-empty wide">
                            <i className="fa-solid fa-receipt" />
                            <div>
                                <strong>Sem itens para cobrar</strong>
                                <p>Adicione produtos no atendimento antes de fazer o pagamento parcial.</p>
                            </div>
                        </div>
                    )}
                </section>

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
                            <button
                                key={option.key}
                                type="button"
                                className={cardType === option.key ? 'active' : ''}
                                onClick={() => setCardType(option.key)}
                            >
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
                        <i className="fa-solid fa-arrow-left" />
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="ui-button"
                        onClick={handleConfirm}
                        disabled={submittingCheckout || pricing.total <= 0 || !selectedItems.length}
                    >
                        <i className="fa-solid fa-check" />
                        {submittingCheckout ? 'Confirmando...' : `Confirmar ${resolvedPaymentMethod === 'cash' ? '' : ''}`}
                    </button>
                </div>
            </div>
        </OrdersModal>
    )
}

