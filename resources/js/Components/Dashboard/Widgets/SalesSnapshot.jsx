import { formatMoney, formatTime } from '@/lib/format'
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

const paymentLabels = {
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Debito',
    credit_card: 'Credito',
    credit: 'A Prazo',
    mixed: 'Misto',
}

export default function SalesSnapshot({ sales = [], mode = 'default' }) {
    const chartData = sales
        .slice()
        .reverse()
        .map((sale) => ({
            label: sale.sale_number,
            total: Number(sale.total || 0),
            customer: sale.customer_name,
            hour: formatTime(sale.created_at),
        }))

    return (
        <section className={`dashboard-panel ${mode === 'expanded' ? 'expanded' : ''}`}>
            <div className="dashboard-panel-header">
                <div>
                    <h2>{mode === 'expanded' ? 'Vendas recentes' : 'Ultimas vendas'}</h2>
                    <p>
                        {mode === 'expanded'
                            ? 'Valores das ultimas vendas registradas.'
                            : 'Lancamentos mais recentes'}
                    </p>
                </div>
                <span className="dashboard-panel-tag">Hoje</span>
            </div>

            <div className="dashboard-chart-shell">
                {chartData.length ? (
                    <ResponsiveContainer width="100%" height={mode === 'expanded' ? 320 : 220}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2f7cf6" stopOpacity={0.42} />
                                    <stop offset="95%" stopColor="#2f7cf6" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(81, 96, 118, 0.14)" />
                            <XAxis dataKey="hour" stroke="#7e8ba0" tickLine={false} axisLine={false} />
                            <YAxis stroke="#7e8ba0" tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: 16,
                                    border: '1px solid rgba(15, 23, 42, 0.08)',
                                    boxShadow: '0 18px 32px rgba(15, 23, 42, 0.12)',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#2f7cf6"
                                strokeWidth={3}
                                fill="url(#salesGradient)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="dashboard-empty-state">Nenhuma venda finalizada ainda.</div>
                )}
            </div>

            <div className="dashboard-sales-list">
                {sales.length ? (
                    sales.map((sale) => (
                        <article key={sale.id} className="dashboard-sale-row">
                            <div>
                                <strong>{sale.sale_number}</strong>
                                <span>{sale.customer_name}</span>
                            </div>
                            <div>
                                <span>{paymentLabels[sale.payment_method] ?? sale.payment_method}</span>
                                <small>{formatTime(sale.created_at)}</small>
                            </div>
                            <strong>{formatMoney(sale.total)}</strong>
                        </article>
                    ))
                ) : null}
            </div>
        </section>
    )
}
