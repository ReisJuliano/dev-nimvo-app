import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'

function initials(name) {
    return String(name || 'C')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'C'
}

function FieldError({ message }) {
    if (!message) {
        return null
    }

    return <span className="conditional-error">{message}</span>
}

function InfoTile({ label, value }) {
    return (
        <div className="products-field-group">
            <span className="products-summary-kicker">{label}</span>
            <strong style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.92rem', color: 'var(--app-text-primary)' }}>{value}</strong>
        </div>
    )
}

function StatusBadge({ label, tone }) {
    const cls = tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'warning'

    return <span className={`ui-badge ${cls}`}>{label}</span>
}

export default function ConditionalSaleDetailCard({
    conditionalSale,
    returnForm,
    finalizeForm,
    finalizePreview,
    paymentMethods,
    hasCashPayment,
    onReturnSubmit,
    onFinalizeSubmit,
    onReturnItemChange,
    onFinalizeItemChange,
    onReturnAll,
    onFinalizePreset,
    onAddPayment,
    onRemovePayment,
    onPaymentChange,
}) {
    if (!conditionalSale) {
        return (
            <section className="products-table-card conditional-detail-card">
                <div className="conditional-empty" style={{ minHeight: '14rem' }}>
                    <i className="fa-solid fa-magnifying-glass" />
                    <strong>Sem selecao</strong>
                    <span>Escolha uma condicional na lista ao lado.</span>
                </div>
            </section>
        )
    }

    const unresolvedItems = conditionalSale.items.filter((item) => Number(item.remaining_quantity) > 0)

    return (
        <section className="products-table-card conditional-detail-card">
            <div className="products-table-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span className="data-list-icon" aria-hidden>{initials(conditionalSale.customer.name)}</span>
                    <div>
                        <h2>{conditionalSale.code}</h2>
                        <p>{conditionalSale.customer.name}</p>
                    </div>
                </div>
                <div className="conditional-inline-actions">
                    <StatusBadge label={conditionalSale.status_label} tone={conditionalSale.status_tone} />
                    {conditionalSale.sale ? (
                        <span className="ui-badge success">{conditionalSale.sale.sale_number}</span>
                    ) : null}
                </div>
            </div>

            <div className="products-table-scroll" style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                <div className="conditional-form-grid cols-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                    <InfoTile label="Retirada" value={formatDateTime(conditionalSale.withdrawn_at)} />
                    <InfoTile label="Prazo" value={formatDate(conditionalSale.due_at)} />
                    <InfoTile label="Aberto" value={formatMoney(conditionalSale.outstanding_total)} />
                    <InfoTile label="Contato" value={conditionalSale.customer.phone || '-'} />
                </div>

                <div className="conditional-subcard">
                    <div className="conditional-subcard-header">
                        <strong>Itens</strong>
                    </div>
                    <div className="conditional-subcard-body">
                        <div className="conditional-table-wrap">
                            <table className="conditional-table">
                                <thead>
                                    <tr>
                                        <th>SKU</th>
                                        <th>Item</th>
                                        <th>Saida</th>
                                        <th>Volta</th>
                                        <th>Aberto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {conditionalSale.items.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.product_code}</td>
                                            <td>{item.product_name}</td>
                                            <td>{formatNumber(item.quantity_sent)}</td>
                                            <td>{formatNumber(item.quantity_returned)}</td>
                                            <td>{formatNumber(item.remaining_quantity)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {conditionalSale.status === 'closed' ? (
                    <div className="conditional-form-grid cols-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                        <InfoTile label="Subtotal" value={formatMoney(conditionalSale.subtotal)} />
                        <InfoTile label="Cobrado" value={formatMoney(conditionalSale.billed_total)} />
                        <InfoTile label="Devolvido" value={formatMoney(conditionalSale.returned_total)} />
                    </div>
                ) : (
                    <div className="conditional-form-grid cols-2" style={{ alignItems: 'stretch' }}>
                        <div className="conditional-subcard">
                            <div className="conditional-subcard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>
                                    <i className="fa-solid fa-rotate-left" style={{ marginRight: '0.45rem' }} />
                                    Devolucao
                                </strong>
                                <span className="ui-badge warning">Parcial</span>
                            </div>
                            <div className="conditional-subcard-body">
                                <form className="conditional-form-grid" onSubmit={onReturnSubmit}>
                                    <input
                                        className="products-input"
                                        type="datetime-local"
                                        value={returnForm.data.returned_at}
                                        onChange={(event) => returnForm.setData('returned_at', event.target.value)}
                                    />
                                    <FieldError message={returnForm.errors.returned_at} />

                                    <div className="conditional-form-grid">
                                        {unresolvedItems.length ? unresolvedItems.map((item) => {
                                            const formItem = returnForm.data.items.find((entry) => Number(entry.id) === Number(item.id))

                                            return (
                                                <div key={`return-${item.id}`} className="conditional-item-card">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                        <div>
                                                            <strong style={{ fontSize: '0.9rem' }}>{item.product_name}</strong>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginTop: '0.2rem' }}>
                                                                Aberto {formatNumber(item.remaining_quantity)}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="ui-button-ghost"
                                                            aria-label="Devolver tudo"
                                                            onClick={() => onReturnAll(item.id, item.remaining_quantity)}
                                                        >
                                                            <i className="fa-solid fa-check" />
                                                        </button>
                                                    </div>
                                                    <input
                                                        className="products-input"
                                                        style={{ marginTop: '0.65rem' }}
                                                        type="number"
                                                        min="0"
                                                        step="0.001"
                                                        value={formItem?.returned_quantity || ''}
                                                        onChange={(event) => onReturnItemChange(item.id, event.target.value)}
                                                    />
                                                </div>
                                            )
                                        }) : (
                                            <div className="conditional-empty" style={{ minHeight: '8rem' }}>
                                                <i className="fa-solid fa-rotate-left" />
                                                <strong>Sem saldo</strong>
                                            </div>
                                        )}
                                    </div>

                                    <FieldError message={returnForm.errors.items} />
                                    <button className="ui-button-secondary" type="submit" disabled={returnForm.processing}>
                                        {returnForm.processing ? 'Salvando...' : 'Registrar devolucao'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="conditional-subcard">
                            <div className="conditional-subcard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong>
                                    <i className="fa-solid fa-bag-shopping" style={{ marginRight: '0.45rem' }} />
                                    Fechamento
                                </strong>
                                <span className={`ui-badge ${finalizePreview > 0 ? 'success' : 'warning'}`}>{formatMoney(finalizePreview)}</span>
                            </div>
                            <div className="conditional-subcard-body">
                                <form className="conditional-form-grid" onSubmit={onFinalizeSubmit}>
                                    <div className="conditional-form-grid cols-2">
                                        <input
                                            className="products-input"
                                            type="datetime-local"
                                            value={finalizeForm.data.resolved_at}
                                            onChange={(event) => finalizeForm.setData('resolved_at', event.target.value)}
                                        />
                                        <input
                                            className="products-input"
                                            readOnly
                                            value={conditionalSale.customer.document || '-'}
                                            aria-label="Documento do cliente"
                                        />
                                    </div>
                                    <FieldError message={finalizeForm.errors.resolved_at} />

                                    <div className="conditional-form-grid">
                                        {unresolvedItems.map((item) => {
                                            const formItem = finalizeForm.data.items.find((entry) => Number(entry.id) === Number(item.id))

                                            return (
                                                <div key={`finalize-${item.id}`} className="conditional-item-card">
                                                    <div style={{ marginBottom: '0.65rem' }}>
                                                        <strong style={{ fontSize: '0.9rem' }}>{item.product_name}</strong>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--app-text-muted)', marginTop: '0.2rem' }}>
                                                            Aberto {formatNumber(item.remaining_quantity)}
                                                        </div>
                                                    </div>
                                                    <div className="conditional-inline-actions" style={{ marginBottom: '0.65rem' }}>
                                                        <button type="button" className="ui-button-ghost" onClick={() => onFinalizePreset(item.id, 'returned_quantity', item.remaining_quantity)}>
                                                            Volta
                                                        </button>
                                                        <button type="button" className="ui-button-ghost" onClick={() => onFinalizePreset(item.id, 'kept_quantity', item.remaining_quantity)}>
                                                            Fica
                                                        </button>
                                                        <button type="button" className="ui-button-ghost" onClick={() => onFinalizePreset(item.id, 'lost_quantity', item.remaining_quantity)}>
                                                            Perda
                                                        </button>
                                                        <button type="button" className="ui-button-ghost" onClick={() => onFinalizePreset(item.id, 'damaged_quantity', item.remaining_quantity)}>
                                                            Avaria
                                                        </button>
                                                    </div>

                                                    <div className="conditional-form-grid cols-2">
                                                        <input
                                                            className="products-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            placeholder="Volta"
                                                            value={formItem?.returned_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'returned_quantity', event.target.value)}
                                                        />
                                                        <input
                                                            className="products-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            placeholder="Fica"
                                                            value={formItem?.kept_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'kept_quantity', event.target.value)}
                                                        />
                                                        <input
                                                            className="products-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            placeholder="Perda"
                                                            value={formItem?.lost_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'lost_quantity', event.target.value)}
                                                        />
                                                        <input
                                                            className="products-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            placeholder="Avaria"
                                                            value={formItem?.damaged_quantity || ''}
                                                            onChange={(event) => onFinalizeItemChange(item.id, 'damaged_quantity', event.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <FieldError message={finalizeForm.errors.items} />

                                    {finalizePreview > 0 ? (
                                        <div className="conditional-subcard">
                                            <div className="conditional-subcard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <strong>
                                                    <i className="fa-solid fa-credit-card" style={{ marginRight: '0.45rem' }} />
                                                    Pagamento
                                                </strong>
                                                <button type="button" className="ui-button-ghost" onClick={onAddPayment}>
                                                    Parcela
                                                </button>
                                            </div>
                                            <div className="conditional-subcard-body">
                                                {finalizeForm.data.payments.map((payment, index) => (
                                                    <div
                                                        key={`payment-${index}`}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr auto',
                                                            gap: '0.65rem',
                                                            marginBottom: '0.65rem',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <select
                                                            className="products-input"
                                                            value={payment.method}
                                                            onChange={(event) => onPaymentChange(index, 'method', event.target.value)}
                                                        >
                                                            {paymentMethods.map((method) => (
                                                                <option key={method.value} value={method.value}>
                                                                    {method.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            className="products-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={payment.amount}
                                                            onChange={(event) => onPaymentChange(index, 'amount', event.target.value)}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="ui-button-danger"
                                                            disabled={finalizeForm.data.payments.length === 1}
                                                            aria-label="Remover parcela"
                                                            onClick={() => onRemovePayment(index)}
                                                        >
                                                            <i className="fa-solid fa-xmark" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {hasCashPayment ? (
                                                    <label className="products-sidebar-field">
                                                        <span>Recebido (dinheiro)</span>
                                                        <input
                                                            className="products-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={finalizeForm.data.cash_received}
                                                            onChange={(event) => finalizeForm.setData('cash_received', event.target.value)}
                                                        />
                                                    </label>
                                                ) : null}
                                                <FieldError message={finalizeForm.errors.payments} />
                                                <FieldError message={finalizeForm.errors.cash_received} />
                                            </div>
                                        </div>
                                    ) : null}

                                    <input
                                        className="products-input"
                                        value={finalizeForm.data.notes}
                                        onChange={(event) => finalizeForm.setData('notes', event.target.value)}
                                        placeholder="Observacoes"
                                    />

                                    <button className="ui-button" type="submit" disabled={finalizeForm.processing}>
                                        {finalizeForm.processing ? 'Salvando...' : 'Encerrar condicional'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
