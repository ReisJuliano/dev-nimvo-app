import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CompactModal from '@/Components/UI/CompactModal'
import StatusBadge from '@/Components/UI/StatusBadge'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
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

export default function PayablesIndex({ moduleTitle = 'Contas a pagar', payload }) {
    const suppliers = Array.isArray(payload?.suppliers) ? payload.suppliers : []
    const categories = Array.isArray(payload?.categories) ? payload.categories : []
    const paymentMethods = Array.isArray(payload?.payment_methods) ? payload.payment_methods : []
    const recurrences = Array.isArray(payload?.recurrences) ? payload.recurrences : []
    const [records, setRecords] = useState(Array.isArray(payload?.records) ? payload.records : [])
    const [activeFilter, setActiveFilter] = useState('open')
    const [range, setRange] = useState({ from: '', to: '' })
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState((payload?.records || [])[0]?.id ?? null)
    const [launchModalOpen, setLaunchModalOpen] = useState(false)
    const [launchModalMode, setLaunchModalMode] = useState('create')
    const [launchForm, setLaunchForm] = useState(createLaunchForm())
    const [paymentModal, setPaymentModal] = useState(null)
    const [busy, setBusy] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const normalizedSearch = normalizeTextSearch(search)
    const filteredRecords = useMemo(() => (
        records.filter((record) => {
            if (activeFilter !== 'all' && record.status !== activeFilter) {
                return false
            }

            if (!matchesDateRange(record, range)) {
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
    ), [activeFilter, normalizedSearch, range, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => record.id === selectedId) || records.find((record) => record.id === selectedId) || null,
        [filteredRecords, records, selectedId],
    )

    const totals = useMemo(() => ({
        open: records.filter((record) => ['open', 'overdue'].includes(record.status)).reduce((carry, record) => carry + Number(record.remaining_amount || 0), 0),
        overdue: records.filter((record) => record.status === 'overdue').reduce((carry, record) => carry + Number(record.remaining_amount || 0), 0),
    }), [records])

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
            ? `${launchForm.creditor_name} · ${launchForm.description}`
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
            setSelectedId(response.record.id)
            setPaymentModal(null)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusy(false)
        }
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page">
                <section className="proc-ui-hero">
                    <div className="proc-ui-hero-top">
                        <div>
                            <span className="proc-ui-eyebrow">
                                <i className="fa-solid fa-file-invoice-dollar" />
                                Financeiro de entrada
                            </span>
                            <h1>{moduleTitle}</h1>
                            <p>Controle vencimentos, pagamentos parciais e lancamentos avulsos sem sair do fluxo operacional das compras.</p>
                        </div>

                        <div className="proc-ui-hero-stats">
                            <article className="proc-ui-kpi-card">
                                <span>Em aberto</span>
                                <strong>{formatMoney(totals.open)}</strong>
                            </article>
                            <article className="proc-ui-kpi-card">
                                <span>Vencidos</span>
                                <strong>{formatMoney(totals.overdue)}</strong>
                            </article>
                            <article className="proc-ui-kpi-card">
                                <span>Registros</span>
                                <strong>{formatNumber(records.length)}</strong>
                            </article>
                        </div>
                    </div>
                </section>

                <div className="proc-ui-shell">
                    <section className="proc-ui-main-card">
                        <div className="proc-ui-main-header">
                            <div>
                                <h2>{selectedRecord ? 'Conta selecionada' : 'Painel financeiro'}</h2>
                                <p>{selectedRecord ? 'Use a area central para revisar detalhes e agir rapidamente.' : 'Selecione um registro na lateral para revisar vencimentos e pagamentos.'}</p>
                            </div>

                            <button type="button" className="ui-button" onClick={openCreateModal}>
                                <i className="fa-solid fa-plus" />
                                <span>Novo lancamento</span>
                            </button>
                        </div>

                        {feedback ? (
                            <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                                <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                <span>{feedback.text}</span>
                            </div>
                        ) : null}

                        {selectedRecord ? (
                            <div className="proc-ui-stage">
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
                                            <strong>{selectedRecord.due_date ? formatDate(selectedRecord.due_date) : 'Nao informado'}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Forma</span>
                                            <strong>{selectedRecord.payment_method || 'Nao definida'}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Banco / conta</span>
                                            <strong>{selectedRecord.bank_name || 'Nao informado'}</strong>
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

                                    <div className="proc-ui-card-toolbar">
                                        <button
                                            type="button"
                                            className="ui-button"
                                            disabled={selectedRecord.status === 'paid'}
                                            onClick={() => setPaymentModal({
                                                record: selectedRecord,
                                                amount: selectedRecord.remaining_amount ? String(selectedRecord.remaining_amount) : '',
                                                date: todayInput(),
                                                method: selectedRecord.payment_method || 'pix',
                                                account: selectedRecord.bank_name || '',
                                                notes: '',
                                            })}
                                        >
                                            <i className="fa-solid fa-money-bill-wave" />
                                            <span>Registrar pagamento</span>
                                        </button>

                                        <div className="proc-ui-table-actions">
                                            <button type="button" className="ui-button-ghost" onClick={() => openEditModal(selectedRecord)}>
                                                <i className="fa-solid fa-pen" />
                                                <span>Editar</span>
                                            </button>
                                            <button type="button" className="ui-button-ghost danger" onClick={() => handleDelete(selectedRecord)}>
                                                <i className="fa-solid fa-trash" />
                                                <span>Excluir</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>

                                <section className="proc-ui-section-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Historico de pagamentos</h3>
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
                                                        <span>{payment.notes || 'Sem observacao'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="proc-ui-empty">
                                            <strong>Sem pagamentos registrados</strong>
                                            <p>Use o modal acima para registrar pagamentos totais ou parciais.</p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        ) : (
                            <div className="proc-ui-empty">
                                <strong>Selecione uma conta a pagar</strong>
                                <p>Os detalhes completos e as acoes ficam aqui, enquanto a lista historica permanece fixa na lateral.</p>
                            </div>
                        )}
                    </section>

                    <aside className="proc-ui-sidebar">
                        <div className="proc-ui-sidebar-section">
                            <div className="proc-ui-sidebar-header">
                                <div>
                                    <h2>Lista</h2>
                                    <p>{filteredRecords.length} conta(s) no filtro.</p>
                                </div>
                                <button type="button" className="ui-button" onClick={openCreateModal}>
                                    <i className="fa-solid fa-plus" />
                                    <span>Novo</span>
                                </button>
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-section">
                            <div className="proc-ui-chip-row">
                                {STATUS_FILTERS.map((filter) => (
                                    <button key={filter.key} type="button" className={`proc-ui-chip ${activeFilter === filter.key ? 'active' : ''}`} onClick={() => setActiveFilter(filter.key)}>
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-section">
                            <div className="proc-ui-date-range">
                                <input type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
                                <input type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-section">
                            <input className="proc-ui-searchbox" type="search" placeholder="Buscar fornecedor ou descricao" value={search} onChange={(event) => setSearch(event.target.value)} />
                        </div>

                        <div className="proc-ui-sidebar-list">
                            {filteredRecords.length ? filteredRecords.map((record) => (
                                <button key={record.id} type="button" className={`proc-ui-record-card ${record.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(record.id)}>
                                    <div className="proc-ui-record-card-top">
                                        <div className="proc-ui-record-card-copy">
                                            <strong>{record.purchase_code || record.code}</strong>
                                            <span>{record.supplier_name || record.description}</span>
                                        </div>
                                        <StatusBadge compact label={record.status_label} tone={record.status_tone} />
                                    </div>

                                    <div className="proc-ui-record-card-copy">
                                        <strong>{formatMoney(record.amount)}</strong>
                                        <span>{record.due_date ? `Vence ${formatDate(record.due_date)}` : 'Sem vencimento'} · {(record.payment_method || 'forma livre').toUpperCase()}</span>
                                    </div>

                                    <div className="proc-ui-record-card-actions">
                                        <button type="button" className="proc-ui-ghost-icon" title="Registrar pagamento" onClick={(event) => {
                                            event.stopPropagation()
                                            setSelectedId(record.id)
                                            setPaymentModal({
                                                record,
                                                amount: record.remaining_amount ? String(record.remaining_amount) : '',
                                                date: todayInput(),
                                                method: record.payment_method || 'pix',
                                                account: record.bank_name || '',
                                                notes: '',
                                            })
                                        }}>
                                            <i className="fa-solid fa-money-bill-wave" />
                                        </button>
                                        <button type="button" className="proc-ui-ghost-icon" title="Editar" onClick={(event) => {
                                            event.stopPropagation()
                                            openEditModal(record)
                                        }}>
                                            <i className="fa-solid fa-pen" />
                                        </button>
                                        <button type="button" className="proc-ui-ghost-icon" title="Excluir" onClick={(event) => {
                                            event.stopPropagation()
                                            handleDelete(record)
                                        }}>
                                            <i className="fa-solid fa-trash" />
                                        </button>
                                    </div>
                                </button>
                            )) : (
                                <div className="proc-ui-empty">
                                    <strong>Nenhuma conta encontrada</strong>
                                    <p>Revise os filtros ou crie um novo lancamento.</p>
                                </div>
                            )}
                        </div>

                        <div className="proc-ui-footer-totals">
                            <span>Total em aberto: <strong>{formatMoney(totals.open)}</strong></span>
                            <span>Vencidos: <strong>{formatMoney(totals.overdue)}</strong></span>
                        </div>
                    </aside>
                </div>
            </div>

            <CompactModal
                open={launchModalOpen}
                title={launchModalMode === 'edit' ? 'Editar lancamento' : 'Novo lancamento avulso'}
                description="Use para despesas sem entrada de NF ou para ajustes pontuais do financeiro."
                icon="fa-file-invoice-dollar"
                size="lg"
                onClose={() => setLaunchModalOpen(false)}
            >
                <form className="proc-ui-modal-stack" onSubmit={submitLaunchForm}>
                    <div className="proc-ui-field-grid">
                        <div className="proc-ui-field full">
                            <label>
                                <span>Descricao</span>
                                <input required value={launchForm.description} onChange={(event) => setLaunchForm((current) => ({ ...current, description: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field">
                            <label>
                                <span>Fornecedor</span>
                                <select value={launchForm.supplier_id} onChange={(event) => setLaunchForm((current) => ({ ...current, supplier_id: event.target.value }))}>
                                    <option value="">Nao vinculado</option>
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
                                <span>Codigo de barras</span>
                                <input value={launchForm.barcode} onChange={(event) => setLaunchForm((current) => ({ ...current, barcode: event.target.value }))} />
                            </label>
                        </div>
                        <div className="proc-ui-field full">
                            <label>
                                <span>Observacao</span>
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
                                    <span>Observacao</span>
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
