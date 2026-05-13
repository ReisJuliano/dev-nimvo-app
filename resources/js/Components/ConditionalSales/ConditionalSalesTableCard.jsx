import { formatDate, formatMoney } from '@/lib/format'

function StatusBadge({ label, tone }) {
    const cls = tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : 'warning'

    return <span className={`ui-badge ${cls}`}>{label}</span>
}

export default function ConditionalSalesTableCard({
    conditionals,
    selectedConditionalId,
    statusOptions,
    filters,
    onStatusChange,
    onSelect,
}) {
    return (
        <section className="products-table-card">
            <div className="products-table-header">
                <div>
                    <h2>Condicionais</h2>
                    <p>{conditionals.length} registro(s)</p>
                </div>
                <label className="products-sidebar-field" style={{ minWidth: '12rem' }}>
                    <span>Status</span>
                    <select className="products-input" value={filters.status} onChange={(event) => onStatusChange(event.target.value)}>
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="conditional-table-wrap">
                {conditionals.length ? (
                    <table className="conditional-table">
                        <thead>
                            <tr>
                                <th>Codigo</th>
                                <th>Cliente</th>
                                <th>Prazo</th>
                                <th>Valor aberto</th>
                                <th>Status</th>
                                <th style={{ width: '4rem' }} />
                            </tr>
                        </thead>
                        <tbody>
                            {conditionals.map((conditionalSale) => (
                                <tr
                                    key={conditionalSale.id}
                                    className={selectedConditionalId === conditionalSale.id ? 'is-selected' : ''}
                                >
                                    <td>{conditionalSale.code}</td>
                                    <td>{conditionalSale.customer.name}</td>
                                    <td>{formatDate(conditionalSale.due_at)}</td>
                                    <td>{formatMoney(conditionalSale.outstanding_total)}</td>
                                    <td>
                                        <StatusBadge label={conditionalSale.status_label} tone={conditionalSale.status_tone} />
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="ui-button-ghost"
                                            style={{ padding: '0.35rem 0.5rem' }}
                                            aria-label="Abrir condicional"
                                            onClick={() => onSelect(conditionalSale.id)}
                                        >
                                            <i className="fa-solid fa-eye" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="conditional-empty">
                        <i className="fa-solid fa-right-left" />
                        <strong>Sem registros</strong>
                    </div>
                )}
            </div>
        </section>
    )
}
