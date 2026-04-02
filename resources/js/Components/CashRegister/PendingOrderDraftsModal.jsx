import { router } from '@inertiajs/react'
import { formatDateTime, formatMoney } from '@/lib/format'

const TYPE_META = {
    comanda: { label: 'Comanda', icon: 'fa-receipt' },
    mesa: { label: 'Mesa', icon: 'fa-table-cells-large' },
    pedido: { label: 'Pedido', icon: 'fa-box-open' },
}

function resolveTypeMeta(type) {
    return TYPE_META[type] || TYPE_META.comanda
}

export default function PendingOrderDraftsModal({ open, orders, onClose }) {
    if (!open) {
        return null
    }

    return (
        <div className="cash-register-report-backdrop" onClick={onClose}>
            <div className="cash-register-report-card cash-register-orders-modal" onClick={(event) => event.stopPropagation()}>
                <div className="cash-register-report-header">
                    <div>
                        <h2>Comandas disponiveis</h2>
                        <p>Comandas, mesas e pedidos enviados para cobranca aparecem aqui para abrir no PDV.</p>
                    </div>
                    <button className="cash-register-primary-button" type="button" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                        Fechar
                    </button>
                </div>

                <div className="cash-register-report-section">
                    {orders.length ? (
                        <div className="cash-register-orders-list">
                            {orders.map((order) => {
                                const typeMeta = resolveTypeMeta(order.type)

                                return (
                                    <article key={order.id} className="cash-register-order-card">
                                        <div className="cash-register-order-card-top">
                                            <span className="cash-register-count-chip">
                                                <i className={`fa-solid ${typeMeta.icon}`} />
                                                {typeMeta.label}
                                            </span>
                                            <span className="ui-badge info">Aguardando cobranca</span>
                                        </div>

                                        <div className="cash-register-order-card-body">
                                            <div className="cash-register-order-card-copy">
                                                <strong>{order.label}</strong>

                                                <div className="cash-register-order-card-meta">
                                                    <span>
                                                        <i className="fa-solid fa-box-open" />
                                                        {order.items_count} item(ns)
                                                    </span>
                                                    <span>
                                                        <i className="fa-solid fa-wallet" />
                                                        {formatMoney(order.total)}
                                                    </span>
                                                    {order.customer?.name ? (
                                                        <span>
                                                            <i className="fa-solid fa-user" />
                                                            {order.customer.name}
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <small>
                                                    {order.created_by ? `Lancado por ${order.created_by}` : 'Pedido registrado'}
                                                    {order.sent_to_cashier_at ? ` em ${formatDateTime(order.sent_to_cashier_at)}` : ''}
                                                </small>
                                            </div>

                                            <button
                                                type="button"
                                                className="cash-register-primary-button cash-register-order-open-button"
                                                onClick={() => router.visit(`/pdv?orderDraft=${order.id}`)}
                                            >
                                                <i className="fa-solid fa-cash-register" />
                                                Abrir no PDV
                                            </button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="cash-register-empty cash-register-empty-modal">
                            <i className="fa-solid fa-receipt" />
                            <div>
                                <strong>Nenhuma comanda disponivel.</strong>
                                <p>Assim que um atendimento for enviado para o caixa ele aparece nesta lista.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
