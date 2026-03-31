import { formatNumber } from '@/lib/format'

export const KITCHEN_COLUMNS = [
    { key: 'queued', label: 'Fila' },
    { key: 'in_preparation', label: 'Em preparo' },
    { key: 'ready', label: 'Pronto' },
    { key: 'completed', label: 'Expedido' },
]

const CHANNEL_LABELS = {
    balcao: 'Balcao',
    mesa: 'Mesa',
    delivery: 'Delivery',
    retirada: 'Retirada',
}

function parseDate(value) {
    if (!value) return null
    const parsed = new Date(value)

    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function waitingMinutes(ticket) {
    const requestedAt = parseDate(ticket.requested_at)

    if (!requestedAt) return 0

    return Math.max(0, Math.round((Date.now() - requestedAt.getTime()) / 60000))
}

function presetPriority(ticket) {
    const minutes = waitingMinutes(ticket)
    const active = ticket.status === 'queued' || ticket.status === 'in_preparation'

    if (ticket.priority === 'urgent') {
        return { rank: 3, label: 'Urgente', tone: 'danger', minutes }
    }

    if (active && minutes >= 35) {
        return { rank: 2, label: 'Atrasado', tone: 'danger', minutes }
    }

    if (active && minutes >= 20) {
        return { rank: 1, label: 'Atencao', tone: 'warning', minutes }
    }

    return { rank: 0, label: 'Normal', tone: 'info', minutes }
}

function sortTickets(tickets) {
    return [...tickets].sort((left, right) => {
        const leftPriority = presetPriority(left)
        const rightPriority = presetPriority(right)

        if (leftPriority.rank !== rightPriority.rank) {
            return rightPriority.rank - leftPriority.rank
        }

        const leftDate = parseDate(left.requested_at)?.getTime() ?? 0
        const rightDate = parseDate(right.requested_at)?.getTime() ?? 0

        if (leftDate !== rightDate) {
            return leftDate - rightDate
        }

        return Number(left.id) - Number(right.id)
    })
}

function canMoveTo(status, target) {
    if (status === target) return false
    const fromIndex = KITCHEN_COLUMNS.findIndex((column) => column.key === status)
    const toIndex = KITCHEN_COLUMNS.findIndex((column) => column.key === target)

    if (fromIndex < 0 || toIndex < 0) return false

    return Math.abs(fromIndex - toIndex) === 1
}

function cardTitle(ticket) {
    if (ticket.reference) return ticket.reference
    if (ticket.customer_name) return ticket.customer_name
    if (ticket.order_draft_id) return `Comanda #${ticket.order_draft_id}`

    return `Ticket #${ticket.id}`
}

function renderItem(item) {
    const done = Boolean(item.done_at)

    return (
        <div key={item.id} className={`ops-kitchen-kanban-item ${done ? 'done' : ''}`}>
            <span>{item.item_name}</span>
            <small>
                {formatNumber(item.quantity)} {item.unit}
            </small>
        </div>
    )
}

export default function KitchenKanbanBoard({
    tickets,
    onMoveTicket,
    onToggleItemDone,
    loading = false,
    tvMode = false,
}) {
    const sortedTickets = sortTickets(tickets || [])

    return (
        <section className={`ops-kitchen-kanban ${tvMode ? 'tv' : ''}`}>
            {KITCHEN_COLUMNS.map((column) => {
                const columnTickets = sortedTickets.filter((ticket) => ticket.status === column.key)

                return (
                    <article key={column.key} className="ops-kitchen-kanban-column">
                        <header>
                            <strong>{column.label}</strong>
                            <small>{formatNumber(columnTickets.length)}</small>
                        </header>

                        <div className="ops-kitchen-kanban-cards">
                            {columnTickets.length ? (
                                columnTickets.map((ticket) => {
                                    const priority = presetPriority(ticket)
                                    const minutesWaiting = priority.minutes

                                    return (
                                        <section
                                            key={ticket.id}
                                            className={`ops-kitchen-kanban-card priority-${priority.tone}`}
                                        >
                                            <header className="ops-kitchen-kanban-card-header">
                                                <strong>{cardTitle(ticket)}</strong>
                                                <span className={`ui-badge ${priority.tone}`}>{priority.label}</span>
                                            </header>

                                            <div className="ops-kitchen-kanban-meta">
                                                <span>{CHANNEL_LABELS[ticket.channel] || ticket.channel}</span>
                                                {minutesWaiting > 0 ? <span>{minutesWaiting} min</span> : null}
                                            </div>

                                            <div className="ops-kitchen-kanban-items">
                                                {(ticket.items || []).length
                                                    ? ticket.items.map((item) =>
                                                        tvMode || !onToggleItemDone ? (
                                                            renderItem(item)
                                                        ) : (
                                                            <button
                                                                key={item.id}
                                                                type="button"
                                                                className={`ops-kitchen-kanban-item action ${item.done_at ? 'done' : ''}`}
                                                                onClick={() => onToggleItemDone(ticket.id, item.id)}
                                                            >
                                                                <span>{item.item_name}</span>
                                                                <small>
                                                                    {formatNumber(item.quantity)} {item.unit}
                                                                </small>
                                                            </button>
                                                        ),
                                                    )
                                                    : <div className="ops-kitchen-kanban-empty">Sem itens</div>}
                                            </div>

                                            {!tvMode && onMoveTicket ? (
                                                <div className="ops-kitchen-kanban-actions">
                                                    {KITCHEN_COLUMNS.map((target) => (
                                                        <button
                                                            key={target.key}
                                                            type="button"
                                                            className={target.key === ticket.status ? 'active' : ''}
                                                            onClick={() => onMoveTicket(ticket, target.key)}
                                                            disabled={!canMoveTo(ticket.status, target.key) || loading}
                                                        >
                                                            {target.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </section>
                                    )
                                })
                            ) : (
                                <div className="ops-kitchen-kanban-empty">Sem comandas</div>
                            )}
                        </div>
                    </article>
                )
            })}
        </section>
    )
}
