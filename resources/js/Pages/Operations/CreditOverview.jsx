import { router, usePage } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ActionButton from '@/Components/UI/ActionButton'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { apiRequest } from '@/lib/http'
import './credit-overview.css'

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
            applied: filters?.applied ? 1 : undefined,
            section: filters?.section || undefined,
            cash_register: filters?.cash_register || undefined,
            ...overrides,
        }).filter(([, value]) => value != null && value !== ''),
    )
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

    return { label: 'Disponível', tone: 'muted' }
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

function CreditCustomerModal({ customer, sales, storeName, onClose, onReceived }) {
    const [receiveForm, setReceiveForm] = useState({ amount: '', payment_method: 'pix', notes: '' })
    const [receiving, setReceiving] = useState(false)
    const [error, setError] = useState('')

    if (!customer) {
        return null
    }

    const status = getStatusMeta(customer.status)
    const historyTotal = sales.reduce((total, sale) => total + Number(sale.credit_amount || 0), 0)
    const whatsappMessage = encodeURIComponent(
        `Oi, ${customer.name}. Aqui é ${storeName || 'a loja'}. Seu fiado em aberto está em ${formatMoney(customer.open_credit)}. Podemos combinar o pagamento?`,
    )
    const whatsappPhone = String(customer.phone || '').replace(/\D+/g, '')
    const whatsappHref = `https://wa.me/${whatsappPhone || ''}?text=${whatsappMessage}`

    async function handleReceiveSubmit(event) {
        event.preventDefault()
        setError('')

        const amount = Number(receiveForm.amount || 0)

        if (amount <= 0) {
            setError('Informe o valor recebido.')
            return
        }

        setReceiving(true)
        try {
            await apiRequest('/api/fiado/receber', {
                method: 'post',
                data: {
                    customer_id: customer.id,
                    amount,
                    payment_method: receiveForm.payment_method,
                    notes: receiveForm.notes.trim() || null,
                },
            })
            onReceived?.()
        } catch (receiveError) {
            setError(receiveError.message || 'Não foi possível receber o fiado.')
        } finally {
            setReceiving(false)
        }
    }

    return (
        <div className="credit-modal-backdrop" role="presentation">
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
                            <span>Fiado em aberto</span>
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

                    <section className="credit-modal-grid compact">
                        <a className="ui-button" href={whatsappHref} target="_blank" rel="noreferrer">
                            <i className="fa-brands fa-whatsapp" />
                            Cobrar no WhatsApp
                        </a>
                    </section>

                    <form className="credit-receive-form" onSubmit={handleReceiveSubmit}>
                        <header className="credit-panel-header">
                            <div>
                                <h3>Receber fiado</h3>
                                <span>Registre pagamento parcial ou total.</span>
                            </div>
                        </header>
                        <div className="credit-receive-grid">
                            <input
                                className="ui-input"
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Valor recebido"
                                value={receiveForm.amount}
                                onChange={(event) => setReceiveForm((current) => ({ ...current, amount: event.target.value }))}
                            />
                            <select
                                className="ui-select"
                                value={receiveForm.payment_method}
                                onChange={(event) => setReceiveForm((current) => ({ ...current, payment_method: event.target.value }))}
                            >
                                <option value="pix">Pix</option>
                                <option value="cash">Dinheiro</option>
                                <option value="debit_card">Cartão</option>
                                <option value="credit_card">Cartão de crédito</option>
                            </select>
                            <input
                                className="ui-input"
                                placeholder="Observação opcional"
                                value={receiveForm.notes}
                                onChange={(event) => setReceiveForm((current) => ({ ...current, notes: event.target.value }))}
                            />
                            <button className="ui-button" type="submit" disabled={receiving}>
                                {receiving ? 'Recebendo...' : 'Receber fiado'}
                            </button>
                        </div>
                        {error ? <span className="products-editor-submit-error">{error}</span> : null}
                    </form>

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
                            <span>Último fiado</span>
                            <strong>{customer.last_credit_at ? formatDateTime(customer.last_credit_at) : 'Sem registro'}</strong>
                        </article>
                        <article className="credit-highlight-card">
                            <span>Histórico</span>
                            <strong>{formatMoney(historyTotal)}</strong>
                            <small>{formatNumber(customer.credit_sales_count || 0)} venda(s)</small>
                        </article>
                    </section>

                    <section className="credit-modal-history">
                        <header className="credit-panel-header">
                            <div>
                                <h3>Histórico recente</h3>
                                <span>{sales.length} registros no período</span>
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
                                <span>Quando vender fiado, as cobranças aparecerão aqui.</span>
                            </div>
                        )}
                    </section>
                </div>
            </section>
        </div>
    )
}

export default function CreditOverview({ module }) {
    const { tenant } = usePage().props
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
    const hasAppliedFilters = Boolean(module.filters?.applied)
    const [activeFilter, setActiveFilter] = useState('all')
    const [selectedCustomerId, setSelectedCustomerId] = useState(null)
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
        if (selectedCustomerId && !customers.some((customer) => customer.id === selectedCustomerId)) {
            setSelectedCustomerId(null)
        }

        if (!activeCustomerId) {
            return
        }

        if (!customers.some((customer) => customer.id === activeCustomerId)) {
            setActiveCustomerId(null)
        }
    }, [activeCustomerId, customers, selectedCustomerId])

    const normalizedSearch = normalizeTextSearch(searchControl.value)

    const filteredCustomers = useMemo(() => {
        return customers.filter((customer) =>
            (normalizedSearch === ''
                || matchesTextSearchAny([customer.name, customer.phone], normalizedSearch))
            && matchesCustomerFilter(customer, activeFilter),
        )
    }, [activeFilter, customers, normalizedSearch])

    const filterCounts = useMemo(() => ({
        all: customers.length,
        debt: customers.filter((customer) => Number(customer.open_credit || 0) > 0).length,
        attention: customers.filter((customer) => customer.status === 'attention').length,
        overflow: customers.filter((customer) => customer.status === 'overflow').length,
    }), [customers])

    const selectedCustomer = useMemo(
        () => filteredCustomers.find((customer) => String(customer.id) === String(selectedCustomerId))
            || customers.find((customer) => String(customer.id) === String(selectedCustomerId))
            || null,
        [customers, filteredCustomers, selectedCustomerId],
    )

    const activeCustomer = useMemo(
        () => customers.find((customer) => customer.id === activeCustomerId) || null,
        [activeCustomerId, customers],
    )
    const activeCustomerSales = useMemo(
        () => recentSales.filter((sale) => sale.customer_id === activeCustomer?.id),
        [activeCustomer?.id, recentSales],
    )

    function submitFilters(nextRange = dateRange) {
        router.get(
            window.location.pathname,
            buildFilterPayload(module.filters, {
                applied: 1,
                from: nextRange.from || undefined,
                to: nextRange.to || undefined,
            }),
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    function resetDates() {
        const nextRange = { from: '', to: '' }
        setDateRange(nextRange)
        router.get(
            window.location.pathname,
            {},
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    function handleApplyFilters() {
        searchControl.apply()
        submitFilters()
    }

    function handleResetFilters() {
        searchControl.clear()
        setActiveFilter('all')
        setSelectedCustomerId(null)
        setActiveCustomerId(null)
        resetDates()
    }

    function openSelectedCustomer() {
        if (!selectedCustomer) {
            return
        }

        setActiveCustomerId(selectedCustomer.id)
    }

    return (
        <AppLayout title="Fiado">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title={module.title}
                        actions={(
                            <>
                                <ActionButton icon="fa-eye" tone="secondary" disabled={!selectedCustomer} onClick={openSelectedCustomer}>
                                    Ver detalhes
                                </ActionButton>
                                <ActionButton icon="fa-hand-holding-dollar" tone="secondary" onClick={() => setActiveFilter('debt')}>
                                    Mostrar devendo
                                </ActionButton>
                                <ActionButton icon="fa-users" onClick={() => router.visit('/clientes')}>
                                    Ir para clientes
                                </ActionButton>
                            </>
                        )}
                        search={{
                            placeholder: 'Buscar cliente por nome ou telefone',
                            value: searchControl.draftValue,
                            onChange: searchControl.setDraftValue,
                        }}
                        filters={customerFilters.map((filter) => ({
                            ...filter,
                            value: filter.key,
                            count: filterCounts[filter.key],
                        }))}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        dateRange={{
                            from: dateRange.from,
                            to: dateRange.to,
                            onChange: setDateRange,
                        }}
                        quickDates
                        onApply={handleApplyFilters}
                        onReset={handleResetFilters}
                    />

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'customer',
                                    label: 'Cliente',
                                    render: (customer) => (
                                        <div className="credit-table-customer">
                                            <div className="credit-avatar">{getInitials(customer.name)}</div>
                                            <div className="credit-customer-copy">
                                                <strong>{customer.name}</strong>
                                                <span>{customer.phone || 'Sem telefone'}</span>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'open_credit',
                                    label: 'Em aberto',
                                    align: 'right',
                                    render: (customer) => <strong>{formatMoney(customer.open_credit)}</strong>,
                                },
                                {
                                    key: 'credit_limit',
                                    label: 'Limite',
                                    align: 'right',
                                    render: (customer) => formatMoney(customer.credit_limit),
                                },
                                {
                                    key: 'available_credit',
                                    label: 'Disponível',
                                    align: 'right',
                                    render: (customer) => formatMoney(customer.available_credit),
                                },
                                {
                                    key: 'usage',
                                    label: 'Uso',
                                    render: (customer) => {
                                        const status = getStatusMeta(customer.status)

                                        return (
                                            <div className="credit-table-usage">
                                                <strong>{formatPercent(customer.utilization_percent || 0)}</strong>
                                                <div className="credit-progress-track">
                                                    <span className={`credit-progress-fill ${status.tone} ${getUsageClass(customer.utilization_percent)}`} />
                                                </div>
                                            </div>
                                        )
                                    },
                                },
                                {
                                    key: 'last_credit_at',
                                    label: 'Último lanç.',
                                    render: (customer) => customer.last_credit_at ? formatDateTime(customer.last_credit_at) : 'Sem registro',
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (customer) => {
                                        const status = getStatusMeta(customer.status)

                                        return <StatusBadge compact label={status.label} tone={status.tone} />
                                    },
                                },
                            ]}
                            rows={filteredCustomers}
                            rowKey="id"
                            selectedRowKey={selectedCustomerId}
                            onRowClick={(customer) => setSelectedCustomerId(customer.id)}
                            onRowDoubleClick={(customer) => {
                                setSelectedCustomerId(customer.id)
                                setActiveCustomerId(customer.id)
                            }}
                            emptyMessage={hasAppliedFilters ? 'Nenhum cliente encontrado' : 'Quando vender fiado, as cobranças aparecerão aqui.'}
                            emptyIcon="fa-user-slash"
                            actions={(customer) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    tone: 'primary',
                                    onClick: () => {
                                        setSelectedCustomerId(customer.id)
                                        setActiveCustomerId(customer.id)
                                    },
                                },
                            ]}
                        />
                    </section>

                    <div className="proc-ui-footer-totals">
                        <span>Fiado em aberto: <strong>{formatMoney(customers.reduce((total, customer) => total + Number(customer.open_credit || 0), 0))}</strong></span>
                        <span>Limite total: <strong>{formatMoney(module.portfolio_summary?.total_limit || 0)}</strong></span>
                    </div>
                </div>
            </div>

            <CreditCustomerModal
                customer={activeCustomer}
                sales={activeCustomerSales}
                storeName={tenant?.name}
                onClose={() => setActiveCustomerId(null)}
                onReceived={() => router.reload({ preserveScroll: true })}
            />
        </AppLayout>
    )
}
