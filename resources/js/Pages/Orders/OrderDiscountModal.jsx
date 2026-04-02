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
            title="Desconto"
            size="lg"
            className="orders-modal-action-compact"
            bodyClassName="orders-modal-action-compact-body"
            onClose={onClose}
        >
            <form className="orders-action-compact-form" onSubmit={onApplyDiscount}>
                <div className="orders-action-toggle-grid cols-3">
                    <button
                        type="button"
                        className={`orders-action-toggle ${discountDraft.mode === 'percent' ? 'active' : ''}`}
                        onClick={() => setDiscountDraft((current) => ({ ...current, mode: 'percent' }))}
                        aria-label="Desconto percentual"
                        title="Desconto percentual"
                    >
                        <i className="fa-solid fa-percent" />
                        <span>%</span>
                    </button>
                    <button
                        type="button"
                        className={`orders-action-toggle ${discountDraft.mode === 'target_total' ? 'active' : ''}`}
                        onClick={() => setDiscountDraft((current) => ({ ...current, mode: 'target_total' }))}
                        aria-label="Total final"
                        title="Total final"
                    >
                        <i className="fa-solid fa-bullseye" />
                        <span>Final</span>
                    </button>
                    <button
                        type="button"
                        className={`orders-action-toggle ${discountDraft.mode === 'item' ? 'active' : ''}`}
                        onClick={() => setDiscountDraft((current) => ({ ...current, mode: 'item' }))}
                        aria-label="Desconto por item"
                        title="Desconto por item"
                    >
                        <i className="fa-solid fa-box-open" />
                        <span>Item</span>
                    </button>
                </div>

                {discountDraft.mode === 'percent' ? (
                    <div className="orders-action-field-grid">
                        <label className="orders-action-field wide">
                            <i className="fa-solid fa-percent" />
                            <input
                                className="ui-input"
                                type="number"
                                min="0.01"
                                max="100"
                                step="0.01"
                                value={discountDraft.percent}
                                onChange={(event) => setDiscountDraft((current) => ({ ...current, percent: event.target.value }))}
                                placeholder="Percentual"
                                aria-label="Percentual de desconto"
                            />
                        </label>
                    </div>
                ) : null}

                {discountDraft.mode === 'target_total' ? (
                    <div className="orders-action-field-grid">
                        <label className="orders-action-field wide">
                            <i className="fa-solid fa-money-bill-wave" />
                            <input
                                className="ui-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={discountDraft.targetTotal}
                                onChange={(event) => setDiscountDraft((current) => ({ ...current, targetTotal: event.target.value }))}
                                placeholder="Total final"
                                aria-label="Valor final"
                            />
                        </label>
                    </div>
                ) : null}

                {discountDraft.mode === 'item' ? (
                    <div className="orders-action-field-grid">
                        <label className="orders-action-field wide">
                            <i className="fa-solid fa-box" />
                            <select
                                className="ui-select"
                                value={discountDraft.itemId}
                                onChange={(event) => setDiscountDraft((current) => ({ ...current, itemId: event.target.value }))}
                                aria-label="Item"
                            >
                                {draft.items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="orders-action-toggle-grid cols-2 wide">
                            <button
                                type="button"
                                className={`orders-action-toggle ${discountDraft.itemDiscountType === 'value' ? 'active' : ''}`}
                                onClick={() => setDiscountDraft((current) => ({ ...current, itemDiscountType: 'value' }))}
                                aria-label="Desconto em valor"
                                title="Desconto em valor"
                            >
                                <i className="fa-solid fa-money-bill-wave" />
                                <span>Valor</span>
                            </button>
                            <button
                                type="button"
                                className={`orders-action-toggle ${discountDraft.itemDiscountType === 'percent' ? 'active' : ''}`}
                                onClick={() => setDiscountDraft((current) => ({ ...current, itemDiscountType: 'percent' }))}
                                aria-label="Desconto em percentual"
                                title="Desconto em percentual"
                            >
                                <i className="fa-solid fa-percent" />
                                <span>%</span>
                            </button>
                        </div>

                        {discountDraft.itemDiscountType === 'value' ? (
                            <label className="orders-action-field wide">
                                <i className="fa-solid fa-money-bill-wave" />
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={discountDraft.itemValue}
                                    onChange={(event) => setDiscountDraft((current) => ({ ...current, itemValue: event.target.value }))}
                                    placeholder="Valor"
                                    aria-label="Valor do desconto"
                                />
                            </label>
                        ) : (
                            <label className="orders-action-field wide">
                                <i className="fa-solid fa-percent" />
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={discountDraft.itemPercent}
                                    onChange={(event) => setDiscountDraft((current) => ({ ...current, itemPercent: event.target.value }))}
                                    placeholder="Percentual"
                                    aria-label="Percentual do desconto"
                                />
                            </label>
                        )}
                    </div>
                ) : null}

                <div className="orders-action-metrics">
                    <div className="orders-action-metric" title="Subtotal">
                        <span>Sub</span>
                        <strong>{formatMoney(discountPreview.subtotal)}</strong>
                    </div>
                    <div className="orders-action-metric" title="Desconto">
                        <span>Desc</span>
                        <strong>{formatMoney(discountPreview.discount)}</strong>
                    </div>
                    <div className="orders-action-metric total" title="Total">
                        <span>Total</span>
                        <strong>{formatMoney(discountPreview.total)}</strong>
                    </div>
                </div>

                <div className="orders-action-buttons">
                    <button type="button" className="orders-action-button muted" onClick={onClearDiscount}>
                        <i className="fa-solid fa-broom-wide" />
                        <span>Limpar</span>
                    </button>
                    <button type="submit" className="orders-action-button primary">
                        <i className="fa-solid fa-percent" />
                        <span>Aplicar</span>
                    </button>
                </div>
            </form>
        </OrdersModal>
    )
}
