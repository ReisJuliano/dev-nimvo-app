import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CompactModal from '@/Components/UI/CompactModal'
import DenseTable from '@/Components/UI/DenseTable'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { buildRecordsUrl, ensureDate, parseNumber, upsertRecord } from '@/Pages/Operations/workspaces/shared'
import '../Operations/backoffice-workspace.css'
import './purchases.css'

const STATUS_TABS = [
    { key: 'all', label: 'Todos', icon: 'fa-layer-group' },
    { key: 'draft', label: 'Rascunhos', icon: 'fa-file-lines' },
    { key: 'ordered', label: 'Solicitadas', icon: 'fa-paper-plane' },
    { key: 'received', label: 'Recebidas', icon: 'fa-box-open' },
]

const STEPS = [
    { key: 'supplier', label: 'Fornecedor e nome', icon: 'fa-building' },
    { key: 'items', label: 'Itens do pedido', icon: 'fa-boxes-stacked' },
    { key: 'review', label: 'Revisao final', icon: 'fa-circle-check' },
]

function resolveInitialTab(records) {
    return 'all'
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
    return {
        search: '',
        from: '',
        to: '',
    }
}

function normalizeRecord(record) {
    return {
        ...createEmptyForm(),
        ...record,
        custom_name: record?.custom_name || '',
        supplier_id: record?.supplier_id ? String(record.supplier_id) : '',
        expected_at: ensureDate(record?.expected_at),
        freight: String(record?.freight ?? 0),
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

function resolveStatusMeta(status) {
    if (status === 'received') {
        return { label: 'RECEBIDA', tone: 'success', className: 'received' }
    }

    if (status === 'ordered') {
        return { label: 'SOLICITADA', tone: 'info', className: 'ordered' }
    }

    return { label: 'RASCUNHO', tone: 'warning', className: 'draft' }
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

function findLabel(options, id) {
    return options.find((entry) => String(entry.id) === String(id))?.name || ''
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

function getPurchaseFilterDateTime(record) {
    return String(record?.created_at || record?.received_at || record?.expected_at || '')
}

function matchesPurchaseFilters(record, filters, status) {
    if (status && status !== 'all' && record.status !== status) {
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

    const dateTimeValue = getPurchaseFilterDateTime(record)
    const recordDate = dateTimeValue.slice(0, 10)

    if (filters?.from && (!recordDate || recordDate < filters.from)) {
        return false
    }

    if (filters?.to && (!recordDate || recordDate > filters.to)) {
        return false
    }

    return true
}

function buildPurchasePayload(recordLike, status) {
    return {
        supplier_id: recordLike.supplier_id ? Number(recordLike.supplier_id) : null,
        custom_name: recordLike.custom_name || null,
        status,
        expected_at: null,
        freight: 0,
        notes: recordLike.notes || null,
        items: (recordLike.items || []).map((item) => ({
            product_id: Number(item.product_id),
            quantity: parseNumber(item.quantity, 0),
            unit_cost: parseNumber(item.unit_cost, 0),
        })),
    }
}

function AutocompleteField({
    label,
    icon,
    query,
    value,
    selectedLabel,
    placeholder,
    emptyLabel,
    options,
    onQueryChange,
    onSelect,
    disabled = false,
}) {
    const shouldShow = !disabled && query.trim().length > 0

    return (
        <div className="proc-ui-field full">
            <label>
                <span className="proc-ui-label">
                    <i className={`fa-solid ${icon}`} /> {label}
                </span>
                <div className="proc-ui-autocomplete">
                    <input
                        className="proc-ui-searchbox"
                        disabled={disabled}
                        placeholder={placeholder}
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                    />
                    {selectedLabel ? (
                        <div className="proc-ui-pill">
                            <i className="fa-solid fa-check" />
                            <span className="proc-ui-truncate">{selectedLabel}</span>
                        </div>
                    ) : null}
                    {shouldShow ? (
                        <div className="proc-ui-autocomplete-list">
                            {options.length ? options.map((option) => (
                                <button
                                    key={option.id}
                                    className="proc-ui-autocomplete-item"
                                    type="button"
                                    onClick={() => onSelect(option)}
                                >
                                    <div className="proc-ui-record-card-copy">
                                        <strong>{option.name}</strong>
                                        <span>{option.document || option.code || option.barcode || option.city_name || 'Sem complemento'}</span>
                                    </div>
                                    {String(value || '') === String(option.id) ? <i className="fa-solid fa-circle-check" /> : null}
                                </button>
                            )) : (
                                <div className="proc-ui-empty">
                                    <strong>{emptyLabel}</strong>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </label>
        </div>
    )
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
            badge="Detalhes"
            className="purchases-details-modal"
            description={`${record.code || `Pedido #${record.id}`} - ${record.supplier_name || 'Sem fornecedor'}`}
            icon="fa-receipt"
            size="lg"
            title="Pedido de compra"
            onClose={onClose}
        >
            <div className="proc-ui-modal-stack">
                <section className="proc-ui-modal-block purchases-details-header">
                    <div className="purchases-details-headline">
                        <div>
                            <h3>{getPurchaseDisplayName(record)}</h3>
                            <p>{record.code || `Pedido #${record.id}`} - {record.supplier_name || 'Sem fornecedor'} - {getRecordDateLabel(record)}</p>
                        </div>
                        <PurchaseStatusBadge status={record.status} />
                    </div>

                    <div className="proc-ui-summary-grid purchases-details-summary">
                        <article className="proc-ui-summary-card">
                            <span>Pedido</span>
                            <strong>{getPurchaseDisplayName(record)}</strong>
                        </article>
                        <article className="proc-ui-summary-card">
                            <span>Fornecedor</span>
                            <strong>{record.supplier_name || 'Sem fornecedor'}</strong>
                        </article>
                        <article className="proc-ui-summary-card">
                            <span>Itens</span>
                            <strong>{formatNumber(record.items_count || record.items?.length || 0)}</strong>
                        </article>
                        {record.expected_at ? (
                            <article className="proc-ui-summary-card">
                                <span>Previsao</span>
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
                    <h3>Observacoes</h3>
                    <div className="proc-ui-banner info">
                        <i className="fa-solid fa-note-sticky" />
                        <div>{record.notes || 'Sem observacoes registradas para este pedido.'}</div>
                    </div>
                </section>

                <div className="proc-ui-modal-footer">
                    {record.status === 'draft' ? (
                        <>
                            <button type="button" className="ui-button-ghost" onClick={() => onEdit(record)}>
                                Editar
                            </button>
                            <button
                                type="button"
                                className="ui-button"
                                disabled={busyAction === `send-${record.id}`}
                                onClick={() => onSend(record)}
                            >
                                {busyAction === `send-${record.id}` ? 'Enviando...' : 'Enviar pedido'}
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
    const suppliers = Array.isArray(payload?.suppliers) ? payload.suppliers : []
    const products = Array.isArray(payload?.products) ? payload.products : []
    const initialRecords = Array.isArray(payload?.records) ? payload.records : []
    const initialTab = resolveInitialTab(initialRecords)

    const [records, setRecords] = useState(initialRecords)
    const [selectedTab, setSelectedTab] = useState(initialTab)
    const [listFilters, setListFilters] = useState(createListFilters())
    const [appliedFilters, setAppliedFilters] = useState(createListFilters())
    const [hasAppliedSearch, setHasAppliedSearch] = useState(false)
    const [detailRecordId, setDetailRecordId] = useState(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorSession, setEditorSession] = useState({ type: 'create', recordId: null })
    const [step, setStep] = useState(0)
    const [form, setForm] = useState(createEmptyForm())
    const [supplierQuery, setSupplierQuery] = useState('')
    const [productQuery, setProductQuery] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [savingAction, setSavingAction] = useState(null)
    const [recordsLoading, setRecordsLoading] = useState(false)

    const selectedSupplierName = findLabel(suppliers, form.supplier_id)
    const productsById = useMemo(
        () => new Map(products.map((product) => [String(product.id), product])),
        [products],
    )

    const filteredRecords = useMemo(() => (
        hasAppliedSearch
            ? records.filter((record) => matchesPurchaseFilters(record, appliedFilters, selectedTab))
            : []
    ), [appliedFilters, hasAppliedSearch, records, selectedTab])

    const supplierOptions = useMemo(() => {
        const normalized = normalizeTextSearch(supplierQuery)

        if (!normalized) {
            return suppliers.slice(0, 8)
        }

        return suppliers.filter((supplier) => matchesTextSearchAny([
            supplier.name,
            supplier.document,
            supplier.city_name,
        ], normalized)).slice(0, 8)
    }, [supplierQuery, suppliers])

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

    const statusCounts = useMemo(() => (
        STATUS_TABS.reduce((carry, tab) => {
            if (tab.key === 'all') {
                return {
                    ...carry,
                    [tab.key]: records.length,
                }
            }

            return {
                ...carry,
                [tab.key]: records.filter((record) => record.status === tab.key).length,
            }
        }, {})
    ), [records])

    const filteredTotal = useMemo(
        () => filteredRecords.reduce((totalAmount, record) => totalAmount + Number(record.total || 0), 0),
        [filteredRecords],
    )

    const selectedDetailRecord = useMemo(
        () => records.find((record) => String(record.id) === String(detailRecordId)) || null,
        [detailRecordId, records],
    )

    const itemsByProductId = useMemo(
        () => form.items.reduce((carry, item) => {
            carry[String(item.product_id)] = item
            return carry
        }, {}),
        [form.items],
    )
    const subtotal = useMemo(() => summarizeItems(form.items), [form.items])
    const total = subtotal
    const stepReady = [
        Boolean(form.supplier_id),
        form.items.length > 0,
        form.items.length > 0 && Boolean(form.supplier_id),
    ]
    const isLocked = isLockedRecord(form)
    const canEdit = !isLocked
    const pageFeedbackVisible = Boolean(feedback) && !editorOpen && !selectedDetailRecord
    const nextDisabledReason = step === 0 && !form.supplier_id
        ? 'Selecione um fornecedor para continuar.'
        : step === 1 && !form.items.length
            ? 'Adicione pelo menos um item ao pedido.'
            : ''

    const columns = useMemo(() => ([
        {
            key: 'code',
            label: 'Numero',
            render: (record) => (
                <div className="proc-ui-record-card-copy purchases-code-cell">
                    <strong>{record.code || `#${record.id}`}</strong>
                    <span>{record.custom_name || 'Sem nome personalizado'}</span>
                </div>
            ),
        },
        {
            key: 'supplier_name',
            label: 'Fornecedor',
            render: (record) => <span className="proc-ui-truncate">{record.supplier_name || 'Sem fornecedor'}</span>,
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
            key: 'freight',
            label: 'Frete',
            className: 'purchases-cell-money',
            render: (record) => formatMoney(record.freight || 0),
        },
        {
            key: 'expected_at',
            label: 'Previsao',
            render: (record) => record.expected_at ? formatDate(record.expected_at) : 'Sem previsao',
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

    function handleListFilterChange(field, value) {
        setListFilters((current) => ({
            ...current,
            [field]: field === 'year' ? value.replace(/\D/g, '').slice(0, 4) : value,
        }))
    }

    async function handleApplyFilters() {
        if (listFilters.from && listFilters.to && listFilters.from > listFilters.to) {
            setFeedback({ type: 'error', text: 'O periodo final precisa ser maior ou igual ao periodo inicial.' })
            return
        }

        setFeedback(null)
        setDetailRecordId(null)

        setRecordsLoading(true)

        try {
            const response = await apiRequest(buildRecordsUrl('compras'))
            setRecords(Array.isArray(response?.records) ? response.records : [])
            setAppliedFilters({ ...listFilters })
            setHasAppliedSearch(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setRecordsLoading(false)
        }
    }

    function resetEditorSession() {
        setEditorSession({ type: 'create', recordId: null })
        setStep(0)
        setForm(createEmptyForm())
        setSupplierQuery('')
        setProductQuery('')
    }

    function hydrateEditor(record, sessionType = 'edit') {
        const normalized = normalizeRecord(record)
        setEditorSession({ type: sessionType, recordId: normalized.id })
        setStep(0)
        setForm(normalized)
        setSupplierQuery(findLabel(suppliers, normalized.supplier_id))
        setProductQuery('')
    }

    function openCreateModal() {
        setDetailRecordId(null)
        setFeedback(null)

        if (editorSession.type === 'create' && editorSession.recordId === null) {
            setEditorOpen(true)
            return
        }

        resetEditorSession()
        setEditorOpen(true)
    }

    function openEditModal(record) {
        if (isLockedRecord(record)) {
            setDetailRecordId(record.id)
            return
        }

        setDetailRecordId(null)
        setFeedback(null)

        if (editorSession.type === 'edit' && String(editorSession.recordId || '') === String(record.id || '')) {
            setEditorOpen(true)
            return
        }

        hydrateEditor(record, 'edit')
        setEditorOpen(true)
    }

    function closeEditorModal() {
        setEditorOpen(false)
        setFeedback(null)
    }

    function openDetailsModal(record) {
        setEditorOpen(false)
        setFeedback(null)
        setDetailRecordId(record.id)
    }

    function closeDetailsModal() {
        setDetailRecordId(null)
        setFeedback(null)
    }

    function handleSupplierSelect(option) {
        setForm((current) => ({ ...current, supplier_id: String(option.id) }))
        setSupplierQuery(option.name)
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
    }

    function handleProductSearchKeyDown(event) {
        if (event.key !== 'Enter') {
            return
        }

        const firstProduct = productOptions[0]

        if (!firstProduct || !canEdit) {
            return
        }

        event.preventDefault()
        addProduct(firstProduct, 1)
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

        if (!sourceForm.supplier_id) {
            setFeedback({ type: 'error', text: 'Selecione o fornecedor antes de salvar.' })
            if (options.openEditor !== false) {
                setEditorOpen(true)
                setStep(0)
            }
            return null
        }

        if (!(sourceForm.items || []).length) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um item ao pedido.' })
            if (options.openEditor !== false) {
                setEditorOpen(true)
                setStep(1)
            }
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
            setSelectedTab(response.record.status || selectedTab)
            setAppliedFilters((current) => (hasAppliedSearch ? current : createListFilters()))
            setHasAppliedSearch(true)
            hydrateEditor(response.record, 'edit')
            setFeedback({ type: 'success', text: response.message })

            if (options.keepDetailsOpen) {
                setDetailRecordId(response.record.id)
            } else {
                setDetailRecordId(null)
            }

            if (options.closeEditor !== false) {
                setEditorOpen(false)
            }

            return response.record
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
            if (options.openEditor !== false) {
                setEditorOpen(true)
            }
            return null
        } finally {
            setSavingAction(null)
        }
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

            if (String(editorSession.recordId || '') === String(record.id || '')) {
                resetEditorSession()
                setEditorOpen(false)
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

    async function handleSendFromDetails(record) {
        const confirmed = await confirmPopup({
            type: 'info',
            title: 'Enviar pedido',
            message: `Deseja enviar o pedido ${record.code || `#${record.id}`} para o fornecedor?`,
            confirmLabel: 'Enviar pedido',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        await persistPurchase('ordered', normalizeRecord(record), {
            closeEditor: false,
            keepDetailsOpen: true,
            openEditor: false,
            requestKey: `send-${record.id}`,
        })
    }

    async function handleReceiveFromDetails(record) {
        const confirmed = await confirmPopup({
            type: 'info',
            title: 'Registrar recebimento',
            message: `Ao confirmar, o pedido ${record.code || `#${record.id}`} sera recebido e a entrada em estoque sera aplicada.`,
            confirmLabel: 'Registrar recebimento',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        await persistPurchase('received', normalizeRecord(record), {
            closeEditor: false,
            keepDetailsOpen: true,
            openEditor: false,
            requestKey: `receive-${record.id}`,
        })
    }

    async function handleCancelOrdered(record) {
        await handleDelete(record, {
            title: 'Cancelar pedido',
            message: `O cancelamento deste pedido sera tratado como exclusao, porque o backend ainda nao possui um status cancelado para compras. Deseja continuar com ${record.code || `#${record.id}`}?`,
            confirmLabel: 'Cancelar pedido',
            type: 'warning',
        })
    }

    function handleViewStockEntry(record) {
        const reference = encodeURIComponent(record.code || record.document || '')
        window.location.assign(reference ? `/entrada-estoque/manutencao?nf=${reference}` : '/entrada-estoque/manutencao')
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page purchases-page">
                <section className="proc-ui-section-card purchases-list-card">
                    <div className="purchases-toolbar">
                        <div className="proc-ui-card-toolbar purchases-toolbar-main">
                            <label className="purchases-toolbar-search">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    className="proc-ui-searchbox"
                                    placeholder="Buscar por numero, nome, fornecedor..."
                                    type="search"
                                    value={listFilters.search}
                                    onChange={(event) => handleListFilterChange('search', event.target.value)}
                                />
                            </label>

                            <form
                                className="proc-ui-date-range proc-ui-date-range-with-action purchases-range-form"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    handleApplyFilters()
                                }}
                            >
                                <input
                                    aria-label="Data inicial"
                                    type="date"
                                    value={listFilters.from}
                                    onChange={(event) => handleListFilterChange('from', event.target.value)}
                                />
                                <input
                                    aria-label="Data final"
                                    type="date"
                                    value={listFilters.to}
                                    onChange={(event) => handleListFilterChange('to', event.target.value)}
                                />
                                <button type="submit" className="ui-button" disabled={recordsLoading}>
                                    <i className="fa-solid fa-calendar-check" />
                                    <span>{recordsLoading ? 'Buscando...' : 'Buscar'}</span>
                                </button>
                            </form>

                            <button type="button" className="ui-button purchases-new-button" onClick={openCreateModal}>
                                <i className="fa-solid fa-plus" />
                                <span>Novo pedido</span>
                            </button>
                        </div>

                        <div className="purchases-toolbar-status">
                            <span className="purchases-toolbar-label">Status</span>
                            <div className="proc-ui-top-tabs purchases-toolbar-tabs">
                                {STATUS_TABS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        className={`proc-ui-tab-chip ${selectedTab === tab.key ? 'active' : ''}`}
                                        onClick={() => setSelectedTab(tab.key)}
                                    >
                                        <span>{tab.label}</span>
                                        <strong>{formatNumber(statusCounts[tab.key] || 0)}</strong>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {pageFeedbackVisible ? (
                        <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                            <span>{feedback.text}</span>
                        </div>
                    ) : null}

                    <DenseTable
                        className="purchases-records-table"
                        columns={columns}
                        emptyState={(
                            <div className="proc-ui-empty">
                                <strong>{recordsLoading ? 'Buscando pedidos...' : hasAppliedSearch ? 'Nenhum pedido encontrado' : 'Use os filtros para buscar pedidos'}</strong>
                                <p>{recordsLoading ? 'Estamos carregando os pedidos para aplicar os filtros.' : hasAppliedSearch ? 'Ajuste os filtros aplicados ou troque o status selecionado.' : 'Escolha o periodo ou use a busca textual e clique em Buscar.'}</p>
                            </div>
                        )}
                        getRowActions={(record) => [
                            {
                                key: 'view',
                                icon: 'fa-eye',
                                label: 'Ver',
                                onClick: () => openDetailsModal(record),
                            },
                            {
                                key: 'edit',
                                disabled: isLockedRecord(record),
                                icon: 'fa-pen',
                                label: 'Editar',
                                onClick: () => openEditModal(record),
                                tone: 'info',
                            },
                            {
                                key: 'delete',
                                disabled: isLockedRecord(record),
                                icon: 'fa-trash',
                                label: 'Excluir',
                                onClick: () => handleDelete(record),
                                tone: 'danger',
                            },
                        ]}
                        minWidth={980}
                        rows={filteredRecords}
                        showActionLabels
                        onRowClick={openDetailsModal}
                    />

                    {hasAppliedSearch && !recordsLoading ? (
                        <footer className="purchases-table-footer">
                            <span>Total de registros: <strong>{formatNumber(filteredRecords.length)}</strong></span>
                            <span>Total geral dos pedidos filtrados: <strong>{formatMoney(filteredTotal)}</strong></span>
                        </footer>
                    ) : null}
                </section>
            </div>

            <CompactModal
                open={editorOpen}
                badge={editorSession.type === 'edit' ? 'Editar pedido' : 'Novo pedido'}
                bodyClassName="purchases-editor-modal-body"
                className="purchases-editor-modal"
                description={form.id ? `${getPurchaseDisplayName(form)} - ${selectedSupplierName || 'Sem fornecedor'}` : 'Selecione o fornecedor e monte os itens do pedido.'}
                icon={editorSession.type === 'edit' ? 'fa-pen-to-square' : 'fa-cart-plus'}
                size="lg"
                title={editorSession.type === 'edit' ? 'Editar pedido' : 'Criar pedido'}
                onClose={closeEditorModal}
            >
                <div className="proc-ui-modal-stack">
                    <div className="proc-ui-stepper purchases-editor-stepper" style={{ '--proc-step-count': STEPS.length }}>
                        {STEPS.map((entry, index) => (
                            <button
                                key={entry.key}
                                type="button"
                                className={`proc-ui-step ${step === index ? 'active' : ''} ${stepReady[index] && step > index ? 'complete' : ''} ${index > step && !stepReady[index - 1] ? 'disabled' : ''}`}
                                onClick={() => {
                                    if (index <= step || stepReady[index - 1]) {
                                        setStep(index)
                                    }
                                }}
                            >
                                <span className="proc-ui-step-index">
                                    {stepReady[index] && step > index ? <i className="fa-solid fa-check" /> : index + 1}
                                </span>
                                <strong><i className={`fa-solid ${entry.icon}`} /> {entry.label}</strong>
                            </button>
                        ))}
                    </div>

                    {feedback ? (
                        <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                            <span>{feedback.text}</span>
                        </div>
                    ) : null}

                    {step === 0 ? (
                        <div className="proc-ui-stage purchases-editor-setup">
                            <AutocompleteField
                                emptyLabel="Nenhum fornecedor encontrado"
                                icon="fa-building"
                                label="Fornecedor"
                                options={supplierOptions}
                                placeholder="Buscar fornecedor por nome, documento ou cidade"
                                query={supplierQuery}
                                selectedLabel={selectedSupplierName}
                                value={form.supplier_id}
                                disabled={!canEdit}
                                onQueryChange={setSupplierQuery}
                                onSelect={handleSupplierSelect}
                            />

                            <div className="proc-ui-field full">
                                <label>
                                    <span>Nome da compra</span>
                                    <input
                                        disabled={!canEdit}
                                        maxLength="160"
                                        placeholder="Ex.: Reposicao feira de sabado"
                                        type="text"
                                        value={form.custom_name}
                                        onChange={(event) => setForm((current) => ({ ...current, custom_name: event.target.value }))}
                                    />
                                </label>
                            </div>

                            <div className="proc-ui-step-actions">
                                <button type="button" className="ui-button-ghost" onClick={closeEditorModal}>
                                    Fechar
                                </button>
                                <button
                                    type="button"
                                    className="ui-button"
                                    disabled={!canEdit || !form.supplier_id}
                                    title={!form.supplier_id ? 'Selecione um fornecedor para continuar.' : undefined}
                                    onClick={() => setStep(1)}
                                >
                                    <span>Proximo</span>
                                    <i className="fa-solid fa-arrow-right" />
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {step === 1 ? (
                        <div className="proc-ui-stage purchases-items-stage">
                            <section className="proc-ui-modal-block purchases-items-search-panel">
                                <div className="purchases-items-search-head">
                                    <div className="purchases-items-search-copy">
                                        <h3>Monte os itens do pedido</h3>
                                        <p>Digite nome ou codigo e pressione Enter para adicionar o primeiro resultado rapidamente.</p>
                                    </div>

                                    <div className="purchases-items-meta">
                                        <span>Fornecedor <strong>{selectedSupplierName || 'Nao selecionado'}</strong></span>
                                        <span>Compra <strong>{form.custom_name || 'Sem nome definido'}</strong></span>
                                    </div>
                                </div>

                                <label className="purchases-items-searchbox">
                                    <span className="proc-ui-label">
                                        <i className="fa-solid fa-box" /> Buscar produto
                                    </span>
                                    <div className="purchases-items-search-input">
                                        <i className="fa-solid fa-magnifying-glass" />
                                        <input
                                            className="proc-ui-searchbox"
                                            disabled={!canEdit}
                                            placeholder="Buscar produto por nome, codigo ou codigo de barras"
                                            type="search"
                                            value={productQuery}
                                            onChange={(event) => setProductQuery(event.target.value)}
                                            onKeyDown={handleProductSearchKeyDown}
                                        />
                                    </div>
                                </label>

                                {productQuery.trim().length > 0 ? (
                                    <div className="purchases-product-results">
                                        {productOptions.length ? productOptions.map((option) => {
                                            const queuedItem = itemsByProductId[String(option.id)]
                                            const queuedQuantity = queuedItem ? formatNumber(queuedItem.quantity) : null

                                            return (
                                                <article key={option.id} className="purchases-product-result">
                                                    <div className="purchases-product-result-copy">
                                                        <strong>{option.name}</strong>
                                                        <span>{option.code || option.barcode || 'Sem codigo'}</span>
                                                        <small>Custo atual: {formatMoney(option.cost_price || 0)}</small>
                                                    </div>

                                                    <div className="purchases-product-result-actions">
                                                        {queuedQuantity ? <span className="proc-ui-pill">No pedido: {queuedQuantity}</span> : null}
                                                        <button type="button" className="ui-button-ghost" disabled={!canEdit} onClick={() => addProduct(option, 1)}>
                                                            +1
                                                        </button>
                                                        <button type="button" className="ui-button" disabled={!canEdit} onClick={() => addProduct(option, 5)}>
                                                            +5
                                                        </button>
                                                    </div>
                                                </article>
                                            )
                                        }) : (
                                            <div className="proc-ui-empty purchases-product-results-empty">
                                                <strong>Nenhum produto encontrado</strong>
                                                <p>Tente outro termo, codigo ou codigo de barras.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="proc-ui-empty purchases-product-results-empty">
                                        <strong>Busque um produto para comecar</strong>
                                        <p>Os atalhos de inclusao rapida aparecem assim que voce digita.</p>
                                    </div>
                                )}
                            </section>

                            <section className="proc-ui-modal-block purchases-items-board">
                                <div className="proc-ui-summary-grid purchases-review-summary">
                                    <article className="proc-ui-summary-card">
                                        <span>Itens</span>
                                        <strong>{formatNumber(form.items.length)}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Unidades</span>
                                        <strong>{formatNumber(form.items.reduce((sum, item) => sum + parseNumber(item.quantity, 0), 0))}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Subtotal</span>
                                        <strong>{formatMoney(subtotal)}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Total</span>
                                        <strong>{formatMoney(total)}</strong>
                                    </article>
                                </div>

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
                                                        <span>{productMeta?.code || productMeta?.barcode || 'Sem codigo'}</span>
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
                                                        <button
                                                            type="button"
                                                            className="ui-button-ghost purchases-qty-burst"
                                                            disabled={!canEdit}
                                                            onClick={() => handleItemQuantityShortcut(index, 5)}
                                                        >
                                                            +5
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
                                                        <strong>Nenhum item no pedido</strong>
                                                        <p>Use a busca acima para adicionar os primeiros produtos.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>

                                <div className="proc-ui-table-totalbar purchases-items-totalbar">
                                    <span>Itens diferentes: <strong>{formatNumber(form.items.length)}</strong></span>
                                    <span>Subtotal: <strong>{formatMoney(subtotal)}</strong></span>
                                    <span>Total do pedido: <strong>{formatMoney(total)}</strong></span>
                                </div>
                            </section>

                            <div className="proc-ui-step-actions">
                                <button type="button" className="ui-button-ghost" onClick={() => setStep(0)}>
                                    <i className="fa-solid fa-arrow-left" />
                                    <span>Voltar</span>
                                </button>
                                <button
                                    type="button"
                                    className="ui-button"
                                    disabled={!canEdit || !form.items.length}
                                    title={!form.items.length ? 'Adicione itens para revisar o pedido.' : undefined}
                                    onClick={() => setStep(2)}
                                >
                                    <span>Proximo</span>
                                    <i className="fa-solid fa-arrow-right" />
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {step === 2 ? (
                        <div className="proc-ui-stage">
                            <div className="proc-ui-summary-grid purchases-review-summary">
                                <article className="proc-ui-summary-card">
                                    <span>Pedido</span>
                                    <strong>{getPurchaseDisplayName(form)}</strong>
                                </article>
                                <article className="proc-ui-summary-card">
                                    <span>Fornecedor</span>
                                    <strong>{selectedSupplierName || 'Nao selecionado'}</strong>
                                </article>
                                <article className="proc-ui-summary-card">
                                    <span>Itens</span>
                                    <strong>{formatNumber(form.items.length)}</strong>
                                </article>
                                <article className="proc-ui-summary-card">
                                    <span>Total</span>
                                    <strong>{formatMoney(total)}</strong>
                                </article>
                            </div>

                            <section className="proc-ui-review-card">
                                <div className="proc-ui-section-title">
                                    <h3>Resumo compacto</h3>
                                </div>

                                <div className="proc-ui-surface-list">
                                    {form.items.map((item, index) => (
                                        <div key={`${item.product_id}-${index}`} className="proc-ui-surface-item">
                                            <div>
                                                <strong>{getProductLabel(item, products)}</strong>
                                                <small>{formatNumber(item.quantity)} un - {formatMoney(item.unit_cost)} cada</small>
                                            </div>
                                            <strong>{formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0))}</strong>
                                        </div>
                                    ))}
                                </div>

                                <div className="proc-ui-divider" />

                                <div className="proc-ui-field full purchases-review-notes">
                                    <label>
                                        <span>Observacoes</span>
                                        <textarea
                                            className="purchases-editor-notes"
                                            disabled={!canEdit}
                                            rows="2"
                                            value={form.notes}
                                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                        />
                                    </label>
                                </div>

                                <div className="proc-ui-review-grid">
                                    <div>
                                        <small>Resumo financeiro</small>
                                        <strong>{formatMoney(total)}</strong>
                                    </div>
                                    <div>
                                        <small>Fornecedor confirmado</small>
                                        <strong>{selectedSupplierName || 'Nao selecionado'}</strong>
                                    </div>
                                </div>
                            </section>

                            <div className="proc-ui-step-actions">
                                <button type="button" className="ui-button-ghost" onClick={() => setStep(1)}>
                                    <i className="fa-solid fa-arrow-left" />
                                    <span>Voltar</span>
                                </button>

                                <div className="proc-ui-card-toolbar purchases-editor-submitbar">
                                    <button
                                        type="button"
                                        className="ui-button-ghost"
                                        disabled={!canEdit || savingAction !== null}
                                        onClick={() => persistPurchase('draft', form, { requestKey: 'editor-draft' })}
                                    >
                                        {savingAction === 'editor-draft' ? 'Salvando...' : 'Salvar rascunho'}
                                    </button>
                                    <button
                                        type="button"
                                        className="ui-button"
                                        disabled={!canEdit || savingAction !== null}
                                        onClick={() => persistPurchase('ordered', form, { requestKey: 'editor-ordered' })}
                                    >
                                        {savingAction === 'editor-ordered' ? 'Enviando...' : 'Enviar pedido'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {nextDisabledReason && step < 2 ? (
                        <span className="proc-ui-step-note">{nextDisabledReason}</span>
                    ) : null}
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
                onEdit={openEditModal}
                onReceive={handleReceiveFromDetails}
                onSend={handleSendFromDetails}
                onViewStockEntry={handleViewStockEntry}
            />
        </AppLayout>
    )
}
