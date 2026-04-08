import { router } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import './credit-overview.css'

const metricIcons = {
    'Clientes ativos': 'fa-users',
    'Em aberto': 'fa-wallet',
    Disponivel: 'fa-circle-dollar-to-slot',
    'Uso da carteira': 'fa-chart-pie',
}

const quickRanges = [
    { key: 'today', label: 'Hoje', days: 0 },
    { key: 'week', label: '7d', days: 6 },
    { key: 'month', label: '30d', days: 29 },
]

function buildFilterPayload(filters, overrides = {}) {
    return Object.fromEntries(
        Object.entries({
            from: filters?.from || undefined,
            to: filters?.to || undefined,
            section: filters?.section || undefined,
            cash_register: filters?.cash_register || undefined,
            ...overrides,
        }).filter(([, value]) => value != null && value !== ''),
    )
}

function formatMetricValue(metric) {
    if (metric?.format === 'money') {
        return formatMoney(metric.value)
    }

    if (metric?.format === 'percent') {
        return formatPercent(metric.value)
    }

    if (metric?.format === 'text') {
        return metric?.value || '-'
    }

    return formatNumber(metric?.value || 0)
}

function formatInputDate(value) {
    const date = value ? new Date(value) : new Date()
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))

    return localDate.toISOString().slice(0, 10)
}

function resolveQuickRange(days) {
    const end = new Date()
    const start = new Date(end)
    start.setDate(end.getDate() - days)

    return {
        from: formatInputDate(start),
        to: formatInputDate(end),
    }
}

function getInitials(name) {
    return String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'CP'
}

function getUsageClass(percent) {
    const normalized = Number(percent || 0)

    if (normalized <= 0) {
        return 'usage-0'
    }

    if (normalized >= 100) {
        return 'usage-10'
    }

    return `usage-${Math.min(10, Math.max(1, Math.ceil(normalized / 10)))}`
}

function getStatusMeta(status) {
    if (status === 'overflow') {
        return { label: 'Acima do limite', tone: 'danger' }
    }

    if (status === 'attention') {
        return { label: 'Em alerta', tone: 'warning' }
    }

    if (status === 'active') {
        return { label: 'Com saldo', tone: 'primary' }
    }

    return { label: 'Disponivel', tone: 'muted' }
}

function CreditMetricCard({ metric, index }) {
    return (
        <article className={`credit-metric-card tone-${(index % 4) + 1}`}>
            <div className="credit-metric-top">
                <span>{metric.label}</span>
                <i className={`fa-solid ${metricIcons[metric.label] || 'fa-chart-line'}`} />
            </div>
            <strong>{formatMetricValue(metric)}</strong>
            {metric.caption ? <small>{metric.caption}</small> : null}
        </article>
    )
}

export default function CreditOverview({ module }) {
    const customers = useMemo(() => {
        const portfolio = Array.isArray(module.portfolio) ? module.portfolio : []

        return [...portfolio].sort((left, right) => {
            if (right.open_credit !== left.open_credit) {
                return right.open_credit - left.open_credit
            }

            return String(left.name || '').localeCompare(String(right.name || ''))
        })
    }, [module.portfolio])
    const recentSales = Array.isArray(module.recent_sales) ? module.recent_sales : []
    const summary = module.portfolio_summary || {}
    const [search, setSearch] = useState('')
    const [selectedCustomerId, setSelectedCustomerId] = useState(() => customers[0]?.id ?? null)

    const filteredCustomers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()

        if (!normalizedSearch) {
            return customers
        }

        return customers.filter((customer) =>
            [customer.name, customer.phone]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
        )
    }, [customers, search])

    useEffect(() => {
        if (!filteredCustomers.length) {
            setSelectedCustomerId(null)
            return
        }

        if (!filteredCustomers.some((customer) => customer.id === selectedCustomerId)) {
            setSelectedCustomerId(filteredCustomers[0].id)
        }
    }, [filteredCustomers, selectedCustomerId])

    const selectedCustomer = useMemo(
        () => filteredCustomers.find((customer) => customer.id === selectedCustomerId)
            || customers.find((customer) => customer.id === selectedCustomerId)
            || null,
        [customers, filteredCustomers, selectedCustomerId],
    )

    const selectedSales = useMemo(() => {
        if (!filteredCustomers.length && search.trim()) {
            return []
        }

        if (!selectedCustomer) {
            return recentSales
        }

        return recentSales.filter((sale) => sale.customer_id === selectedCustomer.id)
    }, [filteredCustomers.length, recentSales, search, selectedCustomer])

    const activeRangeKey = useMemo(() => {
        return quickRanges.find((range) => {
            const resolved = resolveQuickRange(range.days)

            return resolved.from === (module.filters?.from || '') && resolved.to === (module.filters?.to || '')
        })?.key || null
    }, [module.filters?.from, module.filters?.to])

    function handleFilterSubmit(event) {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)

        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, {
                from: String(formData.get('from') || '').trim() || undefined,
                to: String(formData.get('to') || '').trim() || undefined,
            }),
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    function applyQuickRange(days) {
        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, resolveQuickRange(days)),
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    function resetDates() {
        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, {
                from: undefined,
                to: undefined,
            }),
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    return (
        <AppLayout title={module.title}>
            <div className="credit-page">
                <section className="credit-header-card">
                    <div className="credit-header-copy">
                        <span className="credit-kicker">Carteira</span>
                        <div className="credit-header-row">
                            <div className="credit-header-title">
                                <h1>{module.title}</h1>
                                <span>{module.description}</span>
                            </div>

                            <div className="credit-header-pills">
                                <span className="credit-pill">{formatNumber(customers.length)} clientes</span>
                                <span className="credit-pill accent">{formatMoney(summary.total_limit || 0)} limite</span>
                            </div>
                        </div>
                    </div>

                    <form className="credit-toolbar" onSubmit={handleFilterSubmit}>
                        <label className="credit-field">
                            <span>De</span>
                            <input name="from" type="date" defaultValue={module.filters?.from || ''} />
                        </label>

                        <label className="credit-field">
                            <span>Ate</span>
                            <input name="to" type="date" defaultValue={module.filters?.to || ''} />
                        </label>

                        <div className="credit-quick-actions">
                            {quickRanges.map((range) => (
                                <button
                                    key={range.key}
                                    type="button"
                                    className={`credit-quick-chip ${activeRangeKey === range.key ? 'active' : ''}`}
                                    onClick={() => applyQuickRange(range.days)}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>

                        <div className="credit-toolbar-actions">
                            <button type="button" className="credit-icon-button" onClick={resetDates} aria-label="Limpar periodo">
                                <i className="fa-solid fa-rotate-left" />
                            </button>
                            <button type="submit" className="credit-submit-button">
                                <i className="fa-solid fa-arrow-up-right-from-square" />
                                <span>Aplicar</span>
                            </button>
                        </div>
                    </form>
                </section>

                <section className="credit-metric-grid">
                    {(module.metrics || []).map((metric, index) => (
                        <CreditMetricCard key={metric.label} metric={metric} index={index} />
                    ))}
                </section>

                <section className="credit-main-grid">
                    <div className="credit-panel credit-portfolio-panel">
                        <header className="credit-panel-header">
                            <div>
                                <h2>Carteira</h2>
                                <span>{filteredCustomers.length} clientes no recorte</span>
                            </div>

                            <label className="credit-search-field">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar cliente"
                                />
                                {search ? (
                                    <button
                                        type="button"
                                        className="credit-icon-button subtle"
                                        onClick={() => setSearch('')}
                                        aria-label="Limpar busca"
                                    >
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                ) : null}
                            </label>
                        </header>

                        <div className="credit-summary-row">
                            <div className="credit-summary-pill">
                                <span>Com saldo</span>
                                <strong>{formatNumber(summary.with_balance || 0)}</strong>
                            </div>
                            <div className="credit-summary-pill warning">
                                <span>Em alerta</span>
                                <strong>{formatNumber(summary.near_limit || 0)}</strong>
                            </div>
                            <div className="credit-summary-pill muted">
                                <span>Sem limite</span>
                                <strong>{formatNumber(summary.without_limit || 0)}</strong>
                            </div>
                        </div>

                        {filteredCustomers.length ? (
                            <div className="credit-customer-list">
                                {filteredCustomers.map((customer) => {
                                    const status = getStatusMeta(customer.status)

                                    return (
                                        <button
                                            key={customer.id}
                                            type="button"
                                            className={`credit-customer-card ${selectedCustomer?.id === customer.id ? 'active' : ''}`}
                                            onClick={() => setSelectedCustomerId(customer.id)}
                                        >
                                            <div className="credit-customer-top">
                                                <div className="credit-avatar">{getInitials(customer.name)}</div>

                                                <div className="credit-customer-copy">
                                                    <strong>{customer.name}</strong>
                                                    <span>{customer.phone || 'Sem telefone'}</span>
                                                </div>

                                                <div className="credit-customer-balance">
                                                    <strong>{formatMoney(customer.open_credit)}</strong>
                                                    <small>{formatNumber(customer.credit_sales_count || 0)} lanc.</small>
                                                </div>
                                            </div>

                                            <div className="credit-customer-meta">
                                                <span>{formatMoney(customer.credit_limit)} limite</span>
                                                <span>{formatMoney(customer.available_credit)} livre</span>
                                                <span className={`credit-status-chip ${status.tone}`}>{status.label}</span>
                                            </div>

                                            <div className="credit-progress-track">
                                                <span className={`credit-progress-fill ${status.tone} ${getUsageClass(customer.utilization_percent)}`} />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="credit-empty-state">
                                <i className="fa-solid fa-wallet" />
                                <span>Sem carteira</span>
                            </div>
                        )}
                    </div>

                    <aside className="credit-panel credit-focus-panel">
                        {selectedCustomer ? (
                            <>
                                <header className="credit-panel-header">
                                    <div>
                                        <h2>{selectedCustomer.name}</h2>
                                        <span>{selectedCustomer.phone || 'Sem telefone'}</span>
                                    </div>
                                    <span className={`credit-status-chip ${getStatusMeta(selectedCustomer.status).tone}`}>
                                        {getStatusMeta(selectedCustomer.status).label}
                                    </span>
                                </header>

                                <div className="credit-focus-hero">
                                    <div className="credit-avatar large">{getInitials(selectedCustomer.name)}</div>
                                    <div className="credit-focus-copy">
                                        <strong>{formatMoney(selectedCustomer.open_credit)}</strong>
                                        <span>Saldo em aberto</span>
                                    </div>
                                </div>

                                <div className="credit-focus-grid">
                                    <div className="credit-focus-card">
                                        <span>Limite</span>
                                        <strong>{formatMoney(selectedCustomer.credit_limit)}</strong>
                                    </div>
                                    <div className="credit-focus-card">
                                        <span>Livre</span>
                                        <strong>{formatMoney(selectedCustomer.available_credit)}</strong>
                                    </div>
                                    <div className="credit-focus-card">
                                        <span>Uso</span>
                                        <strong>{formatPercent(selectedCustomer.utilization_percent || 0)}</strong>
                                    </div>
                                    <div className="credit-focus-card">
                                        <span>Lanc.</span>
                                        <strong>{formatNumber(selectedCustomer.credit_sales_count || 0)}</strong>
                                    </div>
                                </div>

                                <div className="credit-focus-progress">
                                    <div className="credit-focus-progress-copy">
                                        <span>Consumo do limite</span>
                                        <strong>{formatPercent(selectedCustomer.utilization_percent || 0)}</strong>
                                    </div>

                                    <div className="credit-progress-track large">
                                        <span
                                            className={`credit-progress-fill ${getStatusMeta(selectedCustomer.status).tone} ${getUsageClass(selectedCustomer.utilization_percent)}`}
                                        />
                                    </div>
                                </div>

                                <div className="credit-highlight-card">
                                    <span>Ultimo lancamento</span>
                                    <strong>
                                        {selectedCustomer.last_credit_at
                                            ? formatDateTime(selectedCustomer.last_credit_at)
                                            : 'Sem registro'}
                                    </strong>
                                </div>

                                <div className="credit-highlight-card">
                                    <span>Maior exposicao</span>
                                    <strong>{summary.largest_exposure?.name || 'Sem destaque'}</strong>
                                    <small>{formatMoney(summary.largest_exposure?.amount || 0)}</small>
                                </div>
                            </>
                        ) : (
                            <div className="credit-empty-state tall">
                                <i className="fa-solid fa-user-group" />
                                <span>Selecione cliente</span>
                            </div>
                        )}
                    </aside>
                </section>

                <section className="credit-panel credit-activity-panel">
                    <header className="credit-panel-header">
                        <div>
                            <h2>{selectedCustomer ? 'Historico recente' : 'Lancamentos recentes'}</h2>
                            <span>{selectedCustomer ? selectedCustomer.name : 'Toda a carteira'}</span>
                        </div>

                        <div className="credit-activity-meta">
                            <span>{formatNumber(selectedSales.length)} registros</span>
                            <strong>{formatMoney(selectedSales.reduce((total, sale) => total + Number(sale.credit_amount || 0), 0))}</strong>
                        </div>
                    </header>

                    {selectedSales.length ? (
                        <div className="credit-activity-list">
                            {selectedSales.slice(0, 10).map((sale) => (
                                <article key={sale.id} className="credit-activity-item">
                                    <div className="credit-activity-copy">
                                        <strong>{sale.sale_number}</strong>
                                        <span>{sale.customer_name}</span>
                                    </div>

                                    <div className="credit-activity-copy compact">
                                        <strong>{sale.user_name}</strong>
                                        <span>{formatDate(sale.created_at)}</span>
                                    </div>

                                    <div className="credit-activity-value">
                                        <strong>{formatMoney(sale.credit_amount)}</strong>
                                        <span>{formatDateTime(sale.created_at)}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="credit-empty-state">
                            <i className="fa-solid fa-clock-rotate-left" />
                            <span>Sem lancamentos</span>
                        </div>
                    )}
                </section>
            </div>
        </AppLayout>
    )
}
