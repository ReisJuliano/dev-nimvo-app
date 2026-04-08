import { useMemo, useState } from 'react'
import DashboardMetricCard from '@/Components/Dashboard/Widgets/DashboardMetricCard'
import PaymentOverview from '@/Components/Dashboard/Widgets/PaymentOverview'
import ProductAlerts from '@/Components/Dashboard/Widgets/ProductAlerts'
import RevenueOverview from '@/Components/Dashboard/Widgets/RevenueOverview'
import SalesSnapshot from '@/Components/Dashboard/Widgets/SalesSnapshot'
import AppLayout from '@/Layouts/AppLayout'
import { formatPercent } from '@/lib/format'
import './dashboard.css'

const focusModes = [
    { key: 'trend', icon: 'fa-chart-column', label: 'Tendencia' },
    { key: 'today', icon: 'fa-clock', label: 'Hoje' },
    { key: 'inventory', icon: 'fa-box-open', label: 'Produtos' },
]

function formatDelta(value) {
    return `${value >= 0 ? '+' : ''}${formatPercent(value)}`
}

export default function Dashboard({
    summary,
    recentSales,
    topProducts,
    lowStockItems,
    salesTrend,
    hourlySales,
    paymentBreakdown,
}) {
    const [focusMode, setFocusMode] = useState('trend')

    const cards = useMemo(
        () => [
            {
                title: 'Hoje',
                value: summary.today_sales_total,
                caption: `${summary.today_sales_qty} vendas`,
                badge: formatDelta(summary.today_growth),
                badgeTone: summary.today_growth >= 0 ? 'positive' : 'negative',
                icon: 'fa-arrow-trend-up',
                tone: 'primary',
            },
            {
                title: 'Mes',
                value: summary.month_sales_total,
                caption: 'faturamento',
                badge: formatDelta(summary.month_growth),
                badgeTone: summary.month_growth >= 0 ? 'positive' : 'negative',
                icon: 'fa-chart-line',
                tone: 'sky',
            },
            {
                title: 'Ticket',
                value: summary.average_ticket,
                caption: 'medio',
                badge: `${formatPercent(summary.profit_margin)} margem`,
                badgeTone: 'neutral',
                icon: 'fa-wallet',
                tone: 'teal',
            },
            {
                title: 'Estoque',
                value: summary.low_stock_count,
                format: 'number',
                caption: `${summary.total_products} ativos`,
                badge: `${formatPercent(summary.inventory_health)} ok`,
                badgeTone: summary.low_stock_count > 0 ? 'warning' : 'positive',
                icon: 'fa-boxes-stacked',
                tone: 'violet',
            },
        ],
        [summary],
    )

    const activeMode = focusModes.find((mode) => mode.key === focusMode) ?? focusModes[0]

    return (
        <AppLayout title="Dashboard">
            <div className="dashboard-page">
                <section className="dashboard-toolbar">
                    <div className="dashboard-toolbar-badge">
                        <span className="dashboard-toolbar-dot" />
                        <strong>{activeMode.label}</strong>
                    </div>

                    <div className="dashboard-icon-tabs" role="tablist" aria-label="Dashboard views">
                        {focusModes.map((mode) => (
                            <button
                                key={mode.key}
                                type="button"
                                className={`dashboard-icon-tab ${focusMode === mode.key ? 'active' : ''}`}
                                onClick={() => setFocusMode(mode.key)}
                                aria-label={mode.label}
                                title={mode.label}
                            >
                                <i className={`fa-solid ${mode.icon}`} />
                            </button>
                        ))}
                    </div>
                </section>

                <section className="dashboard-stats-grid">
                    {cards.map((card) => (
                        <DashboardMetricCard key={card.title} {...card} />
                    ))}
                </section>

                <section className="dashboard-main-grid">
                    <div className="dashboard-grid-span-8">
                        <RevenueOverview
                            view={focusMode}
                            salesTrend={salesTrend}
                            hourlySales={hourlySales}
                            topProducts={topProducts}
                            summary={summary}
                        />
                    </div>

                    <div className="dashboard-grid-span-4">
                        <PaymentOverview
                            paymentBreakdown={paymentBreakdown}
                            total={summary.month_sales_total}
                        />
                    </div>

                    <div className="dashboard-grid-span-6">
                        <SalesSnapshot sales={recentSales} summary={summary} />
                    </div>

                    <div className="dashboard-grid-span-6">
                        <ProductAlerts lowStockItems={lowStockItems} summary={summary} />
                    </div>
                </section>
            </div>
        </AppLayout>
    )
}
