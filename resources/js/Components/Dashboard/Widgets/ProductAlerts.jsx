import { formatMoney, formatNumber } from '@/lib/format'

export default function ProductAlerts({ topProducts = [], lowStockItems = [] }) {
    return (
        <section className="dashboard-side-grid">
            <article className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h2>Mais vendidos hoje</h2>
                        <p>Baseado nas vendas finalizadas</p>
                    </div>
                </div>

                <div className="dashboard-ranking-list">
                    {topProducts.length ? (
                        topProducts.map((product, index) => (
                            <div key={`${product.name}-${index}`} className="dashboard-ranking-row">
                                <span>{product.name}</span>
                                <div>
                                    <strong>{formatNumber(product.qty_sold)}</strong>
                                    <small>{formatMoney(product.total_sold)}</small>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="dashboard-empty-state">Sem produtos vendidos hoje.</div>
                    )}
                </div>
            </article>

            <article className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h2>Estoque baixo</h2>
                        <p>Itens que merecem reposicao</p>
                    </div>
                </div>

                <div className="dashboard-ranking-list">
                    {lowStockItems.length ? (
                        lowStockItems.map((product) => (
                            <div key={product.id} className="dashboard-ranking-row warning">
                                <span>{product.name}</span>
                                <div>
                                    <strong>
                                        {formatNumber(product.stock_quantity)} {product.unit}
                                    </strong>
                                    <small>Min. {formatNumber(product.min_stock)}</small>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="dashboard-empty-state">Sem alertas de estoque no momento.</div>
                    )}
                </div>
            </article>
        </section>
    )
}
