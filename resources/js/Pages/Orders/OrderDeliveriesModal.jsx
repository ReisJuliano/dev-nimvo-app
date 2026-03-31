import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import OrdersModal from './OrdersModal'

function statusLabel(status) {
    if (status === 'dispatched') return 'Em rota'
    if (status === 'delivered') return 'Entregue'
    return 'Pendente'
}

export default function OrderDeliveriesModal({ open, onClose }) {
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const pending = useMemo(() => records.filter((r) => r.status === 'pending'), [records])
    const dispatched = useMemo(() => records.filter((r) => r.status === 'dispatched'), [records])
    const delivered = useMemo(() => records.filter((r) => r.status === 'delivered'), [records])

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
                            <p>Envie uma comanda para entrega para ela aparecer aqui.</p>
                        </div>
                    </div>
                ) : null}

                {!loading && records.length ? (
                    <div className="orders-delivery-columns">
                        {[{ key: 'pending', title: 'Pendentes', rows: pending }, { key: 'dispatched', title: 'Em rota', rows: dispatched }, { key: 'delivered', title: 'Entregues', rows: delivered }].map((col) => (
                            <section key={col.key} className="orders-delivery-col">
                                <h3>{col.title}</h3>
                                <div className="orders-delivery-list">
                                    {col.rows.map((order) => (
                                        <article key={order.id} className="orders-delivery-card">
                                            <div className="orders-delivery-card-top">
                                                <div>
                                                    <strong>{order.reference || order.recipient_name || 'Entrega'}</strong>
                                                    <small>{order.address}</small>
                                                </div>
                                                <span className={`ui-badge ${order.status === 'delivered' ? 'success' : order.status === 'dispatched' ? 'info' : 'warning'}`}>
                                                    {statusLabel(order.status)}
                                                </span>
                                            </div>
                                            <div className="orders-delivery-card-meta">
                                                <span>{order.customer_name || 'Sem cliente'}</span>
                                                <span>{formatMoney(Number(order.order_total || 0) + Number(order.delivery_fee || 0))}</span>
                                            </div>
                                            <div className="orders-delivery-card-actions">
                                                {order.status !== 'pending' ? (
                                                    <button type="button" className="ui-button-ghost" onClick={() => updateStatus(order, 'pending')}>
                                                        Pendente
                                                    </button>
                                                ) : null}
                                                {order.status !== 'dispatched' ? (
                                                    <button type="button" className="ui-button-secondary" onClick={() => updateStatus(order, 'dispatched')}>
                                                        Em rota
                                                    </button>
                                                ) : null}
                                                {order.status !== 'delivered' ? (
                                                    <button type="button" className="ui-button" onClick={() => updateStatus(order, 'delivered')}>
                                                        Entregue
                                                    </button>
                                                ) : null}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : null}
            </div>
        </OrdersModal>
    )
}

