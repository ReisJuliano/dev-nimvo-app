import { router } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CompactModal from '@/Components/UI/CompactModal'
import StatusBadge from '@/Components/UI/StatusBadge'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { formatDate, formatDateTime, formatMoney, formatNumber, formatTime } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import '../Operations/backoffice-workspace.css'

const DEFAULT_SORT = { key: 'date', direction: 'desc' }
const DEFAULT_COLUMN_FILTERS = {
    date: '',
    customer: '',
    amount: '',
    payment: '',
    status: '',
}

const SORTABLE_COLUMNS = {
    date: 'Data',
    customer: 'Cliente',
    amount: 'Valor',
    payment: 'Forma pagamento',
    status: 'Status',
}

function summaryIcon(type) {
    switch (type) {
        case 'sale':
            return 'fa-receipt'
        case 'entry':
            return 'fa-box-open'
        case 'delivery':
            return 'fa-motorcycle'
        case 'credit':
            return 'fa-handshake'
        case 'fiscal':
            return 'fa-file-invoice'
        default:
            return 'fa-layer-group'
    }
}

function recordCounterparty(record) {
    return record.details?.recipient
        || record.details?.supplier
        || record.subtitle
        || '-'
}

function recordPaymentSummary(record) {
    const labels = Array.from(new Set((record.details?.payments || []).map((payment) => payment.label).filter(Boolean)))

    if (labels.length) {
        return labels.join(', ')
    }

    return {
        sale: 'Sem pagamento informado',
        entry: 'Entrada de estoque',
        delivery: 'Delivery',
        credit: 'A prazo',
        fiscal: 'Documento fiscal',
    }[record.type] || 'Nao informado'
}

function recordTypeLabel(recordType, recordTypes) {
    return recordTypes.find((entry) => entry.key === recordType)?.label || 'Registro'
}

function recordDateInputValue(value) {
    if (!value) {
        return ''
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return ''
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function includesNormalizedText(values, term) {
    const normalizedTerm = normalizeTextSearch(term)

    if (!normalizedTerm) {
        return true
    }

    return (values || []).some((value) => normalizeTextSearch(value).includes(normalizedTerm))
}

function compareValues(left, right) {
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right
    }

    return String(left || '').localeCompare(String(right || ''), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
    })
}

function recordSearchValues(record, recordTypes) {
    const payments = record.details?.payments || []
    const items = record.details?.items || []
    const fiscal = record.details?.fiscal || {}

    return [
        record.title,
        record.subtitle,
        record.status_label,
        recordTypeLabel(record.type, recordTypes),
        recordCounterparty(record),
        recordPaymentSummary(record),
        formatMoney(record.amount),
        String(record.amount ?? ''),
        record.date ? formatDate(record.date) : null,
        record.date ? formatDateTime(record.date) : null,
        ...(record.tags || []),
        record.details?.recipient,
        record.details?.supplier,
        record.details?.address,
        record.details?.notes,
        record.details?.document,
        record.details?.operator,
        record.details?.phone,
        record.details?.courier,
        record.details?.sale_number,
        record.details?.status,
        record.details?.number,
        record.details?.series,
        record.details?.access_key,
        record.details?.code,
        fiscal.status,
        fiscal.number,
        fiscal.series,
        fiscal.access_key,
        fiscal.last_error,
        ...payments.flatMap((payment) => [
            payment.label,
            formatMoney(payment.amount),
            String(payment.amount ?? ''),
        ]),
        ...items.flatMap((item) => [
            item.name,
            item.code,
            formatMoney(item.total),
            formatMoney(item.unit_price),
            formatMoney(item.unit_cost),
            String(item.quantity ?? ''),
            String(item.total ?? ''),
            String(item.unit_price ?? ''),
            String(item.unit_cost ?? ''),
        ]),
    ]
}

export default function ConsultationsIndex({ filters, range, recordTypes, summary, records }) {
    const [activeType, setActiveType] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedUid, setSelectedUid] = useState(null)
    const [busyAction, setBusyAction] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const [sortConfig, setSortConfig] = useState(DEFAULT_SORT)
    const [columnFilters, setColumnFilters] = useState(DEFAULT_COLUMN_FILTERS)
    const [columnFiltersExpanded, setColumnFiltersExpanded] = useState(false)
    const [highlightedColumnFilter, setHighlightedColumnFilter] = useState(null)
    const normalizedSearch = normalizeTextSearch(search)

    const statusOptions = useMemo(() => (
        Array.from(new Set((records || []).map((record) => record.status_label).filter(Boolean)))
            .sort((left, right) => left.localeCompare(right, 'pt-BR'))
    ), [records])

    const hasActiveColumnFilters = useMemo(() => (
        Object.values(columnFilters).some((value) => String(value || '').trim() !== '')
    ), [columnFilters])

    const filteredRecords = useMemo(() => (
        (records || []).filter((record) => {
            if (activeType !== 'all' && record.type !== activeType) {
                return false
            }

            if (columnFilters.date && recordDateInputValue(record.date) !== columnFilters.date) {
                return false
            }

            if (!includesNormalizedText([
                recordCounterparty(record),
                record.subtitle,
                record.title,
                record.details?.document,
            ], columnFilters.customer)) {
                return false
            }

            if (!includesNormalizedText([
                formatMoney(record.amount),
                String(record.amount ?? ''),
            ], columnFilters.amount)) {
                return false
            }

            if (!includesNormalizedText([
                recordPaymentSummary(record),
                ...(record.tags || []),
            ], columnFilters.payment)) {
                return false
            }

            if (columnFilters.status && record.status_label !== columnFilters.status) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return matchesTextSearchAny(recordSearchValues(record, recordTypes), normalizedSearch)
        }).sort((left, right) => {
            const direction = sortConfig.direction === 'asc' ? 1 : -1

            return compareValues(sortValue(left, sortConfig.key), sortValue(right, sortConfig.key)) * direction
        })
    ), [activeType, columnFilters, normalizedSearch, records, recordTypes, sortConfig])

    const selectedRecord = useMemo(
        () => (records || []).find((record) => record.uid === selectedUid) || null,
        [records, selectedUid],
    )

    function sortValue(record, key) {
        switch (key) {
            case 'customer':
                return recordCounterparty(record)
            case 'amount':
                return Number(record.amount || 0)
            case 'payment':
                return recordPaymentSummary(record)
            case 'status':
                return record.status_label
            default:
                return record.date ? new Date(record.date).getTime() : 0
        }
    }

    function changePeriod(period) {
        router.get('/consultas-cancelamentos', { period }, { preserveScroll: true, replace: true })
    }

    function applyCustomRange(event) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        router.get('/consultas-cancelamentos', {
            period: 'custom',
            from: form.get('from'),
            to: form.get('to'),
        }, { preserveScroll: true, replace: true })
    }

    async function handleRetry(url) {
        if (!url) {
            return
        }

        setBusyAction(url)
        setFeedback(null)

        try {
            await apiRequest(url, { method: 'post' })
            router.reload({ preserveScroll: true })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleCancel(url, label) {
        if (!url) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: `Cancelar ${label}`,
            message: `Deseja cancelar ${label}?`,
            confirmLabel: 'Cancelar',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        setBusyAction(url)
        setFeedback(null)

        try {
            await apiRequest(url, { method: 'post', data: { reason: 'Cancelado pela central de consultas.' } })
            setSelectedUid(null)
            router.reload({ preserveScroll: true })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleDeliveryStatus(record, status) {
        setBusyAction(`${record.uid}-${status}`)
        setFeedback(null)

        try {
            await apiRequest(record.actions.mark_dispatched, { method: 'post', data: { status } })
            router.reload({ preserveScroll: true })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleDeliveryDelete(record) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Cancelar entrega',
            message: `Deseja cancelar ${record.title}?`,
            confirmLabel: 'Cancelar entrega',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        setBusyAction(record.actions.delete_url)
        setFeedback(null)

        try {
            await apiRequest(record.actions.delete_url, { method: 'delete' })
            setSelectedUid(null)
            router.reload({ preserveScroll: true })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    function toggleSort(key) {
        setSortConfig((current) => {
            if (current.key === key) {
                return {
                    key,
                    direction: current.direction === 'asc' ? 'desc' : 'asc',
                }
            }

            return {
                key,
                direction: key === 'amount' ? 'desc' : 'asc',
            }
        })
    }

    function sortIcon(columnKey) {
        if (sortConfig.key !== columnKey) {
            return 'fa-arrows-up-down'
        }

        return sortConfig.direction === 'asc'
            ? 'fa-arrow-up-short-wide'
            : 'fa-arrow-down-wide-short'
    }

    function handleColumnFilterChange(key, value) {
        setColumnFilters((current) => ({
            ...current,
            [key]: value,
        }))
    }

    function toggleColumnFilters(columnKey) {
        setColumnFiltersExpanded((current) => (highlightedColumnFilter === columnKey ? !current : true))
        setHighlightedColumnFilter(columnKey)
    }

    function clearColumnFilters() {
        setColumnFilters(DEFAULT_COLUMN_FILTERS)
        setColumnFiltersExpanded(false)
        setHighlightedColumnFilter(null)
    }

    function openRecord(uid) {
        setSelectedUid(uid)
    }

    function handleRowKeyDown(event, uid) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return
        }

        event.preventDefault()
        openRecord(uid)
    }

    return (
        <AppLayout title="Consultas">
            <div className="proc-ui-page">
                <section className="proc-ui-main-card">
                    <div className="proc-ui-main-header">
                        <div>
                            <h2>{range.label}</h2>
                        </div>
                    </div>

                    {feedback ? (
                        <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                            <span>{feedback.text}</span>
                        </div>
                    ) : null}

                    <div className="proc-ui-chip-row">
                        {recordTypes.map((type) => (
                            <button key={type.key} type="button" className={`proc-ui-chip ${activeType === type.key ? 'active' : ''}`} onClick={() => setActiveType(type.key)}>
                                {type.label}
                            </button>
                        ))}
                    </div>

                    <div className="proc-ui-card-toolbar">
                        <div className="proc-ui-chip-row">
                            {[
                                { key: 'day', label: 'Hoje' },
                                { key: 'week', label: 'Semana' },
                                { key: 'month', label: 'Mes' },
                            ].map((period) => (
                                <button key={period.key} type="button" className={`proc-ui-chip ${filters.period === period.key ? 'active' : ''}`} onClick={() => changePeriod(period.key)}>
                                    {period.label}
                                </button>
                            ))}
                        </div>

                        <form className="proc-ui-date-range proc-ui-date-range-with-action" onSubmit={applyCustomRange}>
                            <input defaultValue={filters.from} name="from" type="date" />
                            <input defaultValue={filters.to} name="to" type="date" />
                            <button type="submit" className="ui-button">
                                <i className="fa-solid fa-calendar-check" />
                                <span>Aplicar</span>
                            </button>
                        </form>
                    </div>

                    <div className="proc-ui-consultations-toolbar">
                        <input
                            className="proc-ui-searchbox"
                            type="search"
                            placeholder="Buscar por numero, cliente, fornecedor, endereco ou status"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {hasActiveColumnFilters ? (
                            <div className="proc-ui-consultations-toolbar-actions">
                                <button type="button" className="ui-button-ghost" onClick={clearColumnFilters}>
                                    <i className="fa-solid fa-rotate-left" />
                                    <span>Limpar filtros</span>
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <div className="proc-ui-list-stack">
                        {filteredRecords.length ? (
                            <div className="proc-ui-table-wrap proc-ui-records-table-wrap">
                                <table className="proc-ui-table proc-ui-records-table">
                                    <thead>
                                        <tr>
                                            {Object.entries(SORTABLE_COLUMNS).map(([key, label]) => (
                                                <th key={key}>
                                                    <div className="proc-ui-record-table-heading">
                                                        <button type="button" className="proc-ui-record-sort-button" onClick={() => toggleSort(key)}>
                                                            <span>{label}</span>
                                                            <i className={`fa-solid ${sortIcon(key)}`} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`proc-ui-record-filter-trigger ${(columnFilters[key] || '') !== '' || highlightedColumnFilter === key ? 'active' : ''}`}
                                                            onClick={() => toggleColumnFilters(key)}
                                                            aria-label={`Filtrar coluna ${label}`}
                                                        >
                                                            <i className="fa-solid fa-filter" />
                                                        </button>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="proc-ui-record-open-column">Abrir</th>
                                        </tr>
                                        {columnFiltersExpanded || hasActiveColumnFilters ? (
                                            <tr className="proc-ui-record-filter-row">
                                                <th>
                                                    <input
                                                        type="date"
                                                        value={columnFilters.date}
                                                        onChange={(event) => handleColumnFilterChange('date', event.target.value)}
                                                        autoFocus={highlightedColumnFilter === 'date'}
                                                    />
                                                </th>
                                                <th>
                                                    <input
                                                        type="search"
                                                        value={columnFilters.customer}
                                                        onChange={(event) => handleColumnFilterChange('customer', event.target.value)}
                                                        placeholder="Nome, doc. ou venda"
                                                        autoFocus={highlightedColumnFilter === 'customer'}
                                                    />
                                                </th>
                                                <th>
                                                    <input
                                                        type="search"
                                                        value={columnFilters.amount}
                                                        onChange={(event) => handleColumnFilterChange('amount', event.target.value)}
                                                        placeholder="Ex.: 50,00"
                                                        autoFocus={highlightedColumnFilter === 'amount'}
                                                    />
                                                </th>
                                                <th>
                                                    <input
                                                        type="search"
                                                        value={columnFilters.payment}
                                                        onChange={(event) => handleColumnFilterChange('payment', event.target.value)}
                                                        placeholder="Pix, credito, entrega..."
                                                        autoFocus={highlightedColumnFilter === 'payment'}
                                                    />
                                                </th>
                                                <th>
                                                    <select
                                                        value={columnFilters.status}
                                                        onChange={(event) => handleColumnFilterChange('status', event.target.value)}
                                                        autoFocus={highlightedColumnFilter === 'status'}
                                                    >
                                                        <option value="">Todos</option>
                                                        {statusOptions.map((status) => (
                                                            <option key={status} value={status}>{status}</option>
                                                        ))}
                                                    </select>
                                                </th>
                                                <th className="proc-ui-record-filter-actions">
                                                    <button type="button" className="proc-ui-ghost-icon" onClick={clearColumnFilters} aria-label="Limpar filtros">
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </th>
                                            </tr>
                                        ) : null}
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((record) => (
                                            <tr
                                                key={record.uid}
                                                className={`proc-ui-record-row ${selectedUid === record.uid ? 'active' : ''}`}
                                                tabIndex={0}
                                                onClick={() => openRecord(record.uid)}
                                                onKeyDown={(event) => handleRowKeyDown(event, record.uid)}
                                            >
                                                <td>
                                                    <div className="proc-ui-record-primary">
                                                        <strong>{record.date ? formatDate(record.date) : 'Sem data'}</strong>
                                                        <small>{record.date ? formatTime(record.date) : 'Horario indisponivel'}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="proc-ui-record-primary">
                                                        <strong>{recordCounterparty(record)}</strong>
                                                        <small>{record.title}</small>
                                                    </div>
                                                </td>
                                                <td className="proc-ui-record-value-cell">
                                                    <div className="proc-ui-record-primary">
                                                        <strong>{formatMoney(record.amount)}</strong>
                                                        <small>{recordTypeLabel(record.type, recordTypes)}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="proc-ui-record-primary">
                                                        <strong>{recordPaymentSummary(record)}</strong>
                                                        <small>{(record.tags || [])[0] || 'Sem marcador adicional'}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="proc-ui-record-status-cell">
                                                        <StatusBadge compact icon={summaryIcon(record.type)} label={record.status_label} tone={record.status_tone} />
                                                    </div>
                                                </td>
                                                <td className="proc-ui-record-open-cell">
                                                    <span className="proc-ui-record-open-indicator" aria-hidden="true">
                                                        <i className="fa-solid fa-arrow-up-right-from-square" />
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="proc-ui-table-totalbar">
                                    <span>{filteredRecords.length} registro(s)</span>
                                    <span>Ordenado por {SORTABLE_COLUMNS[sortConfig.key]} ({sortConfig.direction === 'asc' ? 'crescente' : 'decrescente'})</span>
                                    <span>{summary.length} indicador(es) no topo</span>
                                </div>
                            </div>
                        ) : (
                            <div className="proc-ui-empty">
                                <strong>Sem registros nesse recorte</strong>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <CompactModal
                open={Boolean(selectedRecord)}
                title={selectedRecord?.title || 'Detalhes'}
                description={selectedRecord ? `${selectedRecord.subtitle} - ${formatMoney(selectedRecord.amount)}` : ''}
                icon={selectedRecord ? summaryIcon(selectedRecord.type) : 'fa-circle-info'}
                size="lg"
                onClose={() => setSelectedUid(null)}
            >
                {selectedRecord ? (
                    <div className="proc-ui-modal-stack">
                        <div className="proc-ui-card-toolbar">
                            <StatusBadge label={selectedRecord.status_label} tone={selectedRecord.status_tone} />
                            <span className="proc-ui-muted">{selectedRecord.date ? formatDateTime(selectedRecord.date) : 'Sem data'}</span>
                        </div>

                        {selectedRecord.type === 'sale' ? (
                            <>
                                <section className="proc-ui-modal-block">
                                    <h3>Resumo da venda</h3>
                                    <div className="proc-ui-summary-grid">
                                        <article className="proc-ui-summary-card"><span>Operador</span><strong>{selectedRecord.details.operator || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Cliente</span><strong>{selectedRecord.details.recipient || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Documento</span><strong>{selectedRecord.details.document || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Total</span><strong>{formatMoney(selectedRecord.amount)}</strong></article>
                                    </div>
                                </section>

                                <section className="proc-ui-modal-block">
                                    <h3>Itens</h3>
                                    <div className="proc-ui-surface-list">
                                        {selectedRecord.details.items.map((item, index) => (
                                            <div key={`${selectedRecord.uid}-item-${index}`} className="proc-ui-surface-item">
                                                <div>
                                                    <strong>{item.name}</strong>
                                                    <small>{formatNumber(item.quantity)} un - {formatMoney(item.unit_price)}</small>
                                                </div>
                                                <strong>{formatMoney(item.total)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : null}

                        {selectedRecord.type === 'entry' ? (
                            <>
                                <section className="proc-ui-modal-block">
                                    <h3>Resumo da entrada</h3>
                                    <div className="proc-ui-summary-grid">
                                        <article className="proc-ui-summary-card"><span>Fornecedor</span><strong>{selectedRecord.details.supplier || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Codigo</span><strong>{selectedRecord.details.code || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Recebida em</span><strong>{selectedRecord.details.received_at ? formatDateTime(selectedRecord.details.received_at) : '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Total</span><strong>{formatMoney(selectedRecord.amount)}</strong></article>
                                    </div>
                                </section>

                                <section className="proc-ui-modal-block">
                                    <h3>Itens recebidos</h3>
                                    <div className="proc-ui-surface-list">
                                        {selectedRecord.details.items.map((item, index) => (
                                            <div key={`${selectedRecord.uid}-item-${index}`} className="proc-ui-surface-item">
                                                <div>
                                                    <strong>{item.name}</strong>
                                                    <small>{formatNumber(item.quantity)} un - {formatMoney(item.unit_cost)}</small>
                                                </div>
                                                <strong>{formatMoney(item.total)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : null}

                        {selectedRecord.type === 'delivery' ? (
                            <section className="proc-ui-modal-block">
                                <h3>Detalhes da entrega</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Destinatario</span><strong>{selectedRecord.details.recipient || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Telefone</span><strong>{selectedRecord.details.phone || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Entregador</span><strong>{selectedRecord.details.courier || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Taxa</span><strong>{formatMoney(selectedRecord.details.delivery_fee || 0)}</strong></article>
                                </div>
                                <div className="proc-ui-banner info">
                                    <i className="fa-solid fa-location-dot" />
                                    <div>{selectedRecord.details.address || 'Sem endereco'} {selectedRecord.details.neighborhood ? ` - ${selectedRecord.details.neighborhood}` : ''}</div>
                                </div>
                            </section>
                        ) : null}

                        {selectedRecord.type === 'credit' ? (
                            <section className="proc-ui-modal-block">
                                <h3>Venda a prazo</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Cliente</span><strong>{selectedRecord.details.recipient || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Documento</span><strong>{selectedRecord.details.document || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Operador</span><strong>{selectedRecord.details.operator || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Total</span><strong>{formatMoney(selectedRecord.amount)}</strong></article>
                                </div>
                            </section>
                        ) : null}

                        {selectedRecord.type === 'fiscal' ? (
                            <section className="proc-ui-modal-block">
                                <h3>Documento fiscal</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Venda</span><strong>{selectedRecord.details.sale_number || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Status</span><strong>{selectedRecord.details.status || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Numero</span><strong>{selectedRecord.details.number || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Serie</span><strong>{selectedRecord.details.series || '-'}</strong></article>
                                </div>
                                <div className="proc-ui-banner info">
                                    <i className="fa-solid fa-key" />
                                    <div>{selectedRecord.details.access_key || 'Sem chave de acesso armazenada'}</div>
                                </div>
                                {selectedRecord.details.last_error ? (
                                    <div className="proc-ui-banner critical">
                                        <i className="fa-solid fa-triangle-exclamation" />
                                        <div>{selectedRecord.details.last_error}</div>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}

                        <div className="proc-ui-modal-footer">
                            {selectedRecord.type === 'sale' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.preview_url} onClick={() => window.open(selectedRecord.actions.preview_url, '_blank', 'noopener,noreferrer')}>
                                        Reimprimir
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.retry_url || busyAction === selectedRecord.actions.retry_url} onClick={() => handleRetry(selectedRecord.actions.retry_url)}>
                                        Reenfileirar NF-e
                                    </button>
                                    <button type="button" className="ui-button-ghost danger" disabled={busyAction === selectedRecord.actions.cancel_url} onClick={() => handleCancel(selectedRecord.actions.cancel_url, selectedRecord.title)}>
                                        Cancelar
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'entry' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.mirror_url} onClick={() => window.open(selectedRecord.actions.mirror_url, '_blank', 'noopener,noreferrer')}>
                                        Espelho NF
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled title="Cancelamento de entrada ainda nao e suportado neste backend.">
                                        Cancelar entrada
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled title="Estorno de estoque ainda nao e suportado neste backend.">
                                        Estornar estoque
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'delivery' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={busyAction === `${selectedRecord.uid}-dispatched`} onClick={() => handleDeliveryStatus(selectedRecord, 'dispatched')}>
                                        Alterar para rota
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled={busyAction === `${selectedRecord.uid}-delivered`} onClick={() => handleDeliveryStatus(selectedRecord, 'delivered')}>
                                        Marcar entregue
                                    </button>
                                    <button type="button" className="ui-button-ghost danger" disabled={busyAction === selectedRecord.actions.delete_url} onClick={() => handleDeliveryDelete(selectedRecord)}>
                                        Cancelar
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'credit' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled title="Pagamento a prazo permanece centralizado no modulo proprio.">
                                        Registrar pagamento
                                    </button>
                                    <button type="button" className="ui-button-ghost danger" disabled={busyAction === selectedRecord.actions.cancel_url} onClick={() => handleCancel(selectedRecord.actions.cancel_url, selectedRecord.title)}>
                                        Cancelar
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'fiscal' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.signed_xml_url} onClick={() => window.open(selectedRecord.actions.signed_xml_url, '_blank', 'noopener,noreferrer')}>
                                        Ver XML
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled={busyAction === selectedRecord.actions.retry_url} onClick={() => handleRetry(selectedRecord.actions.retry_url)}>
                                        Reenfileirar
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled title="Inutilizacao segue fluxo proprio de numeracao fiscal.">
                                        Inutilizar
                                    </button>
                                    <button type="button" className="ui-button" disabled={!selectedRecord.actions.authorized_xml_url && !selectedRecord.actions.cancelled_xml_url} onClick={() => window.open(selectedRecord.actions.authorized_xml_url || selectedRecord.actions.cancelled_xml_url, '_blank', 'noopener,noreferrer')}>
                                        Download XML
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </CompactModal>
        </AppLayout>
    )
}
