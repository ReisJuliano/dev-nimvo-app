import { formatMoney, formatNumber } from '@/lib/format'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function ProductAlerts({ topProducts = [], lowStockItems = [], mode = 'default' }) {
    const chartData = topProducts.slice(0, 6).map((product) => ({
        name: product.name,
        qty: Number(product.qty_sold || 0),
    }))

    return (
        <section className={`dashboard-side-grid ${mode === 'expanded' ? 'expanded' : ''}`}>
            <article className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h2>Mais vendidos hoje</h2>
                        <p>Quantidade vendida no dia</p>
                    </div>
                    <span className="dashboard-panel-tag">Vendas</span>
                </div>

                <div className="dashboard-chart-shell compact">
                    {chartData.length ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(81, 96, 118, 0.14)" />
                                <XAxis dataKey="name" hide={mode !== 'expanded'} axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} stroke="#7e8ba0" />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: 16,
                                        border: '1px solid rgba(15, 23, 42, 0.08)',
                                        boxShadow: '0 18px 32px rgba(15, 23, 42, 0.12)',
                                    }}
                                />
                                <Bar dataKey="qty" radius={[12, 12, 4, 4]} fill="#07a5c9" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="dashboard-empty-state">Sem produtos vendidos hoje.</div>
                    )}
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
                    ) : null}
                </div>
            </article>

            <article className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <div>
                        <h2>Estoque baixo</h2>
                        <p>Itens abaixo do minimo</p>
                    </div>
                    <span className="dashboard-panel-tag warning">Alerta</span>
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
