import { useMemo, useRef, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    FeedbackHeader,
    getProductOptionLabel,
    ListCard,
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

function formatProductScanCode(product) {
    return product?.barcode || product?.code || '-'
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

function findProductByScan(products, value) {
    const normalizedValue = String(value || '').trim()

    if (!normalizedValue) {
        return null
    }

    return products.find((product) => (
        String(product.barcode || '').trim() === normalizedValue
        || String(product.code || '').trim() === normalizedValue
    )) || null
}

function sumItems(items) {
    return items.reduce((total, item) => total + (parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0)), 0)
}

function buildInboundItem(product) {
    return {
        product_id: String(product.id),
        product_name: product.name,
        barcode: product.barcode || null,
        code: product.code || null,
        quantity: '1',
        unit_cost: String(product.cost_price || 0),
    }
}

function upsertInboundItem(items, product) {
    const existingIndex = items.findIndex((item) => String(item.product_id) === String(product.id))

    if (existingIndex === -1) {
        return [...items, buildInboundItem(product)]
    }

    return items.map((item, index) => (
        index === existingIndex
            ? { ...item, quantity: String(parseNumber(item.quantity, 0) + 1) }
            : item
    ))
}

function StepPill({ icon, index, label, active, done, onClick }) {
    return (
        <button
            type="button"
            className={`ops-step-pill ${active ? 'active' : ''} ${done ? 'done' : ''}`}
            onClick={onClick}
        >
            <span className="ops-step-pill-index">{done ? <i className="fa-solid fa-check" /> : index + 1}</span>
            <span className="ops-step-pill-copy">
                <i className={`fa-solid ${icon}`} />
                <strong>{label}</strong>
            </span>
        </button>
    )
}

function InboundItemsTable({ items, onChange, onRemove }) {
    if (!items.length) {
        return <EmptyState title="Sem itens" text="Bipe ou selecione os produtos." />
    }

    return (
        <div className="ops-workspace-table-wrap">
            <table className="ui-table">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Custo</th>
                        <th>Total</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={`${item.product_id}-${index}`}>
                            <td>
                                <div className="ops-inline-product-meta">
                                    <strong>{item.product_name}</strong>
                                    <small>{item.barcode || item.code || '-'}</small>
                                </div>
                            </td>
                            <td>
                                <input
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    value={item.quantity}
                                    onChange={(event) => onChange(index, 'quantity', event.target.value)}
                                />
                            </td>
                            <td>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_cost}
                                    onChange={(event) => onChange(index, 'unit_cost', event.target.value)}
                                />
                            </td>
                            <td>{formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0))}</td>
                            <td>
                                <button type="button" className="ui-button-ghost danger icon-only" onClick={() => onRemove(index)}>
                                    <i className="fa-solid fa-trash" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function StockInboundWorkspace({ moduleKey, payload }) {
    const suppliers = payload.suppliers || []
    const emptyForm = {
        supplier_id: '',
        invoice_number: '',
        billing_barcode: '',
        billing_amount: '',
        billing_due_date: '',
        notes: '',
        items: [],
    }

    const steps = [
        { key: 'supplier', label: 'Fornecedor', icon: 'fa-building' },
        { key: 'invoice', label: 'Nota', icon: 'fa-file-invoice' },
        { key: 'items', label: 'Itens', icon: 'fa-barcode' },
        { key: 'billing', label: 'Boleto', icon: 'fa-receipt' },
    ]

    const [records, setRecords] = useState(payload.records || [])
    const [products] = useState(payload.products || [])
    const [form, setForm] = useState(emptyForm)
    const [step, setStep] = useState(0)
    const [scanCode, setScanCode] = useState('')
    const [manualProductId, setManualProductId] = useState('')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const scanInputRef = useRef(null)

    const filteredProducts = useMemo(() => (
        form.supplier_id
            ? products.filter((product) => String(product.supplier_id || '') === String(form.supplier_id))
            : products
    ), [products, form.supplier_id])

    const subtotalPreview = useMemo(() => sumItems(form.items), [form.items])
    const billingPreview = parseNumber(form.billing_amount, 0)
    const supplierName = suppliers.find((supplier) => String(supplier.id) === String(form.supplier_id))?.name || '-'

    function resetForm() {
        setForm(emptyForm)
        setStep(0)
        setScanCode('')
        setManualProductId('')
    }

    function handleItemChange(index, field, value) {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
        }))
    }

    function handleItemRemove(index) {
        setForm((current) => ({
            ...current,
            items: current.items.filter((_, itemIndex) => itemIndex !== index),
        }))
    }

    function pushProduct(product) {
        setForm((current) => ({
            ...current,
            items: upsertInboundItem(current.items, product),
        }))
        setScanCode('')
        setManualProductId('')
        scanInputRef.current?.focus()
    }

    function handleScanSubmit(event) {
        event.preventDefault()

        const product = findProductByScan(filteredProducts, scanCode)

        if (!product) {
            setFeedback({ type: 'error', text: 'Produto nao encontrado para o codigo informado.' })
            return
        }

        pushProduct(product)
    }

    function handleManualAdd() {
        const product = filteredProducts.find((entry) => String(entry.id) === String(manualProductId))

        if (!product) {
            setFeedback({ type: 'error', text: 'Selecione um produto para adicionar.' })
            return
        }

        pushProduct(product)
    }

    function handleNextStep() {
        if (step === 0 && !form.supplier_id) {
            setFeedback({ type: 'error', text: 'Selecione o fornecedor para continuar.' })
            return
        }

        if (step === 1 && !String(form.invoice_number || '').trim()) {
            setFeedback({ type: 'error', text: 'Informe o numero da nota.' })
            return
        }

        if (step === 2 && !form.items.length) {
            setFeedback({ type: 'error', text: 'Adicione ao menos um item na entrada.' })
            return
        }

        setStep((current) => Math.min(current + 1, steps.length - 1))
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (!form.items.length) {
            setFeedback({ type: 'error', text: 'Adicione itens antes de finalizar a entrada.' })
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const payloadData = {
                supplier_id: Number(form.supplier_id),
                invoice_number: form.invoice_number.trim(),
                billing_barcode: form.billing_barcode.trim() || null,
                billing_amount: form.billing_amount === '' ? null : parseNumber(form.billing_amount, 0),
                billing_due_date: form.billing_due_date || null,
                notes: form.notes.trim() || null,
                items: form.items.map((item) => ({
                    product_id: Number(item.product_id),
                    quantity: parseNumber(item.quantity, 0),
                    unit_cost: parseNumber(item.unit_cost, 0),
                })),
            }

            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            resetForm()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="ops-workspace-stack ops-inbound-workspace">
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel ops-compact-panel">
                    <div className="ops-stepper-row">
                        {steps.map((entry, index) => (
                            <StepPill
                                key={entry.key}
                                icon={entry.icon}
                                index={index}
                                label={entry.label}
                                active={step === index}
                                done={index < step || (index === 0 && !!form.supplier_id) || (index === 1 && !!form.invoice_number) || (index === 2 && form.items.length > 0)}
                                onClick={() => {
                                    if (index <= step) {
                                        setStep(index)
                                        return
                                    }

                                    handleNextStep()
                                }}
                            />
                        ))}
                    </div>

                    <Feedback feedback={feedback} />

                    {step === 0 ? (
                        <div className="ops-step-card">
                            <FeedbackHeader title="Fornecedor" subtitle={supplierName === '-' ? 'Selecao' : supplierName} />
                            <div className="ops-workspace-form-grid one-column">
                                <label>
                                    <FieldLabel icon="fa-building" text="Fornecedor" />
                                    <select value={form.supplier_id} onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}>
                                        <option value="">Selecione</option>
                                        {suppliers.map((supplier) => (
                                            <option key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                    ) : null}

                    {step === 1 ? (
                        <div className="ops-step-card">
                            <FeedbackHeader title="Nota" subtitle={form.invoice_number || 'Numero'} />
                            <div className="ops-workspace-form-grid one-column">
                                <label>
                                    <FieldLabel icon="fa-file-invoice" text="Numero da nota" />
                                    <input value={form.invoice_number} onChange={(event) => setForm((current) => ({ ...current, invoice_number: event.target.value }))} placeholder="NF 000123" />
                                </label>
                            </div>
                        </div>
                    ) : null}

                    {step === 2 ? (
                        <div className="ops-step-card">
                            <FeedbackHeader title="Itens" subtitle={`${form.items.length} item(ns)`} />
                            <div className="ops-scan-shell">
                                <form className="ops-scan-form" onSubmit={handleScanSubmit}>
                                    <label>
                                        <FieldLabel icon="fa-barcode" text="Bipar produto" />
                                        <input ref={scanInputRef} value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="EAN ou codigo" autoComplete="off" />
                                    </label>
                                    <button type="submit" className="ui-button">
                                        <i className="fa-solid fa-plus" />
                                    </button>
                                </form>

                                <div className="ops-workspace-inline-adder compact">
                                    <select value={manualProductId} onChange={(event) => setManualProductId(event.target.value)}>
                                        <option value="">Selecionar produto</option>
                                        {filteredProducts.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                {getProductOptionLabel(product)}
                                            </option>
                                        ))}
                                    </select>
                                    <button type="button" className="ui-button-ghost" onClick={handleManualAdd}>
                                        <i className="fa-solid fa-plus" />
                                    </button>
                                </div>
                            </div>

                            <InboundItemsTable items={form.items} onChange={handleItemChange} onRemove={handleItemRemove} />

                            <div className="ops-workspace-total-bar">
                                <span>Subtotal</span>
                                <strong>{formatMoney(subtotalPreview)}</strong>
                            </div>
                        </div>
                    ) : null}

                    {step === 3 ? (
                        <form className="ops-step-card" onSubmit={handleSubmit}>
                            <FeedbackHeader title="Boleto" subtitle={formatMoney(billingPreview || subtotalPreview)} />
                            <div className="ops-workspace-form-grid">
                                <label className="span-2">
                                    <FieldLabel icon="fa-barcode" text="Codigo" />
                                    <input value={form.billing_barcode} onChange={(event) => setForm((current) => ({ ...current, billing_barcode: event.target.value }))} placeholder="Linha digitavel" />
                                </label>
                                <label>
                                    <FieldLabel icon="fa-money-bill-wave" text="Valor" />
                                    <input type="number" min="0" step="0.01" value={form.billing_amount} onChange={(event) => setForm((current) => ({ ...current, billing_amount: event.target.value }))} />
                                </label>
                                <label>
                                    <FieldLabel icon="fa-calendar-day" text="Vencimento" />
                                    <input type="date" value={form.billing_due_date} onChange={(event) => setForm((current) => ({ ...current, billing_due_date: event.target.value }))} />
                                </label>
                                <label className="span-2">
                                    <FieldLabel icon="fa-note-sticky" text="Observacao" />
                                    <textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                                </label>
                            </div>

                            <div className="ops-review-grid">
                                <article><small>Fornecedor</small><strong>{supplierName}</strong></article>
                                <article><small>Nota</small><strong>{form.invoice_number || '-'}</strong></article>
                                <article><small>Itens</small><strong>{form.items.length}</strong></article>
                                <article><small>Total</small><strong>{formatMoney(subtotalPreview)}</strong></article>
                            </div>

                            <div className="ops-workspace-actions">
                                <button type="button" className="ui-button-ghost" onClick={resetForm}>
                                    <i className="fa-solid fa-rotate-left" />
                                </button>
                                <button type="submit" className="ui-button" disabled={saving}>
                                    <i className="fa-solid fa-check" />
                                    <span>{saving ? 'Salvando...' : 'Finalizar'}</span>
                                </button>
                            </div>
                        </form>
                    ) : null}

                    {step < steps.length - 1 ? (
                        <div className="ops-workspace-actions">
                            {step > 0 ? (
                                <button type="button" className="ui-button-ghost" onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                                    <i className="fa-solid fa-arrow-left" />
                                </button>
                            ) : null}
                            <button type="button" className="ui-button" onClick={handleNextStep}>
                                <i className="fa-solid fa-arrow-right" />
                            </button>
                        </div>
                    ) : null}
                </section>

                <section className="ops-workspace-panel ops-compact-panel">
                    <FeedbackHeader title="Entradas" subtitle={`${records.length} registro(s)`} />
                    <div className="ops-workspace-list-stack">
                        {records.length ? records.map((record) => (
                            <ListCard
                                key={record.id}
                                active={false}
                                onClick={() => null}
                                title={record.invoice_number || record.code}
                                badge={<Badge tone="success">{record.supplier_name || 'Sem fornecedor'}</Badge>}
                                description={formatMoney(record.total || 0)}
                                meta={[`${formatNumber(record.quantity_total || 0)} un`, record.billing_due_date || 'Sem vencimento']}
                            />
                        )) : <EmptyState title="Sem entradas" text="Nenhum recebimento salvo." />}
                    </div>
                </section>
            </div>
        </div>
    )
}

export function StockMovementsWorkspace({ moduleKey, payload }) {
    const emptyForm = {
        product_id: '',
        counted_quantity: '',
        reason: 'Ajuste manual de saldo',
        notes: '',
    }

    const [records, setRecords] = useState(payload.records || [])
    const [products, setProducts] = useState(payload.products || [])
    const [form, setForm] = useState(emptyForm)
    const [scanCode, setScanCode] = useState('')
    const [manualProductId, setManualProductId] = useState('')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const scanInputRef = useRef(null)

    const selectedProduct = useMemo(
        () => products.find((product) => String(product.id) === String(form.product_id)) || null,
        [products, form.product_id],
    )

    const targetStock = parseNumber(form.counted_quantity, Number(selectedProduct?.stock_quantity || 0))
    const deltaPreview = targetStock - Number(selectedProduct?.stock_quantity || 0)

    function selectProduct(product) {
        setForm((current) => ({
            ...current,
            product_id: String(product.id),
            counted_quantity: String(product.stock_quantity || 0),
        }))
        setScanCode('')
        setManualProductId('')
    }

    function handleScanSubmit(event) {
        event.preventDefault()

        const product = findProductByScan(products, scanCode)

        if (!product) {
            setFeedback({ type: 'error', text: 'Produto nao encontrado para o codigo informado.' })
            return
        }

        selectProduct(product)
    }

    function handleManualSelect() {
        const product = products.find((entry) => String(entry.id) === String(manualProductId))

        if (!product) {
            setFeedback({ type: 'error', text: 'Selecione um produto para continuar.' })
            return
        }

        selectProduct(product)
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (!selectedProduct) {
            setFeedback({ type: 'error', text: 'Selecione um produto antes de salvar.' })
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Confirmar ajuste',
            message: `Atualizar ${selectedProduct.name} de ${formatNumber(selectedProduct.stock_quantity || 0)} para ${formatNumber(parseNumber(form.counted_quantity, 0))}?`,
            confirmLabel: 'Confirmar',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const payloadData = {
                product_id: Number(form.product_id),
                counted_quantity: parseNumber(form.counted_quantity, 0),
                reason: form.reason.trim() || null,
                notes: form.notes.trim() || null,
            }

            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setProducts((current) => updateStockInProducts(current, response.record.product_id, response.record.stock_after))
            setForm(emptyForm)
            setScanCode('')
            setManualProductId('')
            scanInputRef.current?.focus()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="ops-workspace-stack ops-stock-movement-workspace">
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel ops-compact-panel">
                    <FeedbackHeader title="Movimentacao" subtitle={selectedProduct ? selectedProduct.name : 'Bipagem'} />
                    <Feedback feedback={feedback} />

                    <div className="ops-scan-shell">
                        <form className="ops-scan-form" onSubmit={handleScanSubmit}>
                            <label>
                                <FieldLabel icon="fa-barcode" text="Bipar produto" />
                                <input ref={scanInputRef} value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="EAN ou codigo" autoComplete="off" />
                            </label>
                            <button type="submit" className="ui-button">
                                <i className="fa-solid fa-arrow-right" />
                            </button>
                        </form>

                        <div className="ops-workspace-inline-adder compact">
                            <select value={manualProductId} onChange={(event) => setManualProductId(event.target.value)}>
                                <option value="">Selecionar produto</option>
                                {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                        {getProductOptionLabel(product)}
                                    </option>
                                ))}
                            </select>
                            <button type="button" className="ui-button-ghost" onClick={handleManualSelect}>
                                <i className="fa-solid fa-arrow-right" />
                            </button>
                        </div>
                    </div>

                    {selectedProduct ? (
                        <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                            <div className="ops-stock-focus-card span-2">
                                <div><small>Produto</small><strong>{selectedProduct.name}</strong></div>
                                <div><small>Codigo</small><strong>{formatProductScanCode(selectedProduct)}</strong></div>
                                <div><small>Saldo atual</small><strong>{formatNumber(selectedProduct.stock_quantity || 0)}</strong></div>
                            </div>

                            <label>
                                <FieldLabel icon="fa-scale-balanced" text="Novo saldo" />
                                <input type="number" min="0" step="0.001" value={form.counted_quantity} onChange={(event) => setForm((current) => ({ ...current, counted_quantity: event.target.value }))} />
                            </label>
                            <label>
                                <FieldLabel icon="fa-pen" text="Motivo" />
                                <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
                            </label>

                            <div className="ops-workspace-total-bar span-2">
                                <span>Delta</span>
                                <strong>{formatNumber(deltaPreview)}</strong>
                            </div>

                            <label className="span-2">
                                <FieldLabel icon="fa-note-sticky" text="Observacao" />
                                <textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                            </label>

                            <div className="ops-workspace-actions span-2">
                                <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>
                                    <i className="fa-solid fa-rotate-left" />
                                </button>
                                <button type="submit" className="ui-button" disabled={saving}>
                                    <i className="fa-solid fa-check" />
                                    <span>{saving ? 'Salvando...' : 'Confirmar'}</span>
                                </button>
                            </div>
                        </form>
                    ) : <EmptyState title="Nenhum produto" text="Selecione um item para ajustar." />}
                </section>

                <section className="ops-workspace-panel ops-compact-panel">
                    <FeedbackHeader title="Historico" subtitle={`${records.length} registro(s)`} />
                    <div className="ops-workspace-list-stack">
                        {records.length ? records.map((record) => (
                            <ListCard
                                key={record.id}
                                active={false}
                                onClick={() => null}
                                title={record.product_name || 'Produto'}
                                badge={<Badge tone={Number(record.quantity_delta || 0) >= 0 ? 'success' : 'warning'}>{formatNumber(record.quantity_delta || 0)}</Badge>}
                                description={record.reason || 'Ajuste manual'}
                                meta={[`${formatNumber(record.stock_before || 0)} -> ${formatNumber(record.stock_after || 0)}`, record.product_code || '-']}
                            />
                        )) : <EmptyState title="Sem ajustes" text="Nenhum movimento registrado." />}
                    </div>
                </section>
            </div>
        </div>
    )
}
