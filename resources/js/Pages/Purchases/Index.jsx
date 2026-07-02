import { useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ActionSidebar from '@/Components/UI/ActionSidebar'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { buildRecordsUrl, ensureDate, parseNumber, upsertRecord } from '@/Pages/Operations/workspaces/shared'
import '../Operations/backoffice-workspace.css'
import './purchases.css'

const STATUS_TABS = [
    { key: 'in_progress', label: 'Em andamento' },
    { key: 'finalized', label: 'Finalizadas' },
]
const ACTIVE_DRAFT_TAB_KEY = 'active_draft'

function resolveInitialTab(records) {
    return records.length === 0 || records.some((record) => record.status === 'draft') ? 'in_progress' : 'finalized'
}

function createEmptyForm() {
    return {
        id: null,
        code: null,
        custom_name: '',
        supplier_id: '',
        status: 'draft',
        expected_at: '',
        freight: '0',
        notes: '',
        items: [],
        stock_applied_at: null,
        received_at: null,
    }
}

function createListFilters() {
    const today = createTodayInputValue()
    const firstDay = createMonthStartInputValue()

    return {
        search: '',
        from: firstDay,
        to: today,
    }
}

function createTodayInputValue() {
    const now = new Date()
    const timezoneOffset = now.getTimezoneOffset() * 60000

    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function createAppliedPeriod() {
    const today = createTodayInputValue()
    const firstDay = createMonthStartInputValue()

    return {
        from: firstDay,
        to: today,
    }
}

function createMonthStartInputValue() {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const timezoneOffset = firstDay.getTimezoneOffset() * 60000

    return new Date(firstDay.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function normalizeRecord(record) {
    return {
        ...createEmptyForm(),
        ...record,
        custom_name: record?.custom_name || '',
        supplier_id: record?.supplier_id ? String(record.supplier_id) : '',
        expected_at: ensureDate(record?.expected_at),
        freight: String(record?.freight ?? 0),
        notes: String(record?.notes || ''),
        items: (record?.items || []).map((item) => ({
            id: item.id,
            product_id: String(item.product_id),
            product_name: item.product_name,
            quantity: String(item.quantity),
            unit_cost: String(item.unit_cost),
            total: Number(item.total || 0),
        })),
    }
}

function resolveWorkspaceTab(status) {
    return status === 'draft' ? 'in_progress' : 'finalized'
}

function resolveStatusMeta(status) {
    if (status === 'received') {
        return { label: 'RECEBIDA', tone: 'success', className: 'received' }
    }

    if (status === 'ordered') {
        return { label: 'FINALIZADA', tone: 'success', className: 'ordered' }
    }

    return { label: 'EM ANDAMENTO', tone: 'warning', className: 'draft' }
}

function PurchaseStatusBadge({ status, compact = false }) {
    const meta = resolveStatusMeta(status)

    return (
        <StatusBadge
            compact={compact}
            className={`purchases-status-badge ${meta.className}`}
            label={meta.label}
            tone={meta.tone}
        />
    )
}

function summarizeItems(items) {
    return items.reduce((total, item) => total + (parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0)), 0)
}

function isLockedRecord(record) {
    return Boolean(record?.stock_applied_at) || record?.status === 'received'
}

function getRecordDateLabel(record) {
    const value = record?.created_at || record?.received_at || record?.expected_at

    return value ? formatDateTime(value) : 'Sem data registrada'
}

function getProductLabel(item, products) {
    return item.product_name || products.find((product) => String(product.id) === String(item.product_id))?.name || 'Produto'
}

function getPurchaseDisplayName(record) {
    return record?.custom_name || record?.code || `Pedido #${record?.id}`
}

function matchesPurchaseFilters(record, filters, tab) {
    if (tab && resolveWorkspaceTab(record.status) !== tab) {
        return false
    }

    const normalizedSearch = normalizeTextSearch(filters?.search)

    if (normalizedSearch && !matchesTextSearchAny([
        record.code,
        record.custom_name,
        record.supplier_name,
        record.document,
        record.notes,
        ...(record.items || []).map((item) => item.product_name),
    ], normalizedSearch)) {
        return false
    }

    return true
}

function buildPurchasePayload(recordLike, status) {
    return {
        supplier_id: recordLike.supplier_id ? Number(recordLike.supplier_id) : null,
        custom_name: recordLike.custom_name || null,
        status,
        expected_at: recordLike.expected_at || null,
        freight: parseNumber(recordLike.freight, 0),
        notes: recordLike.notes || null,
        items: (recordLike.items || []).map((item) => ({
            product_id: Number(item.product_id),
            quantity: parseNumber(item.quantity, 0),
            unit_cost: parseNumber(item.unit_cost, 0),
        })),
    }
}

function buildDraftSnapshot(recordLike) {
    return JSON.stringify({
        custom_name: String(recordLike?.custom_name || ''),
        notes: String(recordLike?.notes || ''),
        items: (recordLike?.items || []).map((item) => ({
            product_id: String(item.product_id || ''),
            quantity: Number(parseNumber(item.quantity, 0).toFixed(3)),
            unit_cost: Number(parseNumber(item.unit_cost, 0).toFixed(2)),
        })),
    })
}

function buildPurchaseReportUrl(recordId) {
    return `/api/purchases/${recordId}/report`
}

function PurchaseDetailsModal({
    record,
    products,
    feedback,
    busyAction,
    onClose,
    onEdit,
    onDelete,
    onSend,
    onReceive,
    onCancel,
    onViewStockEntry,
}) {
    if (!record) {
        return null
    }

    const subtotal = Number(record.subtotal || summarizeItems(record.items || []))

    return (
        <CompactModal
            open
            badge="Relatório"
            className="purchases-details-modal"
            description={record.code || `Pedido #${record.id}`}
            icon="fa-receipt"
            size="lg"
            title="Relatório do pedido"
            onClose={onClose}
        >
            <div className="proc-ui-modal-stack">
                <section className="proc-ui-modal-block purchases-details-header">
                    <div className="purchases-details-headline">
                        <div>
                            <h3>{getPurchaseDisplayName(record)}</h3>
                            <p>{record.code || `Pedido #${record.id}`} - {getRecordDateLabel(record)}</p>
                        </div>
                        <PurchaseStatusBadge status={record.status} />
                    </div>

                    <div className="proc-ui-summary-grid purchases-details-summary">
                        <article className="proc-ui-summary-card">
                            <span>Pedido</span>
                            <strong>{getPurchaseDisplayName(record)}</strong>
                        </article>
                        {record.supplier_name ? (
                            <article className="proc-ui-summary-card">
                                <span>Fornecedor</span>
                                <strong>{record.supplier_name}</strong>
                            </article>
                        ) : null}
                        <article className="proc-ui-summary-card">
                            <span>Itens</span>
                            <strong>{formatNumber(record.items_count || record.items?.length || 0)}</strong>
                        </article>
                        <article className="proc-ui-summary-card">
                            <span>Unidades</span>
                            <strong>{formatNumber(record.quantity_total || 0)}</strong>
                        </article>
                        {record.expected_at ? (
                            <article className="proc-ui-summary-card">
                                <span>Previsão</span>
                                <strong>{formatDate(record.expected_at)}</strong>
                            </article>
                        ) : null}
                        <article className="proc-ui-summary-card">
                            <span>Total</span>
                            <strong>{formatMoney(record.total || 0)}</strong>
                        </article>
                    </div>
                </section>

                {feedback ? (
                    <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                        <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                        <span>{feedback.text}</span>
                    </div>
                ) : null}

                <section className="proc-ui-modal-block">
                    <h3>Itens do pedido</h3>
                    <div className="proc-ui-table-wrap">
                        <table className="proc-ui-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Qtd</th>
                                    <th>Custo unit.</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {record.items?.length ? record.items.map((item, index) => (
                                    <tr key={`${record.id}-${item.product_id}-${index}`}>
                                        <td>{getProductLabel(item, products)}</td>
                                        <td>{formatNumber(item.quantity)}</td>
                                        <td>{formatMoney(item.unit_cost)}</td>
                                        <td><strong>{formatMoney(item.total)}</strong></td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4">
                                            <div className="proc-ui-empty">
                                                <strong>Nenhum item registrado</strong>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="proc-ui-table-totalbar">
                        <span>Subtotal: <strong>{formatMoney(subtotal)}</strong></span>
                        {Number(record.freight || 0) > 0 ? <span>Frete: <strong>{formatMoney(record.freight || 0)}</strong></span> : null}
                        <span>Total: <strong>{formatMoney(record.total || 0)}</strong></span>
                    </div>
                </section>

                <section className="proc-ui-modal-block">
                    <h3>Observações</h3>
                    <div className="proc-ui-banner info">
                        <i className="fa-solid fa-note-sticky" />
                        <div>{record.notes || 'Sem observações registradas para este pedido.'}</div>
                    </div>
                </section>

                <div className="proc-ui-modal-footer">
                    {record.status === 'draft' ? (
                        <>
                            <button type="button" className="ui-button-ghost" onClick={() => onEdit(record)}>
                                Abrir pedido
                            </button>
                            <button
                                type="button"
                                className="ui-button"
                                disabled={busyAction === `send-${record.id}`}
                                onClick={() => onSend(record)}
                            >
                                {busyAction === `send-${record.id}` ? 'Finalizando...' : 'Finalizar compra'}
                            </button>
                            <button
                                type="button"
                                className="ui-button-ghost danger"
                                disabled={busyAction === `delete-${record.id}`}
                                onClick={() => onDelete(record)}
                            >
                                Excluir
                            </button>
                        </>
                    ) : null}

                    {record.status === 'ordered' ? (
                        <>
                            <button
                                type="button"
                                className="ui-button"
                                disabled={busyAction === `receive-${record.id}`}
                                onClick={() => onReceive(record)}
                            >
                                {busyAction === `receive-${record.id}` ? 'Registrando...' : 'Registrar recebimento'}
                            </button>
                            <button
                                type="button"
                                className="ui-button-ghost danger"
                                disabled={busyAction === `delete-${record.id}`}
                                onClick={() => onCancel(record)}
                            >
                                Cancelar
                            </button>
                        </>
                    ) : null}

                    {record.status === 'received' ? (
                        <button type="button" className="ui-button" onClick={() => onViewStockEntry(record)}>
                            Ver entrada de estoque
                        </button>
                    ) : null}
                </div>
            </div>
        </CompactModal>
    )
}

export default function PurchasesIndex({ moduleTitle = 'Compras', payload }) {
    const products = Array.isArray(payload?.products) ? payload.products : []
    const initialRecords = Array.isArray(payload?.records) ? payload.records : []
    const initialTab = resolveInitialTab(initialRecords)

    const [records, setRecords] = useState(initialRecords)
    const [selectedTab, setSelectedTab] = useState(initialTab)
    const [listFilters, setListFilters] = useState(createListFilters())
    const [appliedPeriod, setAppliedPeriod] = useState(createAppliedPeriod())
    const [detailRecordId, setDetailRecordId] = useState(null)
    const [selectedListId, setSelectedListId] = useState((initialRecords[0]?.id) ?? null)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [createDraftName, setCreateDraftName] = useState('')
    const [activeDraftRecordId, setActiveDraftRecordId] = useState(null)
    const [form, setForm] = useState(createEmptyForm())
    const [savedDraftSnapshot, setSavedDraftSnapshot] = useState('')
    const [nameEditing, setNameEditing] = useState(false)
    const [notesExpanded, setNotesExpanded] = useState(false)
    const [productQuery, setProductQuery] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [savingAction, setSavingAction] = useState(null)
    const [recordsLoading, setRecordsLoading] = useState(false)
    const [hasLoadedRecords, setHasLoadedRecords] = useState(initialRecords.length > 0)
    const nameInputRef = useRef(null)
    const productSearchRef = useRef(null)

    const listViewTab = selectedTab === ACTIVE_DRAFT_TAB_KEY ? 'in_progress' : selectedTab
    const periodDirty = listFilters.from !== appliedPeriod.from || listFilters.to !== appliedPeriod.to
    const listRecordsReady = hasLoadedRecords && !periodDirty
    const recordsForListView = listRecordsReady ? records : []

    const productsById = useMemo(
        () => new Map(products.map((product) => [String(product.id), product])),
        [products],
    )

    const filteredRecords = useMemo(
        () => recordsForListView.filter((record) => matchesPurchaseFilters(record, { search: listFilters.search }, listViewTab)),
        [listFilters.search, listViewTab, recordsForListView],
    )

    const productOptions = useMemo(() => {
        const normalized = normalizeTextSearch(productQuery)

        if (!normalized) {
            return []
        }

        return products.filter((product) => matchesTextSearchAny([
            product.name,
            product.code,
            product.barcode,
        ], normalized)).slice(0, 8)
    }, [productQuery, products])

    const highlightedProduct = useMemo(() => {
        const normalized = normalizeTextSearch(productQuery)

        if (!normalized) {
            return null
        }

        return productOptions.find((product) => (
            [product.barcode, product.code, product.name].some((value) => normalizeTextSearch(value) === normalized)
        )) || productOptions[0] || null
    }, [productOptions, productQuery])

    const statusCounts = useMemo(() => (
        STATUS_TABS.reduce((carry, tab) => ({
            ...carry,
            [tab.key]: recordsForListView.filter((record) => resolveWorkspaceTab(record.status) === tab.key).length,
        }), {})
    ), [recordsForListView])

    const filteredTotal = useMemo(
        () => filteredRecords.reduce((totalAmount, record) => totalAmount + Number(record.total || 0), 0),
        [filteredRecords],
    )

    const selectedListRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedListId))
            || records.find((record) => String(record.id) === String(selectedListId))
            || null,
        [filteredRecords, records, selectedListId],
    )

    const selectedDetailRecord = useMemo(
        () => records.find((record) => String(record.id) === String(detailRecordId)) || null,
        [detailRecordId, records],
    )

    const activeDraftRecord = useMemo(
        () => records.find((record) => String(record.id) === String(activeDraftRecordId) && record.status === 'draft') || null,
        [activeDraftRecordId, records],
    )

    const itemsByProductId = useMemo(
        () => form.items.reduce((carry, item) => {
            carry[String(item.product_id)] = item
            return carry
        }, {}),
        [form.items],
    )

    const itemUnitsTotal = useMemo(
        () => form.items.reduce((sum, item) => sum + parseNumber(item.quantity, 0), 0),
        [form.items],
    )

    const subtotal = useMemo(() => summarizeItems(form.items), [form.items])
    const total = subtotal + parseNumber(form.freight, 0)
    const canEdit = activeDraftRecord ? !isLockedRecord(activeDraftRecord) : false
    const editorDirty = Boolean(activeDraftRecordId) && buildDraftSnapshot(form) !== savedDraftSnapshot
    const pageFeedbackVisible = Boolean(feedback) && !createModalOpen && !selectedDetailRecord && !activeDraftRecordId
    const editorFeedbackVisible = Boolean(feedback) && Boolean(activeDraftRecordId) && !selectedDetailRecord
    const itemsChipLabel = `${formatNumber(form.items.length)} ${form.items.length === 1 ? 'item' : 'itens'}`
    const unitsChipLabel = `${formatNumber(itemUnitsTotal)} un`
    const hasNotes = String(form.notes || '').trim().length > 0
    const workspaceTabs = useMemo(() => (
        activeDraftRecord
            ? [
                ...STATUS_TABS,
                {
                    key: ACTIVE_DRAFT_TAB_KEY,
                    label: getPurchaseDisplayName(activeDraftRecord),
                    icon: 'fa-file-pen',
                },
            ]
            : STATUS_TABS
    ), [activeDraftRecord])
    const showingActiveDraftWorkspace = selectedTab === ACTIVE_DRAFT_TAB_KEY && activeDraftRecord

    const columns = useMemo(() => ([
        {
            key: 'code',
            label: 'Pedido',
            render: (record) => (
                <div className="proc-ui-record-card-copy purchases-code-cell">
                    <strong>{getPurchaseDisplayName(record)}</strong>
                    <span>{record.code || `#${record.id}`}</span>
                </div>
            ),
        },
        {
            key: 'quantity_total',
            label: 'Qtd total',
            className: 'purchases-cell-items',
            render: (record) => formatNumber(record.quantity_total || 0),
        },
        {
            key: 'items',
            label: 'Itens',
            className: 'purchases-cell-items',
            render: (record) => formatNumber(record.items_count || record.items?.length || 0),
        },
        {
            key: 'total',
            label: 'Total',
            className: 'purchases-cell-money',
            render: (record) => <strong>{formatMoney(record.total || 0)}</strong>,
        },
        {
            key: 'created_at',
            label: 'Criado em',
            render: (record) => record.created_at ? formatDate(record.created_at) : 'Sem data',
        },
        {
            key: 'status',
            label: 'Status',
            render: (record) => <PurchaseStatusBadge compact status={record.status} />,
        },
    ]), [])

    useEffect(() => {
        if (detailRecordId && !selectedDetailRecord) {
            setDetailRecordId(null)
        }
    }, [detailRecordId, selectedDetailRecord])

    useEffect(() => {
        if (!filteredRecords.length) {
            setSelectedListId(null)
            return
        }

        if (!filteredRecords.some((record) => String(record.id) === String(selectedListId))) {
            setSelectedListId(filteredRecords[0].id)
        }
    }, [filteredRecords, selectedListId])

    useEffect(() => {
        if (!activeDraftRecordId || activeDraftRecord) {
            return
        }

        resetActiveDraftState({
            nextTab: selectedTab === ACTIVE_DRAFT_TAB_KEY ? 'in_progress' : null,
        })
    }, [activeDraftRecord, activeDraftRecordId, selectedTab])

    useEffect(() => {
        if (!activeDraftRecordId) {
            return undefined
        }

        const frameId = window.requestAnimationFrame(() => {
            productSearchRef.current?.focus()
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [activeDraftRecordId])

    useEffect(() => {
        if (!nameEditing) {
            return undefined
        }

        const frameId = window.requestAnimationFrame(() => {
            nameInputRef.current?.focus()
            nameInputRef.current?.select?.()
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [nameEditing])

    function resetActiveDraftState(options = {}) {
        setActiveDraftRecordId(null)
        setForm(createEmptyForm())
        setSavedDraftSnapshot('')
        setNameEditing(false)
        setNotesExpanded(false)
        setProductQuery('')

        if (options.nextTab) {
            setSelectedTab(options.nextTab)
        }
    }

    function hydrateActiveDraft(record) {
        const normalized = normalizeRecord(record)
        setActiveDraftRecordId(normalized.id)
        setForm(normalized)
        setSavedDraftSnapshot(buildDraftSnapshot(normalized))
        setNameEditing(false)
        setNotesExpanded(false)
        setProductQuery('')
    }

    async function confirmDiscardUnsavedChanges() {
        if (!editorDirty) {
            return true
        }

        return confirmPopup({
            type: 'warning',
            title: 'Descartar alterações',
            message: 'Existe um pedido com alterações não salvas. Deseja descartar e continuar?',
            confirmLabel: 'Descartar',
            cancelLabel: 'Continuar editando',
        })
    }


    async function clearActiveDraftSelection(options = {}) {
        if (!options.skipConfirm && !(await confirmDiscardUnsavedChanges())) {
            return false
        }

        resetActiveDraftState({ nextTab: options.nextTab || null })
        return true
    }

    function handleListFilterChange(field, value) {
        setListFilters((current) => ({
            ...current,
            [field]: value,
        }))
    }

    async function confirmRefreshWithOpenDraft() {
        if (!activeDraftRecordId || !editorDirty) {
            return true
        }

        return confirmPopup({
            type: 'warning',
            title: 'Atualizar lista',
            message: 'Existe um pedido aberto com alterações não salvas. Atualizar pode fechar esse pedido se ele sair do periodo atual. Deseja continuar?',
            confirmLabel: 'Atualizar mesmo',
            cancelLabel: 'Continuar editando',
        })
    }

    async function refreshRecords(options = {}) {
        if (!(await confirmRefreshWithOpenDraft())) {
            return
        }

        setRecordsLoading(true)

        if (!options.preserveFeedback) {
            setFeedback(null)
        }

        try {
            const params = new URLSearchParams()
            params.set('applied', '1')

            if (listFilters.from) {
                params.set('from', listFilters.from)
            }

            if (listFilters.to) {
                params.set('to', listFilters.to)
            }

            const response = await apiRequest(
                params.toString() ? `${buildRecordsUrl('compras')}?${params.toString()}` : buildRecordsUrl('compras'),
            )

            setRecords(Array.isArray(response?.records) ? response.records : [])
            setAppliedPeriod({
                from: listFilters.from,
                to: listFilters.to,
            })
            setHasLoadedRecords(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setRecordsLoading(false)
        }
    }

    async function handleTabChange(tabKey) {
        if (tabKey === selectedTab) {
            return
        }

        if (tabKey === ACTIVE_DRAFT_TAB_KEY) {
            if (activeDraftRecord) {
                setDetailRecordId(null)
                setFeedback(null)
                setSelectedTab(tabKey)
            }

            return
        }

        if (activeDraftRecordId && !(await clearActiveDraftSelection({ nextTab: tabKey }))) {
            return
        }

        setDetailRecordId(null)
        setFeedback(null)

        if (!activeDraftRecordId) {
            setSelectedTab(tabKey)
        }
    }

    async function openCreateModal() {
        if (!(await clearActiveDraftSelection({ nextTab: 'in_progress' }))) {
            return
        }

        setDetailRecordId(null)
        setFeedback(null)
        setCreateDraftName('')
        setCreateModalOpen(true)
    }

    function closeCreateModal() {
        setCreateModalOpen(false)
        setCreateDraftName('')
        setFeedback(null)
    }

    async function openDraftEditor(record) {
        if (String(activeDraftRecordId || '') === String(record.id || '')) {
            setSelectedTab(ACTIVE_DRAFT_TAB_KEY)
            return
        }

        if (!(await clearActiveDraftSelection({ nextTab: 'in_progress' }))) {
            return
        }

        setDetailRecordId(null)
        setFeedback(null)
        hydrateActiveDraft(record)
        setSelectedTab(ACTIVE_DRAFT_TAB_KEY)
    }

    async function openDetailsModal(record) {
        const nextTab = resolveWorkspaceTab(record.status)

        if (!(await clearActiveDraftSelection({ nextTab }))) {
            return
        }

        setCreateModalOpen(false)
        setFeedback(null)
        setDetailRecordId(record.id)
        setSelectedTab(nextTab)
    }

    async function handleOpenRecord(record) {
        if (record.status === 'draft') {
            await openDraftEditor(record)
            return
        }

        await openDetailsModal(record)
    }

    function closeDetailsModal() {
        setDetailRecordId(null)
        setFeedback(null)
    }

    function addProduct(option, quantity = 1) {
        const parsedQuantity = Math.max(1, parseNumber(quantity, 1))

        setForm((current) => {
            const existingIndex = current.items.findIndex((item) => String(item.product_id) === String(option.id))

            if (existingIndex >= 0) {
                return {
                    ...current,
                    items: current.items.map((item, index) => (
                        index === existingIndex
                            ? { ...item, quantity: String(parseNumber(item.quantity, 0) + parsedQuantity) }
                            : item
                    )),
                }
            }

            return {
                ...current,
                items: [
                    ...current.items,
                    {
                        product_id: String(option.id),
                        product_name: option.name,
                        quantity: String(parsedQuantity),
                        unit_cost: String(option.cost_price || 0),
                    },
                ],
            }
        })

        setProductQuery('')

        window.requestAnimationFrame(() => {
            productSearchRef.current?.focus()
        })
    }

    function handleProductSearchKeyDown(event) {
        if (event.key !== 'Enter') {
            return
        }

        if (!highlightedProduct || !canEdit) {
            return
        }

        event.preventDefault()
        addProduct(highlightedProduct, 1)
    }

    function handleItemChange(index, field, value) {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [field]: value } : item
            )),
        }))
    }

    function handleItemQuantityShortcut(index, delta) {
        setForm((current) => ({
            ...current,
            items: current.items.flatMap((item, itemIndex) => {
                if (itemIndex !== index) {
                    return [item]
                }

                const nextQuantity = parseNumber(item.quantity, 0) + delta

                if (nextQuantity <= 0) {
                    return []
                }

                return [{ ...item, quantity: String(nextQuantity) }]
            }),
        }))
    }

    function handleItemRemove(index) {
        setForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }))
    }

    async function persistPurchase(status, sourceForm = form, options = {}) {
        if (isLockedRecord(sourceForm) && status !== 'received') {
            return null
        }

        if (!String(sourceForm.custom_name || '').trim()) {
            setFeedback({ type: 'error', text: 'Informe um nome para o pedido antes de salvar.' })
            return null
        }

        if (status !== 'draft' && !(sourceForm.items || []).length) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um item ao pedido antes de finalizar.' })
            return null
        }

        const requestKey = options.requestKey || status

        setSavingAction(requestKey)
        setFeedback(null)

        try {
            const payloadData = buildPurchasePayload(sourceForm, status)
            const response = sourceForm.id
                ? await apiRequest(buildRecordsUrl('compras', sourceForm.id), { method: 'put', data: payloadData })
                : await apiRequest(buildRecordsUrl('compras'), { method: 'post', data: payloadData })

            setRecords((current) => upsertRecord(current, response.record))
            setHasLoadedRecords(true)

            if (response.record.status === 'draft') {
                hydrateActiveDraft(response.record)
                setDetailRecordId(null)
                setSelectedTab(ACTIVE_DRAFT_TAB_KEY)
            } else {
                setSelectedTab(resolveWorkspaceTab(response.record.status || status))

                if (String(activeDraftRecordId || '') === String(response.record.id || '')) {
                    resetActiveDraftState()
                }

                setDetailRecordId(options.keepDetailsOpen ? response.record.id : null)
            }

            setFeedback({ type: 'success', text: response.message })

            return response.record
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
            return null
        } finally {
            setSavingAction(null)
        }
    }

    async function handleCreatePurchase() {
        const record = await persistPurchase('draft', {
            ...createEmptyForm(),
            custom_name: createDraftName,
            items: [],
        }, {
            requestKey: 'create-draft',
        })

        if (!record) {
            return
        }

        setCreateModalOpen(false)
        setCreateDraftName('')
    }

    function openPurchaseReport(recordId) {
        window.open(buildPurchaseReportUrl(recordId), '_blank', 'noopener,noreferrer')
    }

    async function finalizePurchase(sourceForm = form, options = {}) {
        const record = await persistPurchase('ordered', sourceForm, options)

        if (record?.id) {
            openPurchaseReport(record.id)
        }

        return record
    }

    async function handleDelete(record, override = {}) {
        const confirmed = await confirmPopup({
            type: override.type || 'warning',
            title: override.title || 'Excluir pedido',
            message: override.message || `Deseja excluir o pedido ${record.code || `#${record.id}`}?`,
            confirmLabel: override.confirmLabel || 'Excluir',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        setSavingAction(`delete-${record.id}`)
        setFeedback(null)

        try {
            const response = await apiRequest(buildRecordsUrl('compras', record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))

            if (String(activeDraftRecordId || '') === String(record.id || '')) {
                resetActiveDraftState({
                    nextTab: selectedTab === ACTIVE_DRAFT_TAB_KEY ? 'in_progress' : null,
                })
            }

            if (String(detailRecordId || '') === String(record.id || '')) {
                setDetailRecordId(null)
            }

            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSavingAction(null)
        }
    }

    async function handleDiscardActiveChanges() {
        if (!activeDraftRecord || !editorDirty) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Descartar alterações',
            message: `Deseja descartar as alterações do pedido ${getPurchaseDisplayName(activeDraftRecord)}?`,
            confirmLabel: 'Descartar',
            cancelLabel: 'Continuar editando',
        })

        if (!confirmed) {
            return
        }

        hydrateActiveDraft(activeDraftRecord)
        setFeedback(null)
    }

    async function handleSaveActiveDraft() {
        await persistPurchase('draft', form, { requestKey: 'active-draft-save' })
    }

    async function handleFinalizeActiveDraft() {
        const confirmed = await confirmPopup({
            type: 'info',
            title: 'Finalizar compra',
            message: `Deseja finalizar o pedido ${getPurchaseDisplayName(form)} e mover para Finalizadasó`,
            confirmLabel: 'Finalizar compra',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        await finalizePurchase(form, { requestKey: 'active-draft-finalize' })
    }

    async function handleSendFromDetails(record) {
        const confirmed = await confirmPopup({
            type: 'info',
            title: 'Finalizar compra',
            message: `Deseja finalizar o pedido ${record.code || `#${record.id}`} e gerar o PDF com os itensó`,
            confirmLabel: 'Finalizar compra',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        await finalizePurchase(normalizeRecord(record), {
            keepDetailsOpen: true,
            requestKey: `send-${record.id}`,
        })
    }

    async function handleReceiveFromDetails(record) {
        const confirmed = await confirmPopup({
            type: 'info',
            title: 'Registrar recebimento',
            message: `Ao confirmar, o pedido ${record.code || `#${record.id}`} será recebido e a entrada em estoque será aplicada.`,
            confirmLabel: 'Registrar recebimento',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        await persistPurchase('received', normalizeRecord(record), {
            keepDetailsOpen: true,
            requestKey: `receive-${record.id}`,
        })
    }

    async function handleCancelOrdered(record) {
        await handleDelete(record, {
            title: 'Cancelar pedido',
            message: `O cancelamento deste pedido será tratado como exclusão, porque o backend ainda não possui um status cancelado para compras. Deseja continuar com ${record.code || `#${record.id}`}?`,
            confirmLabel: 'Cancelar pedido',
            type: 'warning',
        })
    }

    function handleViewStockEntry(record) {
        const reference = encodeURIComponent(record.code || record.document || '')
        window.location.assign(reference ? `/entrada-estoque/manutencao?nf=${reference}` : '/entrada-estoque/manutencao')
    }

    const activeDraftEditor = showingActiveDraftWorkspace ? (
        <CompactModal
            open
            badge="Em andamento"
            className="purchases-editor-modal"
            bodyClassName="purchases-editor-modal-body"
            description={form.code || getPurchaseDisplayName(form)}
            icon="fa-cart-shopping"
            size="lg"
            title={form.custom_name || 'Editar pedido'}
            onClose={() => void clearActiveDraftSelection({ nextTab: 'in_progress' })}
        >
            <div className="purchases-workspace-card">
                {editorFeedbackVisible ? (
                    <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                        <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                        <span>{feedback.text}</span>
                    </div>
                ) : null}

                <div className="proc-ui-main-header purchases-workspace-header">
                    <div className="purchases-inline-summary">
                        <span className="purchases-summary-chip purchases-summary-chip-code">
                            {form.code || 'Novo pedido'}
                        </span>

                        <div className={`purchases-summary-chip purchases-summary-chip-name ${nameEditing ? 'is-editing' : ''}`}>
                            <span className="purchases-summary-chip-label">Nome:</span>
                            {nameEditing ? (
                                <input
                                    ref={nameInputRef}
                                    disabled={!canEdit}
                                    maxLength="160"
                                    placeholder="Nome do pedido"
                                    type="text"
                                    value={form.custom_name}
                                    onBlur={() => setNameEditing(false)}
                                    onChange={(event) => setForm((current) => ({ ...current, custom_name: event.target.value }))}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === 'Escape') {
                                            event.preventDefault()
                                            setNameEditing(false)
                                        }
                                    }}
                                />
                            ) : (
                                <strong>{form.custom_name || 'Sem nome'}</strong>
                            )}
                            {canEdit ? (
                                <button
                                    type="button"
                                    className="proc-ui-ghost-icon purchases-name-edit-button"
                                    title={nameEditing ? 'Concluir edição' : 'Editar nome'}
                                    onClick={() => setNameEditing((current) => !current)}
                                >
                                    <i className={`fa-solid ${nameEditing ? 'fa-check' : 'fa-pen'}`} />
                                </button>
                            ) : null}
                        </div>

                        <span className="purchases-summary-chip">{itemsChipLabel}</span>
                        <span className="purchases-summary-chip">{unitsChipLabel}</span>
                        <span className="purchases-summary-chip purchases-summary-chip-total">{formatMoney(total)}</span>
                    </div>

                    <div className="purchases-inline-status">
                        <PurchaseStatusBadge compact status={form.status} />
                        {editorDirty ? (
                            <span className="purchases-inline-badge warning">
                                <i className="fa-solid fa-triangle-exclamation" />
                                <span>Alteracoes pendentes</span>
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="purchases-editor-grid">
                    <section className="proc-ui-modal-block purchases-items-search-panel">
                        <div className="purchases-items-entrybar">
                            <div className="purchases-items-search-field">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    ref={productSearchRef}
                                    className="proc-ui-searchbox"
                                    aria-label="Buscar produto"
                                    disabled={!canEdit}
                                    placeholder="Buscar produto por nome ou código de barras..."
                                    type="search"
                                    value={productQuery}
                                    onChange={(event) => setProductQuery(event.target.value)}
                                    onKeyDown={handleProductSearchKeyDown}
                                />
                            </div>

                            <button
                                type="button"
                                className="ui-button purchases-quick-add-button"
                                aria-label="Adicionar produto"
                                disabled={!canEdit || !highlightedProduct}
                                title="Adicionar produto"
                                onClick={() => addProduct(highlightedProduct, 1)}
                            >
                                <i className="fa-solid fa-plus" />
                                <span>Adicionar</span>
                            </button>
                        </div>

                        {productQuery.trim().length > 0 ? (
                            <div className="purchases-product-results">
                                {productOptions.length ? productOptions.map((option) => {
                                    const queuedItem = itemsByProductId[String(option.id)]
                                    const queuedQuantity = queuedItem ? formatNumber(queuedItem.quantity) : null

                                    return (
                                        <article key={option.id} className="purchases-product-result">
                                            <div className="purchases-product-result-copy">
                                                <strong>{option.name}</strong>
                                                <span>{option.barcode || option.code || 'Sem código'}</span>
                                                <small>Custo atual: {formatMoney(option.cost_price || 0)}</small>
                                            </div>

                                            <div className="purchases-product-result-actions">
                                                {queuedQuantity ? (
                                                    <span className="proc-ui-pill" title="Quantidade no pedido">
                                                        <i className="fa-solid fa-boxes-stacked" />
                                                        <strong>{queuedQuantity}</strong>
                                                    </span>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="ui-button purchases-product-add-button"
                                                    aria-label={`Adicionar ${option.name}`}
                                                    disabled={!canEdit}
                                                    title={`Adicionar ${option.name}`}
                                                    onClick={() => addProduct(option, 1)}
                                                >
                                                    <i className="fa-solid fa-plus" />
                                                </button>
                                            </div>
                                        </article>
                                    )
                                }) : (
                                    <div className="proc-ui-empty purchases-product-results-empty">
                                        <strong>Nenhum produto</strong>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </section>

                    <section className="proc-ui-modal-block purchases-items-board">
                        <div className="proc-ui-table-wrap purchases-items-table-wrap">
                            <table className="proc-ui-table purchases-items-table">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Qtd</th>
                                        <th>Custo unit.</th>
                                        <th>Total</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.items.length ? form.items.map((item, index) => {
                                        const productMeta = productsById.get(String(item.product_id))

                                        return (
                                            <tr key={`${item.product_id}-${index}`}>
                                                <td>
                                                    <div className="purchases-item-identity">
                                                        <strong>{getProductLabel(item, products)}</strong>
                                                        <span>{productMeta?.barcode || productMeta?.code || 'Sem código'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="purchases-qty-control">
                                                        <button
                                                            type="button"
                                                            className="proc-ui-ghost-icon"
                                                            disabled={!canEdit}
                                                            title="Diminuir 1"
                                                            onClick={() => handleItemQuantityShortcut(index, -1)}
                                                        >
                                                            <i className="fa-solid fa-minus" />
                                                        </button>
                                                        <input
                                                            disabled={!canEdit}
                                                            min="0"
                                                            step="0.001"
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="proc-ui-ghost-icon"
                                                            disabled={!canEdit}
                                                            title="Aumentar 1"
                                                            onClick={() => handleItemQuantityShortcut(index, 1)}
                                                        >
                                                            <i className="fa-solid fa-plus" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        disabled={!canEdit}
                                                        min="0"
                                                        step="0.01"
                                                        type="number"
                                                        value={item.unit_cost}
                                                        onChange={(event) => handleItemChange(index, 'unit_cost', event.target.value)}
                                                    />
                                                </td>
                                                <td><strong>{formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0))}</strong></td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="proc-ui-ghost-icon"
                                                        disabled={!canEdit}
                                                        title="Remover item"
                                                        onClick={() => handleItemRemove(index)}
                                                    >
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    }) : (
                                        <tr>
                                            <td colSpan="5">
                                                <div className="proc-ui-empty">
                                                    <strong>Nenhum item</strong>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="proc-ui-table-totalbar purchases-items-totalbar">
                            <span>Itens: <strong>{itemsChipLabel}</strong></span>
                            <span>Unidades: <strong>{unitsChipLabel}</strong></span>
                            <span>Subtotal: <strong>{formatMoney(subtotal)}</strong></span>
                            <span>Total do pedido: <strong>{formatMoney(total)}</strong></span>
                            <button
                                type="button"
                                className={`ui-button-ghost purchases-notes-toggle ${notesExpanded ? 'is-active' : ''} ${hasNotes ? 'has-content' : ''}`}
                                disabled={!canEdit && !hasNotes}
                                onClick={() => setNotesExpanded((current) => !current)}
                            >
                                <i className="fa-regular fa-note-sticky" />
                                <span>Observacoes</span>
                            </button>
                        </div>

                        {notesExpanded ? (
                            <div className="purchases-review-notes is-open">
                                <textarea
                                    className="purchases-editor-notes"
                                    aria-label="Observacoes"
                                    disabled={!canEdit}
                                    placeholder="Adicionar observações..."
                                    rows="3"
                                    value={form.notes}
                                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                />
                            </div>
                        ) : null}
                    </section>
                </div>

                <div className="proc-ui-card-toolbar purchases-workspace-submitbar">
                    <button type="button" className="ui-button-ghost" onClick={() => void clearActiveDraftSelection({ nextTab: 'in_progress' })}>
                        Voltar
                    </button>
                    <button
                        type="button"
                        className="ui-button-ghost"
                        disabled={!editorDirty || savingAction !== null}
                        onClick={() => void handleDiscardActiveChanges()}
                    >
                        Descartar alterações
                    </button>
                    <button
                        type="button"
                        className="ui-button-ghost danger"
                        disabled={savingAction !== null}
                        onClick={() => handleDelete(activeDraftRecord)}
                    >
                        Excluir
                    </button>
                    <button
                        type="button"
                        className="ui-button-ghost"
                        disabled={!canEdit || savingAction !== null}
                        onClick={() => void handleSaveActiveDraft()}
                    >
                        {savingAction === 'active-draft-save' ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                        type="button"
                        className="ui-button"
                        disabled={!canEdit || savingAction !== null}
                        onClick={() => void handleFinalizeActiveDraft()}
                    >
                        {savingAction === 'active-draft-finalize' ? 'Finalizando...' : 'Finalizar compra'}
                    </button>
                </div>
            </div>
        </CompactModal>
    ) : null

    return (
        <AppLayout title={moduleTitle}>
            <div className="page-hero page-hero--green">
                <div className="page-hero-left">
                    <div className="page-hero-icon">
                        <i className="fa-solid fa-cart-shopping" />
                    </div>
                    <div>
                        <h1 className="page-hero-title">{moduleTitle}</h1>
                        <p className="page-hero-sub">Entradas de mercadoria e NF-e de fornecedores</p>
                    </div>
                </div>
                <div className="page-hero-stats">
                    <div className="page-hero-stat page-hero-stat--accent">
                        <strong>{statusCounts.open ?? 0}</strong>
                        <span>Em andamento</span>
                    </div>
                    <div className="page-hero-stat">
                        <strong>{statusCounts.all ?? 0}</strong>
                        <span>Total</span>
                    </div>
                </div>
                <button className="page-hero-cta" onClick={openCreateModal} type="button">
                    <i className="fa-solid fa-plus" />
                    Nova compra
                </button>
            </div>

            <div className="proc-ui-page purchases-page">
                <section className="proc-ui-section-card purchases-list-card">
                    <div className="ui-list-page-shell" style={{ padding: 0 }}>
                        <div className="ui-list-page-main">
                            <PageHeader
                                title={moduleTitle}
                                search={{
                                    placeholder: 'Buscar por número, fornecedor ou produto',
                                    value: listFilters.search,
                                    onChange: (value) => handleListFilterChange('search', value),
                                }}
                                filters={STATUS_TABS.map((tab) => ({
                                    ...tab,
                                    value: tab.key,
                                    count: statusCounts[tab.key] || 0,
                                }))}
                                activeFilter={listViewTab}
                                onFilterChange={(value) => void handleTabChange(value)}
                                dateRange={{
                                    from: listFilters.from,
                                    to: listFilters.to,
                                    onChange: (nextRange) => setListFilters((current) => ({
                                        ...current,
                                        from: nextRange.from,
                                        to: nextRange.to,
                                    })),
                                }}
                                quickDates
                                onApply={() => void refreshRecords()}
                                onReset={() => {
                                    const next = createListFilters()
                                    setListFilters(next)
                                    setAppliedPeriod(createAppliedPeriod())
                                    setRecords([])
                                    setSelectedListId(null)
                                    setHasLoadedRecords(false)
                                    setRecordsLoading(false)
                                    setFeedback(null)
                                }}
                            />

                            {pageFeedbackVisible ? (
                                <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                                    <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                    <span>{feedback.text}</span>
                                </div>
                            ) : null}

                            <section className="ui-list-page-table-card">
                                <DataTable
                                    className="purchases-records-table"
                                    columns={columns}
                                    rows={filteredRecords}
                                    selectedRowKey={selectedListId}
                                    onRowClick={(record) => setSelectedListId(record.id)}
                                    onRowDoubleClick={(record) => {
                                        setSelectedListId(record.id)
                                        return record.status === 'draft'
                                            ? void openDraftEditor(record)
                                            : void openDetailsModal(record)
                                    }}
                                    emptyMessage="Nenhum resultado encontrado. Ajuste os filtros e clique em Filtrar."
                                    actions={(record) => [
                                        {
                                            key: 'view',
                                            icon: 'fa-eye',
                                            label: 'Ver detalhes',
                                            tone: 'primary',
                                            onClick: () => record.status === 'draft'
                                                ? void openDraftEditor(record)
                                                : void openDetailsModal(record),
                                        },
                                    ]}
                                />
                            </section>

                            {listRecordsReady && !recordsLoading ? (
                                <footer className="purchases-table-footer">
                                    <span>Total de registros: <strong>{formatNumber(filteredRecords.length)}</strong></span>
                                    <span>Total geral dos pedidos filtrados: <strong>{formatMoney(filteredTotal)}</strong></span>
                                </footer>
                            ) : null}
                        </div>

                        <ActionSidebar
                            storageKey="purchases-index"
                            persistCollapsed={false}
                            actions={[
                                {
                                    key: 'create',
                                    icon: 'fa-plus',
                                    label: 'Novo pedido',
                                    tone: 'primary',
                                    onClick: () => void openCreateModal(),
                                },
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    disabled: !selectedListRecord,
                                    onClick: () => selectedListRecord && (selectedListRecord.status === 'draft'
                                        ? void openDraftEditor(selectedListRecord)
                                        : void openDetailsModal(selectedListRecord)),
                                },
                                {
                                    key: 'edit',
                                    icon: 'fa-pen',
                                    label: 'Editar',
                                    disabled: !selectedListRecord || selectedListRecord.status !== 'draft',
                                    onClick: () => selectedListRecord && void openDraftEditor(selectedListRecord),
                                },
                                {
                                    key: 'delete',
                                    icon: 'fa-trash',
                                    label: 'Excluir',
                                    tone: 'danger',
                                    dividerBefore: true,
                                    disabled: !selectedListRecord,
                                    onClick: () => selectedListRecord && handleDelete(selectedListRecord),
                                },
                            ]}
                        />
                    </div>
                </section>
            </div>

            {activeDraftEditor}

            <CompactModal
                open={createModalOpen}
                badge="Novo pedido"
                className="purchases-create-modal"
                description="Salve o nome e continue a edição em Em andamento."
                icon="fa-cart-plus"
                size="md"
                title="Criar pedido"
                onClose={closeCreateModal}
            >
                <div className="proc-ui-modal-stack">
                    {createModalOpen && feedback ? (
                        <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                            <span>{feedback.text}</span>
                        </div>
                    ) : null}

                    <section className="proc-ui-modal-block purchases-name-stage">
                        <div className="purchases-name-copy">
                            <h3>Comece pelo nome</h3>
                            <p>Depois de salvar, o pedido vai para Em andamento para voce editar, renomear e incluir produtos.</p>
                        </div>

                        <div className="proc-ui-field full">
                            <label>
                                <span>Nome do pedido</span>
                                <input
                                    autoFocus
                                    maxLength="160"
                                    placeholder="Ex.: Pedido feira de sabado"
                                    type="text"
                                    value={createDraftName}
                                    onChange={(event) => setCreateDraftName(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            void handleCreatePurchase()
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </section>

                    <div className="proc-ui-modal-footer purchases-create-actions">
                        <button type="button" className="ui-button-ghost" onClick={closeCreateModal}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="ui-button"
                            disabled={savingAction === 'create-draft' || !String(createDraftName || '').trim()}
                            onClick={() => void handleCreatePurchase()}
                        >
                            {savingAction === 'create-draft' ? 'Salvando...' : 'Salvar e abrir'}
                        </button>
                    </div>
                </div>
            </CompactModal>

            <PurchaseDetailsModal
                busyAction={savingAction}
                feedback={selectedDetailRecord ? feedback : null}
                products={products}
                record={selectedDetailRecord}
                onCancel={handleCancelOrdered}
                onClose={closeDetailsModal}
                onDelete={handleDelete}
                onEdit={(record) => void openDraftEditor(record)}
                onReceive={handleReceiveFromDetails}
                onSend={handleSendFromDetails}
                onViewStockEntry={handleViewStockEntry}
            />
        </AppLayout>
    )
}
