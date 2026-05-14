import { useEffect, useState } from 'react'
import ActionButton from '@/Components/UI/ActionButton'
import DenseTable from '@/Components/UI/DenseTable'
import StatusBadge from '@/Components/UI/StatusBadge'
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

function DetailMetric({ label, value }) {
    return (
        <article className="conditional-detail-metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </article>
    )
}

function ItemResolveCard({ item, formItem, onPreset, onChange }) {
    return (
        <article className="conditional-item-card compact">
            <div className="conditional-item-card-head">
                <div>
                    <strong>{item.product_name}</strong>
                    <small>{item.product_code || 'Sem SKU'} · Aberto {formatNumber(item.remaining_quantity)}</small>
                </div>
                <div className="conditional-inline-actions compact">
                    <button type="button" className="ui-button-ghost" onClick={() => onPreset(item.id, 'returned_quantity', item.remaining_quantity)}>
                        Volta
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => onPreset(item.id, 'kept_quantity', item.remaining_quantity)}>
                        Fica
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => onPreset(item.id, 'lost_quantity', item.remaining_quantity)}>
                        Perda
                    </button>
                    <button type="button" className="ui-button-ghost" onClick={() => onPreset(item.id, 'damaged_quantity', item.remaining_quantity)}>
                        Avaria
                    </button>
                </div>
            </div>

            <div className="conditional-form-grid cols-4">
                <label className="products-sidebar-field">
                    <span>Volta</span>
                    <input
                        className="products-input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formItem?.returned_quantity || ''}
                        onChange={(event) => onChange(item.id, 'returned_quantity', event.target.value)}
                    />
                </label>
                <label className="products-sidebar-field">
                    <span>Fica</span>
                    <input
                        className="products-input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formItem?.kept_quantity || ''}
                        onChange={(event) => onChange(item.id, 'kept_quantity', event.target.value)}
                    />
                </label>
                <label className="products-sidebar-field">
                    <span>Perda</span>
                    <input
                        className="products-input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formItem?.lost_quantity || ''}
                        onChange={(event) => onChange(item.id, 'lost_quantity', event.target.value)}
                    />
                </label>
                <label className="products-sidebar-field">
                    <span>Avaria</span>
                    <input
                        className="products-input"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formItem?.damaged_quantity || ''}
                        onChange={(event) => onChange(item.id, 'damaged_quantity', event.target.value)}
                    />
                </label>
            </div>
        </article>
    )
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
    embedded = false,
}) {
    const [activePanel, setActivePanel] = useState('overview')

    useEffect(() => {
        setActivePanel('overview')
    }, [conditionalSale?.id, conditionalSale?.status])

    if (!conditionalSale) {
        const emptyState = (
            <div className="conditional-empty" style={{ minHeight: '12rem' }}>
                <i className="fa-solid fa-magnifying-glass" />
                <strong>Sem selecao</strong>
                <span>Escolha uma condicional para abrir o drawer de detalhes.</span>
            </div>
        )

        return embedded ? emptyState : <section className="products-table-card conditional-detail-card">{emptyState}</section>
    }

    const unresolvedItems = conditionalSale.items.filter((item) => Number(item.remaining_quantity) > 0)
    const isClosed = conditionalSale.status === 'closed'
    const panelOptions = isClosed
        ? [{ key: 'overview', label: 'Resumo', icon: 'fa-layer-group' }]
        : [
            { key: 'overview', label: 'Resumo', icon: 'fa-layer-group' },
            { key: 'return', label: 'Devolucao', icon: 'fa-rotate-left' },
            { key: 'finalize', label: 'Fechamento', icon: 'fa-bag-shopping' },
        ]

    const content = (
        <div className="conditional-detail-shell">
            <header className="conditional-detail-header">
                <div className="conditional-detail-identity">
                    <span className="conditional-detail-avatar">{initials(conditionalSale.customer.name)}</span>
                    <div className="conditional-detail-copy">
                        <strong>{conditionalSale.code}</strong>
                        <span>{conditionalSale.customer.name}</span>
                        <small>Operador {conditionalSale.operator_name || 'Nao informado'}</small>
                    </div>
                </div>

                <div className="conditional-inline-actions">
                    <StatusBadge label={conditionalSale.status_label} tone={conditionalSale.status_tone} />
                    {conditionalSale.sale ? <StatusBadge label={`Venda ${conditionalSale.sale.sale_number}`} tone="success" /> : null}
                    {conditionalSale.days_overdue > 0 ? <StatusBadge label={`${conditionalSale.days_overdue}d atraso`} tone="danger" /> : null}
                </div>
            </header>

            <section className="conditional-detail-metrics-grid">
                <DetailMetric label="Retirada" value={formatDateTime(conditionalSale.withdrawn_at)} />
                <DetailMetric label="Prazo" value={formatDate(conditionalSale.due_at)} />
                <DetailMetric label="Em aberto" value={formatMoney(conditionalSale.outstanding_total)} />
                <DetailMetric label="Subtotal" value={formatMoney(conditionalSale.subtotal)} />
                <DetailMetric label="Contato" value={conditionalSale.customer.phone || '-'} />
                <DetailMetric label="Documento" value={conditionalSale.customer.document || '-'} />
                {isClosed ? <DetailMetric label="Cobrado" value={formatMoney(conditionalSale.billed_total)} /> : null}
                {isClosed ? <DetailMetric label="Devolvido" value={formatMoney(conditionalSale.returned_total)} /> : null}
            </section>

            <div className="conditional-detail-tabs" role="tablist" aria-label="Acoes da condicional">
                {panelOptions.map((panel) => (
                    <button
                        key={panel.key}
                        type="button"
                        className={`conditional-detail-tab ${activePanel === panel.key ? 'active' : ''}`}
                        onClick={() => setActivePanel(panel.key)}
                    >
                        <i className={`fa-solid ${panel.icon}`} />
                        <span>{panel.label}</span>
                    </button>
                ))}
            </div>

            {activePanel === 'overview' ? (
                <div className="conditional-detail-panel">
                    <div className="conditional-detail-section-head">
                        <div>
                            <strong>Itens da condicional</strong>
                            <span>{conditionalSale.items.length} item(ns)</span>
                        </div>
                        {conditionalSale.notes ? <StatusBadge label="Com observacao" tone="info" /> : null}
                    </div>

                    <DenseTable
                        columns={[
                            { key: 'product_code', label: 'SKU', render: (item) => item.product_code || '-' },
                            {
                                key: 'product_name',
                                label: 'Item',
                                render: (item) => (
                                    <div className="conditional-row-title">
                                        <strong>{item.product_name}</strong>
                                        <span>{formatMoney(item.unit_price)} unit.</span>
                                    </div>
                                ),
                            },
                            { key: 'quantity_sent', label: 'Saida', render: (item) => formatNumber(item.quantity_sent) },
                            { key: 'quantity_returned', label: 'Volta', render: (item) => formatNumber(item.quantity_returned) },
                            { key: 'remaining_quantity', label: 'Aberto', render: (item) => formatNumber(item.remaining_quantity) },
                        ]}
                        rows={conditionalSale.items}
                        rowKey="id"
                        minWidth={620}
                    />

                    {conditionalSale.notes ? (
                        <article className="conditional-note-card">
                            <span>Observacoes</span>
                            <p>{conditionalSale.notes}</p>
                        </article>
                    ) : null}
                </div>
            ) : null}

            {activePanel === 'return' ? (
                <form className="conditional-detail-panel conditional-detail-form" onSubmit={onReturnSubmit}>
                    <div className="conditional-detail-section-head">
                        <div>
                            <strong>Registrar devolucao</strong>
                            <span>Somente os itens com saldo aparecem abaixo.</span>
                        </div>
                        <StatusBadge label={`${unresolvedItems.length} item(ns)`} tone="warning" />
                    </div>

                    <div className="conditional-form-grid cols-2">
                        <label className="products-sidebar-field">
                            <span>Data e hora</span>
                            <input
                                className="products-input"
                                type="datetime-local"
                                value={returnForm.data.returned_at}
                                onChange={(event) => returnForm.setData('returned_at', event.target.value)}
                            />
                            <FieldError message={returnForm.errors.returned_at} />
                        </label>
                        <label className="products-sidebar-field">
                            <span>Observacoes</span>
                            <input
                                className="products-input"
                                value={returnForm.data.notes}
                                onChange={(event) => returnForm.setData('notes', event.target.value)}
                                placeholder="Motivo ou contexto"
                            />
                            <FieldError message={returnForm.errors.notes} />
                        </label>
                    </div>

                    <div className="conditional-form-grid">
                        {unresolvedItems.length ? unresolvedItems.map((item) => {
                            const formItem = returnForm.data.items.find((entry) => Number(entry.id) === Number(item.id))

                            return (
                                <article key={`return-${item.id}`} className="conditional-item-card compact">
                                    <div className="conditional-item-card-head">
                                        <div>
                                            <strong>{item.product_name}</strong>
                                            <small>{item.product_code || 'Sem SKU'} · Aberto {formatNumber(item.remaining_quantity)}</small>
                                        </div>
                                        <button
                                            type="button"
                                            className="ui-button-ghost"
                                            onClick={() => onReturnAll(item.id, item.remaining_quantity)}
                                        >
                                            Tudo
                                        </button>
                                    </div>
                                    <label className="products-sidebar-field">
                                        <span>Qtd. devolvida</span>
                                        <input
                                            className="products-input"
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={formItem?.returned_quantity || ''}
                                            onChange={(event) => onReturnItemChange(item.id, event.target.value)}
                                        />
                                    </label>
                                </article>
                            )
                        }) : (
                            <div className="conditional-empty conditional-empty-tight">
                                <i className="fa-solid fa-rotate-left" />
                                <strong>Sem saldo aberto</strong>
                            </div>
                        )}
                    </div>

                    <FieldError message={returnForm.errors.items} />
                    <div className="conditional-detail-submit">
                        <ActionButton icon="fa-rotate-left" type="submit" disabled={returnForm.processing}>
                            {returnForm.processing ? 'Salvando...' : 'Registrar devolucao'}
                        </ActionButton>
                    </div>
                </form>
            ) : null}

            {activePanel === 'finalize' ? (
                <form className="conditional-detail-panel conditional-detail-form" onSubmit={onFinalizeSubmit}>
                    <div className="conditional-detail-section-head">
                        <div>
                            <strong>Fechar condicional</strong>
                            <span>Resolva 100% do saldo restante antes de confirmar.</span>
                        </div>
                        <StatusBadge label={formatMoney(finalizePreview)} tone={finalizePreview > 0 ? 'success' : 'warning'} />
                    </div>

                    <div className="conditional-form-grid cols-2">
                        <label className="products-sidebar-field">
                            <span>Data e hora</span>
                            <input
                                className="products-input"
                                type="datetime-local"
                                value={finalizeForm.data.resolved_at}
                                onChange={(event) => finalizeForm.setData('resolved_at', event.target.value)}
                            />
                            <FieldError message={finalizeForm.errors.resolved_at} />
                        </label>
                        <label className="products-sidebar-field">
                            <span>Observacoes</span>
                            <input
                                className="products-input"
                                value={finalizeForm.data.notes}
                                onChange={(event) => finalizeForm.setData('notes', event.target.value)}
                                placeholder="Resumo do fechamento"
                            />
                            <FieldError message={finalizeForm.errors.notes} />
                        </label>
                    </div>

                    <div className="conditional-form-grid">
                        {unresolvedItems.length ? unresolvedItems.map((item) => {
                            const formItem = finalizeForm.data.items.find((entry) => Number(entry.id) === Number(item.id))

                            return (
                                <ItemResolveCard
                                    key={`finalize-${item.id}`}
                                    item={item}
                                    formItem={formItem}
                                    onPreset={onFinalizePreset}
                                    onChange={onFinalizeItemChange}
                                />
                            )
                        }) : (
                            <div className="conditional-empty conditional-empty-tight">
                                <i className="fa-solid fa-bag-shopping" />
                                <strong>Sem saldo restante</strong>
                            </div>
                        )}
                    </div>

                    <FieldError message={finalizeForm.errors.items} />

                    {finalizePreview > 0 ? (
                        <section className="conditional-payment-card">
                            <div className="conditional-detail-section-head">
                                <div>
                                    <strong>Pagamento</strong>
                                    <span>Distribua o total cobrado entre os meios.</span>
                                </div>
                                <button type="button" className="ui-button-ghost" onClick={onAddPayment}>
                                    Parcela
                                </button>
                            </div>

                            <div className="conditional-form-grid">
                                {finalizeForm.data.payments.map((payment, index) => (
                                    <div key={`payment-${index}`} className="conditional-payment-row">
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
                            </div>

                            {hasCashPayment ? (
                                <label className="products-sidebar-field">
                                    <span>Recebido em dinheiro</span>
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
                        </section>
                    ) : null}

                    <div className="conditional-detail-submit">
                        <ActionButton icon="fa-bag-shopping" type="submit" disabled={finalizeForm.processing}>
                            {finalizeForm.processing ? 'Salvando...' : 'Encerrar condicional'}
                        </ActionButton>
                    </div>
                </form>
            ) : null}
        </div>
    )

    if (embedded) {
        return content
    }

    return <section className="products-table-card conditional-detail-card">{content}</section>
}
