import { formatDateTime, formatMoney } from '@/lib/format'

export default function PendingOrdersPanel({
    orders,
    activeOrderDraftId,
    loadingOrderId,
    refreshing,
    onLoadOrder,
    onRefresh,
}) {
    return (
        <section className="pos-card">
            <div className="pos-card-header pos-pending-orders-header">
                <div>
                    <h2>Pedidos enviados para o caixa</h2>
                    <p>Carregue uma comanda ou mesa ja pronta para apenas cobrar no PDV.</p>
                </div>

                <button type="button" className="ui-button-ghost" onClick={onRefresh} disabled={refreshing}>
                    <i className="fa-solid fa-rotate-right" />
                    {refreshing ? 'Atualizando...' : 'Atualizar fila'}
                </button>
            </div>

            {orders.length ? (
                <div className="pos-pending-orders-list">
                    {orders.map((order) => {
                        const isActive = Number(activeOrderDraftId) === Number(order.id)
                        const isLoading = Number(loadingOrderId) === Number(order.id)

                        return (
                            <article key={order.id} className={`pos-pending-order-card ${isActive ? 'active' : ''}`}>
                                <div className="pos-pending-order-copy">
                                    <div className="pos-pending-order-top">
                                        <span className={`ui-badge ${isActive ? 'success' : 'info'}`}>
                                            {isActive ? 'Em cobranca' : 'Aguardando caixa'}
                                        </span>
                                        <strong>{order.label}</strong>
                                    </div>

                                    <div className="pos-inline-metadata">
                                        <span className="pos-meta-pill">{order.items_count} item(ns)</span>
                                        <span className="pos-meta-pill">{formatMoney(order.total)}</span>
                                        {order.customer?.name ? <span className="pos-meta-pill">{order.customer.name}</span> : null}
                                    </div>

                                    <small>
                                        {order.created_by ? `Lancado por ${order.created_by}` : 'Pedido registrado'}{' '}
                                        {order.sent_to_cashier_at ? `em ${formatDateTime(order.sent_to_cashier_at)}` : ''}
                                    </small>
                                </div>

                                <button type="button" className="pos-inline-button" onClick={() => onLoadOrder(order.id)} disabled={isLoading}>
                                    <i className="fa-solid fa-cash-register" />
                                    {isLoading ? 'Abrindo...' : isActive ? 'Recarregar' : 'Cobrar agora'}
                                </button>
                            </article>
                        )
                    })}
                </div>
            ) : (
                <div className="pos-empty-state">Nenhum pedido foi enviado para o caixa ainda.</div>
            )}
        </section>
    )
}
