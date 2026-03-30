import { useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
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
    MetricGrid,
    parseNumber,
    SectionTabs,
    upsertRecord,
} from './shared'

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

function ServiceItemsEditor({ items, onChange }) {
    const [draft, setDraft] = useState({ description: '', quantity: '1', unit_price: '0' })

    function addItem() {
        if (!draft.description) return
        onChange([...items, { description: draft.description, quantity: String(parseNumber(draft.quantity, 1)), unit_price: String(parseNumber(draft.unit_price, 0)) }])
        setDraft({ description: '', quantity: '1', unit_price: '0' })
    }

    return (
        <>
            <div className="ops-workspace-inline-adder span-2">
                <input value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Peca ou servico" />
                <input type="number" min="0.001" step="0.001" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} />
                <input type="number" min="0" step="0.01" value={draft.unit_price} onChange={(event) => setDraft((current) => ({ ...current, unit_price: event.target.value }))} />
                <button type="button" className="ui-button-ghost" onClick={addItem}>Adicionar</button>
            </div>
            <div className="ops-workspace-table-wrap span-2">
                <table className="ui-table">
                    <thead><tr><th>Descricao</th><th>Qtd</th><th>Valor unit.</th><th>Total</th><th>Acao</th></tr></thead>
                    <tbody>
                        {items.length ? items.map((item, index) => (
                            <tr key={`${item.description}-${index}`}>
                                <td><input value={item.description} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, description: event.target.value } : entry)))} /></td>
                                <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, quantity: event.target.value } : entry)))} /></td>
                                <td><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? { ...entry, unit_price: event.target.value } : entry)))} /></td>
                                <td>{formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_price, 0))}</td>
                                <td><button type="button" className="ui-button-ghost danger" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}>Remover</button></td>
                            </tr>
                        )) : <tr><td colSpan="5">Nenhum item adicionado.</td></tr>}
                    </tbody>
                </table>
            </div>
        </>
    )
}

export function WeighingWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, product_id: '', customer_id: '', reference: '', status: 'draft', gross_weight: '0', tare_weight: '0', unit_price: '', notes: '', weighed_at: '' }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('draft')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const selectedProduct = payload.products.find((product) => String(product.id) === String(form.product_id))
    const netWeight = Math.max(0, parseNumber(form.gross_weight, 0) - parseNumber(form.tare_weight, 0))
    const totalPreview = netWeight * parseNumber(form.unit_price || selectedProduct?.sale_price, 0)
    const metrics = useMemo(() => [
        { label: 'Pesagens', value: records.length, caption: 'Lancamentos do modulo' },
        { label: 'Confirmadas', value: records.filter((record) => record.status === 'confirmed').length, caption: 'Prontas para atendimento' },
        { label: 'Total previsto', value: records.reduce((total, record) => total + Number(record.total || 0), 0), caption: 'Soma das pesagens', format: 'money' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, product_id: Number(form.product_id), customer_id: form.customer_id ? Number(form.customer_id) : null, gross_weight: parseNumber(form.gross_weight, 0), tare_weight: parseNumber(form.tare_weight, 0), unit_price: parseNumber(form.unit_price || selectedProduct?.sale_price, 0), weighed_at: form.weighed_at || null }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, product_id: String(response.record.product_id), customer_id: response.record.customer_id ? String(response.record.customer_id) : '', gross_weight: String(response.record.gross_weight), tare_weight: String(response.record.tare_weight), unit_price: String(response.record.unit_price), weighed_at: ensureDateTime(response.record.weighed_at) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a pesagem "${form.reference || form.product_id}"?`)) return
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
            <SectionTabs tabs={[{ key: 'draft', label: 'Rascunhos', icon: 'fa-scale-balanced' }, { key: 'confirmed', label: 'Confirmadas', icon: 'fa-check-double' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Pesagens" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, product_id: String(record.product_id), customer_id: record.customer_id ? String(record.customer_id) : '', gross_weight: String(record.gross_weight), tare_weight: String(record.tare_weight), unit_price: String(record.unit_price), weighed_at: ensureDateTime(record.weighed_at) })}
                                title={record.product_name || 'Produto'}
                                badge={<Badge tone={record.status === 'confirmed' ? 'success' : 'warning'}>{record.status === 'confirmed' ? 'Confirmada' : 'Rascunho'}</Badge>}
                                description={record.customer_name || 'Sem cliente'}
                                meta={[`${formatNumber(record.net_weight)} ${record.unit || 'KG'}`, formatMoney(record.total || 0)]}
                            />
                        )) : <EmptyState title="Sem pesagens nesse status" text="Registre o peso bruto, a tara e o liquido para vendas por peso." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar pesagem' : 'Nova pesagem'} subtitle="Operacao por peso com total previsto" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Produto</span><select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value, unit_price: current.unit_price || String(payload.products.find((product) => String(product.id) === String(event.target.value))?.sale_price || '') }))} required><option value="">Selecione</option>{payload.products.map((product) => <option key={product.id} value={product.id}>{getProductOptionLabel(product)}</option>)}</select></label>
                        <label><span>Cliente</span><select value={form.customer_id} onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}><option value="">Nao informado</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <label><span>Referencia</span><input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="confirmed">Confirmada</option></select></label>
                        <label><span>Peso bruto</span><input type="number" min="0.001" step="0.001" value={form.gross_weight} onChange={(event) => setForm((current) => ({ ...current, gross_weight: event.target.value }))} required /></label>
                        <label><span>Tara</span><input type="number" min="0" step="0.001" value={form.tare_weight} onChange={(event) => setForm((current) => ({ ...current, tare_weight: event.target.value }))} /></label>
                        <label><span>Preco por unidade</span><input type="number" min="0" step="0.01" value={form.unit_price} onChange={(event) => setForm((current) => ({ ...current, unit_price: event.target.value }))} /></label>
                        <label><span>Pesado em</span><input type="datetime-local" value={form.weighed_at} onChange={(event) => setForm((current) => ({ ...current, weighed_at: event.target.value }))} /></label>
                        <div className="ops-workspace-total-bar span-2"><span>Liquido / Total previsto</span><strong>{`${formatNumber(netWeight)} ${selectedProduct?.unit || 'KG'} · ${formatMoney(totalPreview)}`}</strong></div>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar pesagem' : 'Salvar pesagem'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function DeliveryWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, customer_id: '', reference: '', status: 'pending', channel: 'delivery', recipient_name: '', phone: '', courier_name: '', address: '', neighborhood: '', delivery_fee: '0', order_total: '0', scheduled_for: '', notes: '' }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('pending')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const metrics = useMemo(() => [
        { label: 'Entregas', value: records.length, caption: 'Cadastros totais' },
        { label: 'Em rota', value: records.filter((record) => record.status === 'dispatched').length, caption: 'Pedidos em deslocamento' },
        { label: 'Taxas', value: records.reduce((total, record) => total + Number(record.delivery_fee || 0), 0), caption: 'Total em taxas', format: 'money' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, customer_id: form.customer_id ? Number(form.customer_id) : null, delivery_fee: parseNumber(form.delivery_fee, 0), order_total: parseNumber(form.order_total, 0), scheduled_for: form.scheduled_for || null }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, customer_id: response.record.customer_id ? String(response.record.customer_id) : '', delivery_fee: String(response.record.delivery_fee || 0), order_total: String(response.record.order_total || 0), scheduled_for: ensureDateTime(response.record.scheduled_for) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a entrega "${form.reference || form.recipient_name}"?`)) return
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
            <SectionTabs tabs={[{ key: 'pending', label: 'Pendentes', icon: 'fa-motorcycle' }, { key: 'dispatched', label: 'Em rota', icon: 'fa-route' }, { key: 'delivered', label: 'Entregues', icon: 'fa-house-chimney-check' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Fila de entrega" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, customer_id: record.customer_id ? String(record.customer_id) : '', delivery_fee: String(record.delivery_fee || 0), order_total: String(record.order_total || 0), scheduled_for: ensureDateTime(record.scheduled_for) })}
                                title={record.reference || record.recipient_name || 'Entrega'}
                                badge={<Badge tone={record.status === 'delivered' ? 'success' : record.status === 'dispatched' ? 'info' : 'warning'}>{record.status}</Badge>}
                                description={record.address}
                                meta={[record.customer_name || 'Sem cliente', formatMoney(parseNumber(record.order_total, 0) + parseNumber(record.delivery_fee, 0))]}
                            />
                        )) : <EmptyState title="Sem entregas nesse status" text="Acompanhe entrega, retirada e status do atendimento externo." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar entrega' : 'Nova entrega'} subtitle="Painel do delivery" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Cliente</span><select value={form.customer_id} onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}><option value="">Nao informado</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <label><span>Referencia</span><input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="pending">Pendente</option><option value="dispatched">Em rota</option><option value="delivered">Entregue</option></select></label>
                        <label><span>Canal</span><select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}><option value="delivery">Delivery</option><option value="retirada">Retirada</option></select></label>
                        <label><span>Destinatario</span><input value={form.recipient_name} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} /></label>
                        <label><span>Telefone</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                        <label className="span-2"><span>Endereco</span><input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} required /></label>
                        <label><span>Bairro</span><input value={form.neighborhood} onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))} /></label>
                        <label><span>Entregador</span><input value={form.courier_name} onChange={(event) => setForm((current) => ({ ...current, courier_name: event.target.value }))} /></label>
                        <label><span>Taxa</span><input type="number" min="0" step="0.01" value={form.delivery_fee} onChange={(event) => setForm((current) => ({ ...current, delivery_fee: event.target.value }))} /></label>
                        <label><span>Total do pedido</span><input type="number" min="0" step="0.01" value={form.order_total} onChange={(event) => setForm((current) => ({ ...current, order_total: event.target.value }))} /></label>
                        <label className="span-2"><span>Agendado para</span><input type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm((current) => ({ ...current, scheduled_for: event.target.value }))} /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar entrega' : 'Salvar entrega'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function PurchasesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, supplier_id: '', producer_id: '', status: 'draft', expected_at: '', freight: '0', notes: '', items: [] }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('draft')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const subtotalPreview = useMemo(() => form.items.reduce((total, item) => total + parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0), 0), [form.items])
    const totalPreview = subtotalPreview + parseNumber(form.freight, 0)
    const metrics = useMemo(() => [
        { label: 'Compras', value: records.length, caption: 'Pedidos cadastrados' },
        { label: 'Recebidas', value: records.filter((record) => record.status === 'received').length, caption: 'Ja entrou no estoque' },
        { label: 'Total', value: records.reduce((total, record) => total + Number(record.total || 0), 0), caption: 'Volume de compras', format: 'money' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, supplier_id: form.supplier_id ? Number(form.supplier_id) : null, producer_id: form.producer_id ? Number(form.producer_id) : null, expected_at: form.expected_at || null, freight: parseNumber(form.freight, 0), items: form.items.map((item) => ({ product_id: Number(item.product_id), quantity: parseNumber(item.quantity, 0), unit_cost: parseNumber(item.unit_cost, 0) })) }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, supplier_id: response.record.supplier_id ? String(response.record.supplier_id) : '', producer_id: response.record.producer_id ? String(response.record.producer_id) : '', expected_at: ensureDate(response.record.expected_at), freight: String(response.record.freight || 0), items: (response.record.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity), unit_cost: String(item.unit_cost) })) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a compra "${form.code || form.id}"?`)) return
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
            <SectionTabs tabs={[{ key: 'draft', label: 'Rascunhos', icon: 'fa-file-lines' }, { key: 'ordered', label: 'Solicitadas', icon: 'fa-cart-shopping' }, { key: 'received', label: 'Recebidas', icon: 'fa-box-open' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Compras" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, supplier_id: record.supplier_id ? String(record.supplier_id) : '', producer_id: record.producer_id ? String(record.producer_id) : '', expected_at: ensureDate(record.expected_at), freight: String(record.freight || 0), items: (record.items || []).map((item) => ({ ...item, product_id: String(item.product_id), quantity: String(item.quantity), unit_cost: String(item.unit_cost) })) })}
                                title={record.code}
                                badge={<Badge tone={record.stock_applied_at ? 'success' : record.status === 'received' ? 'info' : 'warning'}>{record.status}</Badge>}
                                description={record.supplier_name || record.producer_name || 'Sem origem definida'}
                                meta={[`${record.items?.length || 0} item(ns)`, formatMoney(record.total || 0)]}
                            />
                        )) : <EmptyState title="Sem compras nesse status" text="Cadastre entradas planejadas e receba itens direto no estoque." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar compra' : 'Nova compra'} subtitle="Pedido com entrada automatica no estoque" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Fornecedor</span><select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}><option value="">Nao informado</option>{payload.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                        <label><span>Produtor</span><select value={form.producer_id} onChange={(event) => setForm((current) => ({ ...current, producer_id: event.target.value }))}><option value="">Nao informado</option>{payload.producers.map((producer) => <option key={producer.id} value={producer.id}>{producer.name}</option>)}</select></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="ordered">Solicitada</option><option value="received">Recebida</option></select></label>
                        <label><span>Previsao</span><input type="date" value={form.expected_at} onChange={(event) => setForm((current) => ({ ...current, expected_at: event.target.value }))} /></label>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <PurchaseItemsEditor products={payload.products} items={form.items} onChange={(items) => setForm((current) => ({ ...current, items }))} />
                        <label><span>Frete</span><input type="number" min="0" step="0.01" value={form.freight} onChange={(event) => setForm((current) => ({ ...current, freight: event.target.value }))} /></label>
                        <div className="ops-workspace-total-bar"><span>Subtotal / Total</span><strong>{`${formatMoney(subtotalPreview)} · ${formatMoney(totalPreview)}`}</strong></div>
                        {form.stock_applied_at ? <div className="ops-workspace-inline-alert span-2">Esta compra ja entrou no estoque e nao pode mais ser alterada.</div> : null}
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar compra' : 'Salvar compra'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function ServiceOrdersWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, customer_id: '', status: 'open', equipment: '', issue_description: '', diagnosis: '', resolution: '', technician_name: '', labor_total: '0', due_at: '', notes: '', items: [] }
    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('open')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => records.filter((record) => record.status === activeTab), [records, activeTab])
    const partsPreview = useMemo(() => form.items.reduce((total, item) => total + parseNumber(item.quantity, 0) * parseNumber(item.unit_price, 0), 0), [form.items])
    const totalPreview = partsPreview + parseNumber(form.labor_total, 0)
    const metrics = useMemo(() => [
        { label: 'OS', value: records.length, caption: 'Ordens cadastradas' },
        { label: 'Concluidas', value: records.filter((record) => record.status === 'completed').length, caption: 'Servico encerrado' },
        { label: 'Faturamento', value: records.reduce((total, record) => total + Number(record.total || 0), 0), caption: 'Valor acumulado', format: 'money' },
    ], [records])

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = { ...form, customer_id: form.customer_id ? Number(form.customer_id) : null, labor_total: parseNumber(form.labor_total, 0), due_at: form.due_at || null, items: form.items.map((item) => ({ description: item.description, quantity: parseNumber(item.quantity, 0), unit_price: parseNumber(item.unit_price, 0) })) }
            const response = form.id ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData }) : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record, customer_id: response.record.customer_id ? String(response.record.customer_id) : '', labor_total: String(response.record.labor_total || 0), due_at: ensureDate(response.record.due_at), items: (response.record.items || []).map((item) => ({ ...item, quantity: String(item.quantity), unit_price: String(item.unit_price) })) })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id || !window.confirm(`Remover a OS "${form.code || form.equipment}"?`)) return
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
            <SectionTabs tabs={[{ key: 'open', label: 'Abertas', icon: 'fa-screwdriver-wrench' }, { key: 'in_service', label: 'Em servico', icon: 'fa-gears' }, { key: 'completed', label: 'Concluidas', icon: 'fa-check-double' }]} activeTab={activeTab} onChange={setActiveTab} />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Ordens de servico" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <ListCard
                                key={record.id}
                                active={form.id === record.id}
                                onClick={() => setForm({ ...emptyForm, ...record, customer_id: record.customer_id ? String(record.customer_id) : '', labor_total: String(record.labor_total || 0), due_at: ensureDate(record.due_at), items: (record.items || []).map((item) => ({ ...item, quantity: String(item.quantity), unit_price: String(item.unit_price) })) })}
                                title={`${record.code} · ${record.equipment}`}
                                badge={<Badge tone={record.status === 'completed' ? 'success' : record.status === 'in_service' ? 'info' : 'warning'}>{record.status}</Badge>}
                                description={record.customer_name || 'Sem cliente'}
                                meta={[record.technician_name || 'Sem tecnico', formatMoney(record.total || 0)]}
                            />
                        )) : <EmptyState title="Sem OS nesse status" text="Abra atendimentos tecnicos com diagnostico, pecas e total consolidado." />}
                    </div>
                </section>
                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar OS' : 'Nova OS'} subtitle="Fluxo tecnico e financeiro" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label><span>Cliente</span><select value={form.customer_id} onChange={(event) => setForm((current) => ({ ...current, customer_id: event.target.value }))}><option value="">Nao informado</option>{payload.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
                        <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="open">Aberta</option><option value="in_service">Em servico</option><option value="completed">Concluida</option></select></label>
                        <label className="span-2"><span>Equipamento / item</span><input value={form.equipment} onChange={(event) => setForm((current) => ({ ...current, equipment: event.target.value }))} required /></label>
                        <label className="span-2"><span>Problema relatado</span><textarea rows="3" value={form.issue_description} onChange={(event) => setForm((current) => ({ ...current, issue_description: event.target.value }))} required /></label>
                        <label className="span-2"><span>Diagnostico</span><textarea rows="3" value={form.diagnosis} onChange={(event) => setForm((current) => ({ ...current, diagnosis: event.target.value }))} /></label>
                        <label className="span-2"><span>Resolucao</span><textarea rows="3" value={form.resolution} onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))} /></label>
                        <label><span>Tecnico</span><input value={form.technician_name} onChange={(event) => setForm((current) => ({ ...current, technician_name: event.target.value }))} /></label>
                        <label><span>Prazo</span><input type="date" value={form.due_at} onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))} /></label>
                        <ServiceItemsEditor items={form.items} onChange={(items) => setForm((current) => ({ ...current, items }))} />
                        <label><span>Mao de obra</span><input type="number" min="0" step="0.01" value={form.labor_total} onChange={(event) => setForm((current) => ({ ...current, labor_total: event.target.value }))} /></label>
                        <div className="ops-workspace-total-bar"><span>Pecas / Total</span><strong>{`${formatMoney(partsPreview)} · ${formatMoney(totalPreview)}`}</strong></div>
                        <label className="span-2"><span>Observacoes</span><textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
                        <div className="ops-workspace-actions span-2"><button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>Limpar</button>{form.id ? <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>Excluir</button> : null}<button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Atualizar OS' : 'Salvar OS'}</button></div>
                    </form>
                </section>
            </div>
        </div>
    )
}
