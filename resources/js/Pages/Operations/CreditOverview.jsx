import { router } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearch, normalizeTextSearch } from '@/lib/textSearch'
import './credit-overview.css'

const quickRanges = [
    { key: 'today', label: 'Hoje', days: 0 },
    { key: 'week', label: '7d', days: 6 },
    { key: 'month', label: '30d', days: 29 },
]

const customerFilters = [
    { key: 'all', label: 'Todos' },
    { key: 'debt', label: 'Devendo' },
    { key: 'attention', label: 'Em alerta' },
    { key: 'overflow', label: 'Acima limite' },
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

function matchesCustomerFilter(customer, activeFilter) {
    if (activeFilter === 'debt') {
        return Number(customer.open_credit || 0) > 0
    }

    if (activeFilter === 'attention') {
        return customer.status === 'attention'
    }

    if (activeFilter === 'overflow') {
        return customer.status === 'overflow'
    }

    return true
}

function CreditCustomerModal({ customer, sales, onClose }) {
    if (!customer) {
        return null
    }

    const status = getStatusMeta(customer.status)
    const historyTotal = sales.reduce((total, sale) => total + Number(sale.credit_amount || 0), 0)

    return (
        <div className="credit-modal-backdrop" onClick={onClose} role="presentation">
            <section className="credit-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="credit-modal-title">
                <header className="credit-modal-header">
                    <div className="credit-modal-heading">
                        <div className="credit-avatar large">{getInitials(customer.name)}</div>
                        <div>
                            <h2 id="credit-modal-title">{customer.name}</h2>
                            <span>{customer.phone || 'Sem telefone'}</span>
                        </div>
                    </div>

                    <div className="credit-modal-header-actions">
                        <span className={`credit-status-chip ${status.tone}`}>{status.label}</span>
                        <button type="button" className="credit-icon-button" onClick={onClose} aria-label="Fechar detalhes">
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </header>

                <div className="credit-modal-body">
                    <section className="credit-modal-grid">
                        <article className="credit-focus-card">
                            <span>Saldo</span>
                            <strong>{formatMoney(customer.open_credit)}</strong>
                        </article>
                        <article className="credit-focus-card">
                            <span>Limite</span>
                            <strong>{formatMoney(customer.credit_limit)}</strong>
                        </article>
                        <article className="credit-focus-card">
                            <span>Livre</span>
                            <strong>{formatMoney(customer.available_credit)}</strong>
                        </article>
                        <article className="credit-focus-card">
                            <span>Uso</span>
                            <strong>{formatPercent(customer.utilization_percent || 0)}</strong>
                        </article>
                    </section>

                    <section className="credit-modal-progress">
                        <div className="credit-focus-progress-copy">
                            <span>Consumo do limite</span>
                            <strong>{formatPercent(customer.utilization_percent || 0)}</strong>
                        </div>

                        <div className="credit-progress-track large">
                            <span className={`credit-progress-fill ${status.tone} ${getUsageClass(customer.utilization_percent)}`} />
                        </div>
                    </section>

                    <section className="credit-modal-grid compact">
                        <article className="credit-highlight-card">
                            <span>Ultimo lanc.</span>
                            <strong>{customer.last_credit_at ? formatDateTime(customer.last_credit_at) : 'Sem registro'}</strong>
                        </article>
                        <article className="credit-highlight-card">
                            <span>Historico</span>
                            <strong>{formatMoney(historyTotal)}</strong>
                            <small>{formatNumber(customer.credit_sales_count || 0)} lancamentos</small>
                        </article>
                    </section>

                    <section className="credit-modal-history">
                        <header className="credit-panel-header">
                            <div>
                                <h3>Historico recente</h3>
                                <span>{sales.length} registros no periodo</span>
                            </div>
                        </header>

                        {sales.length ? (
                            <div className="credit-activity-list">
                                {sales.slice(0, 10).map((sale) => (
                                    <article key={sale.id} className="credit-activity-item">
                                        <div className="credit-activity-copy">
                                            <strong>{sale.sale_number}</strong>
                                            <span>{sale.user_name}</span>
                                        </div>

                                        <div className="credit-activity-copy compact">
                                            <strong>{formatMoney(sale.credit_amount)}</strong>
                                            <span>{formatDate(sale.created_at)}</span>
                                        </div>

                                        <div className="credit-activity-value">
                                            <strong>{formatMoney(sale.total)}</strong>
                                            <span>{formatDateTime(sale.created_at)}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="credit-empty-state small">
                                <i className="fa-solid fa-clock-rotate-left" />
                                <span>Sem lancamentos</span>
                            </div>
                        )}
                    </section>
                </div>
            </section>
        </div>
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
    const searchControl = useConfirmedSearch('')
    const [activeFilter, setActiveFilter] = useState('all')
    const [activeCustomerId, setActiveCustomerId] = useState(null)
    const [dateRange, setDateRange] = useState({
        from: module.filters?.from || '',
        to: module.filters?.to || '',
    })

    useEffect(() => {
        setDateRange({
            from: module.filters?.from || '',
            to: module.filters?.to || '',
        })
    }, [module.filters?.from, module.filters?.to])

    useEffect(() => {
        if (!activeCustomerId) {
            return
        }

        if (!customers.some((customer) => customer.id === activeCustomerId)) {
            setActiveCustomerId(null)
        }
    }, [activeCustomerId, customers])

    const normalizedSearch = normalizeTextSearch(searchControl.value)
    const shouldShowResults = normalizedSearch.length > 0

    const filteredCustomers = useMemo(() => {
        if (!shouldShowResults) {
            return []
        }

        return customers.filter((customer) =>
            matchesTextSearch(customer.name, normalizedSearch)
            && matchesCustomerFilter(customer, activeFilter),
        )
    }, [activeFilter, customers, normalizedSearch, shouldShowResults])

    const activeCustomer = useMemo(
        () => customers.find((customer) => customer.id === activeCustomerId) || null,
        [activeCustomerId, customers],
    )
    const activeCustomerSales = useMemo(
        () => recentSales.filter((sale) => sale.customer_id === activeCustomer?.id),
        [activeCustomer?.id, recentSales],
    )

    const activeRangeKey = useMemo(() => {
        return quickRanges.find((range) => {
            const resolved = resolveQuickRange(range.days)

            return resolved.from === dateRange.from && resolved.to === dateRange.to
        })?.key || null
    }, [dateRange.from, dateRange.to])

    function submitFilters(nextRange = dateRange) {
        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, {
                from: nextRange.from || undefined,
                to: nextRange.to || undefined,
            }),
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    function handleFilterSubmit(event) {
        event.preventDefault()
        submitFilters()
    }

    function applyQuickRange(days) {
        const nextRange = resolveQuickRange(days)
        setDateRange(nextRange)
        submitFilters(nextRange)
    }

    function resetDates() {
        const nextRange = { from: '', to: '' }
        setDateRange(nextRange)
        submitFilters(nextRange)
    }

    return (
        <AppLayout title={module.title}>
            <div className="credit-page">
                <section className="credit-header-card">
                    <div className="credit-header-copy">
                        <span className="credit-kicker">Carteira</span>
                        <div className="credit-header-title">
                            <h1>{module.title}</h1>
                            {typeof module.description === 'string' && module.description.trim() ? (
                                <span>{module.description}</span>
                            ) : null}
                        </div>
                    </div>

                    <form className="credit-toolbar compact" onSubmit={handleFilterSubmit}>
                        <label className="credit-search-bar">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                type="search"
                                value={searchControl.draftValue}
                                onChange={(event) => searchControl.setDraftValue(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter') {
                                        return
                                    }

                                    event.preventDefault()
                                    searchControl.apply()
                                }}
                                placeholder="Buscar cliente por nome"
                            />
                            <button type="button" className="credit-search-apply" onClick={() => searchControl.apply()}>
                                Pesquisar
                            </button>
                            {searchControl.draftValue || searchControl.value ? (
                                <button type="button" className="credit-icon-button subtle" onClick={() => searchControl.clear()} aria-label="Limpar busca">
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            ) : null}
                        </label>

                        <div className="credit-filter-row">
                            <div className="credit-filter-chips">
                                {customerFilters.map((filter) => (
                                    <button
                                        key={filter.key}
                                        type="button"
                                        className={`credit-quick-chip ${activeFilter === filter.key ? 'active' : ''}`}
                                        onClick={() => setActiveFilter(filter.key)}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>

                            <div className="credit-date-row">
                                <label className="credit-field inline">
                                    <span>De</span>
                                    <input
                                        name="from"
                                        type="date"
                                        value={dateRange.from}
                                        onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))}
                                    />
                                </label>

                                <label className="credit-field inline">
                                    <span>Ate</span>
                                    <input
                                        name="to"
                                        type="date"
                                        value={dateRange.to}
                                        onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))}
                                    />
                                </label>
                            </div>

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
                                    <span>Filtrar</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </section>

                <section className="credit-panel credit-results-panel">
                    <header className="credit-panel-header">
                        <div>
                            <h2>Busca</h2>
                            <span>
                                {shouldShowResults
                                    ? `${filteredCustomers.length} resultado(s)`
                                    : 'Pesquise por nome para listar clientes'}
                            </span>
                        </div>

                        <div className="credit-results-meta">
                            <span>{customerFilters.find((filter) => filter.key === activeFilter)?.label || 'Todos'}</span>
                        </div>
                    </header>

                    {!shouldShowResults ? (
                        <div className="credit-empty-state search">
                            <i className="fa-solid fa-magnifying-glass" />
                            <span>Busque cliente</span>
                        </div>
                    ) : filteredCustomers.length ? (
                        <div className="credit-results-grid">
                            {filteredCustomers.map((customer) => {
                                const status = getStatusMeta(customer.status)

                                return (
                                    <button
                                        key={customer.id}
                                        type="button"
                                        className="credit-result-card"
                                        onClick={() => setActiveCustomerId(customer.id)}
                                    >
                                        <div className="credit-customer-top">
                                            <div className="credit-avatar">{getInitials(customer.name)}</div>

                                            <div className="credit-customer-copy">
                                                <strong>{customer.name}</strong>
                                                <span>{customer.phone || 'Sem telefone'}</span>
                                            </div>

                                            <span className={`credit-status-chip ${status.tone}`}>{status.label}</span>
                                        </div>

                                        <div className="credit-result-metrics">
                                            <div>
                                                <span>Saldo</span>
                                                <strong>{formatMoney(customer.open_credit)}</strong>
                                            </div>
                                            <div>
                                                <span>Livre</span>
                                                <strong>{formatMoney(customer.available_credit)}</strong>
                                            </div>
                                            <div>
                                                <span>Uso</span>
                                                <strong>{formatPercent(customer.utilization_percent || 0)}</strong>
                                            </div>
                                        </div>

                                        <div className="credit-progress-track">
                                            <span className={`credit-progress-fill ${status.tone} ${getUsageClass(customer.utilization_percent)}`} />
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="credit-empty-state search">
                            <i className="fa-solid fa-user-slash" />
                            <span>Sem resultado</span>
                            <small>Dica: use % antes do nome, como %Maria, para encontrar clientes com outro nome antes.</small>
                        </div>
                    )}
                </section>
            </div>

            <CreditCustomerModal customer={activeCustomer} sales={activeCustomerSales} onClose={() => setActiveCustomerId(null)} />
        </AppLayout>
    )
}
