import { formatMoney, formatNumber, formatTime } from '@/lib/format'

const paymentLabels = {
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Debito',
    credit_card: 'Credito',
    credit: 'A prazo',
    mixed: 'Misto',
}

export default function SalesSnapshot({ sales = [], summary }) {
    const hasSales = sales.length > 0

    return (
        <section className="dashboard-surface dashboard-surface-list">
            <header className="dashboard-surface-header">
                <div className="dashboard-surface-title">
                    <strong>Ultimas vendas</strong>
                    <span>{formatNumber(sales.length)}</span>
                </div>

                <div className="dashboard-chip-group">
                    <span className="dashboard-soft-chip">{formatNumber(summary.today_sales_qty)}x</span>
                    <span className="dashboard-soft-chip">{formatMoney(summary.average_ticket)}</span>
                </div>
            </header>

            <div className="dashboard-sales-list">
                {hasSales ? (
                    sales.map((sale) => (
                        <article key={sale.id} className="dashboard-sale-item">
                            <div className="dashboard-sale-copy">
                                <span className="dashboard-sale-icon">
                                    <i className="fa-solid fa-receipt" />
                                </span>
                                <div>
                                    <strong>{sale.sale_number}</strong>
                                    <small>{sale.customer_name}</small>
                                </div>
                            </div>

                            <div className="dashboard-sale-meta">
                                <span>{paymentLabels[sale.payment_method] ?? sale.payment_method}</span>
                                <small>{formatTime(sale.created_at)}</small>
                            </div>

                            <b>{formatMoney(sale.total)}</b>
                        </article>
                    ))
                ) : (
                    <div className="dashboard-empty-state">
                        <i className="fa-solid fa-receipt" />
                        <span>Sem vendas</span>
                    </div>
                )}
            </div>
        </section>
    )
}
