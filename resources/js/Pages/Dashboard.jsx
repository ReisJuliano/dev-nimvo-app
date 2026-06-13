import { Link } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import './dashboard.css'

const shortcuts = [
    { href: '/caixa', label: 'Abrir caixa / Ver caixa', icon: 'fa-vault' },
    { href: '/pdv', label: 'Vender agora', icon: 'fa-cash-register' },
    { href: '/produtos', label: 'Cadastrar produto', icon: 'fa-box' },
    { href: '/entrada-estoque', label: 'Recebi mercadoria', icon: 'fa-dolly' },
    { href: '/fiado', label: 'Ver fiados', icon: 'fa-handshake' },
    { href: '/caixa', label: 'Fechar caixa', icon: 'fa-lock' },
]

export default function Dashboard({ summary, topProducts, lowStockItems, paymentBreakdown }) {
    const cards = [
        {
            title: 'Vendido hoje',
            value: formatMoney(summary.today_sales_total || 0),
            note: `${formatNumber(summary.today_sales_qty || 0)} venda(s) hoje`,
            icon: 'fa-receipt',
        },
        {
            title: 'Lucro estimado hoje',
            value: formatMoney(summary.today_profit || 0),
            note: 'Com base no custo cadastrado',
            icon: 'fa-chart-line',
        },
        {
            title: 'Fiado em aberto',
            value: formatMoney(summary.open_credit_total || 0),
            note: 'Valores vendidos para receber depois',
            icon: 'fa-handshake',
        },
        {
            title: 'Produtos acabando',
            value: formatNumber(summary.low_stock_count || 0),
            note: summary.low_stock_count > 0 ? 'Precisa repor' : 'Tudo certo por enquanto.',
            icon: 'fa-triangle-exclamation',
        },
        {
            title: 'Caixa atual',
            value: summary.open_cash_register_id ? 'Aberto' : 'Fechado',
            note: summary.open_cash_register_id
                ? `Aberto em ${formatDateTime(summary.open_cash_register_opened_at)}`
                : 'Abra o caixa para comecar a vender.',
            icon: 'fa-vault',
        },
    ]

    return (
        <AppLayout title="Resumo da loja">
            <div className="dashboard-page store-summary-page">
                <section className="store-summary-hero">
                    <div>
                        <h1>Resumo da loja</h1>
                        <p>Veja como a loja esta hoje.</p>
                    </div>
                    <a className="store-summary-detail-link" href="#mais-detalhes">
                        Ver mais detalhes
                    </a>
                </section>

                <section className="store-summary-shortcuts" aria-label="Atalhos principais">
                    {shortcuts.map((shortcut) => (
                        <Link key={shortcut.label} className="store-summary-shortcut" href={shortcut.href}>
                            <i className={`fa-solid ${shortcut.icon}`} />
                            <span>{shortcut.label}</span>
                        </Link>
                    ))}
                </section>

                <section className="store-summary-cards">
                    {cards.map((card) => (
                        <article key={card.title} className="store-summary-card">
                            <i className={`fa-solid ${card.icon}`} />
                            <span>{card.title}</span>
                            <strong>{card.value}</strong>
                            <small>{card.note}</small>
                        </article>
                    ))}
                </section>

                <section id="mais-detalhes" className="store-summary-bottom">
                    <article className="store-summary-panel">
                        <header>
                            <h2>Produtos acabando</h2>
                            <Link href="/entrada-estoque">Recebi mais</Link>
                        </header>
                        {lowStockItems?.length ? (
                            <div className="store-summary-list">
                                {lowStockItems.slice(0, 5).map((product) => (
                                    <div key={product.id} className="store-summary-list-row">
                                        <span>{product.name}</span>
                                        <strong>{formatNumber(product.stock_quantity)} {product.unit}</strong>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="store-summary-empty">Tudo certo por enquanto.</p>
                        )}
                    </article>

                    <article className="store-summary-panel">
                        <header>
                            <h2>Mais vendidos</h2>
                            <a href="#mais-detalhes">Resumo</a>
                        </header>
                        {topProducts?.length ? (
                            <div className="store-summary-list">
                                {topProducts.slice(0, 5).map((product) => (
                                    <div key={product.name} className="store-summary-list-row">
                                        <span>{product.name}</span>
                                        <strong>{formatMoney(product.total_sold)}</strong>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="store-summary-empty">Comece vendendo para ver os produtos mais vendidos aqui.</p>
                        )}
                    </article>

                    <article className="store-summary-panel">
                        <header>
                            <h2>Formas de pagamento</h2>
                            <Link href="/caixa">Caixa</Link>
                        </header>
                        {paymentBreakdown?.length ? (
                            <div className="store-summary-list">
                                {paymentBreakdown.slice(0, 5).map((payment) => (
                                    <div key={payment.method} className="store-summary-list-row">
                                        <span>{payment.label}</span>
                                        <strong>{formatMoney(payment.total)}</strong>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="store-summary-empty">Abra o caixa e finalize vendas para acompanhar o dia.</p>
                        )}
                    </article>
                </section>
            </div>
        </AppLayout>
    )
}
