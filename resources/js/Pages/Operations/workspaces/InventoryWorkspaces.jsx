import { useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    ensureDateTime,
    Feedback,
    FeedbackHeader,
    getProductOptionLabel,
    ListCard,
    MetricGrid,
    parseNumber,
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

function updateStockInProducts(products, productId, stockAfter) {
    if (!productId || stockAfter == null) {
        return products
    }

    return products.map((product) =>
        String(product.id) === String(productId)
            ? { ...product, stock_quantity: Number(stockAfter) }
            : product,
    )
}

export function StockInboundWorkspace({ moduleKey, payload }) {
    const initialLocation = payload.locations?.[0] || ''
    const emptyForm = {
        product_id: '',
        quantity: '1',
        unit_cost: '',
        supplier_id: '',
        document: '',
        location: initialLocation,
        notes: '',
        occurred_at: '',
    }

    const [records, setRecords] = useState(payload.records || [])
    const [products, setProducts] = useState(payload.products || [])
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const selectedProduct = useMemo(
        () => products.find((product) => String(product.id) === String(form.product_id)),
        [products, form.product_id],
    )

    const metrics = useMemo(
        () => [
            { label: 'Entradas', value: records.length, caption: 'Lancamentos registrados' },
            { label: 'Quantidade recebida', value: records.reduce((total, record) => total + Number(record.quantity || 0), 0), caption: 'Soma do periodo', format: 'number' },
            { label: 'Valor de entrada', value: records.reduce((total, record) => total + (Number(record.quantity || 0) * Number(record.unit_cost || 0)), 0), caption: 'Base de custo informada', format: 'money' },
        ],
        [records],
    )

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = {
                ...form,
                product_id: Number(form.product_id),
                quantity: parseNumber(form.quantity, 0),
                unit_cost: form.unit_cost === '' ? null : parseNumber(form.unit_cost, 0),
                supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
                document: form.document || null,
                location: form.location || null,
                notes: form.notes || null,
                occurred_at: form.occurred_at || null,
            }

            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setProducts((current) => updateStockInProducts(current, response.record.product_id, response.record.stock_after))
            setForm({ ...emptyForm, location: form.location || initialLocation })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="ops-workspace-stack">
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Historico de entradas" subtitle={`${records.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {records.length ? (
                            records.map((record) => (
                                <ListCard
                                    key={record.id}
                                    active={false}
                                    onClick={() => null}
                                    title={`${record.product_name || 'Produto'} - ${formatNumber(record.quantity || 0)} ${record.unit || 'UN'}`}
                                    badge={<Badge tone="success">{record.type_label}</Badge>}
                                    description={record.document ? `Documento: ${record.document}` : record.supplier_name || 'Entrada manual'}
                                    meta={[
                                        record.location || 'Sem local informado',
                                        `${formatNumber(record.stock_before || 0)} -> ${formatNumber(record.stock_after || 0)}`,
                                    ]}
                                />
                            ))
                        ) : (
                            <EmptyState title="Nenhuma entrada registrada" text="Lance a primeira entrada para atualizar o estoque em tempo real." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Nova entrada de estoque" subtitle="Recebimento de produtos com impacto imediato" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-boxes-stacked" text="Produto" />
                            <select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value, unit_cost: current.unit_cost || String(products.find((product) => String(product.id) === String(event.target.value))?.cost_price || '') }))} required>
                                <option value="">Selecione</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {getProductOptionLabel(product)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel icon="fa-weight-hanging" text="Quantidade" />
                            <input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
                        </label>
                        <label>
                            <FieldLabel icon="fa-coins" text="Custo unitario" />
                            <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(event) => setForm((current) => ({ ...current, unit_cost: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-truck-ramp-box" text="Fornecedor" />
                            <select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}>
                                <option value="">Nao informado</option>
                                {payload.suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel icon="fa-file-invoice" text="Documento" />
                            <input value={form.document} onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))} placeholder="NF, pedido ou protocolo" />
                        </label>
                        <label>
                            <FieldLabel icon="fa-warehouse" text="Local" />
                            <select value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}>
                                <option value="">Nao informado</option>
                                {(payload.locations || []).map((location) => (
                                    <option key={location} value={location}>
                                        {location}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-clock" text="Data e hora" />
                            <input type="datetime-local" value={form.occurred_at} onChange={(event) => setForm((current) => ({ ...current, occurred_at: event.target.value }))} />
                        </label>
                        <div className="ops-workspace-total-bar span-2">
                            <span>Saldo atual do produto</span>
                            <strong>{`${formatNumber(selectedProduct?.stock_quantity || 0)} ${selectedProduct?.unit || 'UN'}`}</strong>
                        </div>
                        <label className="span-2">
                            <FieldLabel icon="fa-note-sticky" text="Observacoes" />
                            <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <button type="button" className="ui-button-ghost" onClick={() => setForm({ ...emptyForm, location: form.location || initialLocation })}>
                                Limpar
                            </button>
                            <button type="submit" className="ui-button" disabled={saving}>
                                {saving ? 'Salvando...' : 'Registrar entrada'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function StockAdjustmentsWorkspace({ moduleKey, payload }) {
    const initialLocation = payload.locations?.[0] || ''
    const emptyForm = {
        product_id: '',
        counted_quantity: '',
        reason: '',
        location: initialLocation,
        notes: '',
        occurred_at: '',
    }

    const [records, setRecords] = useState(payload.records || [])
    const [products, setProducts] = useState(payload.products || [])
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const selectedProduct = useMemo(
        () => products.find((product) => String(product.id) === String(form.product_id)),
        [products, form.product_id],
    )

    const countedValue = parseNumber(form.counted_quantity, 0)
    const expectedValue = Number(selectedProduct?.stock_quantity || 0)
    const adjustmentPreview = countedValue - expectedValue

    const metrics = useMemo(
        () => [
            { label: 'Conferencias', value: records.filter((record) => record.type === 'stock_conference').length, caption: 'Sem ajuste de saldo' },
            { label: 'Ajustes', value: records.filter((record) => record.type === 'manual_adjustment').length, caption: 'Com impacto no estoque' },
            { label: 'Delta acumulado', value: records.reduce((total, record) => total + Number(record.quantity_delta || 0), 0), caption: 'Somatorio dos ajustes', format: 'number' },
        ],
        [records],
    )

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = {
                ...form,
                product_id: Number(form.product_id),
                counted_quantity: parseNumber(form.counted_quantity, 0),
                reason: form.reason,
                location: form.location || null,
                notes: form.notes || null,
                occurred_at: form.occurred_at || null,
            }

            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setProducts((current) => updateStockInProducts(current, response.record.product_id, response.record.stock_after))
            setForm({ ...emptyForm, location: form.location || initialLocation })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="ops-workspace-stack">
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Historico de conferencias" subtitle={`${records.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {records.length ? (
                            records.map((record) => (
                                <ListCard
                                    key={record.id}
                                    active={false}
                                    onClick={() => null}
                                    title={record.product_name || 'Produto'}
                                    badge={(
                                        <Badge tone={record.type === 'stock_conference' ? 'info' : Number(record.quantity_delta || 0) >= 0 ? 'success' : 'warning'}>
                                            {record.type_label}
                                        </Badge>
                                    )}
                                    description={record.reason || 'Conferencia de estoque'}
                                    meta={[
                                        `Contado: ${formatNumber(record.counted_quantity || record.stock_after || 0)}`,
                                        `Delta: ${formatNumber(record.quantity_delta || 0)}`,
                                    ]}
                                />
                            ))
                        ) : (
                            <EmptyState title="Nenhuma conferencia registrada" text="Conferencias mantem o estoque confiavel e auditavel." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Nova conferencia" subtitle="Ajuste automatico quando houver divergencia" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-boxes-stacked" text="Produto" />
                            <select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))} required>
                                <option value="">Selecione</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {getProductOptionLabel(product)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel icon="fa-scale-balanced" text="Quantidade contada" />
                            <input type="number" min="0" step="0.001" value={form.counted_quantity} onChange={(event) => setForm((current) => ({ ...current, counted_quantity: event.target.value }))} required />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-clipboard-check" text="Motivo" />
                            <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ex.: Inventario semanal" required />
                        </label>
                        <label>
                            <FieldLabel icon="fa-warehouse" text="Local" />
                            <select value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}>
                                <option value="">Nao informado</option>
                                {(payload.locations || []).map((location) => (
                                    <option key={location} value={location}>
                                        {location}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel icon="fa-clock" text="Data e hora" />
                            <input type="datetime-local" value={form.occurred_at} onChange={(event) => setForm((current) => ({ ...current, occurred_at: event.target.value }))} />
                        </label>
                        <div className="ops-workspace-total-bar span-2">
                            <span>Saldo atual / Diferenca prevista</span>
                            <strong>{`${formatNumber(expectedValue)} ${selectedProduct?.unit || 'UN'} - ${formatNumber(adjustmentPreview)}`}</strong>
                        </div>
                        <label className="span-2">
                            <FieldLabel icon="fa-note-sticky" text="Observacoes" />
                            <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <button type="button" className="ui-button-ghost" onClick={() => setForm({ ...emptyForm, location: form.location || initialLocation })}>
                                Limpar
                            </button>
                            <button type="submit" className="ui-button" disabled={saving}>
                                {saving ? 'Salvando...' : 'Registrar conferencia'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function StockTransfersWorkspace({ moduleKey, payload }) {
    const emptyForm = {
        product_id: '',
        quantity: '1',
        from_location: payload.locations?.[0] || '',
        to_location: payload.locations?.[1] || payload.locations?.[0] || '',
        reason: '',
        notes: '',
        occurred_at: '',
    }

    const [records, setRecords] = useState(payload.records || [])
    const [products] = useState(payload.products || [])
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const metrics = useMemo(
        () => [
            { label: 'Movimentacoes', value: records.length, caption: 'Transferencias registradas' },
            { label: 'Quantidade transferida', value: records.reduce((total, record) => total + Number(record.quantity || 0), 0), caption: 'Soma informada', format: 'number' },
            { label: 'Produtos envolvidos', value: new Set(records.map((record) => record.product_id).filter(Boolean)).size, caption: 'Itens com movimentacao' },
        ],
        [records],
    )

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = {
                ...form,
                product_id: Number(form.product_id),
                quantity: parseNumber(form.quantity, 0),
                from_location: form.from_location,
                to_location: form.to_location,
                reason: form.reason || null,
                notes: form.notes || null,
                occurred_at: form.occurred_at || null,
            }

            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({
                ...emptyForm,
                from_location: form.from_location,
                to_location: form.to_location,
            })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="ops-workspace-stack">
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Historico de movimentacoes" subtitle={`${records.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {records.length ? (
                            records.map((record) => (
                                <ListCard
                                    key={record.id}
                                    active={false}
                                    onClick={() => null}
                                    title={record.product_name || 'Produto'}
                                    badge={<Badge tone="info">{record.type_label}</Badge>}
                                    description={`${record.from_location || '-'} -> ${record.to_location || '-'}`}
                                    meta={[
                                        `${formatNumber(record.quantity || 0)} ${record.unit || 'UN'}`,
                                        record.occurred_at ? ensureDateTime(record.occurred_at).replace('T', ' ') : 'Sem data',
                                    ]}
                                />
                            ))
                        ) : (
                            <EmptyState title="Nenhuma movimentacao registrada" text="Registre transferencias entre locais para manter rastreabilidade." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Nova movimentacao" subtitle="Transferencia entre locais internos" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-boxes-stacked" text="Produto" />
                            <select value={form.product_id} onChange={(event) => setForm((current) => ({ ...current, product_id: event.target.value }))} required>
                                <option value="">Selecione</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {getProductOptionLabel(product)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel icon="fa-arrow-right-arrow-left" text="Quantidade" />
                            <input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required />
                        </label>
                        <label>
                            <FieldLabel icon="fa-right-from-bracket" text="Origem" />
                            <select value={form.from_location} onChange={(event) => setForm((current) => ({ ...current, from_location: event.target.value }))} required>
                                <option value="">Selecione</option>
                                {(payload.locations || []).map((location) => (
                                    <option key={location} value={location}>
                                        {location}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <FieldLabel icon="fa-right-to-bracket" text="Destino" />
                            <select value={form.to_location} onChange={(event) => setForm((current) => ({ ...current, to_location: event.target.value }))} required>
                                <option value="">Selecione</option>
                                {(payload.locations || []).map((location) => (
                                    <option key={location} value={location}>
                                        {location}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-clipboard-check" text="Motivo" />
                            <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ex.: Reposicao da loja" />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-clock" text="Data e hora" />
                            <input type="datetime-local" value={form.occurred_at} onChange={(event) => setForm((current) => ({ ...current, occurred_at: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-note-sticky" text="Observacoes" />
                            <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>
                                Limpar
                            </button>
                            <button type="submit" className="ui-button" disabled={saving}>
                                {saving ? 'Salvando...' : 'Registrar movimentacao'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}
