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

function getShortDate() {
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

function formatSaleTime(value) {
    if (!value) return '--:--'
    try {
        return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
    } catch {
        return formatDateTime(value)
    }
}

function paymentLabel(method) {
    const labels = {
        cash: 'Dinheiro', pix: 'Pix', debit_card: 'Débito',
        credit_card: 'Crédito', credit: 'Fiado', mixed: 'Misto',
    }
    return labels[method] || method || 'Não informado'
}

function paymentIcon(method) {
    const icons = {
        cash: 'fa-money-bill-wave', pix: 'fa-qrcode',
        debit_card: 'fa-credit-card', credit_card: 'fa-credit-card',
        credit: 'fa-handshake', mixed: 'fa-shuffle',
    }
    return icons[method] || 'fa-circle-dollar-to-slot'
}

function growthBadge(value) {
    const numeric = Number(value || 0)
    const isPositive = numeric >= 0
    return {
        label: `${isPositive ? '+' : ''}${formatNumber(numeric)}%`,
        tone: isPositive ? 'positive' : 'negative',
    }
}

export default function Dashboard({ summary = {}, lowStockItems = [], expiringSoonItems = [], recentSales = [] }) {
    const { auth, tenant } = usePage().props
    const firstName = String(auth?.user?.name || 'loja').trim().split(/\s+/)[0]
    const salesGrowth = growthBadge(summary.today_growth)
    const profitMargin = Number(summary.today_sales_total || 0) > 0
        ? (Number(summary.today_profit || 0) / Number(summary.today_sales_total || 0)) * 100
        : 0
    const hasOpenCashRegister     = Boolean(summary.open_cash_register_id)
    const overduePayablesCount    = Number(summary.overdue_payables_count || 0)
    const overduePayablesTotal    = Number(summary.overdue_payables_total || 0)

    const shortcuts = [
        { href: '/caixa', label: 'Abrir caixa', icon: 'fa-lock-open', tone: 'green', visible: !hasOpenCashRegister },
        { href: '/pdv', label: 'Vender agora', icon: 'fa-cash-register', tone: 'accent', visible: hasOpenCashRegister },
        { href: '/produtos', label: 'Novo produto', icon: 'fa-plus', tone: 'indigo', visible: true },
        { href: '/fiado', label: 'Ver fiados', icon: 'fa-handshake', tone: 'amber', visible: true },
        { href: '/contas-a-pagar', label: 'Contas', icon: 'fa-file-invoice-dollar', tone: 'rose', visible: true },
        { href: '/caixa', label: 'Fechar caixa', icon: 'fa-lock', tone: 'slate', visible: hasOpenCashRegister },
    ].filter((s) => s.visible)

    const kpis = [
        {
            title: 'Vendido hoje',
            value: formatMoney(summary.today_sales_total || 0),
            note: `${formatNumber(summary.today_sales_qty || 0)} venda(s)`,
            badge: salesGrowth.label,
            badgeTone: salesGrowth.tone,
            icon: 'fa-arrow-trend-up',
            color: 'indigo',
        },
        {
            title: 'Lucro estimado',
            value: formatMoney(summary.today_profit || 0),
            note: `${formatNumber(profitMargin, { maximumFractionDigits: 1 })}% de margem`,
            badge: 'Estimado',
            badgeTone: 'neutral',
            icon: 'fa-chart-pie',
            color: 'green',
        },
        {
            title: 'Fiado em aberto',
            value: formatMoney(summary.open_credit_total || 0),
            note: 'A receber de clientes',
            badge: 'Pendente',
            badgeTone: 'warning',
            icon: 'fa-handshake',
            color: 'amber',
        },
        {
            title: 'Saldo do caixa',
            value: hasOpenCashRegister ? formatMoney(summary.open_cash_register_amount || 0) : 'Fechado',
            note: hasOpenCashRegister
                ? `Aberto ${formatDateTime(summary.open_cash_register_opened_at)}`
                : 'Abra o caixa para vender.',
            badge: hasOpenCashRegister ? 'Aberto' : 'Fechado',
            badgeTone: hasOpenCashRegister ? 'positive' : 'neutral',
            icon: 'fa-vault',
            color: hasOpenCashRegister ? 'teal' : 'gray',
        },
        {
            title: 'Ticket médio',
            value: formatMoney(summary.average_ticket || 0),
            note: 'Média por venda no mês',
            badge: 'Mensal',
            badgeTone: 'neutral',
            icon: 'fa-receipt',
            color: 'violet',
        },
        {
            title: 'Saldo projetado (30 dias)',
            value: formatMoney(summary.projected_balance_30d || 0),
            note: 'Receita estimada menos contas a pagar',
            badge: 'Estimativa',
            badgeTone: 'neutral',
            icon: 'fa-piggy-bank',
            color: Number(summary.projected_balance_30d || 0) >= 0 ? 'teal' : 'rose',
        },
    ]

    const quickAccess = [
        { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked', color: 'indigo' },
        { href: '/clientes', label: 'Clientes', icon: 'fa-users', color: 'blue' },
        { href: '/relatorios', label: 'Relatórios', icon: 'fa-chart-bar', color: 'violet' },
        { href: '/contas-a-pagar', label: 'Contas', icon: 'fa-file-invoice-dollar', color: 'rose' },
        { href: '/entrada-estoque', label: 'Entrada', icon: 'fa-truck-ramp-box', color: 'green' },
        { href: '/estoque', label: 'Estoque', icon: 'fa-warehouse', color: 'teal' },
    ]

    return (
        <AppLayout title="Resumo da loja">
            <div className="ds-page">

                {/* ─── HERO ─── */}
                <section className="ds-hero">
                    <div className="ds-hero-top">
                        <div className="ds-hero-identity">
                            <div className="ds-hero-icon">
                                <i className="fa-solid fa-store" />
                            </div>
                            <div>
                                <h1 className="ds-hero-greeting">{getGreeting()}, {firstName}!</h1>
                                <p className="ds-hero-sub">{tenant?.name || 'Nimvo'} · {getShortDate()}</p>
                            </div>
                        </div>
                        <div className="ds-hero-status-row">
                            <span className={`ds-cash-badge ${hasOpenCashRegister ? 'open' : 'closed'}`}>
                                <i className={`fa-solid ${hasOpenCashRegister ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                                Caixa {hasOpenCashRegister ? 'aberto' : 'fechado'}
                            </span>
                            {hasOpenCashRegister ? (
                                <span className="ds-sales-chip">
                                    <i className="fa-solid fa-receipt" />
                                    {formatNumber(summary.today_sales_qty || 0)} venda(s) hoje
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="ds-hero-actions">
                        {shortcuts.map((shortcut) => (
                            <Link key={shortcut.label} className={`ds-action tone-${shortcut.tone}`} href={shortcut.href}>
                                <i className={`fa-solid ${shortcut.icon}`} />
                                <span>{shortcut.label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* ─── ALERTA DE BOLETOS VENCIDOS ─── */}
                {overduePayablesCount > 0 ? (
                    <Link href="/contas-a-pagar" className="ds-overdue-alert">
                        <div className="ds-overdue-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>
                        <div className="ds-overdue-body">
                            <strong>
                                {overduePayablesCount === 1
                                    ? '1 conta vencida'
                                    : `${formatNumber(overduePayablesCount)} contas vencidas`}
                            </strong>
                            <span>
                                Total em atraso: {formatMoney(overduePayablesTotal)} — clique para ver e pagar.
                            </span>
                        </div>
                        <i className="fa-solid fa-arrow-right ds-overdue-arrow" />
                    </Link>
                ) : null}

                {/* ─── KPI CARDS ─── */}
                <section className="ds-kpis">
                    {kpis.map((kpi) => (
                        <article key={kpi.title} className={`ds-kpi ds-kpi--${kpi.color}`}>
                            <div className="ds-kpi-top">
                                <div className={`ds-kpi-icon ds-kpi-icon--${kpi.color}`}>
                                    <i className={`fa-solid ${kpi.icon}`} />
                                </div>
                                <span className={`ds-kpi-badge ${kpi.badgeTone}`}>{kpi.badge}</span>
                            </div>
                            <p className="ds-kpi-label">{kpi.title}</p>
                            <strong className="ds-kpi-value">{kpi.value}</strong>
                            <small className="ds-kpi-note">{kpi.note}</small>
                        </article>
                    ))}
                </section>

                {/* ─── BOTTOM ─── */}
                <div className="ds-bottom">

                    {/* Últimas vendas */}
                    <section className="ds-panel ds-panel--sales">
                        <div className="ds-panel-header">
                            <div>
                                <h2>Últimas vendas</h2>
                                <p>Movimentações mais recentes do dia.</p>
                            </div>
                            <Link href="/relatorios" className="ds-panel-link">
                                <i className="fa-solid fa-arrow-right" />
                                Ver relatório
                            </Link>
                        </div>

                        {recentSales?.length ? (
                            <div className="ds-sales-list">
                                {recentSales.slice(0, 8).map((sale) => (
                                    <div key={sale.id} className="ds-sale-row">
                                        <div className="ds-sale-method-icon">
                                            <i className={`fa-solid ${paymentIcon(sale.payment_method)}`} />
                                        </div>
                                        <div className="ds-sale-info">
                                            <strong>{sale.customer_name || 'Sem cliente'}</strong>
                                            <small>{paymentLabel(sale.payment_method)}</small>
                                        </div>
                                        <span className="ds-sale-time">{formatSaleTime(sale.created_at)}</span>
                                        <b className="ds-sale-amount">{formatMoney(sale.total || 0)}</b>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ds-empty">
                                <i className="fa-solid fa-receipt" />
                                <strong>Nenhuma venda hoje ainda</strong>
                                <span>As vendas aparecerão aqui conforme forem registradas.</span>
                            </div>
                        )}
                    </section>

                    {/* Coluna direita */}
                    <div className="ds-right-col">

                        {/* Alerta de estoque baixo */}
                        {lowStockItems?.length ? (
                            <section className="ds-panel ds-panel--alert">
                                <div className="ds-panel-header">
                                    <div>
                                        <h2>
                                            <i className="fa-solid fa-triangle-exclamation" />
                                            Estoque baixo
                                        </h2>
                                        <p>{formatNumber(lowStockItems.length)} produto(s) abaixo do mínimo.</p>
                                    </div>
                                    {Number(summary.low_stock_count || 0) > 5 ? (
                                        <Link href="/entrada-estoque" className="ds-panel-link">Ver todos</Link>
                                    ) : null}
                                </div>
                                <div className="ds-stock-list">
                                    {lowStockItems.slice(0, 6).map((product) => (
                                        <div key={product.id} className="ds-stock-row">
                                            <div className="ds-stock-icon">
                                                <i className="fa-solid fa-box" />
                                            </div>
                                            <div className="ds-stock-info">
                                                <strong>{product.name}</strong>
                                                <small>{formatNumber(product.stock_quantity)} {product.unit || 'UN'} em estoque</small>
                                            </div>
                                            <Link href={`/entrada-estoque?product=${product.id}`} className="ds-repor-btn">
                                                Repor
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {/* Alerta de vencimento */}
                        {expiringSoonItems?.length ? (
                            <section className="ds-panel ds-panel--alert">
                                <div className="ds-panel-header">
                                    <div>
                                        <h2>
                                            <i className="fa-solid fa-calendar-days" />
                                            Vencendo em breve
                                        </h2>
                                        <p>
                                            {formatNumber(summary.expiring_soon_count || expiringSoonItems.length)} lote(s) vencendo em até {summary.expiring_soon_alert_days || 30} dias, {formatMoney(summary.expiring_soon_cost || 0)} em custo.
                                        </p>
                                    </div>
                                    <Link href="/estoque" className="ds-panel-link">Ver todos</Link>
                                </div>
                                <div className="ds-stock-list">
                                    {expiringSoonItems.slice(0, 6).map((lot) => (
                                        <div key={lot.id} className="ds-stock-row">
                                            <div className="ds-stock-icon">
                                                <i className="fa-solid fa-hourglass-half" />
                                            </div>
                                            <div className="ds-stock-info">
                                                <strong>{lot.product_name}</strong>
                                                <small>{formatNumber(lot.quantity)} un. vencendo em {formatDateTime(lot.expires_at)}</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {/* Acesso rápido */}
                        <section className="ds-panel ds-panel--quick">
                            <div className="ds-panel-header">
                                <div>
                                    <h2>Acesso rápido</h2>
                                    <p>Atalhos para as áreas mais usadas.</p>
                                </div>
                            </div>
                            <div className="ds-quick-grid">
                                {quickAccess.map((item) => (
                                    <Link key={item.href} href={item.href} className={`ds-quick-item ds-quick-item--${item.color}`}>
                                        <div className="ds-quick-icon">
                                            <i className={`fa-solid ${item.icon}`} />
                                        </div>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
