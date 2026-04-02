import { formatMoney, formatNumber } from '@/lib/format'
import OrdersModal from './OrdersModal'
import { formatElapsedTime, getDraftNumberLabel, getOrderTypeLabel } from './orderUtils'

export default function OrderDetailModal({
    draft,
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
}) {
    if (!draft) {
        return null
    }

    const sentToCashier = draft.status === 'sent_to_cashier'
    const elapsedLabel = formatElapsedTime(draft.updatedAt, clock)
    const customerName = selectedCustomer?.name || 'Nao identificado'
    const referenceLabel = draft.reference?.trim() || getDraftNumberLabel(draft)
    const detailCards = [
        { icon: 'fa-layer-group', label: 'Tipo', value: getOrderTypeLabel(draft.type) },
        { icon: 'fa-hashtag', label: 'Ref.', value: referenceLabel },
        { icon: 'fa-user', label: 'Cliente', value: customerName },
        { icon: 'fa-circle-dot', label: 'Status', value: currentDraftStatus?.label || 'Em aberto' },
    ]
    const sidebarActions = [
        { key: 'products', label: 'Produtos', icon: 'fa-box-open', onClick: onOpenProductsModal },
        { key: 'quantity', label: 'Quantidade', icon: 'fa-arrows-up-down', onClick: onOpenQuantityModal, disabled: !selectedItem },
        { key: 'discount', label: 'Desconto', icon: 'fa-percent', onClick: onOpenDiscountModal, disabled: !draft.items.length },
        { key: 'delivery', label: 'Entrega', icon: 'fa-motorcycle', onClick: onOpenDeliveryModal },
        { key: 'customer', label: 'Cliente', icon: 'fa-user-pen', onClick: onOpenTransferModal },
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
                                    <span className="orders-terminal-inline-chip soft">
                                        <i className="fa-solid fa-circle-dot" />
                                        {currentDraftStatus?.label || 'Em aberto'}
                                    </span>
                                </div>

                                <div className="orders-terminal-hero-meta">
                                    <span>
                                        <i className="fa-solid fa-hashtag" />
                                        {referenceLabel}
                                    </span>
                                    <span>
                                        <i className="fa-solid fa-clock" />
                                        {elapsedLabel}
                                    </span>
                                    <span>
                                        <i className="fa-solid fa-user" />
                                        {customerName}
                                    </span>
                                </div>
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
                                            Itens
                                        </span>
                                        <h4>Produtos</h4>
                                    </div>
                                    <small>{formatNumber(draft.items.length)} item(ns)</small>
                                </div>

                                {pricing.items.length ? (
                                    <div className="orders-terminal-item-table">
                                        <div className="orders-terminal-item-columns" aria-hidden="true">
                                            <span>Descricao</span>
                                            <span>EAN</span>
                                            <span>Preco un.</span>
                                            <span>Quantidade</span>
                                            <span />
                                        </div>

                                        <div className="orders-terminal-item-list">
                                            {pricing.items.map((item) => (
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
                                                    <div className="orders-terminal-item-copy">
                                                        <strong>{item.name}</strong>
                                                    </div>

                                                    <span className="orders-terminal-item-barcode">{item.barcode || '-'}</span>

                                                    <span className="orders-terminal-item-unit-price">{formatMoney(item.sale_price)}</span>

                                                    <div className="orders-terminal-item-controls" onClick={(event) => event.stopPropagation()}>
                                                        <input
                                                            className="ui-input"
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            value={item.qty}
                                                            onChange={(event) => onQuantityChange(item.id, event.target.value)}
                                                            aria-label={`Quantidade de ${item.name}`}
                                                        />
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
                                                </article>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="orders-terminal-empty">
                                        <i className="fa-solid fa-box-open" />
                                        <div>
                                            <strong>Sem produtos no atendimento</strong>
                                            <p>Abra o catalogo na sidebar para adicionar itens.</p>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <div className="orders-terminal-side-stack">
                                <section className="orders-terminal-panel orders-terminal-panel-compact">
                                    <div className="orders-terminal-panel-heading compact">
                                        <div>
                                            <span className="orders-terminal-panel-kicker">
                                                <i className="fa-solid fa-wallet" />
                                                Resumo
                                            </span>
                                            <h4>Total do atendimento</h4>
                                        </div>
                                        <span className="orders-terminal-inline-chip soft">
                                            <i className="fa-solid fa-percent" />
                                            {pricing.summary.title}
                                        </span>
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
