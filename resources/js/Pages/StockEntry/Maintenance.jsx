import { Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import '../Operations/backoffice-workspace.css'

const PERIOD_FILTERS = [
    { key: '', label: 'Livre', icon: 'fa-sliders' },
    { key: 'today', label: 'Hoje', icon: 'fa-calendar-day' },
    { key: 'week', label: 'Semana', icon: 'fa-calendar-week' },
    { key: 'month', label: 'Mes', icon: 'fa-calendar' },
]

const TIME_FILTERS = [
    { key: '', label: 'Qualquer', icon: 'fa-clock' },
    { key: 'morning', label: 'Manha', icon: 'fa-sun' },
    { key: 'afternoon', label: 'Tarde', icon: 'fa-cloud-sun' },
    { key: 'night', label: 'Noite', icon: 'fa-moon' },
]

function createDraftFilters() {
    return {
        period: '',
        exactDate: '',
        month: '',
        exactTime: '',
        timeSlot: '',
        supplier: '',
        product: '',
        nf: '',
    }
}

function matchesPeriod(record, periodKey) {
    if (!periodKey) {
        return true
    }

    const baseValue = record?.received_at || record?.created_at

    if (!baseValue) {
        return true
    }

    const target = new Date(baseValue)
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (periodKey === 'today') {
        return target >= dayStart
    }

    if (periodKey === 'week') {
        const start = new Date(dayStart)
        start.setDate(dayStart.getDate() - 6)

        return target >= start
    }

    if (periodKey === 'month') {
        const start = new Date(dayStart)
        start.setDate(dayStart.getDate() - 29)

        return target >= start
    }

    return true
}

function resolveRecordDate(record) {
    return String(record?.received_at || record?.created_at || '').slice(0, 10)
}

function matchesMonth(record, month) {
    if (!month) {
        return true
    }

    return resolveRecordDate(record).startsWith(month)
}

function matchesExactDate(record, exactDate) {
    if (!exactDate) {
        return true
    }

    return resolveRecordDate(record) === exactDate
}

function resolveRecordTime(record) {
    const baseValue = record?.received_at || record?.created_at

    if (!baseValue) {
        return ''
    }

    const target = new Date(baseValue)

    if (Number.isNaN(target.getTime())) {
        return ''
    }

    const hours = String(target.getHours()).padStart(2, '0')
    const minutes = String(target.getMinutes()).padStart(2, '0')

    return `${hours}:${minutes}`
}

function matchesExactTime(record, exactTime) {
    if (!exactTime) {
        return true
    }

    return resolveRecordTime(record).startsWith(exactTime)
}

function matchesTimeSlot(record, timeSlot) {
    if (!timeSlot) {
        return true
    }

    const baseValue = record?.received_at || record?.created_at

    if (!baseValue) {
        return false
    }

    const hour = new Date(baseValue).getHours()

    if (timeSlot === 'morning') {
        return hour >= 6 && hour < 12
    }

    if (timeSlot === 'afternoon') {
        return hour >= 12 && hour < 18
    }

    if (timeSlot === 'night') {
        return hour >= 18 || hour < 6
    }

    return true
}

function hasActiveFilters(filters) {
    return Object.values(filters).some((value) => String(value || '').trim() !== '')
}

export default function StockEntryMaintenance({ moduleTitle = 'Manutencao de entradas', payload }) {
    const records = Array.isArray(payload?.records) ? payload.records : []
    const importedDocuments = Array.isArray(payload?.incoming_nfe_documents) ? payload.incoming_nfe_documents : []

    const [draftFilters, setDraftFilters] = useState(createDraftFilters())
    const [appliedFilters, setAppliedFilters] = useState(createDraftFilters())
    const [selectedId, setSelectedId] = useState(null)

    const filtersActive = hasActiveFilters(appliedFilters)
    const normalizedSupplier = normalizeTextSearch(appliedFilters.supplier)
    const normalizedProduct = normalizeTextSearch(appliedFilters.product)
    const normalizedNf = normalizeTextSearch(appliedFilters.nf)

    const filteredRecords = useMemo(() => {
        if (!filtersActive) {
            return []
        }

        return records.filter((record) => {
            if (!matchesPeriod(record, appliedFilters.period)) {
                return false
            }

            if (!matchesExactDate(record, appliedFilters.exactDate)) {
                return false
            }

            if (!matchesMonth(record, appliedFilters.month)) {
                return false
            }

            if (!matchesExactTime(record, appliedFilters.exactTime)) {
                return false
            }

            if (!matchesTimeSlot(record, appliedFilters.timeSlot)) {
                return false
            }

            if (normalizedSupplier && !matchesTextSearchAny([record.supplier_name], normalizedSupplier)) {
                return false
            }

            if (normalizedNf && !matchesTextSearchAny([record.invoice_number, record.document, record.code], normalizedNf)) {
                return false
            }

            if (normalizedProduct) {
                const productNames = (record.items || []).map((item) => item.product_name)

                if (!matchesTextSearchAny(productNames, normalizedProduct)) {
                    return false
                }
            }

            return true
        })
    }, [appliedFilters, filtersActive, normalizedNf, normalizedProduct, normalizedSupplier, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => record.id === selectedId) || null,
        [filteredRecords, selectedId],
    )

    const selectedDocument = useMemo(() => {
        if (!selectedRecord) {
            return null
        }

        return importedDocuments.find((document) => (
            String(document.purchase_id || '') === String(selectedRecord.id)
            || String(document.access_key || '') === String(selectedRecord.invoice_access_key || '')
        )) || null
    }, [importedDocuments, selectedRecord])

    function updateDraft(field, value) {
        setDraftFilters((current) => ({ ...current, [field]: value }))
    }

    function applyFilters() {
        setAppliedFilters(draftFilters)
        setSelectedId(null)
    }

    function clearFilters() {
        const empty = createDraftFilters()
        setDraftFilters(empty)
        setAppliedFilters(empty)
        setSelectedId(null)
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page compact">
                <section className="proc-ui-section-card proc-ui-filter-panel">
                    <div className="proc-ui-card-toolbar">
                        <div className="proc-ui-section-title">
                            <h3>{moduleTitle}</h3>
                        </div>

                        <div className="proc-ui-statusline">
                            <button type="button" className="ui-button-ghost" onClick={clearFilters}>
                                <i className="fa-solid fa-rotate-left" />
                                <span>Limpar</span>
                            </button>
                            <button type="button" className="ui-button" onClick={applyFilters}>
                                <i className="fa-solid fa-magnifying-glass" />
                                <span>Buscar</span>
                            </button>
                            <Link className="ui-button-ghost" href="/entrada-estoque">
                                <i className="fa-solid fa-plus" />
                                <span>Nova entrada</span>
                            </Link>
                        </div>
                    </div>

                    <div className="proc-ui-field-grid proc-ui-maintenance-grid">
                        <div className="proc-ui-field">
                            <label>
                                <span><i className="fa-solid fa-hashtag" /> NF</span>
                                <input value={draftFilters.nf} onChange={(event) => updateDraft('nf', event.target.value)} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span><i className="fa-solid fa-building" /> Fornecedor</span>
                                <input value={draftFilters.supplier} onChange={(event) => updateDraft('supplier', event.target.value)} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span><i className="fa-solid fa-box" /> Produto</span>
                                <input value={draftFilters.product} onChange={(event) => updateDraft('product', event.target.value)} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span><i className="fa-solid fa-calendar-day" /> Data</span>
                                <input type="date" value={draftFilters.exactDate} onChange={(event) => updateDraft('exactDate', event.target.value)} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span><i className="fa-solid fa-calendar" /> Mes</span>
                                <input type="month" value={draftFilters.month} onChange={(event) => updateDraft('month', event.target.value)} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span><i className="fa-solid fa-clock" /> Horario</span>
                                <input type="time" value={draftFilters.exactTime} onChange={(event) => updateDraft('exactTime', event.target.value)} />
                            </label>
                        </div>
                        <div className="proc-ui-field full">
                            <div className="proc-ui-filter-row">
                                <div className="proc-ui-filter-group">
                                    {PERIOD_FILTERS.map((filter) => (
                                        <button
                                            key={filter.key || 'free'}
                                            type="button"
                                            className={`proc-ui-chip ${draftFilters.period === filter.key ? 'active' : ''}`}
                                            onClick={() => updateDraft('period', filter.key)}
                                        >
                                            <i className={`fa-solid ${filter.icon}`} />
                                            <span>{filter.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="proc-ui-filter-group">
                                    {TIME_FILTERS.map((filter) => (
                                        <button
                                            key={filter.key || 'any'}
                                            type="button"
                                            className={`proc-ui-chip ${draftFilters.timeSlot === filter.key ? 'active' : ''}`}
                                            onClick={() => updateDraft('timeSlot', filter.key)}
                                        >
                                            <i className={`fa-solid ${filter.icon}`} />
                                            <span>{filter.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="proc-ui-shell">
                    <section className="proc-ui-main-card">
                        <div className="proc-ui-main-header">
                            <div>
                                <h2>{selectedRecord ? `NF ${selectedRecord.invoice_number || selectedRecord.code}` : 'Detalhes'}</h2>
                                {selectedRecord?.supplier_name ? <span className="proc-ui-muted">{selectedRecord.supplier_name}</span> : null}
                            </div>

                            {filtersActive ? (
                                <div className="proc-ui-inline-meta">
                                    <span>{filteredRecords.length} notas</span>
                                    <span>{formatMoney(filteredRecords.reduce((carry, record) => carry + Number(record.total || 0), 0))}</span>
                                </div>
                            ) : null}
                        </div>

                        {selectedRecord ? (
                            <div className="proc-ui-stage">
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card">
                                        <span>NF</span>
                                        <strong>{selectedRecord.invoice_number || '-'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Fornecedor</span>
                                        <strong>{selectedRecord.supplier_name || '-'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Recebimento</span>
                                        <strong>{selectedRecord.received_at ? formatDate(selectedRecord.received_at) : '-'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Total</span>
                                        <strong>{formatMoney(selectedRecord.total || 0)}</strong>
                                    </article>
                                </div>

                                <section className="proc-ui-review-card">
                                    <div className="proc-ui-card-toolbar">
                                        <StatusBadge compact label={selectedRecord.supplier_name || 'Entrada'} tone="info" />

                                        <div className="proc-ui-statusline">
                                            <button
                                                type="button"
                                                className="ui-button-ghost"
                                                disabled={!selectedDocument?.danfe_available}
                                                onClick={() => {
                                                    if (selectedDocument?.id) {
                                                        window.open(`/api/purchases/incoming-nfe/${selectedDocument.id}/danfe`, '_blank', 'noopener,noreferrer')
                                                    }
                                                }}
                                            >
                                                <i className="fa-solid fa-print" />
                                                <span>Espelho</span>
                                            </button>
                                            <button type="button" className="ui-button-ghost" disabled title="Cancelamento indisponivel por rastreabilidade.">
                                                <i className="fa-solid fa-xmark" />
                                                <span>Cancelar</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="proc-ui-two-grid">
                                        <div className="proc-ui-mini-card">
                                            <span>Serie</span>
                                            <strong>{selectedRecord.invoice_series || '-'}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Data NF</span>
                                            <strong>{selectedRecord.invoice_date ? formatDate(selectedRecord.invoice_date) : '-'}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Volumes</span>
                                            <strong>{formatNumber(selectedRecord.quantity_total || 0)}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Itens</span>
                                            <strong>{formatNumber(selectedRecord.items_count || 0)}</strong>
                                        </div>
                                    </div>
                                </section>

                                <section className="proc-ui-section-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Itens</h3>
                                    </div>

                                    <div className="proc-ui-table-wrap">
                                        <table className="proc-ui-table">
                                            <thead>
                                                <tr>
                                                    <th>Produto</th>
                                                    <th>Qtd</th>
                                                    <th>Custo</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedRecord.items || []).length ? selectedRecord.items.map((item, index) => (
                                                    <tr key={`${selectedRecord.id}-item-${index}`}>
                                                        <td>
                                                            <div className="proc-ui-record-card-copy">
                                                                <strong>{item.product_name}</strong>
                                                                <span>{item.product_id ? `Produto #${item.product_id}` : '-'}</span>
                                                            </div>
                                                        </td>
                                                        <td>{formatNumber(item.quantity || 0)}</td>
                                                        <td>{formatMoney(item.unit_cost || 0)}</td>
                                                        <td><strong>{formatMoney(item.total || 0)}</strong></td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan="4">
                                                            <div className="proc-ui-empty">
                                                                <strong>Sem itens</strong>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="proc-ui-empty">
                                <strong>{filtersActive ? 'Selecione uma nota' : 'Aplique filtros'}</strong>
                            </div>
                        )}
                    </section>

                    <aside className="proc-ui-sidebar">
                        <div className="proc-ui-sidebar-section">
                            <div className="proc-ui-card-toolbar">
                                <strong>Resultados</strong>
                                <span className="proc-ui-muted">{filtersActive ? filteredRecords.length : 0}</span>
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-list">
                            {filteredRecords.length ? filteredRecords.map((record) => (
                                <button key={record.id} type="button" className={`proc-ui-record-card ${record.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(record.id)}>
                                    <div className="proc-ui-record-card-top">
                                        <strong>{record.invoice_number || record.code}</strong>
                                        <StatusBadge compact label={record.supplier_name || 'Entrada'} tone="info" />
                                    </div>

                                    <div className="proc-ui-record-card-copy">
                                        <strong>{formatMoney(record.total || 0)}</strong>
                                        <span>{record.received_at ? formatDate(record.received_at) : 'Sem data'}</span>
                                    </div>

                                    <div className="proc-ui-inline-meta">
                                        <span>{formatNumber(record.quantity_total || 0)} un</span>
                                        <span>{formatNumber(record.items_count || 0)} itens</span>
                                    </div>
                                </button>
                            )) : (
                                <div className="proc-ui-empty">
                                    <strong>{filtersActive ? 'Sem notas' : 'Sem busca'}</strong>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    )
}
