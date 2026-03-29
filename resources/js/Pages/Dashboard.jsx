import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import DashboardMetricCard from '@/Components/Dashboard/Widgets/DashboardMetricCard'
import ProductAlerts from '@/Components/Dashboard/Widgets/ProductAlerts'
import SalesSnapshot from '@/Components/Dashboard/Widgets/SalesSnapshot'
import { formatMoney, formatNumber } from '@/lib/format'
import './dashboard.css'

export default function Dashboard({ summary, recentSales, topProducts, lowStockItems }) {
    const [activeTab, setActiveTab] = useState('overview')

    const summaryCards = useMemo(
        () => [
            {
                title: 'Ticket medio',
                value:
                    Number(summary.today_sales_qty) > 0
                        ? Number(summary.today_sales_total) / Number(summary.today_sales_qty)
                        : 0,
                caption: 'Media por venda hoje',
                tone: 'info',
            },
            {
                title: 'Itens criticos',
                value: summary.low_stock_count,
                caption: 'Produtos com estoque baixo',
                tone: 'warning',
                type: 'number',
            },
            {
                title: 'Produtos ativos',
                value: summary.total_products,
                caption: 'Produtos ativos no cadastro',
                tone: 'success',
                type: 'number',
            },
        ],
        [summary],
    )

    return (
        <AppLayout title="Inicio">
            <div className="dashboard-page">
                <section className="dashboard-hero-card">
                    <div className="dashboard-hero-copy">
                        <span>Resumo do dia</span>
                        <h1>Inicio</h1>
                        <p>Vendas, estoque e ultimos lancamentos.</p>
                    </div>

                    <div className="dashboard-hero-aside">
                        <div className="dashboard-hero-stat">
                            <small>Receita do dia</small>
                            <strong>{formatMoney(summary.today_sales_total)}</strong>
                        </div>
                        <div className="dashboard-hero-stat">
                            <small>Vendas concluidas</small>
                            <strong>{formatNumber(summary.today_sales_qty)}</strong>
                        </div>
                        <div className="dashboard-hero-stat">
                            <small>Estoque baixo</small>
                            <strong>{formatNumber(summary.low_stock_count)}</strong>
                        </div>
                    </div>
                </section>

                <section className="ui-tabs dashboard-tabs">
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <i className="fa-solid fa-grid-2" />
                        <span>Visao geral</span>
                    </button>
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'sales' ? 'active' : ''}`}
                        onClick={() => setActiveTab('sales')}
                    >
                        <i className="fa-solid fa-chart-line" />
                        <span>Vendas</span>
                    </button>
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inventory')}
                    >
                        <i className="fa-solid fa-boxes-stacked" />
                        <span>Produtos</span>
                    </button>
                </section>

                <section className="dashboard-metrics-grid">
                    <DashboardMetricCard
                        title="Vendas hoje"
                        value={summary.today_sales_total}
                        subtitle={`${summary.today_sales_qty} venda(s) finalizadas`}
                        icon="fa-receipt"
                        tone="success"
                        footer="Total do dia"
                    />
                    <DashboardMetricCard
                        title="Lucro hoje"
                        value={summary.today_profit}
                        subtitle="Lucro calculado sobre as vendas do dia"
                        icon="fa-sack-dollar"
                        tone="info"
                        footer="Resultado do dia"
                    />
                    <DashboardMetricCard
                        title="Vendas no mes"
                        value={summary.month_sales_total}
                        subtitle={`${summary.month_sales_qty} venda(s) neste mes`}
                        icon="fa-calendar-check"
                        footer="Total acumulado no mes"
                    />
                    <DashboardMetricCard
                        title="Produtos ativos"
                        value={summary.total_products}
                        subtitle={`${summary.low_stock_count} com estoque baixo`}
                        icon="fa-boxes-stacked"
                        type="number"
                        tone="warning"
                        footer="Cadastro atual"
                    />
                </section>

                {activeTab !== 'inventory' ? (
                    <section className="dashboard-content-grid">
                        <SalesSnapshot sales={recentSales} />
                        <ProductAlerts topProducts={topProducts} lowStockItems={lowStockItems} />
                    </section>
                ) : null}

                {activeTab === 'overview' ? (
                    <section className="dashboard-summary-grid">
                        {summaryCards.map((card) => (
                            <article key={card.title} className={`dashboard-summary-card tone-${card.tone}`}>
                                <span>{card.title}</span>
                                <strong>{card.type === 'number' ? formatNumber(card.value) : formatMoney(card.value)}</strong>
                                <p>{card.caption}</p>
                            </article>
                        ))}
                    </section>
                ) : null}

                {activeTab === 'sales' ? (
                    <section className="dashboard-focus-panel ui-card">
                        <div className="ui-card-header">
                            <div>
                                <h2>Vendas</h2>
                                <p>Resumo das vendas recentes.</p>
                            </div>
                            <span className="ui-badge primary">Hoje</span>
                        </div>
                        <div className="ui-card-body">
                            <SalesSnapshot sales={recentSales} mode="expanded" />
                        </div>
                    </section>
                ) : null}

                {activeTab === 'inventory' ? (
                    <section className="dashboard-focus-panel ui-card">
                        <div className="ui-card-header">
                            <div>
                                <h2>Produtos</h2>
                                <p>Mais vendidos e estoque baixo.</p>
                            </div>
                            <span className="ui-badge warning">Estoque</span>
                        </div>
                        <div className="ui-card-body">
                            <ProductAlerts topProducts={topProducts} lowStockItems={lowStockItems} mode="expanded" />
                        </div>
                    </section>
                ) : null}
            </div>
        </AppLayout>
    )
}
