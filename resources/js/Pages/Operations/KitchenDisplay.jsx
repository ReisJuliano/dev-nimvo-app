import { Head } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import { formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import KitchenKanbanBoard from './workspaces/KitchenKanbanBoard'
import { buildRecordsUrl, parseNumber, upsertRecord } from './workspaces/shared'
import './operations-workspace.css'
import './kitchen-display.css'

function formatClock(value) {
    return value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function KitchenDisplay({ moduleTitle, payload }) {
    const [records, setRecords] = useState(payload.records || [])
    const [clock, setClock] = useState(() => new Date())
    const [movingTicket, setMovingTicket] = useState(false)

    const summary = useMemo(() => ({
        orders: records.length,
        inPreparation: records.filter((record) => record.status === 'in_preparation').length,
        items: records.reduce((total, record) => total + (record.items || []).length, 0),
    }), [records])

    useEffect(() => {
        const intervalId = window.setInterval(() => setClock(new Date()), 30000)

        return () => window.clearInterval(intervalId)
    }, [])

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            if (document.hidden) return
            void refreshRecords()
        }, 8000)

        return () => window.clearInterval(intervalId)
    }, [])

    async function refreshRecords() {
        try {
            const response = await apiRequest('/api/operations/cozinha/records', { method: 'get' })
            setRecords(response.records || [])
        } catch {
            // A tela de TV continua exibindo o ultimo estado valido em caso de falha.
        }
    }

    function buildTicketPayload(ticket, nextStatus) {
        return {
            reference: ticket.reference || null,
            channel: ticket.channel,
            status: nextStatus,
            priority: ticket.priority || 'normal',
            customer_name: ticket.customer_name || null,
            notes: ticket.notes || null,
            requested_at: ticket.requested_at || null,
            items: (ticket.items || []).map((item) => ({
                product_id: item.product_id ? Number(item.product_id) : null,
                item_name: item.item_name,
                quantity: parseNumber(item.quantity, 1),
                unit: item.unit || 'UN',
                notes: item.notes || null,
            })),
        }
    }

    async function handleMoveTicket(ticket, nextStatus) {
        if (!ticket?.id || ticket.status === nextStatus) return
        setMovingTicket(true)
        try {
            const response = await apiRequest(buildRecordsUrl('cozinha', ticket.id), {
                method: 'put',
                data: buildTicketPayload(ticket, nextStatus),
            })
            setRecords((current) => upsertRecord(current, response.record))
        } catch {
            // Em TV, mantemos o estado atual e tentamos novamente no proximo refresh.
        } finally {
            setMovingTicket(false)
        }
    }

    return (
        <>
            <Head title={`${moduleTitle} TV`} />

            <div className="kitchen-display-page">
                <header className="kitchen-display-header">
                    <div>
                        <span>Painel TV</span>
                        <h1>{moduleTitle}</h1>
                    </div>
                    <div className="kitchen-display-meta">
                        <article>
                            <small>Comandas</small>
                            <strong>{formatNumber(summary.orders)}</strong>
                        </article>
                        <article>
                            <small>Em preparo</small>
                            <strong>{formatNumber(summary.inPreparation)}</strong>
                        </article>
                        <article>
                            <small>Itens ativos</small>
                            <strong>{formatNumber(summary.items)}</strong>
                        </article>
                        <article>
                            <small>Horario</small>
                            <strong>{formatClock(clock)}</strong>
                        </article>
                    </div>
                </header>

                <KitchenKanbanBoard tickets={records} tvMode onMoveTicket={handleMoveTicket} loading={movingTicket} />
            </div>
        </>
    )
}
