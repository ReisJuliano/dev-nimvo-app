import { Link, usePage } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import './dashboard.css'

function getGreeting() {
    const hour = new Date().getHours()

    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'

    return 'Boa noite'
}

function formatSaleTime(value) {
    if (!value) return '--:--'

    try {
        return new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(value))
    } catch {
        return formatDateTime(value)
    }
}

function paymentLabel(method) {
    const labels = {
        cash: 'Dinheiro',
        pix: 'Pix',
        debit_card: 'Debito',
        credit_card: 'Credito',
        credit: 'Fiado',
        mixed: 'Misto',
    }

    return labels[method] || method || 'Nao informado'
}

function growthBadge(value) {
    const numeric = Number(value || 0)
    const isPositive = numeric >= 0

    return {
        label: `${isPositive ? '+' : ''}${formatNumber(numeric)}% vs ontem`,
        tone: isPositive ? 'positive' : 'negative',
    }
}

export default function Dashboard({ summary = {}, lowStockItems = [], recentSales = [] }) {
    const { auth, tenant } = usePage().props
    const firstName = String(auth?.user?.name || 'loja').trim().split(/\s+/)[0]
    const salesGrowth = growthBadge(summary.today_growth)
    const profitMargin = Number(summary.today_sales_total || 0) > 0
        ? (Number(summary.today_profit || 0) / Number(summary.today_sales_total || 0)) * 100
        : 0
    const hasOpenCashRegister = Boolean(summary.open_cash_register_id)

    const shortcuts = [
        { href: '/caixa', label: 'Abrir caixa', icon: 'fa-vault', tone: 'green', visible: !hasOpenCashRegister },
        { href: '/pdv', label: 'Vender agora', icon: 'fa-cash-register', tone: 'accent', visible: hasOpenCashRegister },
        { href: '/produtos', label: 'Cadastrar produto', icon: 'fa-box', tone: 'amber', visible: true },
        { href: '/fiado', label: 'Ver fiados', icon: 'fa-handshake', tone: 'rose', visible: true },
        { href: '/caixa', label: 'Fechar caixa', icon: 'fa-lock', tone: 'slate', visible: hasOpenCashRegister },
    ]

    const cards = [
        {
            title: 'Vendido hoje',
            value: formatMoney(summary.today_sales_total || 0),
            note: `${formatNumber(summary.today_sales_qty || 0)} venda(s)`,
            badge: salesGrowth.label,
            badgeTone: salesGrowth.tone,
            icon: 'fa-arrow-trend-up',
            color: 'blue',
        },
        {
            title: 'Lucro estimado',
            value: formatMoney(summary.today_profit || 0),
            note: `${formatNumber(profitMargin)}% de margem`,
            badge: 'Estimado',
            badgeTone: 'neutral',
            icon: 'fa-chart-pie',
            color: 'green',
        },
        {
            title: 'Fiado em aberto',
            value: formatMoney(summary.open_credit_total || 0),
            note: 'A receber de clientes',
            badge: 'Fiado',
            badgeTone: 'warning',
            icon: 'fa-handshake',
            color: 'amber',
        },
        {
            title: 'Saldo do caixa',
            value: hasOpenCashRegister ? formatMoney(summary.open_cash_register_amount || 0) : 'Fechado',
            note: hasOpenCashRegister
                ? `Aberto em ${formatDateTime(summary.open_cash_register_opened_at)}`
                : 'Abra o caixa para comecar a vender.',
            badge: hasOpenCashRegister ? 'Aberto' : 'Fechado',
            badgeTone: hasOpenCashRegister ? 'positive' : 'neutral',
            icon: 'fa-vault',
            color: hasOpenCashRegister ? 'teal' : 'gray',
        },
    ]

    return (
        <AppLayout title="Resumo da loja">
            <div className="store-summary-page">
                <section className="store-summary-hero">
                    <div className="store-summary-hero-copy">
                        <div className="store-summary-hero-greeting">
                            <div className="store-summary-hero-wave">
                                <i className="fa-solid fa-store" />
                            </div>
                            <div>
                                <h1>{getGreeting()}, {firstName}!</h1>
                                <p>Veja como está indo a loja hoje.</p>
                            </div>
                        </div>
                    </div>
                    <div className="store-summary-hero-right">
                        <strong className="store-summary-hero-store">{tenant?.name || 'Nimvo'}</strong>
                        <span className={`store-summary-hero-status ${hasOpenCashRegister ? 'open' : 'closed'}`}>
                            <i className={`fa-solid ${hasOpenCashRegister ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                            Caixa {hasOpenCashRegister ? 'aberto' : 'fechado'}
                        </span>
                    </div>
                </section>

                <section className="store-summary-shortcuts" aria-label="Atalhos rapidos">
                    {shortcuts.filter((shortcut) => shortcut.visible).map((shortcut) => (
                        <Link key={shortcut.label} className={`store-summary-shortcut tone-${shortcut.tone}`} href={shortcut.href}>
                            <i className={`fa-solid ${shortcut.icon}`} />
                            <span>{shortcut.label}</span>
                        </Link>
                    ))}
                </section>

                <section className="store-summary-cards" aria-label="Resumo de hoje">
                    {cards.map((card) => (
                        <article key={card.title} className={`store-summary-card store-summary-card--${card.color}`}>
                            <div className="store-summary-card-top">
                                <div className={`store-summary-card-icon store-summary-card-icon--${card.color}`}>
                                    <i className={`fa-solid ${card.icon}`} />
                                </div>
                                <b className={`store-summary-badge ${card.badgeTone}`}>{card.badge}</b>
                            </div>
                            <span>{card.title}</span>
                            <strong>{card.value}</strong>
                            <small>{card.note}</small>
                        </article>
                    ))}
                </section>

                {lowStockItems?.length ? (
                    <section className="store-summary-panel">
                        <header>
                            <div>
                                <h2>Esta acabando</h2>
                                <p>{formatNumber(lowStockItems.length)} produto(s) precisam de reposicao.</p>
                            </div>
                            {Number(summary.low_stock_count || 0) > 5 ? <Link href="/entrada-estoque">Ver todos</Link> : null}
                        </header>
                        <div className="store-summary-list">
                            {lowStockItems.slice(0, 5).map((product) => (
                                <div key={product.id} className="store-summary-list-row">
                                    <span>{product.name}</span>
                                    <strong>{formatNumber(product.stock_quantity)} {product.unit || 'UN'}</strong>
                                    <Link href={`/entrada-estoque?product=${product.id}`}>Recebi mais</Link>
                                </div>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className="store-summary-panel">
                    <header>
                        <div>
                            <h2>Ultimas vendas</h2>
                            <p>As 5 vendas mais recentes da loja.</p>
                        </div>
                        <Link href="/relatorios">Ver todas as vendas</Link>
                    </header>
                    {recentSales?.length ? (
                        <div className="store-summary-sales-list">
                            {recentSales.slice(0, 5).map((sale) => (
                                <div key={sale.id} className="store-summary-sale-row">
                                    <span>{formatSaleTime(sale.created_at)}</span>
                                    <strong>{sale.customer_name || 'Sem cliente'}</strong>
                                    <small>{paymentLabel(sale.payment_method)}</small>
                                    <b>{formatMoney(sale.total || 0)}</b>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="store-summary-empty">
                            <i className="fa-solid fa-receipt" />
                            <strong>Nenhuma venda hoje ainda</strong>
                            <span>Quando a primeira venda sair, ela aparece aqui.</span>
                        </div>
                    )}
                </section>
            </div>
        </AppLayout>
    )
}
