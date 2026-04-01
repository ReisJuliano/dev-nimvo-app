import { formatMoney } from '@/lib/format'
import OrdersModal from './OrdersModal'

export default function OrderDiscountModal({
    draft,
    discountDraft,
    setDiscountDraft,
    discountPreview,
    onClose,
    onClearDiscount,
    onApplyDiscount,
}) {
    if (!draft) {
        return null
    }

    return (
        <OrdersModal
            title="Aplicar Desconto"
            subtitle="Use o mesmo calculo do checkout sem sair desta tela."
            size="lg"
            onClose={onClose}
        >
            <form className="orders-modal-stack" onSubmit={onApplyDiscount}>
                <div className="orders-discount-mode-grid">
                    <button
                        type="button"
                        className={`orders-discount-mode ${discountDraft.mode === 'percent' ? 'active' : ''}`}
                        onClick={() => setDiscountDraft((current) => ({ ...current, mode: 'percent' }))}
                    >
                        <strong>Percentual</strong>
                        <small>Desconto em todo o atendimento</small>
                    </button>
                    <button
                        type="button"
                        className={`orders-discount-mode ${discountDraft.mode === 'target_total' ? 'active' : ''}`}
                        onClick={() => setDiscountDraft((current) => ({ ...current, mode: 'target_total' }))}
                    >
                        <strong>Total final</strong>
                        <small>Define quanto o atendimento deve custar</small>
                    </button>
                    <button
                        type="button"
                        className={`orders-discount-mode ${discountDraft.mode === 'item' ? 'active' : ''}`}
                        onClick={() => setDiscountDraft((current) => ({ ...current, mode: 'item' }))}
                    >
                        <strong>Por item</strong>
                        <small>Aplica so no produto selecionado</small>
                    </button>
                </div>

                {discountDraft.mode === 'percent' ? (
                    <label className="orders-form-field">
                        <span>Percentual de desconto</span>
                        <input
                            className="ui-input"
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={discountDraft.percent}
                            onChange={(event) => setDiscountDraft((current) => ({ ...current, percent: event.target.value }))}
                        />
                    </label>
                ) : null}

                {discountDraft.mode === 'target_total' ? (
                    <label className="orders-form-field">
                        <span>Valor final desejado</span>
                        <input
                            className="ui-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountDraft.targetTotal}
                            onChange={(event) => setDiscountDraft((current) => ({ ...current, targetTotal: event.target.value }))}
                        />
                    </label>
                ) : null}

                {discountDraft.mode === 'item' ? (
                    <div className="orders-form-grid">
                        <label className="orders-form-field span-2">
                            <span>Item do atendimento</span>
                            <select
                                className="ui-select"
                                value={discountDraft.itemId}
                                onChange={(event) => setDiscountDraft((current) => ({ ...current, itemId: event.target.value }))}
                            >
                                {draft.items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="orders-card-toggle span-2">
                            <button
                                type="button"
                                className={discountDraft.itemDiscountType === 'value' ? 'active' : ''}
                                onClick={() => setDiscountDraft((current) => ({ ...current, itemDiscountType: 'value' }))}
                            >
                                Valor
                            </button>
                            <button
                                type="button"
                                className={discountDraft.itemDiscountType === 'percent' ? 'active' : ''}
                                onClick={() => setDiscountDraft((current) => ({ ...current, itemDiscountType: 'percent' }))}
                            >
                                Percentual
                            </button>
                        </div>

                        {discountDraft.itemDiscountType === 'value' ? (
                            <label className="orders-form-field span-2">
                                <span>Valor do desconto no item</span>
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={discountDraft.itemValue}
                                    onChange={(event) => setDiscountDraft((current) => ({ ...current, itemValue: event.target.value }))}
                                />
                            </label>
                        ) : (
                            <label className="orders-form-field span-2">
                                <span>Percentual de desconto no item</span>
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={discountDraft.itemPercent}
                                    onChange={(event) => setDiscountDraft((current) => ({ ...current, itemPercent: event.target.value }))}
                                />
                            </label>
                        )}
                    </div>
                ) : null}

                <div className="orders-summary-box preview">
                    <div>
                        <span>Subtotal</span>
                        <strong>{formatMoney(discountPreview.subtotal)}</strong>
                    </div>
                    <div>
                        <span>Desconto</span>
                        <strong>{formatMoney(discountPreview.discount)}</strong>
                    </div>
                    <div className="total">
                        <span>Total final</span>
                        <strong>{formatMoney(discountPreview.total)}</strong>
                    </div>
                </div>

                <div className="orders-modal-actions">
                    <button type="button" className="ui-button-ghost" onClick={onClearDiscount}>
                        <i className="fa-solid fa-broom-wide" />
                        Remover desconto
                    </button>
                    <button type="submit" className="ui-button-secondary">
                        <i className="fa-solid fa-badge-percent" />
                        Aplicar desconto
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}
