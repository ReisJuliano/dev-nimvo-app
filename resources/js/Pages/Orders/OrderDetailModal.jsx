import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'
import { formatElapsedTime, getDraftNumberLabel, getOrderTypeLabel } from './orderUtils'

export default function OrderDetailModal({
    draft,
    customers,
    feedback,
    selectedCustomer,
    selectedItem,
    selectedItemId,
    setSelectedItemId,
    pricing,
    currentDraftStatus,
    currentDraftSaveText,
    clock,
    printingDraft,
    sendingDraft,
    deletingDraft,
    onClose,
    onOpenProductsModal,
    onOpenQuantityModal,
    onOpenTransferModal,
    onOpenDiscountModal,
    onOpenCheckoutModal,
    onOpenDeliveryModal,
    onPrintDraft,
    onSendToCashier,
    onDeleteDraft,
    onQuantityChange,
    onRemoveItem,
    onCustomerChange,
}) {
    if (!draft) {
        return null
    }

    const sentToCashier = draft.status === 'sent_to_cashier'
    const elapsedLabel = formatElapsedTime(draft.updatedAt, clock)
    const detailCards = [
        { icon: 'fa-layer-group', label: 'Tipo', value: getOrderTypeLabel(draft.type) },
        { icon: 'fa-hashtag', label: 'Numero', value: getDraftNumberLabel(draft) },
        { icon: 'fa-user', label: 'Cliente', value: selectedCustomer?.name || 'Nao identificado' },
        { icon: 'fa-clock', label: 'Atualizacao', value: elapsedLabel },
    ]
    const sidebarActions = [
        { key: 'products', label: 'Produtos', icon: 'fa-box-open', onClick: onOpenProductsModal },
        { key: 'quantity', label: 'Quantidade', icon: 'fa-arrows-up-down', onClick: onOpenQuantityModal, disabled: !selectedItem },
        { key: 'discount', label: 'Desconto', icon: 'fa-badge-percent', onClick: onOpenDiscountModal, disabled: !draft.items.length },
        { key: 'delivery', label: 'Entrega', icon: 'fa-motorcycle', onClick: onOpenDeliveryModal },
        { key: 'edit', label: 'Editar', icon: 'fa-pen', onClick: onOpenTransferModal },
        { key: 'print', label: printingDraft ? 'Imprimindo' : 'Imprimir', icon: 'fa-print', onClick: onPrintDraft, disabled: printingDraft },
        {
            key: 'cashier',
            label: sendingDraft ? 'Enviando' : sentToCashier ? 'No caixa' : 'Caixa',
            icon: 'fa-cash-register',
            onClick: onSendToCashier,
            disabled: sendingDraft || !draft.items.length || sentToCashier,
        },
        { key: 'delete', label: deletingDraft ? 'Excluindo' : 'Excluir', icon: 'fa-trash-can', onClick: onDeleteDraft, tone: 'danger', disabled: deletingDraft },
    ]

    return (
        <OrdersModal
            title={draft.label}
            subtitle={currentDraftSaveText}
            size="xl"
            className="orders-modal-detail-terminal"
            bodyClassName="orders-modal-detail-terminal-body"
            badge={<span className="orders-modal-badge orders-modal-badge-status">{currentDraftStatus?.label || 'Em aberto'}</span>}
            onClose={onClose}
        >
            <div className="orders-detail-terminal">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type} orders-modal-inline-alert`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Nao foi possivel concluir a acao' : 'Atualizacao realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <div className="orders-detail-terminal-shell">
                    <div className="orders-detail-terminal-main">
                        <section className="orders-terminal-hero">
                            <div className="orders-terminal-hero-copy">
                                <div className="orders-terminal-hero-kicker">
                                    <i className="fa-solid fa-receipt" />
                                    <span>Comanda em atendimento</span>
                                </div>

                                <div className="orders-terminal-title-row">
                                    <h3>{draft.label}</h3>
                                    <span className="orders-terminal-inline-chip">
                                        <i className="fa-solid fa-store" />
                                        {getOrderTypeLabel(draft.type)}
                                    </span>
                                </div>

                                <p>
                                    {draft.reference ? `Referencia ${draft.reference}. ` : `Numero ${getDraftNumberLabel(draft)}. `}
                                    Aberta ha {elapsedLabel}.
                                </p>

                                <div className="orders-terminal-hero-meta">
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        {selectedCustomer?.name || 'Cliente nao identificado'}
                                    </span>
                                    <span>
                                        <i className="fa-solid fa-floppy-disk" />
                                        {currentDraftSaveText}
                                    </span>
                                </div>
                            </div>

                            <div className="orders-terminal-total-card">
                                <span>Total atual</span>
                                <strong>{formatMoney(pricing.total)}</strong>
                                <small>{draft.items.length} item(ns) no atendimento</small>
                            </div>
                        </section>

                        <section className="orders-terminal-metrics">
                            {detailCards.map((card) => (
                                <article key={card.label} className="orders-terminal-stat-card">
                                    <span>
                                        <i className={`fa-solid ${card.icon}`} />
                                        {card.label}
                                    </span>
                                    <strong>{card.value}</strong>
                                </article>
                            ))}
                        </section>

                        <div className="orders-detail-terminal-content">
                            <section className="orders-terminal-panel orders-terminal-items-panel">
                                <div className="orders-terminal-panel-heading">
                                    <div>
                                        <span className="orders-terminal-panel-kicker">
                                            <i className="fa-solid fa-box-open" />
                                            Itens da comanda
                                        </span>
                                        <h4>Lista de produtos</h4>
                                    </div>
                                    <small>{selectedItem ? `Item em foco: ${selectedItem.name}` : 'Selecione um item para acoes rapidas.'}</small>
                                </div>

                                {pricing.items.length ? (
                                    <div className="orders-terminal-item-list">
                                        {pricing.items.map((item) => {
                                            const itemMeta = [
                                                item.code ? `Cod. ${item.code}` : null,
                                                item.barcode ? `EAN ${item.barcode}` : null,
                                                item.unit ? `Un. ${item.unit}` : null,
                                                `Estoque ${formatNumber(item.stock_quantity)}`,
                                            ].filter(Boolean).join(' | ')

                                            return (
                                                <article
                                                    key={item.id}
                                                    className={`orders-terminal-item-row ${selectedItemId === item.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedItemId(item.id)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter' || event.key === ' ') {
                                                            event.preventDefault()
                                                            setSelectedItemId(item.id)
                                                        }
                                                    }}
                                                    role="button"
                                                    tabIndex={0}
                                                >
                                                    <div className="orders-terminal-item-main">
                                                        <div className="orders-terminal-item-head">
                                                            <div className="orders-terminal-item-copy">
                                                                <strong>{item.name}</strong>
                                                                <small>{itemMeta}</small>
                                                            </div>
                                                            <span className="orders-terminal-item-unit-price">{formatMoney(item.sale_price)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="orders-terminal-item-controls" onClick={(event) => event.stopPropagation()}>
                                                        <label className="orders-terminal-item-field">
                                                            <span>Qtd</span>
                                                            <input
                                                                className="ui-input"
                                                                type="number"
                                                                min="0.001"
                                                                step="0.001"
                                                                value={item.qty}
                                                                onChange={(event) => onQuantityChange(item.id, event.target.value)}
                                                            />
                                                        </label>

                                                        <div className="orders-terminal-item-total">
                                                            <span>Total</span>
                                                            <strong>{formatMoney(item.lineTotal)}</strong>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="orders-terminal-item-remove"
                                                            onClick={() => {
                                                                setSelectedItemId(item.id)
                                                                onRemoveItem(item.id)
                                                            }}
                                                            aria-label={`Remover ${item.name}`}
                                                        >
                                                            <i className="fa-solid fa-trash-can" />
                                                        </button>
                                                    </div>
                                                </article>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="orders-terminal-empty">
                                        <i className="fa-solid fa-box-open" />
                                        <div>
                                            <strong>Sem produtos no atendimento</strong>
                                            <p>Use a sidebar para abrir o catalogo e comecar a montar a comanda.</p>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <div className="orders-terminal-side-stack">
                                <section className="orders-terminal-panel">
                                    <div className="orders-terminal-panel-heading">
                                        <div>
                                            <span className="orders-terminal-panel-kicker">
                                                <i className="fa-solid fa-wallet" />
                                                Fechamento
                                            </span>
                                            <h4>Resumo financeiro</h4>
                                        </div>
                                    </div>

                                    <div className="orders-terminal-summary-box">
                                        <div>
                                            <span>Subtotal</span>
                                            <strong>{formatMoney(pricing.subtotal)}</strong>
                                        </div>
                                        <div>
                                            <span>Desconto</span>
                                            <strong>{formatMoney(pricing.discount)}</strong>
                                        </div>
                                        <div className="total">
                                            <span>Total</span>
                                            <strong>{formatMoney(pricing.total)}</strong>
                                        </div>
                                    </div>

                                    <div className="orders-terminal-note-box">
                                        <span>
                                            <i className="fa-solid fa-badge-percent" />
                                            Desconto ativo
                                        </span>
                                        <p>{pricing.summary.title}</p>
                                        <small>{pricing.summary.description}</small>
                                    </div>
                                </section>

                                <section className="orders-terminal-panel">
                                    <div className="orders-terminal-panel-heading">
                                        <div>
                                            <span className="orders-terminal-panel-kicker">
                                                <i className="fa-solid fa-clipboard-list" />
                                                Atendimento
                                            </span>
                                            <h4>Dados da comanda</h4>
                                        </div>
                                    </div>

                                    <div className="orders-terminal-meta-grid">
                                        <article className="orders-terminal-meta-card">
                                            <span>Tipo</span>
                                            <strong>{getOrderTypeLabel(draft.type)}</strong>
                                        </article>
                                        <article className="orders-terminal-meta-card">
                                            <span>Status</span>
                                            <strong>{currentDraftStatus?.label || 'Em aberto'}</strong>
                                        </article>
                                    </div>

                                    <div className="orders-terminal-note-box">
                                        <span>
                                            <i className="fa-solid fa-note-sticky" />
                                            Observacao
                                        </span>
                                        <p>{draft.notes.trim() || 'Nenhuma observacao registrada para este atendimento.'}</p>
                                    </div>
                                </section>

                                <section className="orders-terminal-panel">
                                    <div className="orders-terminal-panel-heading">
                                        <div>
                                            <span className="orders-terminal-panel-kicker">
                                                <i className="fa-solid fa-user-group" />
                                                Cliente e foco
                                            </span>
                                            <h4>Contexto atual</h4>
                                        </div>
                                    </div>

                                    <div className="orders-terminal-chip">
                                        <span>
                                            <i className="fa-solid fa-user" />
                                            Cliente
                                        </span>
                                        <strong>{selectedCustomer?.name || 'Nao identificado'}</strong>
                                        <small>{selectedCustomer?.phone || 'Sem telefone informado'}</small>
                                    </div>

                                    <label className="orders-terminal-field">
                                        <span>
                                            <i className="fa-solid fa-address-book" />
                                            Vincular cliente
                                        </span>
                                        <select
                                            className="ui-select"
                                            value={draft.customerId}
                                            onChange={(event) => onCustomerChange(event.target.value)}
                                        >
                                            <option value="">Nao identificado</option>
                                            {customers.map((customer) => (
                                                <option key={customer.id} value={customer.id}>
                                                    {customer.name}
                                                </option>
                                            ))}
                                        </select>
                                        <small>Voce pode informar ou trocar o cliente mesmo depois do atendimento criado.</small>
                                    </label>

                                    <div className="orders-terminal-chip">
                                        <span>
                                            <i className="fa-solid fa-crosshairs" />
                                            Item selecionado
                                        </span>
                                        <strong>{selectedItem?.name || 'Nenhum item em foco'}</strong>
                                        <small>
                                            {selectedItem
                                                ? `${formatNumber(selectedItem.qty)} x ${formatMoney(selectedItem.sale_price)}`
                                                : 'Clique em um item da lista para agir rapido.'}
                                        </small>
                                    </div>
                                </section>
                            </div>
                        </div>
                    </div>

                    <aside className="orders-terminal-sidebar">
                        {sidebarActions.map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                className={`orders-terminal-sidebar-action ${action.tone || 'default'}`}
                                onClick={action.onClick}
                                disabled={action.disabled}
                            >
                                <i className={`fa-solid ${action.icon}`} />
                                <span>{action.label}</span>
                            </button>
                        ))}

                        <div className="orders-terminal-sidebar-spacer" />

                        <button
                            type="button"
                            className="orders-terminal-sidebar-finalize"
                            onClick={onOpenCheckoutModal}
                            disabled={!draft.items.length}
                        >
                            <i className="fa-solid fa-check" />
                            <span>Finalizar</span>
                        </button>
                    </aside>
                </div>
            </div>
        </OrdersModal>
    )
}
