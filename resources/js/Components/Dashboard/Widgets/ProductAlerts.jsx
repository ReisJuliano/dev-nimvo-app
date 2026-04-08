import { formatNumber, formatPercent } from '@/lib/format'

function resolveSeverity(product) {
    if (Number(product.stock_quantity || 0) <= 0) {
        return 'danger'
    }

    if (Number(product.stock_quantity || 0) <= Number(product.min_stock || 0) * 0.5) {
        return 'warning'
    }

    return 'neutral'
}

export default function ProductAlerts({ lowStockItems = [], summary }) {
    const hasAlerts = lowStockItems.length > 0

    return (
        <section className="dashboard-surface dashboard-surface-list">
            <header className="dashboard-surface-header">
                <div className="dashboard-surface-title">
                    <strong>Estoque</strong>
                    <span>{formatPercent(summary.inventory_health)}</span>
                </div>

                <div className="dashboard-chip-group">
                    <span className="dashboard-soft-chip">{formatNumber(summary.total_products)} ativos</span>
                    <span className="dashboard-soft-chip warning">{formatNumber(summary.low_stock_count)} baixo</span>
                </div>
            </header>

            <div className="dashboard-alert-list">
                {hasAlerts ? (
                    lowStockItems.map((product) => (
                        <article key={product.id} className="dashboard-alert-item">
                            <div className="dashboard-alert-copy">
                                <strong>{product.name}</strong>
                                <small>
                                    {formatNumber(product.stock_quantity)} {product.unit}
                                </small>
                            </div>

                            <div className="dashboard-alert-meta">
                                <span className={`dashboard-alert-badge ${resolveSeverity(product)}`}>
                                    Min. {formatNumber(product.min_stock)}
                                </span>
                            </div>
                        </article>
                    ))
                ) : (
                    <div className="dashboard-empty-state">
                        <i className="fa-solid fa-box-open" />
                        <span>Sem alertas</span>
                    </div>
                )}
            </div>
        </section>
    )
}
