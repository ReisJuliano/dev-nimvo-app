import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { formatDate, formatMoney } from '@/lib/format'
import './payables.css'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { buildRecordsUrl, upsertRecord } from '@/Pages/Operations/workspaces/shared'
import '../Operations/backoffice-workspace.css'

const STATUS_FILTERS = [
    { key: 'open', label: 'Em aberto' },
    { key: 'overdue', label: 'Vencidos' },
    { key: 'paid', label: 'Pagos' },
    { key: 'all', label: 'Todos' },
]

function todayInput() {
    return new Date().toISOString().slice(0, 10)
}

function currentMonthRange() {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

    return { from: firstDay.toISOString().slice(0, 10), to: todayInput() }
}

function createLaunchForm() {
    return {
        id: null,
        description: '',
        supplier_id: '',
        creditor_name: '',
        amount: '',
        due_date: todayInput(),
        category: 'supplier',
        recurrence: 'once',
        payment_method: 'boleto',
        bank_name: '',
        barcode: '',
        notes: '',
        amount_paid: '',
        paid_at: '',
    }
}

function normalizeLaunchForm(record) {
    return {
        id: record?.id ?? null,
        description: record?.description ?? '',
        supplier_id: record?.supplier_id ? String(record.supplier_id) : '',
        creditor_name: '',
        amount: record?.amount != null ? String(record.amount) : '',
        due_date: record?.due_date || todayInput(),
        category: record?.category || 'supplier',
        recurrence: record?.recurrence || 'once',
        payment_method: record?.payment_method || 'boleto',
        bank_name: record?.bank_name || '',
        barcode: record?.barcode || '',
        notes: record?.notes || '',
        amount_paid: record?.amount_paid != null ? String(record.amount_paid) : '',
        paid_at: record?.paid_at ? String(record.paid_at).slice(0, 10) : '',
    }
}

function matchesDateRange(record, range) {
    const value = record?.due_date || record?.paid_at || record?.created_at

    if (!value) {
        return true
    }

    const dateValue = String(value).slice(0, 10)

    if (range.from && dateValue < range.from) {
        return false
    }

    if (range.to && dateValue > range.to) {
        return false
    }

    return true
}

function buildPaymentDraft(record) {
    return {
        record,
        amount: record.remaining_amount ? String(record.remaining_amount) : '',
        date: todayInput(),
        method: record.payment_method || 'pix',
        account: record.bank_name || '',
        notes: '',
    }
}

export default function PayablesIndex({ moduleTitle = 'Contas a pagar', payload }) {
    const defaultRange = useMemo(() => currentMonthRange(), [])
    const suppliers = Array.isArray(payload?.suppliers) ? payload.suppliers : []
    const categories = Array.isArray(payload?.categories) ? payload.categories : []
    const paymentMethods = Array.isArray(payload?.payment_methods) ? payload.payment_methods : []
    const recurrences = Array.isArray(payload?.recurrences) ? payload.recurrences : []
    const backendStatusCounts = payload?.status_counts || null
    const [records, setRecords] = useState(Array.isArray(payload?.records) ? payload.records : [])
    const searchControl = useConfirmedSearch('')
    const [activeFilter, setActiveFilter] = useState('open')
    const [appliedFilter, setAppliedFilter] = useState('open')
    const [range, setRange] = useState(defaultRange)
    const [appliedRange, setAppliedRange] = useState(defaultRange)
    const [selectedId, setSelectedId] = useState((payload?.records || [])[0]?.id ?? null)
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [launchModalOpen, setLaunchModalOpen] = useState(false)
    const [launchModalMode, setLaunchModalMode] = useState('create')
    const [launchForm, setLaunchForm] = useState(createLaunchForm())
    const [paymentModal, setPaymentModal] = useState(null)
    const [busy, setBusy] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [hasLoadedRecords, setHasLoadedRecords] = useState(Array.isArray(payload?.records) && payload.records.length > 0)

    const normalizedSearch = normalizeTextSearch(searchControl.value)
    const filteredRecords = useMemo(() => (
        records.filter((record) => {
            const matchesFilter = appliedFilter === 'all'
                || (appliedFilter === 'open'
                    ? ['open', 'overdue'].includes(record.status)
                    : record.status === appliedFilter)

            if (!matchesFilter || !matchesDateRange(record, appliedRange)) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return matchesTextSearchAny([
                record.description,
                record.supplier_name,
                record.purchase_code,
                record.code,
            ], normalizedSearch)
        })
    ), [appliedFilter, appliedRange, normalizedSearch, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => record.id === selectedId) || records.find((record) => record.id === selectedId) || null,
        [filteredRecords, records, selectedId],
    )

    const totals = useMemo(() => ({
        open: records
            .filter((record) => ['open', 'overdue'].includes(record.status))
            .reduce((carry, record) => carry + Number(record.remaining_amount || 0), 0),
        overdue: records
            .filter((record) => record.status === 'overdue')
            .reduce((carry, record) => carry + Number(record.remaining_amount || 0), 0),
    }), [records])

    const statusCounts = useMemo(() => ({
        open: backendStatusCounts?.open ?? records.filter((record) => ['open', 'overdue'].includes(record.status)).length,
        overdue: backendStatusCounts?.overdue ?? records.filter((record) => record.status === 'overdue').length,
        paid: backendStatusCounts?.paid ?? records.filter((record) => record.status === 'paid').length,
        all: backendStatusCounts?.all ?? records.length,
    }), [backendStatusCounts, records])

    const tableColumns = useMemo(() => ([
        {
            key: 'description',
            label: 'Descrição',
            render: (record) => (
                <div className="proc-ui-record-card-copy">
                    <strong>{record.description}</strong>
                    <span>{record.purchase_code || record.code || 'Sem referência'}</span>
                </div>
            ),
        },
        {
            key: 'supplier_name',
            label: 'Fornecedor',
            render: (record) => record.supplier_name || 'Credor avulso',
        },
        {
            key: 'amount',
            label: 'Valor',
            align: 'right',
            render: (record) => <strong>{formatMoney(record.amount)}</strong>,
        },
        {
            key: 'due_date',
            label: 'Vencimento',
            render: (record) => record.due_date ? formatDate(record.due_date) : 'Não informado',
        },
        {
            key: 'payment_method',
            label: 'Forma',
            render: (record) => record.payment_method || 'Livre',
        },
        {
            key: 'status',
            label: 'Status',
            render: (record) => <StatusBadge compact label={record.status_label} tone={record.status_tone} />,
        },
    ]), [])

    function openCreateModal() {
        setLaunchModalMode('create')
        setLaunchForm(createLaunchForm())
        setLaunchModalOpen(true)
    }

    function openEditModal(record) {
        setLaunchModalMode('edit')
        setLaunchForm(normalizeLaunchForm(record))
        setLaunchModalOpen(true)
    }

    async function submitLaunchForm(event) {
        event.preventDefault()
        setBusy(true)
        setFeedback(null)

        const description = launchForm.creditor_name
            ? `${launchForm.creditor_name} - ${launchForm.description}`
            : launchForm.description

        try {
            const payloadData = {
                description,
                supplier_id: launchForm.supplier_id ? Number(launchForm.supplier_id) : null,
                amount: Number(launchForm.amount || 0),
                due_date: launchForm.due_date || null,
                category: launchForm.category,
                recurrence: launchForm.recurrence,
                payment_method: launchForm.payment_method || null,
                bank_name: launchForm.bank_name || null,
                barcode: launchForm.barcode || null,
                notes: launchForm.notes || null,
                amount_paid: launchForm.amount_paid ? Number(launchForm.amount_paid) : 0,
                paid_at: launchForm.paid_at || null,
                status: launchForm.amount_paid && Number(launchForm.amount_paid) >= Number(launchForm.amount || 0) ? 'paid' : 'open',
            }

            const response = launchForm.id
                ? await apiRequest(buildRecordsUrl('contas-a-pagar', launchForm.id), { method: 'put', data: payloadData })
                : await apiRequest(buildRecordsUrl('contas-a-pagar'), { method: 'post', data: payloadData })

            setRecords((current) => upsertRecord(current, response.record))
            setHasLoadedRecords(true)
            setSelectedId(response.record.id)
            setLaunchModalOpen(false)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete(record) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Excluir conta a pagar',
            message: `Deseja excluir ${record.description}?`,
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl('contas-a-pagar', record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))

            if (selectedId === record.id) {
                setSelectedId(null)
                setDetailModalOpen(false)
            }

            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function submitPayment(event) {
        event.preventDefault()

        if (!paymentModal?.record) {
            return
        }

        setBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(buildRecordsUrl('contas-a-pagar', paymentModal.record.id), {
                method: 'put',
                data: {
                    action: 'register_payment',
                    payment_amount: Number(paymentModal.amount || 0),
                    payment_date: paymentModal.date,
                    payment_method: paymentModal.method,
                    payment_account: paymentModal.account || null,
                    payment_notes: paymentModal.notes || null,
                },
            })

            setRecords((current) => upsertRecord(current, response.record))
            setHasLoadedRecords(true)
            setSelectedId(response.record.id)
            setPaymentModal(null)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusy(false)
        }
    }

    async function handleApplyFilters() {
        setBusy(true)
        setFeedback(null)

        try {
            const nextSearch = searchControl.apply()
            const response = await apiRequest(buildRecordsUrl('contas-a-pagar'), {
                params: {
                    applied: 1,
                    status: activeFilter,
                    search: nextSearch || undefined,
                    from: range.from || undefined,
                    to: range.to || undefined,
                },
            })

            setRecords(Array.isArray(response?.records) ? response.records : [])
            setAppliedFilter(activeFilter)
            setAppliedRange({ ...range })
            searchControl.sync(nextSearch)
            setSelectedId((response?.records || [])[0]?.id ?? null)
            setHasLoadedRecords(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusy(false)
        }
    }

    function handleResetFilters() {
        searchControl.clear()
        setActiveFilter('open')
        setAppliedFilter('open')
        setRange(defaultRange)
        setAppliedRange(defaultRange)
        setRecords([])
        setSelectedId(null)
        setHasLoadedRecords(false)
        setFeedback(null)
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="pay-page">

                {/* ─── Header ─── */}
                <div className="pay-header">
                    <div className="pay-header-left">
                        <div className="pay-header-icon">
                            <i className="fa-solid fa-file-invoice-dollar" />
                        </div>
                        <div>
                            <h1 className="pay-header-title">{moduleTitle}</h1>
                            <p className="pay-header-sub">Controle de pagamentos e vencimentos</p>
                        </div>
                    </div>
                    <button className="pay-new-btn" onClick={openCreateModal} type="button">
                        <i className="fa-solid fa-plus" />
                        Novo lançamento
                    </button>
                </div>

                {/* ─── KPI cards ─── */}
                <div className="pay-kpis">
                    <div className="pay-kpi pay-kpi--amber">
                        <div className="pay-kpi-icon">
                            <i className="fa-solid fa-circle-dot" />
                        </div>
                        <div className="pay-kpi-body">
                            <span>Em aberto</span>
                            <strong>{formatMoney(totals.open)}</strong>
                            <small>{statusCounts.open ?? 0} conta(s)</small>
                        </div>
                    </div>
                    <div className="pay-kpi pay-kpi--danger">
                        <div className="pay-kpi-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>
                        <div className="pay-kpi-body">
                            <span>Vencidas</span>
                            <strong>{formatMoney(totals.overdue)}</strong>
                            <small>{statusCounts.overdue ?? 0} conta(s)</small>
                        </div>
                    </div>
                    <div className="pay-kpi pay-kpi--green">
                        <div className="pay-kpi-icon">
                            <i className="fa-solid fa-circle-check" />
                        </div>
                        <div className="pay-kpi-body">
                            <span>Pagas</span>
                            <strong>{statusCounts.paid ?? 0}</strong>
                            <small>neste período</small>
                        </div>
                    </div>
                    <div className="pay-kpi pay-kpi--default">
                        <div className="pay-kpi-icon">
                            <i className="fa-solid fa-list-check" />
                        </div>
                        <div className="pay-kpi-body">
                            <span>Total carregado</span>
                            <strong>{statusCounts.all ?? 0}</strong>
                            <small>lançamentos</small>
                        </div>
                    </div>
                </div>

                {/* ─── Filtros + busca ─── */}
                <div className="pay-toolbar">
                    <div className="pay-filter-tabs">
                        {STATUS_FILTERS.map((filter) => (
                            <button
                                key={filter.key}
                                type="button"
                                className={`pay-filter-tab ${activeFilter === filter.key ? 'active' : ''}`}
                                onClick={() => setActiveFilter(filter.key)}
                            >
                                {filter.label}
                                {statusCounts[filter.key] != null ? (
                                    <span>{statusCounts[filter.key]}</span>
                                ) : null}
                            </button>
                        ))}
                    </div>

                    <div className="pay-toolbar-right">
                        <label className="pay-search">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                placeholder="Buscar por descrição ou fornecedor..."
                                value={searchControl.draftValue}
                                onChange={(e) => searchControl.setDraftValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                            />
                        </label>

                        <div className="pay-date-row">
                            <input
                                type="date"
                                className="pay-date-input"
                                value={range.from}
                                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                            />
                            <span>até</span>
                            <input
                                type="date"
                                className="pay-date-input"
                                value={range.to}
                                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                            />
                        </div>

                        <button type="button" className="pay-apply-btn" onClick={handleApplyFilters} disabled={busy}>
                            {busy ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-magnifying-glass" />}
                            Filtrar
                        </button>
                        <button type="button" className="pay-reset-btn" onClick={handleResetFilters}>
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </div>

                {/* ─── Feedback ─── */}
                {feedback ? (
                    <div className={`pay-feedback ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                        <span>{feedback.text}</span>
                    </div>
                ) : null}

                {/* ─── Tabela ─── */}
                <div className="pay-table-card">
                    {filteredRecords.length > 0 ? (
                        <table className="pay-table">
                            <thead>
                                <tr>
                                    <th>Descrição</th>
                                    <th>Fornecedor / Credor</th>
                                    <th style={{ textAlign: 'right' }}>Valor</th>
                                    <th style={{ textAlign: 'right' }}>Restante</th>
                                    <th>Vencimento</th>
                                    <th>Status</th>
                                    <th style={{ width: 120 }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((record) => {
                                    const isOverdue = record.status === 'overdue'
                                    const isPaid = record.status === 'paid'
                                    const isSelected = record.id === selectedId

                                    return (
                                        <tr
                                            key={record.id}
                                            className={`pay-row ${isSelected ? 'selected' : ''} ${isOverdue ? 'overdue' : ''} ${isPaid ? 'paid' : ''}`}
                                            onClick={() => setSelectedId(record.id)}
                                        >
                                            <td>
                                                <div className="pay-row-desc">
                                                    <strong>{record.description}</strong>
                                                    <small>{record.purchase_code || record.code || 'Sem referência'}</small>
                                                </div>
                                            </td>
                                            <td className="pay-row-supplier">
                                                {record.supplier_name || 'Credor avulso'}
                                            </td>
                                            <td className="pay-row-money">
                                                {formatMoney(record.amount)}
                                            </td>
                                            <td className={`pay-row-money ${isOverdue ? 'text-danger' : ''}`}>
                                                <strong>{formatMoney(record.remaining_amount)}</strong>
                                            </td>
                                            <td className={`pay-row-date ${isOverdue ? 'text-danger' : ''}`}>
                                                {isOverdue ? <i className="fa-solid fa-triangle-exclamation" /> : null}
                                                {record.due_date ? formatDate(record.due_date) : '—'}
                                            </td>
                                            <td>
                                                <StatusBadge compact label={record.status_label} tone={record.status_tone} />
                                            </td>
                                            <td>
                                                <div className="pay-row-actions">
                                                    <button
                                                        type="button"
                                                        className="pay-row-btn"
                                                        title="Ver detalhes"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedId(record.id); setDetailModalOpen(true) }}
                                                    >
                                                        <i className="fa-solid fa-eye" />
                                                    </button>
                                                    {!isPaid ? (
                                                        <button
                                                            type="button"
                                                            className="pay-row-btn pay-row-btn--pay"
                                                            title="Registrar pagamento"
                                                            onClick={(e) => { e.stopPropagation(); setPaymentModal(buildPaymentDraft(record)) }}
                                                        >
                                                            <i className="fa-solid fa-money-bill-wave" />
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="pay-row-btn"
                                                        title="Editar"
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(record) }}
                                                    >
                                                        <i className="fa-solid fa-pen" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="pay-row-btn pay-row-btn--danger"
                                                        title="Excluir"
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(record) }}
                                                    >
                                                        <i className="fa-solid fa-trash" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="pay-empty">
                            <i className="fa-solid fa-file-invoice-dollar" />
                            <strong>{hasLoadedRecords ? 'Nenhum lançamento encontrado' : 'Filtre para carregar os lançamentos'}</strong>
                            <small>{hasLoadedRecords ? 'Ajuste os filtros acima.' : 'Use os filtros e clique em Filtrar.'}</small>
                        </div>
                    )}

                    {filteredRecords.length > 0 ? (
                        <div className="pay-footer">
                            <span>
                                <strong>{filteredRecords.length}</strong> lançamento(s) · Em aberto:&nbsp;
                                <strong>{formatMoney(totals.open)}</strong>
                                {totals.overdue > 0 ? (
                                    <>&nbsp;·&nbsp;<span className="text-danger">Vencido: <strong>{formatMoney(totals.overdue)}</strong></span></>
                                ) : null}
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>

            <CompactModal
                open={detailModalOpen && Boolean(selectedRecord)}
                title={selectedRecord?.description || 'Detalhes'}
                description={selectedRecord ? `${selectedRecord.supplier_name || 'Credor avulso'} · ${formatMoney(selectedRecord.amount)}` : ''}
                icon="fa-file-invoice-dollar"
                size="lg"
                onClose={() => setDetailModalOpen(false)}
            >
                {selectedRecord ? (
                    <div className="proc-ui-modal-stack">
                        <div className="proc-ui-summary-grid">
                            <article className="proc-ui-summary-card">
                                <span>Status</span>
                                <strong>{selectedRecord.status_label}</strong>
                            </article>
                            <article className="proc-ui-summary-card">
                                <span>Valor</span>
                                <strong>{formatMoney(selectedRecord.amount)}</strong>
                            </article>
                            <article className="proc-ui-summary-card">
                                <span>Pago</span>
                                <strong>{formatMoney(selectedRecord.amount_paid)}</strong>
                            </article>
                            <article className="proc-ui-summary-card">
                                <span>Saldo</span>
                                <strong>{formatMoney(selectedRecord.remaining_amount)}</strong>
                            </article>
                        </div>

                        <section className="proc-ui-review-card">
                            <div className="proc-ui-card-toolbar">
                                <div className="proc-ui-section-title">
                                    <h3>{selectedRecord.description}</h3>
                                    <p>{selectedRecord.supplier_name || 'Credor avulso'} · {selectedRecord.purchase_code || 'Sem vinculo com NF'}</p>
                                </div>
                                <StatusBadge compact label={selectedRecord.status_label} tone={selectedRecord.status_tone} />
                            </div>

                            <div className="proc-ui-two-grid">
                                <div className="proc-ui-mini-card">
                                    <span>Vencimento</span>
                                    <strong>{selectedRecord.due_date ? formatDate(selectedRecord.due_date) : 'Não informado'}</strong>
                                </div>
                                <div className="proc-ui-mini-card">
                                    <span>Forma</span>
                                    <strong>{selectedRecord.payment_method || 'Não definida'}</strong>
                                </div>
                                <div className="proc-ui-mini-card">
                                    <span>Banco / conta</span>
                                    <strong>{selectedRecord.bank_name || 'Não informado'}</strong>
                                </div>
                                <div className="proc-ui-mini-card">
                                    <span>Parcela</span>
                                    <strong>{selectedRecord.installment_label || 'Unica'}</strong>
                                </div>
                            </div>

                            {selectedRecord.notes ? (
                                <div className="proc-ui-banner info">
                                    <i className="fa-solid fa-note-sticky" />
                                    <div>{selectedRecord.notes}</div>
                                </div>
                            ) : null}
                        </section>

                        <section className="proc-ui-section-card">
                            <div className="proc-ui-section-title">
                                <h3>Histórico de pagamentos</h3>
                                <p>Pagamentos registrados manualmente ficam listados abaixo.</p>
                            </div>

                            {(selectedRecord.metadata?.payments || []).length ? (
                                <div className="proc-ui-surface-list">
                                    {(selectedRecord.metadata?.payments || []).map((payment, index) => (
                                        <div key={`payment-${index}`} className="proc-ui-surface-item">
                                            <div>
                                                <strong>{formatMoney(payment.amount)}</strong>
                                                <small>{formatDate(payment.paid_at)} · {payment.method}</small>
                                            </div>
                                            <div className="proc-ui-record-card-copy">
                                                <strong>{payment.account || 'Sem conta'}</strong>
                                                <span>{payment.notes || 'Sem observação'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="proc-ui-empty">
                                    <strong>Sem pagamentos registrados</strong>
                                </div>
                            )}
                        </section>
                    </div>
                ) : null}
            </CompactModal>

            <CompactModal
                open={launchModalOpen}
                title={launchModalMode === 'edit' ? 'Editar lancamento' : 'Novo lancamento avulso'}
                description=""
                icon="fa-file-invoice-dollar"
                size="lg"
                onClose={() => setLaunchModalOpen(false)}
            >
                <form className="proc-ui-modal-stack" onSubmit={submitLaunchForm}>
                    <div className="proc-ui-field-grid">
                        <div className="proc-ui-field full">
                            <label>
                                <span>Descrição</span>
                                <input required value={launchForm.description} onChange={(event) => setLaunchForm((current) => ({ ...current, description: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Fornecedor</span>
                                <select value={launchForm.supplier_id} onChange={(event) => setLaunchForm((current) => ({ ...current, supplier_id: event.target.value }))}>
                                    <option value="">Não vinculado</option>
                                    {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Credor livre</span>
                                <input value={launchForm.creditor_name} onChange={(event) => setLaunchForm((current) => ({ ...current, creditor_name: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Valor</span>
                                <input required min="0" step="0.01" type="number" value={launchForm.amount} onChange={(event) => setLaunchForm((current) => ({ ...current, amount: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Vencimento</span>
                                <input required type="date" value={launchForm.due_date} onChange={(event) => setLaunchForm((current) => ({ ...current, due_date: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Categoria</span>
                                <select value={launchForm.category} onChange={(event) => setLaunchForm((current) => ({ ...current, category: event.target.value }))}>
                                    {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Recorrencia</span>
                                <select value={launchForm.recurrence} onChange={(event) => setLaunchForm((current) => ({ ...current, recurrence: event.target.value }))}>
                                    {recurrences.map((recurrence) => <option key={recurrence.value} value={recurrence.value}>{recurrence.label}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Forma</span>
                                <select value={launchForm.payment_method} onChange={(event) => setLaunchForm((current) => ({ ...current, payment_method: event.target.value }))}>
                                    {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                                </select>
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Banco / conta</span>
                                <input value={launchForm.bank_name} onChange={(event) => setLaunchForm((current) => ({ ...current, bank_name: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field full">
                            <label>
                                <span>Código de barras</span>
                                <input value={launchForm.barcode} onChange={(event) => setLaunchForm((current) => ({ ...current, barcode: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field full">
                            <label>
                                <span>Observação</span>
                                <textarea rows="4" value={launchForm.notes} onChange={(event) => setLaunchForm((current) => ({ ...current, notes: event.target.value }))} />
                            </label>
                        </div>
                    </div>

                    <div className="proc-ui-modal-footer">
                        <button type="button" className="ui-button-ghost" onClick={() => setLaunchModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                </form>
            </CompactModal>

            <CompactModal
                open={Boolean(paymentModal)}
                title="Registrar pagamento"
                description={paymentModal?.record ? `${paymentModal.record.description} · saldo ${formatMoney(paymentModal.record.remaining_amount)}` : ''}
                icon="fa-money-bill-wave"
                size="md"
                onClose={() => setPaymentModal(null)}
            >
                {paymentModal ? (
                    <form className="proc-ui-modal-stack" onSubmit={submitPayment}>
                        <div className="proc-ui-field-grid">
                            <div className="proc-ui-field">
                                <label>
                                    <span>Valor pago</span>
                                    <input required min="0" step="0.01" type="number" value={paymentModal.amount} onChange={(event) => setPaymentModal((current) => ({ ...current, amount: event.target.value }))} />
                                </label>
                            </div>
                            <div className="proc-ui-field">
                                <label>
                                    <span>Data do pagamento</span>
                                    <input required type="date" value={paymentModal.date} onChange={(event) => setPaymentModal((current) => ({ ...current, date: event.target.value }))} />
                                </label>
                            </div>
                            <div className="proc-ui-field">
                                <label>
                                    <span>Forma</span>
                                    <select value={paymentModal.method} onChange={(event) => setPaymentModal((current) => ({ ...current, method: event.target.value }))}>
                                        {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                                    </select>
                                </label>
                            </div>
                            <div className="proc-ui-field">
                                <label>
                                    <span>Conta / banco</span>
                                    <input value={paymentModal.account} onChange={(event) => setPaymentModal((current) => ({ ...current, account: event.target.value }))} />
                                </label>
                            </div>
                            <div className="proc-ui-field full">
                                <label>
                                    <span>Observação</span>
                                    <textarea rows="4" value={paymentModal.notes} onChange={(event) => setPaymentModal((current) => ({ ...current, notes: event.target.value }))} />
                                </label>
                            </div>
                        </div>

                        <div className="proc-ui-modal-footer">
                            <button type="button" className="ui-button-ghost" onClick={() => setPaymentModal(null)}>Cancelar</button>
                            <button type="submit" className="ui-button" disabled={busy}>{busy ? 'Confirmando...' : 'Confirmar pagamento'}</button>
                        </div>
                    </form>
                ) : null}
            </CompactModal>
        </AppLayout>
    )
}
