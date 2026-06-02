import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ActionSidebar from '@/Components/UI/ActionSidebar'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { apiRequest } from '@/lib/http'
import { buildRecordsUrl } from '@/Pages/Operations/workspaces/shared'
import '../Operations/backoffice-workspace.css'
import './maintenance.css'

const PERIOD_FILTERS = [
    { key: 'all', label: 'Todas', value: '' },
    { key: 'today', label: 'Hoje', value: 'today', days: 1 },
    { key: 'week', label: 'Semana', value: 'week', days: 7 },
    { key: 'month', label: 'Mês', value: 'month', days: 30 },
]

const TIME_FILTERS = [
    { key: 'morning', label: 'Manhã', icon: 'fa-sun' },
    { key: 'afternoon', label: 'Tarde', icon: 'fa-cloud-sun' },
    { key: 'night', label: 'Noite', icon: 'fa-moon' },
]

function pad(value) {
    return String(value).padStart(2, '0')
}

function formatInputDate(value) {
    if (!value) {
        return ''
    }

    const date = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(date.getTime())) {
        return ''
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function createTodayInputValue() {
    const now = new Date()

    return formatInputDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
}

function createRangeFromToday(days) {
    const end = new Date()
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    start.setDate(start.getDate() - Math.max(0, days - 1))

    return {
        from: formatInputDate(start),
        to: createTodayInputValue(),
    }
}

function createMonthRange() {
    const now = new Date()

    return {
        from: formatInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: createTodayInputValue(),
    }
}

function createDraftFilters() {
    const monthRange = createMonthRange()

    return {
        search: '',
        from: monthRange.from,
        to: monthRange.to,
        period: '',
        timeSlot: '',
    }
}

function readInitialFilters() {
    const filters = createDraftFilters()

    if (typeof window === 'undefined') {
        return filters
    }

    const params = new URLSearchParams(window.location.search)

    return {
        ...filters,
        search: params.get('search') || params.get('nf') || params.get('supplier') || params.get('product') || '',
        from: params.get('from') || filters.from,
        to: params.get('to') || filters.to,
        period: params.get('period') || '',
        timeSlot: params.get('time_slot') || '',
    }
}

function resolveRecordDate(record) {
    return String(record?.received_at || record?.created_at || '').slice(0, 10)
}

function matchesDateRange(record, from, to) {
    const date = resolveRecordDate(record)

    if (!date) {
        return true
    }

    if (from && date < from) {
        return false
    }

    if (to && date > to) {
        return false
    }

    return true
}

function matchesPeriod(record, periodKey) {
    const period = PERIOD_FILTERS.find((filter) => filter.value === periodKey)

    if (!period?.days) {
        return true
    }

    const baseValue = record?.received_at || record?.created_at

    if (!baseValue) {
        return true
    }

    const target = new Date(baseValue)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - Math.max(0, period.days - 1))

    return target >= start
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

function matchesUnifiedSearch(record, normalizedSearch) {
    if (!normalizedSearch) {
        return true
    }

    return matchesTextSearchAny([
        record.custom_name,
        record.invoice_number,
        record.invoice_series,
        record.invoice_access_key,
        record.document,
        record.code,
        record.supplier_name,
        ...(record.items || []).map((item) => item.product_name),
    ], normalizedSearch)
}

function findDocumentForRecord(record, documents) {
    if (!record) {
        return null
    }

    return documents.find((document) => (
        String(document.purchase_id || '') === String(record.id)
        || String(document.access_key || '') === String(record.invoice_access_key || '')
        || String(document.number || '') === String(record.invoice_number || '')
    )) || null
}

function stockEntryTitle(record) {
    return record?.custom_name || record?.invoice_number || record?.code || `Entrada #${record?.id}`
}

function stockEntryDate(record) {
    return record?.received_at || record?.created_at || record?.invoice_date || null
}

function documentItemFor(recordItem, document) {
    if (!document?.items?.length) {
        return null
    }

    return document.items.find((item) => (
        String(item.product_id || '') === String(recordItem.product_id || '')
        || normalizeTextSearch(item.product_name || item.description) === normalizeTextSearch(recordItem.product_name)
    )) || null
}

function buildMirrorUrl(record, document) {
    if (document?.id && document?.danfe_available) {
        return `/api/purchases/incoming-nfe/${document.id}/danfe`
    }

    if (record?.id) {
        return `/api/purchases/${record.id}/report`
    }

    return null
}

function openMirror(record, document) {
    const url = buildMirrorUrl(record, document)

    if (!url) {
        return
    }

    window.open(url, '_blank', 'noopener,noreferrer')
}

function DetailMetric({ label, value }) {
    return (
        <article className="stock-maintenance-detail-metric">
            <span>{label}</span>
            <strong>{value || '-'}</strong>
        </article>
    )
}

function StockEntryDetailsModal({
    record,
    document,
    cancelDisabled,
    onCancel,
    onClose,
    onMirror,
}) {
    const [fiscalOpen, setFiscalOpen] = useState(false)

    if (!record) {
        return null
    }

    const cfop = document?.items?.find((item) => item.cfop)?.cfop || '-'
    const fiscalItems = document?.items || []
    const mirrorUrl = buildMirrorUrl(record, document)
    const financialItems = [
        record.billing_barcode ? `Boleto ${record.billing_barcode}` : null,
        record.billing_due_date ? `Venc. ${formatDate(record.billing_due_date)}` : null,
        record.billing_amount ? formatMoney(record.billing_amount) : null,
    ].filter(Boolean)

    return (
        <CompactModal
            open
            badge="Entrada"
            className="stock-maintenance-detail-modal"
            description={`${record.supplier_name || 'Fornecedor'} · ${stockEntryDate(record) ? formatDate(stockEntryDate(record)) : 'Sem data'}`}
            icon="fa-file-invoice"
            size="lg"
            title={stockEntryTitle(record)}
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="ui-button-ghost" onClick={onClose}>
                        Fechar
                    </button>
                    <button
                        type="button"
                        className="ui-button-ghost"
                        disabled={!mirrorUrl}
                        onClick={onMirror}
                    >
                        <i className="fa-solid fa-print" />
                        <span>Espelho NF</span>
                    </button>
                    <button
                        type="button"
                        className="ui-button-ghost danger"
                        disabled={cancelDisabled}
                        title={cancelDisabled ? 'Cancelamento indisponível por rastreabilidade.' : 'Cancelar entrada'}
                        onClick={onCancel}
                    >
                        <i className="fa-solid fa-xmark" />
                        <span>Cancelar entrada</span>
                    </button>
                </>
            )}
        >
            <div className="stock-maintenance-detail-stack">
                <section className="stock-maintenance-detail-head">
                    <div>
                        <h3>{stockEntryTitle(record)} · {record.supplier_name || 'Fornecedor'} · {stockEntryDate(record) ? formatDate(stockEntryDate(record)) : 'Sem data'}</h3>
                    </div>
                    <div className="stock-maintenance-detail-actions">
                        <StatusBadge compact label={document?.fiscal_status || record.status || 'Recebida'} tone="success" />
                        <button type="button" className="ui-button-ghost" disabled={!mirrorUrl} onClick={onMirror}>
                            <i className="fa-solid fa-print" />
                            <span>Espelho</span>
                        </button>
                        <button
                            type="button"
                            className="ui-button-ghost danger"
                            disabled={cancelDisabled}
                            title={cancelDisabled ? 'Cancelamento indisponível por rastreabilidade.' : 'Cancelar entrada'}
                            onClick={onCancel}
                        >
                            <i className="fa-solid fa-xmark" />
                            <span>Cancelar</span>
                        </button>
                    </div>
                </section>

                <section className="stock-maintenance-detail-grid">
                    <DetailMetric label="NF" value={record.invoice_number || document?.number} />
                    <DetailMetric label="Série" value={record.invoice_series || document?.series} />
                    <DetailMetric label="Data NF" value={record.invoice_date ? formatDate(record.invoice_date) : (document?.issued_at ? formatDate(document.issued_at) : '-')} />
                    <DetailMetric label="Data entrada" value={stockEntryDate(record) ? formatDate(stockEntryDate(record)) : '-'} />
                    <DetailMetric label="CFOP" value={cfop} />
                    <DetailMetric label="Volumes" value={formatNumber(record.quantity_total || 0)} />
                    <DetailMetric label="Itens" value={formatNumber(record.items_count || record.items?.length || 0)} />
                    <DetailMetric label="Total" value={formatMoney(record.total || 0)} />
                </section>

                <section className="stock-maintenance-detail-section">
                    <h3>Itens</h3>
                    <div className="proc-ui-table-wrap">
                        <table className="proc-ui-table stock-maintenance-items-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Cód. Barras</th>
                                    <th>Qtd</th>
                                    <th>Custo unit.</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(record.items || []).length ? record.items.map((item, index) => {
                                    const documentItem = documentItemFor(item, document)

                                    return (
                                        <tr key={`${record.id}-item-${item.id || index}`}>
                                            <td>{item.product_name || documentItem?.description || '-'}</td>
                                            <td>{documentItem?.barcode || '-'}</td>
                                            <td>{formatNumber(item.quantity || 0)}</td>
                                            <td>{formatMoney(item.unit_cost || documentItem?.unit_price || 0)}</td>
                                            <td><strong>{formatMoney(item.total || documentItem?.total_price || 0)}</strong></td>
                                        </tr>
                                    )
                                }) : (
                                    <tr>
                                        <td colSpan="5">
                                            <div className="proc-ui-empty">
                                                <strong>Nenhum item registrado</strong>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {record.code || financialItems.length ? (
                    <section className="stock-maintenance-detail-section">
                        <h3>Financeiro</h3>
                        <p>
                            Pedido: <strong>{record.code || '-'}</strong>
                            {financialItems.length ? <> · Parcelas geradas: <strong>{financialItems.join(' · ')}</strong></> : null}
                        </p>
                    </section>
                ) : null}

                <section className="stock-maintenance-detail-section">
                    <button
                        type="button"
                        className="stock-maintenance-collapse"
                        onClick={() => setFiscalOpen((current) => !current)}
                    >
                        <span>Fiscal</span>
                        <i className={`fa-solid ${fiscalOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                    </button>

                    {fiscalOpen ? (
                        <div className="stock-maintenance-fiscal-grid">
                            <DetailMetric label="Chave NF-e" value={record.invoice_access_key || document?.access_key} />
                            <DetailMetric label="Protocolo" value={document?.sefaz_protocol} />
                            <DetailMetric
                                label="CST"
                                value={fiscalItems.map((item) => item.icms_cst_csosn || item.pis_cst || item.cofins_cst).filter(Boolean).slice(0, 4).join(', ')}
                            />
                        </div>
                    ) : null}
                </section>
            </div>
        </CompactModal>
    )
}

export default function StockEntryMaintenance({ moduleTitle = 'Manutenção de entradas', payload }) {
    const initialRecords = Array.isArray(payload?.records) ? payload.records : []
    const importedDocuments = Array.isArray(payload?.incoming_nfe_documents) ? payload.incoming_nfe_documents : []

    const [records, setRecords] = useState(initialRecords)
    const [draftFilters, setDraftFilters] = useState(() => readInitialFilters())
    const [appliedFilters, setAppliedFilters] = useState(createDraftFilters())
    const [selectedId, setSelectedId] = useState(null)
    const [detailRecordId, setDetailRecordId] = useState(null)
    const [loading, setLoading] = useState(false)
    const [hasLoadedRecords, setHasLoadedRecords] = useState(initialRecords.length > 0)
    const [feedback, setFeedback] = useState(null)

    const normalizedSearch = normalizeTextSearch(appliedFilters.search)

    const filteredRecords = useMemo(() => {
        return records
            .filter((record) => (
                matchesDateRange(record, appliedFilters.from, appliedFilters.to)
                && matchesPeriod(record, appliedFilters.period)
                && matchesTimeSlot(record, appliedFilters.timeSlot)
                && matchesUnifiedSearch(record, normalizedSearch)
            ))
            .sort((left, right) => {
                const leftTime = new Date(stockEntryDate(left) || 0).getTime()
                const rightTime = new Date(stockEntryDate(right) || 0).getTime()

                return rightTime - leftTime || Number(right.id || 0) - Number(left.id || 0)
            })
    }, [appliedFilters, normalizedSearch, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedId)) || null,
        [filteredRecords, selectedId],
    )

    const detailRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(detailRecordId)) || null,
        [detailRecordId, filteredRecords],
    )

    const selectedDocument = useMemo(() => findDocumentForRecord(selectedRecord, importedDocuments), [importedDocuments, selectedRecord])
    const detailDocument = useMemo(() => findDocumentForRecord(detailRecord, importedDocuments), [detailRecord, importedDocuments])

    const totalFiltered = useMemo(
        () => filteredRecords.reduce((carry, record) => carry + Number(record.total || 0), 0),
        [filteredRecords],
    )

    const columns = useMemo(() => [
        {
            key: 'nf',
            label: 'NF',
            width: '15%',
            render: (record) => (
                <div className="stock-maintenance-primary-cell">
                    <strong>{record.invoice_number || record.custom_name || '-'}</strong>
                    <span>{record.code || 'Sem pedido'}</span>
                </div>
            ),
        },
        {
            key: 'supplier',
            label: 'Fornecedor',
            width: '22%',
            render: (record) => record.supplier_name || '-',
        },
        {
            key: 'received_at',
            label: 'Data entrada',
            width: '14%',
            render: (record) => stockEntryDate(record) ? formatDate(stockEntryDate(record)) : '-',
        },
        {
            key: 'items',
            label: 'Itens',
            align: 'right',
            width: '9%',
            render: (record) => formatNumber(record.items_count || record.items?.length || 0),
        },
        {
            key: 'units',
            label: 'Unidades',
            align: 'right',
            width: '10%',
            render: (record) => formatNumber(record.quantity_total || 0),
        },
        {
            key: 'total',
            label: 'Total',
            align: 'right',
            width: '13%',
            render: (record) => <strong>{formatMoney(record.total || 0)}</strong>,
        },
        {
            key: 'purchase',
            label: 'Pedido',
            width: '13%',
            render: (record) => record.code || '-',
        },
    ], [])

    function updateDraft(field, value) {
        setDraftFilters((current) => ({ ...current, [field]: value }))
    }

    function handlePeriodChange(value, filter) {
        setDraftFilters((current) => ({
            ...current,
            period: value,
            ...(filter?.days ? createRangeFromToday(filter.days) : {}),
        }))
    }

    async function applyFilters() {
        setLoading(true)
        setFeedback(null)

        try {
            const response = await apiRequest(buildRecordsUrl('entrada-estoque'), {
                params: {
                    applied: 1,
                    search: draftFilters.search || undefined,
                    from: draftFilters.from || undefined,
                    to: draftFilters.to || undefined,
                    period: draftFilters.period || undefined,
                    time_slot: draftFilters.timeSlot || undefined,
                },
            })

            setRecords(Array.isArray(response?.records) ? response.records : [])
            setAppliedFilters({ ...draftFilters })
            setSelectedId(null)
            setDetailRecordId(null)
            setHasLoadedRecords(true)
        } catch (error) {
            setRecords([])
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    function clearFilters() {
        const empty = createDraftFilters()
        setDraftFilters(empty)
        setAppliedFilters(empty)
        setRecords([])
        setSelectedId(null)
        setDetailRecordId(null)
        setLoading(false)
        setHasLoadedRecords(false)
        setFeedback(null)
    }

    function selectRecord(record, openDetails = false) {
        setSelectedId(record.id)

        if (openDetails) {
            setDetailRecordId(record.id)
        }
    }

    function handleNewEntry() {
        window.location.href = '/entrada-estoque'
    }

    function handleCancelAttempt() {
        setFeedback({
            type: 'error',
            text: 'Cancelamento indisponível nesta tela por rastreabilidade. Use o fluxo fiscal habilitado quando houver suporte ao estorno.',
        })
    }

    const emptyMessage = loading
        ? 'Buscando entradas...'
        : hasLoadedRecords
            ? 'Nenhuma entrada encontrada'
            : 'Aplique os filtros para listar as entradas'

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page stock-maintenance-page">
                <section className="proc-ui-section-card purchases-list-card stock-maintenance-list-card">
                    <div className="ui-list-page-shell" style={{ padding: 0 }}>
                        <div className="ui-list-page-main">
                            <PageHeader
                                title={moduleTitle}
                                search={{
                                    placeholder: 'Buscar por NF, fornecedor ou produto...',
                                    value: draftFilters.search,
                                    onChange: (value) => updateDraft('search', value),
                                }}
                                filters={PERIOD_FILTERS.map((filter) => ({
                                    ...filter,
                                    count: filter.value === ''
                                        ? records.length
                                        : records.filter((record) => matchesPeriod(record, filter.value)).length,
                                }))}
                                activeFilter={draftFilters.period}
                                onFilterChange={handlePeriodChange}
                                dateRange={{
                                    from: draftFilters.from,
                                    to: draftFilters.to,
                                    onChange: (nextRange) => setDraftFilters((current) => ({
                                        ...current,
                                        from: nextRange.from,
                                        to: nextRange.to,
                                        period: '',
                                    })),
                                }}
                                quickDateOptions={TIME_FILTERS.map((filter) => ({
                                    ...filter,
                                    active: draftFilters.timeSlot === filter.key,
                                    onClick: () => updateDraft('timeSlot', draftFilters.timeSlot === filter.key ? '' : filter.key),
                                }))}
                                quickDates
                                applyLabel={loading ? 'Buscando...' : 'Filtrar'}
                                onApply={() => void applyFilters()}
                                onReset={clearFilters}
                            />

                            {feedback ? (
                                <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                                    <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                    <span>{feedback.text}</span>
                                </div>
                            ) : null}

                            <section className="ui-list-page-table-card">
                                <DataTable
                                    className="stock-maintenance-records-table"
                                    columns={columns}
                                    rows={filteredRecords}
                                    selectedRowKey={selectedId}
                                    onRowClick={(record) => selectRecord(record, true)}
                                    emptyIcon="fa-box-open"
                                    emptyMessage={emptyMessage}
                                    actions={(record) => {
                                        const document = findDocumentForRecord(record, importedDocuments)
                                        const mirrorUrl = buildMirrorUrl(record, document)

                                        return [
                                            {
                                                key: 'view',
                                                icon: 'fa-eye',
                                                label: 'Ver detalhes',
                                                tone: 'primary',
                                                onClick: () => selectRecord(record, true),
                                            },
                                            {
                                                key: 'mirror',
                                                icon: 'fa-print',
                                                label: 'Espelho NF',
                                                disabled: !mirrorUrl,
                                                selectRow: false,
                                                onClick: () => {
                                                    selectRecord(record)
                                                    openMirror(record, document)
                                                },
                                            },
                                            {
                                                key: 'cancel',
                                                icon: 'fa-xmark',
                                                label: 'Cancelar',
                                                tone: 'danger',
                                                selectRow: false,
                                                onClick: () => {
                                                    selectRecord(record)
                                                    handleCancelAttempt()
                                                },
                                            },
                                        ]
                                    }}
                                />
                            </section>

                            {hasLoadedRecords ? (
                                <footer className="purchases-table-footer stock-maintenance-table-footer">
                                    <span>Total de entradas: <strong>{formatNumber(filteredRecords.length)}</strong></span>
                                    <span>Total filtrado: <strong>{formatMoney(totalFiltered)}</strong></span>
                                </footer>
                            ) : null}
                        </div>

                        <ActionSidebar
                            storageKey="stock-entry-maintenance"
                            persistCollapsed={false}
                            actions={[
                                {
                                    key: 'create',
                                    icon: 'fa-plus',
                                    label: 'Nova entrada',
                                    tone: 'primary',
                                    onClick: handleNewEntry,
                                },
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    disabled: !selectedRecord,
                                    onClick: () => selectedRecord && setDetailRecordId(selectedRecord.id),
                                },
                                {
                                    key: 'mirror',
                                    icon: 'fa-print',
                                    label: 'Espelho NF',
                                    disabled: !buildMirrorUrl(selectedRecord, selectedDocument),
                                    onClick: () => openMirror(selectedRecord, selectedDocument),
                                },
                                {
                                    key: 'cancel',
                                    icon: 'fa-xmark',
                                    label: 'Cancelar',
                                    tone: 'danger',
                                    dividerBefore: true,
                                    disabled: !selectedRecord,
                                    onClick: handleCancelAttempt,
                                },
                            ]}
                        />
                    </div>
                </section>
            </div>

            <StockEntryDetailsModal
                record={detailRecord}
                document={detailDocument}
                cancelDisabled={!detailRecord}
                onCancel={handleCancelAttempt}
                onClose={() => setDetailRecordId(null)}
                onMirror={() => openMirror(detailRecord, detailDocument)}
            />
        </AppLayout>
    )
}
