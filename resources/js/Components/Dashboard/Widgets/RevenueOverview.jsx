import DashboardChartTooltip from '@/Components/Dashboard/DashboardChartTooltip'
import { formatMoney, formatNumber, formatPercent } from '@/lib/format'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

function compactLabel(value = '') {
    if (value.length <= 14) {
        return value
    }

    return `${value.slice(0, 12)}...`
}

export default function RevenueOverview({
    view = 'trend',
    salesTrend = [],
    hourlySales = [],
    topProducts = [],
    summary,
}) {
    const productChartData = topProducts.map((product) => ({
        ...product,
        label: compactLabel(product.name),
        qty_sold: Number(product.qty_sold || 0),
        total_sold: Number(product.total_sold || 0),
    }))

    const viewMap = {
        trend: {
            title: 'Receita',
            meta: '7 dias',
            footer: [
                { label: 'Mes', value: formatMoney(summary.month_sales_total) },
                { label: 'Lucro', value: formatMoney(summary.month_profit) },
                { label: 'Delta', value: `${summary.month_growth >= 0 ? '+' : ''}${formatPercent(summary.month_growth)}` },
            ],
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrend}>
                        <defs>
                            <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} stroke="#94a3b8" />
                        <YAxis hide />
                        <Tooltip
                            cursor={false}
                            content={(props) => (
                                <DashboardChartTooltip
                                    {...props}
                                    valueTypes={{ total: 'money', profit: 'money' }}
                                />
                            )}
                        />
                        <Area
                            type="monotone"
                            dataKey="total"
                            name="Receita"
                            stroke="#2563eb"
                            strokeWidth={3}
                            fill="url(#dashboardRevenueFill)"
                        />
                        <Line
                            type="monotone"
                            dataKey="profit"
                            name="Lucro"
                            stroke="#14b8a6"
                            strokeWidth={2}
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            ),
        },
        today: {
            title: 'Fluxo',
            meta: 'Hoje',
            footer: [
                { label: 'Hoje', value: formatMoney(summary.today_sales_total) },
                { label: 'Lucro', value: formatMoney(summary.today_profit) },
                { label: 'Vendas', value: formatNumber(summary.today_sales_qty) },
            ],
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourlySales}>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.18)" vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} stroke="#94a3b8" />
                        <YAxis hide />
                        <Tooltip
                            cursor={false}
                            content={(props) => (
                                <DashboardChartTooltip
                                    {...props}
                                    valueTypes={{ total: 'money', qty: 'number' }}
                                />
                            )}
                        />
                        <Line
                            type="monotone"
                            dataKey="total"
                            name="Receita"
                            stroke="#0f766e"
                            strokeWidth={3}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            ),
        },
        inventory: {
            title: 'Top produtos',
            meta: '7 dias',
            footer: [
                { label: 'Ativos', value: formatNumber(summary.total_products) },
                { label: 'Baixo', value: formatNumber(summary.low_stock_count) },
                { label: 'Saude', value: formatPercent(summary.inventory_health) },
            ],
            chart: (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.16)" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            stroke="#64748b"
                            width={88}
                        />
                        <Tooltip
                            cursor={false}
                            content={(props) => (
                                <DashboardChartTooltip
                                    {...props}
                                    valueTypes={{ qty_sold: 'number', total_sold: 'money' }}
                                    resolveLabel={(payload) => payload?.[0]?.payload?.name ?? ''}
                                />
                            )}
                        />
                        <Bar dataKey="qty_sold" name="Qtd." radius={[0, 14, 14, 0]} fill="#7c3aed" maxBarSize={22} />
                    </BarChart>
                </ResponsiveContainer>
            ),
        },
    }

    const currentView = viewMap[view] ?? viewMap.trend

    return (
        <section className="dashboard-surface dashboard-surface-focus">
            <header className="dashboard-surface-header">
                <div className="dashboard-surface-title">
                    <strong>{currentView.title}</strong>
                    <span>{currentView.meta}</span>
                </div>
                <span className="dashboard-surface-pill">
                    {view === 'inventory'
                        ? formatPercent(summary.inventory_health)
                        : `${summary.month_growth >= 0 ? '+' : ''}${formatPercent(summary.month_growth)}`}
                </span>
            </header>

            <div className="dashboard-chart-stage">{currentView.chart}</div>

            <div className="dashboard-mini-stats">
                {currentView.footer.map((item) => (
                    <div key={item.label} className="dashboard-mini-stat">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                    </div>
                ))}
            </div>
        </section>
    )
}
