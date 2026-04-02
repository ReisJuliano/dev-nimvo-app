import { formatMoney } from '@/lib/format'

const discountModes = [
    {
        key: 'percent',
        icon: 'fa-percent',
        title: 'Percentual',
        description: 'Distribui o desconto entre os itens da venda.',
    },
    {
        key: 'target_total',
        icon: 'fa-bullseye',
        title: 'Total desejado',
        description: 'Ajusta a venda para um valor final especifico.',
    },
    {
        key: 'item',
        icon: 'fa-money-bill-wave',
        title: 'Por item',
        description: 'Aplica desconto somente no produto selecionado.',
    },
]

export default function DiscountModal({
    open,
    onClose,
    managers,
    pricing,
    selectedCartItem,
    discountDraft,
    onDraftChange,
    discountPreview,
    authorizationForm,
    onAuthorizationChange,
    onClear,
    onSubmit,
    busy = false,
}) {
    if (!open) {
        return null
    }

    return (
        <div className="pos-quick-customer" onClick={onClose}>
            <form className="pos-quick-customer-card pos-discount-modal-card" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
                <div className="pos-quick-customer-header">
                    <div>
                        <h2>Desconto com autorizacao</h2>
                        <p>Selecione a regra do desconto e valide com a senha de um gerente.</p>
                    </div>
                    <button className="ui-button-ghost" type="button" onClick={onClose}>
                        Fechar
                    </button>
                </div>

                <div className="pos-discount-mode-grid">
                    {discountModes.map((mode) => (
                        <button
                            key={mode.key}
                            type="button"
                            className={`pos-discount-mode ${discountDraft.mode === mode.key ? 'active' : ''}`}
                            onClick={() => onDraftChange('mode', mode.key)}
                        >
                            <i className={`fa-solid ${mode.icon}`} />
                            <strong>{mode.title}</strong>
                            <small>{mode.description}</small>
                        </button>
                    ))}
                </div>

                {discountDraft.mode === 'percent' ? (
                    <label className="pos-discount-form-field">
                        Percentual do desconto
                        <input
                            className="ui-input"
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={discountDraft.percent}
                            onChange={(event) => onDraftChange('percent', event.target.value)}
                        />
                    </label>
                ) : null}

                {discountDraft.mode === 'target_total' ? (
                    <label className="pos-discount-form-field">
                        Total desejado da venda
                        <input
                            className="ui-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountDraft.targetTotal}
                            onChange={(event) => onDraftChange('targetTotal', event.target.value)}
                        />
                    </label>
                ) : null}

                {discountDraft.mode === 'item' ? (
                    <div className="pos-discount-item-grid">
                        <label className="pos-discount-form-field">
                            Produto
                            <select
                                className="ui-select"
                                value={discountDraft.itemId}
                                onChange={(event) => onDraftChange('itemId', event.target.value)}
                            >
                                {pricing.items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} - {formatMoney(item.lineSubtotal)}
                                    </option>
                                ))}
                            </select>
                            {selectedCartItem ? <small>Item em foco: {selectedCartItem.name}</small> : null}
                        </label>

                        <div className="pos-discount-type-toggle">
                            <button
                                type="button"
                                className={discountDraft.itemDiscountType === 'value' ? 'active' : ''}
                                onClick={() => onDraftChange('itemDiscountType', 'value')}
                            >
                                Valor
                            </button>
                            <button
                                type="button"
                                className={discountDraft.itemDiscountType === 'percent' ? 'active' : ''}
                                onClick={() => onDraftChange('itemDiscountType', 'percent')}
                            >
                                Percentual
                            </button>
                        </div>

                        {discountDraft.itemDiscountType === 'value' ? (
                            <label className="pos-discount-form-field">
                                Valor do desconto no item
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={discountDraft.itemValue}
                                    onChange={(event) => onDraftChange('itemValue', event.target.value)}
                                />
                            </label>
                        ) : (
                            <label className="pos-discount-form-field">
                                Percentual no item
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={discountDraft.itemPercent}
                                    onChange={(event) => onDraftChange('itemPercent', event.target.value)}
                                />
                            </label>
                        )}
                    </div>
                ) : null}

                <div className="pos-discount-preview">
                    <div>
                        <span>Subtotal atual</span>
                        <strong>{formatMoney(pricing.subtotal)}</strong>
                    </div>
                    <div>
                        <span>Desconto atual</span>
                        <strong>{formatMoney(pricing.discount)}</strong>
                    </div>
                    <div>
                        <span>Total atual</span>
                        <strong>{formatMoney(pricing.total)}</strong>
                    </div>
                    <div>
                        <span>Desconto apos aplicar</span>
                        <strong>{formatMoney(discountPreview.discount)}</strong>
                    </div>
                    <div>
                        <span>Total apos aplicar</span>
                        <strong>{formatMoney(discountPreview.total)}</strong>
                    </div>
                </div>

                <div className="pos-discount-authorization-grid">
                    <label className="pos-discount-form-field">
                        Gerente responsavel
                        <select
                            className="ui-select"
                            value={authorizationForm.authorizer_user_id}
                            onChange={(event) => onAuthorizationChange('authorizer_user_id', event.target.value)}
                        >
                            <option value="">Selecione</option>
                            {managers.map((manager) => (
                                <option key={manager.id} value={manager.id}>
                                    {manager.name} ({manager.role})
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="pos-discount-form-field">
                        Senha gerencial
                        <input
                            className="ui-input"
                            type="password"
                            value={authorizationForm.authorizer_password}
                            onChange={(event) => onAuthorizationChange('authorizer_password', event.target.value)}
                            placeholder="Informe a senha do gerente"
                        />
                    </label>
                </div>

                <div className="pos-quick-customer-actions">
                    <button className="ui-button-ghost" type="button" onClick={onClear}>
                        Remover desconto
                    </button>
                    <button className="pos-finalize-button" type="submit" disabled={busy}>
                        <i className="fa-solid fa-lock" />
                        {busy ? 'Autorizando...' : 'Autorizar e aplicar'}
                    </button>
                </div>
            </form>
        </div>
    )
}
