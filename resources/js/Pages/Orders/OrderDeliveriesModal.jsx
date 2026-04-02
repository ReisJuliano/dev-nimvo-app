import { useEffect, useMemo, useState } from 'react'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import OrdersModal from './OrdersModal'

function statusLabel(status) {
    if (status === 'dispatched') return 'Em rota'
    if (status === 'delivered') return 'Entregue'
    return 'Pendente'
}

function channelLabel(channel) {
    return channel === 'retirada' ? 'Retirada' : 'Delivery'
}

export default function OrderDeliveriesModal({ open, onClose }) {
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })

    const pending = useMemo(() => records.filter((r) => r.status === 'pending'), [records])
    const dispatched = useMemo(() => records.filter((r) => r.status === 'dispatched'), [records])
    const delivered = useMemo(() => records.filter((r) => r.status === 'delivered'), [records])
    const columns = useMemo(
        () => [
            {
                key: 'pending',
                title: 'Pendentes',
                kicker: 'Aguardando saida',
                description: 'Pedidos prontos para separar, revisar e despachar.',
                icon: 'fa-clock',
                emptyTitle: 'Sem pedidos pendentes',
                emptyText: 'As novas entregas vao aparecer aqui.',
                rows: pending,
            },
            {
                key: 'dispatched',
                title: 'Em rota',
                kicker: 'Saiu para entrega',
                description: 'Pedidos em deslocamento ou aguardando confirmacao final.',
                icon: 'fa-motorcycle',
                emptyTitle: 'Nenhuma entrega em rota',
                emptyText: 'Atualize um pedido para acompanhar o trajeto.',
                rows: dispatched,
            },
            {
                key: 'delivered',
                title: 'Entregues',
                kicker: 'Fluxo concluido',
                description: 'Historico recente das entregas finalizadas.',
                icon: 'fa-circle-check',
                emptyTitle: 'Sem entregas concluidas',
                emptyText: 'Assim que finalizar um pedido ele aparece aqui.',
                rows: delivered,
            },
        ],
        [pending, dispatched, delivered],
    )

    useEffect(() => {
        if (!open) return
        let ignore = false
        setLoading(true)
        setFeedback(null)
        apiRequest('/api/delivery/orders')
            .then((response) => {
                if (!ignore) setRecords(response.records || [])
            })
            .catch((error) => {
                if (!ignore) setFeedback({ type: 'error', text: error.message })
            })
            .finally(() => {
                if (!ignore) setLoading(false)
            })

        return () => {
            ignore = true
        }
    }, [open])

    async function updateStatus(order, status) {
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/delivery/orders/${order.id}/status`, { method: 'post', data: { status } })
            setRecords((current) => current.map((row) => (row.id === order.id ? response.record : row)))
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    if (!open) return null

    return (
        <OrdersModal
            title="Entregas"
            subtitle="Acompanhe e atualize status de forma rapida."
            size="xl"
            className="orders-modal-deliveries-board"
            bodyClassName="orders-modal-deliveries-board-body"
            badge={
                <span className="orders-modal-badge orders-modal-deliveries-badge">
                    <i className="fa-solid fa-motorcycle" />
                    <span>{records.length} na fila</span>
                </span>
            }
            onClose={onClose}
        >
            <div className="orders-modal-stack">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type} orders-modal-inline-alert`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Nao foi possivel concluir a acao' : 'Atualizacao realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                {loading ? <div className="orders-inline-empty wide">Carregando entregas...</div> : null}

                {!loading && !records.length ? (
                    <div className="orders-inline-empty wide">
                        <i className="fa-solid fa-motorcycle" />
                        <div>
                            <strong>Nenhuma entrega cadastrada</strong>
                            <p>Envie um atendimento para entrega para ele aparecer aqui.</p>
                        </div>
                    </div>
                ) : null}

                {!loading && records.length ? (
                    <div className="orders-delivery-columns">
                        {columns.map((col) => (
                            <section key={col.key} className="orders-delivery-col">
                                <header className={`orders-delivery-col-header tone-${col.key}`}>
                                    <div>
                                        <span>
                                            <i className={`fa-solid ${col.icon}`} />
                                            {col.kicker}
                                        </span>
                                        <h3>{col.title}</h3>
                                        <p>{col.description}</p>
                                    </div>
                                    <strong>{col.rows.length}</strong>
                                </header>

                                <div className="orders-delivery-list">
                                    {col.rows.length ? (
                                        col.rows.map((order) => {
                                            const displayAddress = order.channel === 'retirada' ? 'Retirada no balcao' : order.address || 'Endereco nao informado'
                                            const contactLabel = order.customer_name || order.recipient_name || 'Sem cliente'

                                            return (
                                                <article key={order.id} className={`orders-delivery-card tone-${order.status}`}>
                                                    <div className="orders-delivery-card-top">
                                                        <div className="orders-delivery-card-title">
                                                            <span className={`orders-delivery-channel-chip ${order.channel === 'retirada' ? 'pickup' : 'delivery'}`}>
                                                                <i className={`fa-solid ${order.channel === 'retirada' ? 'fa-bag-shopping' : 'fa-motorcycle'}`} />
                                                                {channelLabel(order.channel)}
                                                            </span>
                                                            <strong>{order.reference || order.recipient_name || 'Entrega'}</strong>
                                                            <small>
                                                                <i className="fa-solid fa-location-dot" />
                                                                {displayAddress}
                                                            </small>
                                                        </div>
                                                        <span className={`orders-delivery-status-chip tone-${order.status}`}>{statusLabel(order.status)}</span>
                                                    </div>

                                                    <div className="orders-delivery-card-meta">
                                                        <span>
                                                            <i className="fa-solid fa-user" />
                                                            {contactLabel}
                                                        </span>
                                                        {order.phone ? (
                                                            <span>
                                                                <i className="fa-solid fa-phone" />
                                                                {order.phone}
                                                            </span>
                                                        ) : null}
                                                        {order.neighborhood ? (
                                                            <span>
                                                                <i className="fa-solid fa-map" />
                                                                {order.neighborhood}
                                                            </span>
                                                        ) : null}
                                                        <span>
                                                            <i className="fa-solid fa-wallet" />
                                                            {formatMoney(Number(order.order_total || 0) + Number(order.delivery_fee || 0))}
                                                        </span>
                                                    </div>

                                                    {order.notes ? (
                                                        <div className="orders-delivery-card-note">
                                                            <i className="fa-solid fa-file-lines" />
                                                            <p>{order.notes}</p>
                                                        </div>
                                                    ) : null}

                                                    <div className="orders-delivery-card-actions">
                                                        {order.status !== 'pending' ? (
                                                            <button type="button" className="orders-delivery-status-button tone-pending" onClick={() => updateStatus(order, 'pending')}>
                                                                <i className="fa-solid fa-clock" />
                                                                <span>Pendente</span>
                                                            </button>
                                                        ) : null}
                                                        {order.status !== 'dispatched' ? (
                                                            <button type="button" className="orders-delivery-status-button tone-dispatched" onClick={() => updateStatus(order, 'dispatched')}>
                                                                <i className="fa-solid fa-motorcycle" />
                                                                <span>Em rota</span>
                                                            </button>
                                                        ) : null}
                                                        {order.status !== 'delivered' ? (
                                                            <button type="button" className="orders-delivery-status-button tone-delivered" onClick={() => updateStatus(order, 'delivered')}>
                                                                <i className="fa-solid fa-circle-check" />
                                                                <span>Entregue</span>
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </article>
                                            )
                                        })
                                    ) : (
                                        <div className="orders-delivery-col-empty">
                                            <i className={`fa-solid ${col.icon}`} />
                                            <div>
                                                <strong>{col.emptyTitle}</strong>
                                                <p>{col.emptyText}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : null}
            </div>
        </OrdersModal>
    )
}

