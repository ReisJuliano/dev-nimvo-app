import { useMemo, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import ActionDrawer from '@/Components/UI/ActionDrawer'
import ActionSidebar from '@/Components/UI/ActionSidebar'
import DataTable from '@/Components/UI/DataTable'
import DenseTable from '@/Components/UI/DenseTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import IncomingNfeWorkspace from './IncomingNfeWorkspace'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    ensureDate,
    ensureDateTime,
    Feedback,
    FeedbackHeader,
    getProductOptionLabel,
    ListCard,
    parseNumber,
    SectionTabs,
    upsertRecord,
} from './shared'

function FieldLabel({ icon, text }) {
    return (
        <span className="ops-workspace-label-with-icon">
            <i className={`fa-solid ${icon}`} />
            {text}
        </span>
    )
}

function PurchaseItemsEditor({ products, items, onChange }) {
    const [draft, setDraft] = useState({ product_id: '', quantity: '1', unit_cost: '0' })

    function addItem() {
        if (!draft.product_id) return
        const product = products.find((entry) => String(entry.id) === String(draft.product_id))
        onChange([
            ...items,
            {
                product_id: String(draft.product_id),
                product_name: product?.name,
                quantity: String(parseNumber(draft.quantity, 1)),
                unit_cost: String(parseNumber(draft.unit_cost, product?.cost_price || 0)),
            },
        ])
        setDraft({ product_id: '', quantity: '1', unit_cost: '0' })
    }

    return (
        <>
            <div className="ops-workspace-inline-adder span-2">
                <select value={draft.product_id} onChange={(event) => setDraft((current) => ({ ...current, product_id: event.target.value }))}>
                    <option value="">Adicionar produto</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}
                </select>
                <input type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
                <input type="number" min="0" step="0.01" value={draft.unit_cost} onChange={(event) => setDraft((current) => ({ ...current, unit_cost: event.target.value }))} />
                <button type="button" className="ui-button-ghost" onClick={addItem}>Adicionar</button>
            </div>
            <div className="ops-workspace-table-wrap span-2">
                <table className="ui-table">
                    <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th><th>Total</th><th>Acao</th></tr></thead>
                    <tbody>
                        {items.length ? items.map((item, index) => (
                            <tr key={`${item.product_id}-${index}`}>
                                <td>{item.product_name || products.find((product) => String(product.id) === String(item.product_id))?.name || 'Produto'}</td>
                                <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantity: event.target.value } : entry)))} /></td>
                                <td><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, unit_cost: event.target.value } : entry)))} /></td>
                                <td>{formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0))}</td>
                                <td><button type="button" className="ui-button-ghost danger" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}>Remover</button></td>
                            </tr>
                        )) : <tr><td colSpan="5">Nenhum item adicionado.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    )
}

export function DeliveryWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, customer_id: '', reference: '', status: 'pending', channel: 'delivery', recipient_name: '', phone: '', courier_name: '', address: '', neighborhood: '', delivery_fee: '0', order_total: '0', scheduled_for: '', notes: '' }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('pending')
    const [appliedTab, setAppliedTab] = useState('pending')
    const searchControl = useConfirmedSearch('')
    const [appliedSearch, setAppliedSearch] = useState('')
    const [range, setRange] = useState({ from: '', to: '' })
    const [appliedRange, setAppliedRange] = useState({ from: '', to: '' })
    const [selectedId, setSelectedId] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [hasLoadedRecords, setHasLoadedRecords] = useState((payload.records || []).length > 0)

    function deliveryStatusLabel(status) {
        if (status === 'dispatched') return 'Em rota'
        if (status === 'delivered') return 'Entregue'
        return 'Pendente'
    }

    function deliveryStatusTone(status) {
        if (status === 'delivered') return 'success'
        if (status === 'dispatched') return 'info'
        return 'warning'
    }

    function recordDateValue(record) {
        return String(record?.scheduled_for || record?.created_at || record?.updated_at || '').slice(0, 10)
    }

    function normalizeRecord(record) {
        return {
            ...emptyForm,
            ...record,
            customer_id: record.customer_id ? String(record.customer_id) : '',
            delivery_fee: String(record.delivery_fee || 0),
            order_total: String(record.order_total || 0),
            scheduled_for: ensureDateTime(record.scheduled_for),
        }
    }

    function matchesRange(record) {
        const value = recordDateValue(record)

        if (!value) {
            return true
        }

        if (appliedRange.from && value < appliedRange.from) {
            return false
        }

        if (appliedRange.to && value > appliedRange.to) {
            return false
        }

        return true
    }

    const normalizedSearch = normalizeTextSearch(appliedSearch)
    const filteredRecords = useMemo(() => (
        records.filter((record) => {
            if (!hasLoadedRecords) {
                return false
            }

            if (record.status !== appliedTab) {
                return false
            }

            if (!matchesRange(record)) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return matchesTextSearchAny([
                record.reference,
                record.customer_name,
                record.recipient_name,
                record.address,
                record.courier_name,
            ], normalizedSearch)
        })
    ), [appliedRange, appliedTab, hasLoadedRecords, normalizedSearch, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedId))
            || records.find((record) => String(record.id) === String(selectedId))
            || null,
        [filteredRecords, records, selectedId],
    )

    const statusCounts = useMemo(() => ({
        pending: records.filter((record) => record.status === 'pending').length,
        dispatched: records.filter((record) => record.status === 'dispatched').length,
        delivered: records.filter((record) => record.status === 'delivered').length,
    }), [records])

    const tableColumns = useMemo(() => ([
        {
            key: 'reference',
            label: 'Codigo',
            render: (record) => <strong>{record.reference || record.recipient_name || `Entrega #${record.id}`}</strong>,
        },
        {
            key: 'customer',
            label: 'Cliente',
            render: (record) => record.customer_name || record.recipient_name || 'Sem cliente',
        },
        {
            key: 'address',
            label: 'Endereco',
            render: (record) => record.channel === 'retirada' ? 'Retirada no balcao' : (record.address || 'Endereco nao informado'),
        },
        {
            key: 'total',
            label: 'Valor',
            align: 'right',
            render: (record) => formatMoney(parseNumber(record.order_total, 0) + parseNumber(record.delivery_fee, 0)),
        },
        {
            key: 'courier_name',
            label: 'Entregador',
            render: (record) => record.courier_name || 'Nao definido',
        },
        {
            key: 'status',
            label: 'Status',
            render: (record) => <StatusBadge compact label={deliveryStatusLabel(record.status)} tone={deliveryStatusTone(record.status)} />,
        },
    ]), [])

    async function handleApplyFilters() {
        setLoading(true)
        setFeedback(null)

        try {
            const nextSearch = searchControl.apply()
            const response = await apiRequest(buildRecordsUrl(moduleKey), {
                params: {
                    applied: 1,
                    status: activeTab,
                    from: range.from || undefined,
                    to: range.to || undefined,
                },
            })

            setRecords(response.records || [])
            setAppliedTab(activeTab)
            setAppliedSearch(nextSearch)
            setAppliedRange({ ...range })
            setSelectedId(null)
            setHasLoadedRecords(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    function handleResetFilters() {
        searchControl.clear()
        setActiveTab('pending')
        setAppliedTab('pending')
        setAppliedSearch('')
        setRange({ from: '', to: '' })
        setAppliedRange({ from: '', to: '' })
        setRecords([])
        setSelectedId(null)
        setHasLoadedRecords(false)
        setLoading(false)
        setFeedback(null)
    }

    function openNewDrawer() {
        setForm(emptyForm)
        setSelectedId(null)
        setDrawerOpen(true)
    }

    function openRecordDrawer(record) {
        setSelectedId(record.id)
        setForm(normalizeRecord(record))
        setDrawerOpen(true)
    }

    function closeDrawer() {
        setDrawerOpen(false)
        setForm(emptyForm)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, customer_id: form.customer_id ? Number(form.customer_id) : null, delivery_fee: parseNumber(form.delivery_fee, 0), order_total: parseNumber(form.order_total, 0), scheduled_for: form.scheduled_for || null }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setHasLoadedRecords(true)
            setSelectedId(response.record.id)
            setForm(normalizeRecord(response.record))
            setDrawerOpen(false)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(record = form) {
        if (!record?.id) return

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover entrega',
            message: `Remover a entrega "${record.reference || record.recipient_name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) return
        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))
            if (String(form.id) === String(record.id)) {
                closeDrawer()
            }
            if (String(selectedId) === String(record.id)) {
                setSelectedId(null)
            }
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function handleStatusChange(record, status) {
        try {
            const payloadData = {
                customer_id: record.customer_id ?? null,
                reference: record.reference || '',
                status,
                channel: record.channel || 'delivery',
                recipient_name: record.recipient_name || '',
                phone: record.phone || '',
                courier_name: record.courier_name || '',
                address: record.address || '',
                neighborhood: record.neighborhood || '',
                delivery_fee: parseNumber(record.delivery_fee, 0),
                order_total: parseNumber(record.order_total, 0),
                scheduled_for: record.scheduled_for || null,
                notes: record.notes || '',
            }
            const response = await apiRequest(buildRecordsUrl(moduleKey, record.id), { method: 'put', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))

            if (String(form.id) === String(record.id)) {
                setForm(normalizeRecord(response.record))
            }
            setSelectedId(response.record.id)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="ui-list-page-shell">
            <div className="ui-list-page-main">
                <PageHeader
                    title="Entregas"
                    search={{
                        placeholder: 'Buscar por codigo ou cliente',
                        value: searchControl.draftValue,
                        onChange: searchControl.setDraftValue,
                    }}
                    filters={[
                        { key: 'pending', value: 'pending', label: 'Pendentes', count: statusCounts.pending },
                        { key: 'dispatched', value: 'dispatched', label: 'Em rota', count: statusCounts.dispatched },
                        { key: 'delivered', value: 'delivered', label: 'Entregues', count: statusCounts.delivered },
                    ]}
                    activeFilter={activeTab}
                    onFilterChange={setActiveTab}
                    dateRange={{
                        from: range.from,
                        to: range.to,
                        onChange: setRange,
                    }}
                    quickDates
                    onApply={handleApplyFilters}
                    onReset={handleResetFilters}
                />

                <Feedback feedback={feedback} />

                <section className="ui-list-page-table-card">
                    <DataTable
                        columns={tableColumns}
                        rows={filteredRecords}
                        rowKey="id"
                        selectedRowKey={selectedId}
                        onRowClick={(record) => setSelectedId(record.id)}
                        emptyMessage={
                            loading
                                ? 'Buscando entregas'
                                : hasLoadedRecords
                                    ? 'Nenhuma entrega encontrada'
                                    : 'Clique em Filtrar para buscar'
                        }
                        actions={(record) => [
                            {
                                key: 'view',
                                icon: 'fa-eye',
                                label: 'Ver detalhes',
                                tone: 'primary',
                                onClick: () => openRecordDrawer(record),
                            },
                        ]}
                    />
                </section>
            </div>

            <ActionSidebar
                storageKey="delivery-workspace"
                actions={[
                    {
                        key: 'create',
                        icon: 'fa-plus',
                        label: 'Nova entrega',
                        tone: 'primary',
                        onClick: openNewDrawer,
                    },
                    {
                        key: 'view',
                        icon: 'fa-eye',
                        label: 'Ver detalhes',
                        disabled: !selectedRecord,
                        onClick: () => selectedRecord && openRecordDrawer(selectedRecord),
                    },
                    {
                        key: 'dispatch',
                        icon: 'fa-route',
                        label: 'Iniciar rota',
                        disabled: !selectedRecord || selectedRecord.status === 'dispatched' || selectedRecord.status === 'delivered',
                        onClick: () => selectedRecord && handleStatusChange(selectedRecord, 'dispatched'),
                    },
                    {
                        key: 'deliver',
                        icon: 'fa-circle-check',
                        label: 'Marcar entregue',
                        tone: 'success',
                        disabled: !selectedRecord || selectedRecord.status === 'delivered',
                        onClick: () => selectedRecord && handleStatusChange(selectedRecord, 'delivered'),
                    },
                    {
                        key: 'cancel',
                        icon: 'fa-xmark',
                        label: 'Cancelar',
                        tone: 'danger',
                        dividerBefore: true,
                        disabled: !selectedRecord,
                        onClick: () => selectedRecord && handleDelete(selectedRecord),
                    },
                ]}
            />

            <ActionDrawer
                open={drawerOpen}
                title={form.id ? 'Detalhes da entrega' : 'Nova entrega'}
                description={form.id ? 'Edite dados, status e observacoes.' : 'Preencha os dados basicos para entrar na fila.'}
                icon="fa-motorcycle"
                size="lg"
                onClose={closeDrawer}
            >
                <div className="ops-delivery-drawer">
                    {form.id ? (
                        <div className="ops-delivery-drawer-top">
                            <StatusBadge label={deliveryStatusLabel(form.status)} tone={deliveryStatusTone(form.status)} />
                            <StatusBadge label={form.channel === 'retirada' ? 'Retirada' : 'Delivery'} tone={form.channel === 'retirada' ? 'info' : 'warning'} />
                        </div>
                    ) : null}

                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Cliente</span><select value={form.customer_id} onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}><option value="">Nao informado</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <label><span>Referencia</span><input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="pending">Pendente</option><option value="dispatched">Em rota</option><option value="delivered">Entregue</option></select></label>
                        <label><span>Canal</span><select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}><option value="delivery">Delivery</option><option value="retirada">Retirada</option></select></label>
                        <label><span>Destinatario</span><input value={form.recipient_name} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} /></label>
                        <label><span>Telefone</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                        <label className="span-2"><span>Endereco</span><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required={form.channel !== 'retirada'} /></label>
                        <label><span>Bairro</span><input value={form.neighborhood} onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))} /></label>
                        <label><span>Entregador</span><input value={form.courier_name} onChange={(event) => setForm((current) => ({ ...current, courier_name: event.target.value }))} /></label>
                        <label><span>Taxa</span><input type="number" min="0" step="0.01" value={form.delivery_fee} onChange={(event) => setForm((current) => ({ ...current, delivery_fee: event.target.value }))} /></label>
                        <label><span>Total do pedido</span><input type="number" min="0" step="0.01" value={form.order_total} onChange={(event) => setForm((current) => ({ ...current, order_total: event.target.value }))} /></label>
                        <label className="span-2"><span>Agendado para</span><input type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm((current) => ({ ...current, scheduled_for: event.target.value }))} /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <div className="ops-workspace-actions span-2">
                            <button type="button" className="ui-button-ghost" onClick={closeDrawer}>Cancelar</button>
                            {form.id ? <button type="button" className="ui-button-ghost danger" onClick={() => handleDelete(form)}>Excluir</button> : null}
                            {form.id && form.status !== 'dispatched' ? (
                                <button type="button" className="ui-button-ghost" onClick={() => handleStatusChange(form, 'dispatched')}>
                                    Iniciar rota
                                </button>
                            ) : null}
                            {form.id && form.status !== 'delivered' ? (
                                <button type="button" className="ui-button-ghost" onClick={() => handleStatusChange(form, 'delivered')}>
                                    Marcar entregue
                                </button>
                            ) : null}
                            <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar entrega' : 'Salvar entrega'}</button>
                        </div>
                    </form>
                </div>
            </ActionDrawer>
        </div>
    )
}

export function PurchasesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, supplier_id: '', status: 'draft', expected_at: '', freight: '0', notes: '', items: [] }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('draft')
    const [workspaceMode, setWorkspaceMode] = useState('manual')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const subtotalPreview = useMemo(() => form.items.reduce((total, item) => total + parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0), 0), [form.items])
    const totalPreview = subtotalPreview + parseNumber(form.freight, 0)
    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, supplier_id: form.supplier_id ? Number(form.supplier_id) : null, expected_at: form.expected_at || null, freight: parseNumber(form.freight, 0), items: form.items.map((item) => ({ product_id: Number(item.product_id), quantity: parseNumber(item.quantity, 0), unit_cost: parseNumber(item.unit_cost, 0) })) }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, supplier_id: response.record.supplier_id ? String(response.record.supplier_id) : '', expected_at: ensureDate(response.record.expected_at), freight: String(response.record.freight || 0), items: (response.record.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity), unit_cost: String(item.unit_cost) })) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id) return

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover compra',
            message: `Remover a compra "${form.code || form.id}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) return
        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <div className="ops-workspace-stack">
            <SectionTabs tabs={[{ key: 'manual', label: 'Planejamento', icon: 'fa-cart-shopping' }, { key: 'incoming_nfe', label: 'NF-e recebidas', icon: 'fa-file-invoice' }]} activeTab={workspaceMode} onChange={setWorkspaceMode} />
            {workspaceMode === 'incoming_nfe' ? <IncomingNfeWorkspace payload={payload} /> : null}
            {workspaceMode !== 'manual' ? null : (
                <>
                    <SectionTabs tabs={[{ key: 'draft', label: 'Rascunhos', icon: 'fa-file-lines' }, { key: 'ordered', label: 'Solicitadas', icon: 'fa-cart-shopping' }, { key: 'received', label: 'Recebidas', icon: 'fa-box-open' }]} activeTab={activeTab} onChange={setActiveTab} />
                    <div className="ops-workspace-grid two-columns">
                        <section className="ops-workspace-panel">
                            <FeedbackHeader title="Compras" subtitle={`${filteredRecords.length} registro(s)`} />
                            <Feedback feedback={feedback} />
                            <div className="ops-workspace-list-stack">
                                {filteredRecords.length ? filteredRecords.map((record) => (
                                    <ListCard
                                        key={record.id}
                                        active={form.id === record.id}
                                        onClick={() => setForm({ ...emptyForm, ...record, supplier_id: record.supplier_id ? String(record.supplier_id) : '', expected_at: ensureDate(record.expected_at), freight: String(record.freight || 0), items: (record.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity), unit_cost: String(item.unit_cost) })) })}
                                        title={record.code}
                                        badge={<Badge tone={record.stock_applied_at ? 'success' : record.status === 'received' ? 'info' : 'warning'}>{record.status}</Badge>}
                                        description={record.supplier_name || 'Sem origem definida'}
                                        meta={[`${record.items?.length || 0} item(ns)`, formatMoney(record.total || 0)]}
                                    />
                                )) : <EmptyState title="Sem compras" text="Nenhum pedido nesta etapa." />}
                            </div>
                        </section>
                        <section className="ops-workspace-panel">
                            <FeedbackHeader title={form.id ? 'Editar compra' : 'Nova compra'} subtitle="Itens e recebimento" />
                            <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                                <label><FieldLabel icon="fa-truck-ramp-box" text="Fornecedor" /><select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}><option value="">Nao informado</option>{payload.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                                <label><FieldLabel icon="fa-flag" text="Status" /><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="ordered">Solicitada</option><option value="received">Recebida</option></select></label>
                                <label><FieldLabel icon="fa-calendar-day" text="Previsao" /><input type="date" value={form.expected_at} onChange={(event) => setForm((current) => ({ ...current, expected_at: event.target.value }))} /></label>
                                <label className="span-2"><FieldLabel icon="fa-note-sticky" text="Observacoes" /><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                                <PurchaseItemsEditor products={payload.products} items={form.items} onChange={(items) => setForm((current) => ({ ...current, items }))} />
                                <label><FieldLabel icon="fa-truck-fast" text="Frete" /><input type="number" min="0" step="0.01" value={form.freight} onChange={(event) => setForm((current) => ({ ...current, freight: event.target.value }))} /></label>
                                <div className="ops-workspace-total-bar"><span>Subtotal / Total</span><strong>{`${formatMoney(subtotalPreview)} / ${formatMoney(totalPreview)}`}</strong></div>
                                {form.stock_applied_at ? <div className="ops-workspace-inline-alert span-2">Esta compra ja entrou no estoque e nao pode mais ser alterada.</div> : null}
                                <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar compra' : 'Salvar compra'}</button></div>
                            </form>
                        </section>
                    </div>
                </>
            )}
        </div>
    )
}
