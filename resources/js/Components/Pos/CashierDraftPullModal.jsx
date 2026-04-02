import { formatMoney, formatNumber, formatTime } from '@/lib/format'

function resolveOrderLabel(order) {
    const reference = String(order.reference || '').trim()
    const suffix = reference !== '' ? reference : `#${order.id}`

    if (order.type === 'mesa') {
        return `Mesa ${suffix}`
    }

    if (order.type === 'pedido') {
        return `Pedido ${suffix}`
    }

    return `Comanda ${suffix}`
}

export default function CashierDraftPullModal({
    open,
    orders,
    activeOrderDraftId,
    loadingOrderId,
    refreshing = false,
    cartHasItems = false,
    onClose,
    onRefresh,
    onLoadOrder,
}) {
    if (!open) {
        return null
    }

    return (
        <div className="pos-overlay" onClick={onClose}>
            <div className="pos-modal-card pos-cashier-drafts-modal" onClick={(event) => event.stopPropagation()}>
                <div className="pos-cashier-drafts-header">
                    <strong>Comandas</strong>

                    <div className="pos-cashier-drafts-toolbar">
                        <button
                            type="button"
                            onClick={onRefresh}
                            disabled={refreshing}
                            aria-label="Atualizar comandas"
                            title="Atualizar comandas"
                        >
                            <i className={`fa-solid ${refreshing ? 'fa-rotate-right fa-spin' : 'fa-rotate-right'}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fechar comandas"
                            title="Fechar comandas"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </div>

                {orders.length ? (
                    <div className="pos-cashier-drafts-list">
                        {orders.map((order) => {
                            const isActive = Number(activeOrderDraftId) === Number(order.id)
                            const isLoading = Number(loadingOrderId) === Number(order.id)
                            const isBlocked = cartHasItems && !isActive

                            return (
                                <button
                                    key={order.id}
                                    type="button"
                                    className={`pos-cashier-draft-card ${isActive ? 'active' : ''}`}
                                    onClick={() => onLoadOrder(order.id)}
                                    disabled={isLoading || isBlocked}
                                    aria-label={`Puxar ${resolveOrderLabel(order)}`}
                                >
                                    <span className="pos-cashier-draft-top">
                                        <span className="pos-cashier-draft-label">{resolveOrderLabel(order)}</span>
                                        <span className="pos-cashier-draft-icon" aria-hidden="true">
                                            {isLoading ? (
                                                <i className="fa-solid fa-spinner fa-spin" />
                                            ) : isActive ? (
                                                <i className="fa-solid fa-check" />
                                            ) : (
                                                <i className="fa-solid fa-arrow-down" />
                                            )}
                                        </span>
                                    </span>

                                    {order.customer?.name ? (
                                        <span className="pos-cashier-draft-customer">{order.customer.name}</span>
                                    ) : null}

                                    <span className="pos-cashier-draft-meta">
                                        <span>{formatNumber(order.items_count)} itens</span>
                                        <span>{formatMoney(order.total)}</span>
                                        {order.sent_to_cashier_at ? <span>{formatTime(order.sent_to_cashier_at)}</span> : null}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    <div className="pos-cashier-draft-empty">
                        <i className="fa-solid fa-cart-shopping" />
                        <span>Sem comandas no caixa.</span>
                    </div>
                )}
            </div>
        </div>
    )
}
