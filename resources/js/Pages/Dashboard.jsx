import AppLayout from '@/Layouts/AppLayout'
import DashboardMetricCard from '@/Components/Dashboard/Widgets/DashboardMetricCard'
import ProductAlerts from '@/Components/Dashboard/Widgets/ProductAlerts'
import SalesSnapshot from '@/Components/Dashboard/Widgets/SalesSnapshot'
import './dashboard.css'

export default function Dashboard({ summary, recentSales, topProducts, lowStockItems }) {
    return (
        <AppLayout title="Inicio">
            <div className="dashboard-page">
                <section className="dashboard-hero-card">
                    <span>Operacao inicial migrada para React</span>
                    <h1>Painel do PDV</h1>
                    <p>
                        Este painel replica o inicio do projeto de referencia com foco em vendas do dia,
                        lucro, controle de produtos e acessos rapidos para as novas telas do tenant.
                    </p>
                </section>

                <section className="dashboard-metrics-grid">
                    <DashboardMetricCard
                        title="Vendas hoje"
                        value={summary.today_sales_total}
                        subtitle={`${summary.today_sales_qty} venda(s) finalizadas`}
                        tone="success"
                    />
                    <DashboardMetricCard
                        title="Lucro hoje"
                        value={summary.today_profit}
                        subtitle="Margem calculada pelo custo cadastrado"
                    />
                    <DashboardMetricCard
                        title="Vendas no mes"
                        value={summary.month_sales_total}
                        subtitle={`${summary.month_sales_qty} venda(s) neste mes`}
                    />
                    <DashboardMetricCard
                        title="Produtos ativos"
                        value={summary.total_products}
                        subtitle={`${summary.low_stock_count} com estoque baixo`}
                        type="number"
                        tone="warning"
                    />
                </section>

                <section className="dashboard-content-grid">
                    <SalesSnapshot sales={recentSales} />
                    <ProductAlerts topProducts={topProducts} lowStockItems={lowStockItems} />
                </section>
            </div>
        </AppLayout>
    )
}
