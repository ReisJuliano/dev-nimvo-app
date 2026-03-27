import { formatMoney, formatTime } from '@/lib/format'

const paymentLabels = {
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Debito',
    credit_card: 'Credito',
    credit: 'Fiado',
    mixed: 'Misto',
}

export default function SalesSnapshot({ sales = [] }) {
    return (
        <section className="dashboard-panel">
            <div className="dashboard-panel-header">
                <div>
                    <h2>Ultimas vendas</h2>
                    <p>Resumo rapido do caixa mais recente</p>
                </div>
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
                ) : (
                    <div className="dashboard-empty-state">Nenhuma venda finalizada ainda.</div>
                )}
            </div>
        </section>
    )
}
