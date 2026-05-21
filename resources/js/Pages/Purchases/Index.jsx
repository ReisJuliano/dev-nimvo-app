import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { buildRecordsUrl, ensureDate, parseNumber, upsertRecord } from '@/Pages/Operations/workspaces/shared'
import '../Operations/backoffice-workspace.css'

const STATUS_TABS = [
    { key: 'draft', label: 'Rascunhos', icon: 'fa-file-lines' },
    { key: 'ordered', label: 'Solicitadas', icon: 'fa-paper-plane' },
    { key: 'received', label: 'Recebidas', icon: 'fa-box-open' },
]

const STEPS = [
    { key: 'supplier', label: 'Fornecedor e dados', icon: 'fa-building' },
    { key: 'items', label: 'Itens do pedido', icon: 'fa-boxes-stacked' },
    { key: 'review', label: 'Revisao final', icon: 'fa-circle-check' },
]

function createEmptyForm() {
    return {
        id: null,
        code: null,
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

function normalizeRecord(record) {
    return {
        ...createEmptyForm(),
        ...record,
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
        return { label: 'Recebida', tone: 'success' }
    }

    if (status === 'ordered') {
        return { label: 'Solicitada', tone: 'info' }
    }

    return { label: 'Rascunho', tone: 'warning' }
}

function findLabel(options, id) {
    return options.find((entry) => String(entry.id) === String(id))?.name || ''
}

function summarizeItems(items) {
    return items.reduce((total, item) => total + (parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0)), 0)
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
                            )) : <div className="proc-ui-empty"><strong>{emptyLabel}</strong></div>}
                        </div>
                    ) : null}
                </div>
            </label>
        </div>
    )
}

export default function PurchasesIndex({ moduleTitle = 'Compras', payload }) {
    const suppliers = Array.isArray(payload?.suppliers) ? payload.suppliers : []
    const products = Array.isArray(payload?.products) ? payload.products : []
    const [records, setRecords] = useState(Array.isArray(payload?.records) ? payload.records : [])
    const [activeTab, setActiveTab] = useState('draft')
    const [step, setStep] = useState(0)
    const [form, setForm] = useState(createEmptyForm())
    const [editorMode, setEditorMode] = useState('edit')
    const [supplierQuery, setSupplierQuery] = useState('')
    const [productQuery, setProductQuery] = useState('')
    const [listSearch, setListSearch] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [savingAction, setSavingAction] = useState(null)
    const [showAllSidebarRecords, setShowAllSidebarRecords] = useState(false)

    const selectedSupplierName = findLabel(suppliers, form.supplier_id)
    const normalizedListSearch = normalizeTextSearch(listSearch)
    const filteredRecords = useMemo(() => (
        records.filter((record) => {
            if (record.status !== activeTab) {
                return false
            }

            if (!normalizedListSearch) {
                return true
            }

            return matchesTextSearchAny([
                record.code,
                record.supplier_name,
                record.document,
                record.notes,
            ], normalizedListSearch)
        })
    ), [activeTab, normalizedListSearch, records])

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

    const shouldCondenseSidebar = activeTab === 'draft' && !normalizedListSearch
    const visibleSidebarRecords = useMemo(() => {
        if (!shouldCondenseSidebar || showAllSidebarRecords) {
            return filteredRecords
        }

        return filteredRecords.slice(0, 4)
    }, [filteredRecords, shouldCondenseSidebar, showAllSidebarRecords])
    const hiddenSidebarRecords = Math.max(0, filteredRecords.length - visibleSidebarRecords.length)
    const activeTabMeta = STATUS_TABS.find((tab) => tab.key === activeTab) || STATUS_TABS[0]
    const filteredStageTotal = useMemo(
        () => filteredRecords.reduce((totalAmount, record) => totalAmount + Number(record.total || 0), 0),
        [filteredRecords]
    )
    const filteredStageItems = useMemo(
        () => filteredRecords.reduce((count, record) => count + Number(record.items_count || 0), 0),
        [filteredRecords]
    )

    const subtotal = useMemo(() => summarizeItems(form.items), [form.items])
    const total = subtotal + parseNumber(form.freight, 0)
    const stepReady = [
        Boolean(form.supplier_id),
        form.items.length > 0,
        form.items.length > 0 && Boolean(form.supplier_id),
    ]
    const isLocked = Boolean(form.stock_applied_at) || form.status === 'received'
    const canEdit = !isLocked && editorMode === 'edit'
    const nextDisabledReason = step === 0 && !form.supplier_id
        ? 'Selecione um fornecedor para continuar.'
            : step === 1 && !form.items.length
            ? 'Adicione pelo menos um item ao pedido.'
            : ''

    useEffect(() => {
        setShowAllSidebarRecords(false)
    }, [activeTab, normalizedListSearch])

    function resetEditor(nextTab = 'draft') {
        setActiveTab(nextTab)
        setStep(0)
        setEditorMode('edit')
        setForm(createEmptyForm())
        setSupplierQuery('')
        setProductQuery('')
    }

    function loadRecord(record, mode = 'view') {
        const normalized = normalizeRecord(record)
        setActiveTab(record.status || 'draft')
        setForm(normalized)
        setEditorMode(mode)
        setStep(mode === 'view' ? 2 : 0)
        setSupplierQuery(findLabel(suppliers, normalized.supplier_id))
        setProductQuery('')
    }

    function handleSupplierSelect(option) {
        setForm((current) => ({ ...current, supplier_id: String(option.id) }))
        setSupplierQuery(option.name)
    }

    function addProduct(option) {
        setForm((current) => {
            const existingIndex = current.items.findIndex((item) => String(item.product_id) === String(option.id))

            if (existingIndex >= 0) {
                return {
                    ...current,
                    items: current.items.map((item, index) => (
                        index === existingIndex
                            ? { ...item, quantity: String(parseNumber(item.quantity, 0) + 1) }
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
                        quantity: '1',
                        unit_cost: String(option.cost_price || 0),
                    },
                ],
            }
        })
        setProductQuery('')
    }

    function handleItemChange(index, field, value) {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [field]: value } : item
            )),
        }))
    }

    function handleItemRemove(index) {
        setForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }))
    }

    async function handleDelete(record) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Excluir pedido',
            message: `Deseja excluir o pedido ${record.code || `#${record.id}`}?`,
            confirmLabel: 'Excluir',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl('compras', record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))
            if (String(form.id || '') === String(record.id)) {
                resetEditor(activeTab)
            }
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function submitPurchase(status) {
        if (isLocked) {
            return
        }

        if (!form.supplier_id) {
            setFeedback({ type: 'error', text: 'Selecione o fornecedor antes de salvar.' })
            setStep(0)
            return
        }

        if (!form.items.length) {
            setFeedback({ type: 'error', text: 'Adicione pelo menos um item ao pedido.' })
            setStep(1)
            return
        }

        setSavingAction(status)
        setFeedback(null)

        try {
            const payloadData = {
                supplier_id: Number(form.supplier_id),
                status,
                expected_at: form.expected_at || null,
                freight: parseNumber(form.freight, 0),
                notes: form.notes || null,
                items: form.items.map((item) => ({
                    product_id: Number(item.product_id),
                    quantity: parseNumber(item.quantity, 0),
                    unit_cost: parseNumber(item.unit_cost, 0),
                })),
            }

            const response = form.id
                ? await apiRequest(buildRecordsUrl('compras', form.id), { method: 'put', data: payloadData })
                : await apiRequest(buildRecordsUrl('compras'), { method: 'post', data: payloadData })

            setRecords((current) => upsertRecord(current, response.record))
            loadRecord(response.record, response.record.status === 'received' ? 'view' : 'edit')
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSavingAction(null)
        }
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page">
                <div className="proc-ui-shell">
                    <section className="proc-ui-main-card">
                        <div className="proc-ui-main-header">
                            <div>
                                <h2>{form.id ? (form.code || `Pedido #${form.id}`) : 'Novo pedido'}</h2>
                                <p>{form.code ? `${form.code} · ${selectedSupplierName || 'Sem fornecedor'}` : 'Fluxo progressivo para criar e revisar o pedido.'}</p>
                            </div>

                            <div className="proc-ui-statusline">
                                {form.id ? <StatusBadge compact {...resolveStatusMeta(form.status)} /> : null}
                                {form.id && !isLocked && editorMode === 'view' ? (
                                    <button type="button" className="ui-button-ghost" onClick={() => setEditorMode('edit')}>
                                        <i className="fa-solid fa-pen" />
                                        <span>Editar pedido</span>
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className="proc-ui-stepper" style={{ '--proc-step-count': STEPS.length }}>
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
                                    <span className="proc-ui-step-index">{stepReady[index] && step > index ? <i className="fa-solid fa-check" /> : index + 1}</span>
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
                            <div key="purchase-step-1" className="proc-ui-stage">
                                <AutocompleteField
                                    icon="fa-building"
                                    label="Fornecedor"
                                    query={supplierQuery}
                                    value={form.supplier_id}
                                    selectedLabel={selectedSupplierName}
                                    placeholder="Buscar fornecedor por nome, documento ou cidade"
                                    emptyLabel="Nenhum fornecedor encontrado"
                                    options={supplierOptions}
                                    disabled={!canEdit}
                                    onQueryChange={setSupplierQuery}
                                    onSelect={handleSupplierSelect}
                                />

                                <div className="proc-ui-field-grid">
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Previsao de entrega</span>
                                            <input
                                                disabled={!canEdit}
                                                type="date"
                                                value={form.expected_at}
                                                onChange={(event) => setForm((current) => ({ ...current, expected_at: event.target.value }))}
                                            />
                                        </label>
                                    </div>

                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Frete previsto</span>
                                            <input
                                                disabled={!canEdit}
                                                min="0"
                                                step="0.01"
                                                type="number"
                                                value={form.freight}
                                                onChange={(event) => setForm((current) => ({ ...current, freight: event.target.value }))}
                                            />
                                        </label>
                                    </div>

                                    <div className="proc-ui-field full">
                                        <label>
                                            <span>Observacoes</span>
                                            <textarea
                                                disabled={!canEdit}
                                                rows="4"
                                                value={form.notes}
                                                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="proc-ui-step-actions">
                                    <div className="proc-ui-inline-meta">
                                        <span>Fornecedor: {selectedSupplierName || 'Nao selecionado'}</span>
                                        <span>Entrega: {form.expected_at ? formatDate(form.expected_at) : 'Sem previsao'}</span>
                                    </div>

                                    <button
                                        type="button"
                                        className="ui-button"
                                        disabled={!canEdit || Boolean(nextDisabledReason)}
                                        title={nextDisabledReason || undefined}
                                        onClick={() => setStep(1)}
                                    >
                                        <span>Proximo</span>
                                        <i className="fa-solid fa-arrow-right" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {step === 1 ? (
                            <div key="purchase-step-2" className="proc-ui-stage">
                                <AutocompleteField
                                    icon="fa-magnifying-glass"
                                    label="Buscar produto"
                                    query={productQuery}
                                    value=""
                                    selectedLabel={null}
                                    placeholder="Digite nome, codigo ou codigo de barras"
                                    emptyLabel="Nenhum produto encontrado"
                                    options={productOptions}
                                    disabled={!canEdit}
                                    onQueryChange={setProductQuery}
                                    onSelect={addProduct}
                                />

                                <div className="proc-ui-table-wrap">
                                    <table className="proc-ui-table">
                                        <thead>
                                            <tr>
                                                <th>Produto</th>
                                                <th>Qtd</th>
                                                <th>Custo unit.</th>
                                                <th>Total</th>
                                                <th>Acoes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.length ? form.items.map((item, index) => (
                                                <tr key={`${item.product_id}-${index}`}>
                                                    <td>
                                                        <div className="proc-ui-record-card-copy">
                                                            <strong>{item.product_name || products.find((product) => String(product.id) === String(item.product_id))?.name || 'Produto'}</strong>
                                                            <span>{products.find((product) => String(product.id) === String(item.product_id))?.code || 'Sem codigo'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            disabled={!canEdit}
                                                            min="0.001"
                                                            step="0.001"
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                                                        />
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
                                                        <div className="proc-ui-table-actions">
                                                            <button type="button" className="ui-button-ghost danger" disabled={!canEdit} onClick={() => handleItemRemove(index)}>
                                                                <i className="fa-solid fa-trash" />
                                                                <span>Remover</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="5">
                                                        <div className="proc-ui-empty">
                                                            <strong>Nenhum item no pedido</strong>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="proc-ui-table-totalbar">
                                        <span>Subtotal: <strong>{formatMoney(subtotal)}</strong></span>
                                        <span>Frete: <strong>{formatMoney(form.freight)}</strong></span>
                                        <span>Total: <strong>{formatMoney(total)}</strong></span>
                                    </div>
                                </div>

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
                            <div key="purchase-step-3" className="proc-ui-stage">
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card">
                                        <span>Fornecedor</span>
                                        <strong>{selectedSupplierName || 'Nao selecionado'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Itens</span>
                                        <strong>{form.items.length}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Previsao</span>
                                        <strong>{form.expected_at ? formatDate(form.expected_at) : 'Sem data'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Total</span>
                                        <strong>{formatMoney(total)}</strong>
                                    </article>
                                </div>

                                <section className="proc-ui-review-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Resumo</h3>
                                    </div>

                                    <div className="proc-ui-surface-list">
                                        {form.items.map((item, index) => (
                                            <div key={`${item.product_id}-${index}`} className="proc-ui-surface-item">
                                                <div>
                                                    <strong>{item.product_name || products.find((product) => String(product.id) === String(item.product_id))?.name || 'Produto'}</strong>
                                                    <small>{formatNumber(item.quantity)} un · {formatMoney(item.unit_cost)} cada</small>
                                                </div>
                                                <strong>{formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0))}</strong>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="proc-ui-divider" />

                                    <div className="proc-ui-review-grid">
                                        <div>
                                            <small>Observacoes</small>
                                            <strong>{form.notes || 'Sem observacoes registradas.'}</strong>
                                        </div>
                                        <div>
                                            <small>Subtotal + frete</small>
                                            <strong>{`${formatMoney(subtotal)} + ${formatMoney(form.freight)}`}</strong>
                                        </div>
                                    </div>
                                </section>

                                <div className="proc-ui-step-actions">
                                    <button type="button" className="ui-button-ghost" onClick={() => setStep(1)}>
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Voltar</span>
                                    </button>

                                    <div className="proc-ui-card-toolbar">
                                        <button
                                            type="button"
                                            className="ui-button-ghost"
                                            disabled={!canEdit || savingAction !== null}
                                            onClick={() => submitPurchase('draft')}
                                        >
                                            {savingAction === 'draft' ? 'Salvando...' : 'Salvar como rascunho'}
                                        </button>
                                        <button
                                            type="button"
                                            className="ui-button"
                                            disabled={!canEdit || savingAction !== null}
                                            onClick={() => submitPurchase('ordered')}
                                        >
                                            {savingAction === 'ordered' ? 'Enviando...' : 'Enviar pedido'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </section>

                    <aside className="proc-ui-sidebar purchases-history-sidebar">
                        <div className="proc-ui-sidebar-section purchases-history-sidebar-hero">
                            <div className="proc-ui-sidebar-header purchases-history-header">
                                <div className="purchases-history-header-copy">
                                    <span className="purchases-history-kicker">Painel lateral</span>
                                    <h2>Historico</h2>
                                    <p>{formatNumber(filteredRecords.length)} pedido(s) em {activeTabMeta.label.toLowerCase()}.</p>
                                </div>
                                <button type="button" className="ui-button-ghost purchases-history-new-button" onClick={() => resetEditor(activeTab)}>
                                    <i className="fa-solid fa-plus" />
                                    <span>Novo pedido</span>
                                </button>
                            </div>

                            <div className="purchases-history-overview">
                                <article className="purchases-history-stat">
                                    <span>Etapa</span>
                                    <strong>{activeTabMeta.label}</strong>
                                </article>
                                <article className="purchases-history-stat">
                                    <span>Total</span>
                                    <strong>{formatMoney(filteredStageTotal)}</strong>
                                </article>
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-section purchases-history-toolbar-panel">
                            <div className="proc-ui-top-tabs purchases-history-tabs">
                                {STATUS_TABS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        className={`proc-ui-tab-chip purchases-history-tab ${activeTab === tab.key ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveTab(tab.key)
                                            if (!form.id) {
                                                setForm((current) => ({ ...current, status: tab.key }))
                                            }
                                        }}
                                    >
                                        <i className={`fa-solid ${tab.icon}`} />
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <label className="purchases-history-search">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    className="proc-ui-searchbox"
                                    type="search"
                                    placeholder="Buscar por numero, fornecedor ou nota"
                                    value={listSearch}
                                    onChange={(event) => setListSearch(event.target.value)}
                                />
                            </label>
                        </div>

                        <div className={`proc-ui-sidebar-list ${shouldCondenseSidebar ? 'compact' : ''}`}>
                            {visibleSidebarRecords.length ? visibleSidebarRecords.map((record) => {
                                const statusMeta = resolveStatusMeta(record.status)
                                const itemCount = Number(record.items_count || record.items?.length || 0)
                                const isActiveRecord = String(form.id || '') === String(record.id)

                                return (
                                    <button
                                        key={record.id}
                                        type="button"
                                        className={`proc-ui-record-card purchases-history-card ${shouldCondenseSidebar ? 'compact' : ''} ${isActiveRecord ? 'active' : ''}`}
                                        data-tone={statusMeta.tone}
                                        onClick={() => loadRecord(record, 'view')}
                                    >
                                        <div className="proc-ui-record-card-top">
                                            <div className="purchases-history-card-heading">
                                                <div className="proc-ui-record-card-inline">
                                                    <strong>{record.code}</strong>
                                                    {!shouldCondenseSidebar ? <StatusBadge compact label={statusMeta.label} tone={statusMeta.tone} /> : null}
                                                </div>
                                                <strong className="proc-ui-truncate">{record.supplier_name || 'Sem fornecedor'}</strong>
                                            </div>

                                            <div className="purchases-history-card-side">
                                                <strong className="proc-ui-record-card-amount">{formatMoney(record.total || 0)}</strong>
                                                {shouldCondenseSidebar ? <span className="purchases-history-card-status">{statusMeta.label}</span> : null}
                                            </div>
                                        </div>

                                        <div className="proc-ui-record-card-copy">
                                            {shouldCondenseSidebar ? (
                                                <div className="proc-ui-record-card-subline purchases-history-card-meta-line">
                                                    <span><i className="fa-solid fa-boxes-stacked" /> {formatNumber(itemCount)} item(ns)</span>
                                                    <span><i className="fa-solid fa-calendar-day" /> {record.expected_at ? formatDate(record.expected_at) : 'Sem previsao'}</span>
                                                    {record.document ? <span className="proc-ui-truncate"><i className="fa-solid fa-file-lines" /> {record.document}</span> : null}
                                                </div>
                                            ) : (
                                                <span>{record.document || record.notes || 'Sem observacoes'}</span>
                                            )}
                                        </div>

                                        {!shouldCondenseSidebar ? (
                                            <div className="proc-ui-record-card-meta purchases-history-card-meta-line">
                                                <span><i className="fa-solid fa-boxes-stacked" /> {formatNumber(itemCount)} item(ns)</span>
                                                <span><i className="fa-solid fa-calendar-day" /> {record.expected_at ? formatDate(record.expected_at) : 'Sem previsao'}</span>
                                            </div>
                                        ) : null}

                                        <div className="proc-ui-record-card-actions">
                                            <button type="button" className="proc-ui-ghost-icon" title="Ver" onClick={(event) => { event.stopPropagation(); loadRecord(record, 'view') }}>
                                                <i className="fa-solid fa-eye" />
                                            </button>
                                            <button type="button" className="proc-ui-ghost-icon" title="Editar" onClick={(event) => { event.stopPropagation(); loadRecord(record, 'edit') }}>
                                                <i className="fa-solid fa-pen" />
                                            </button>
                                            <button type="button" className="proc-ui-ghost-icon" title="Excluir" onClick={(event) => { event.stopPropagation(); handleDelete(record) }}>
                                                <i className="fa-solid fa-trash" />
                                            </button>
                                        </div>
                                    </button>
                                )
                            }) : (
                                <div className="proc-ui-empty">
                                    <strong>Sem pedidos nesta fila</strong>
                                    <p>Troque a etapa ou crie um novo pedido.</p>
                                </div>
                            )}
                        </div>

                        {shouldCondenseSidebar && (hiddenSidebarRecords > 0 || showAllSidebarRecords) ? (
                            <div className="proc-ui-sidebar-section proc-ui-sidebar-section-compact-toggle">
                                <button
                                    type="button"
                                    className="ui-button-ghost proc-ui-sidebar-toggle"
                                    onClick={() => setShowAllSidebarRecords((current) => !current)}
                                >
                                    <i className={`fa-solid ${showAllSidebarRecords ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                                    <span>{showAllSidebarRecords ? 'Recolher rascunhos' : `Mostrar mais ${hiddenSidebarRecords}`}</span>
                                </button>
                            </div>
                        ) : null}

                        <div className="proc-ui-footer-totals">
                            <span>Total da etapa: <strong>{formatMoney(filteredStageTotal)}</strong></span>
                            <span>Itens: <strong>{formatNumber(filteredStageItems)}</strong></span>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    )
}
