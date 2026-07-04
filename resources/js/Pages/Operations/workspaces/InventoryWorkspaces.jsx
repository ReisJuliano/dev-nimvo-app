import { useMemo, useRef, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import './inventory-workspaces.css'
import { apiRequest, getAmountConfirmationMessage } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import PageHeader from '@/Components/UI/PageHeader'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    getProductOptionLabel,
    ListCard,
    parseNumber,
    upsertRecord,
} from './shared'

/* ─── helpers ─── */

function findProductByScan(products, value) {
    const v = String(value || '').trim()
    if (!v) return null
    return products.find((p) =>
        String(p.barcode || '').trim() === v || String(p.code || '').trim() === v,
    ) || null
}

function sumItems(items) {
    return items.reduce(
        (total, item) => total + parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0),
        0,
    )
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
    const idx = items.findIndex((item) => String(item.product_id) === String(product.id))
    if (idx === -1) return [...items, buildInboundItem(product)]
    return items.map((item, i) =>
        i === idx ? { ...item, quantity: String(parseNumber(item.quantity, 0) + 1) } : item,
    )
}

/* ─── Subcomponentes ─── */

function SectionCard({ title, subtitle, icon, children, className = '' }) {
    return (
        <div className={`inv-section-card ${className}`}>
            <div className="inv-section-header">
                <div className="inv-section-icon">
                    <i className={`fa-solid ${icon}`} />
                </div>
                <div>
                    <h3 className="inv-section-title">{title}</h3>
                    {subtitle ? <p className="inv-section-sub">{subtitle}</p> : null}
                </div>
            </div>
            {children}
        </div>
    )
}

function InboundItemsTable({ items, onChange, onRemove }) {
    if (!items.length) {
        return (
            <div className="inv-empty-items">
                <i className="fa-solid fa-barcode" />
                <strong>Nenhum item adicionado</strong>
                <span>Bipe ou selecione os produtos acima.</span>
            </div>
        )
    }

    return (
        <div className="inv-items-table-wrap">
            <table className="ui-table">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th style={{ width: 90 }}>Qtd.</th>
                        <th style={{ width: 110 }}>Custo unit.</th>
                        <th style={{ width: 100 }}>Total</th>
                        <th style={{ width: 40 }} />
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={`${item.product_id}-${index}`}>
                            <td>
                                <div className="inv-product-meta">
                                    <strong>{item.product_name}</strong>
                                    <small>{item.barcode || item.code || '-'}</small>
                                </div>
                            </td>
                            <td>
                                <input
                                    className="inv-number-input"
                                    type="number"
                                    min="0.001"
                                    step="0.001"
                                    value={item.quantity}
                                    onChange={(e) => onChange(index, 'quantity', e.target.value)}
                                />
                            </td>
                            <td>
                                <input
                                    className="inv-number-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_cost}
                                    onChange={(e) => onChange(index, 'unit_cost', e.target.value)}
                                />
                            </td>
                            <td className="inv-cell-mono">
                                {formatMoney(parseNumber(item.quantity, 0) * parseNumber(item.unit_cost, 0))}
                            </td>
                            <td>
                                <button
                                    type="button"
                                    className="inv-remove-btn"
                                    onClick={() => onRemove(index)}
                                    title="Remover item"
                                >
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════
   ENTRADA DE ESTOQUE
═══════════════════════════════════════════════════════════ */

export function StockInboundWorkspace({ moduleKey, payload }) {
    const suppliers = payload.suppliers || []
    const emptyForm = {
        supplier_id: '', invoice_number: '',
        billing_barcode: '', billing_amount: '', billing_due_date: '', notes: '',
        items: [],
    }

    const [records, setRecords] = useState(payload.records || [])
    const [products] = useState(payload.products || [])
    const [form, setForm] = useState(emptyForm)
    const historySearchControl = useConfirmedSearch('')
    const [historyRange, setHistoryRange] = useState({ from: '', to: '' })
    const [historyLoading, setHistoryLoading] = useState(false)
    const [hasLoadedHistory, setHasLoadedHistory] = useState((payload.records || []).length > 0)
    const [scanCode, setScanCode] = useState('')
    const [manualProductId, setManualProductId] = useState('')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [showBilling, setShowBilling] = useState(false)
    const scanInputRef = useRef(null)

    const filteredProducts = useMemo(() => (
        form.supplier_id
            ? products.filter((p) => String(p.supplier_id || '') === String(form.supplier_id))
            : products
    ), [products, form.supplier_id])

    const subtotalPreview = useMemo(() => sumItems(form.items), [form.items])
    const billingPreview = parseNumber(form.billing_amount, 0)
    const supplierName = suppliers.find((s) => String(s.id) === String(form.supplier_id))?.name || null

    function set(field, value) {
        setForm((cur) => ({ ...cur, [field]: value }))
    }

    function handleItemChange(index, field, value) {
        setForm((cur) => ({
            ...cur,
            items: cur.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
        }))
    }

    function handleItemRemove(index) {
        setForm((cur) => ({ ...cur, items: cur.items.filter((_, i) => i !== index) }))
    }

    function pushProduct(product) {
        setForm((cur) => ({ ...cur, items: upsertInboundItem(cur.items, product) }))
        setScanCode('')
        setManualProductId('')
        scanInputRef.current?.focus()
    }

    function handleScanSubmit(event) {
        event.preventDefault()
        const product = findProductByScan(filteredProducts, scanCode)
        if (!product) {
            setFeedback({ type: 'error', text: 'Produto não encontrado para o código informado.' })
            return
        }
        pushProduct(product)
    }

    function handleManualAdd() {
        const product = filteredProducts.find((p) => String(p.id) === String(manualProductId))
        if (!product) {
            setFeedback({ type: 'error', text: 'Selecione um produto para adicionar.' })
            return
        }
        pushProduct(product)
    }

    function handleReset() {
        setForm(emptyForm)
        setScanCode('')
        setManualProductId('')
        setFeedback(null)
        setShowBilling(false)
    }

    async function handleSubmit(event, confirmAmountMismatch = false) {
        event?.preventDefault?.()

        if (!form.supplier_id) {
            setFeedback({ type: 'error', text: 'Selecione o fornecedor.' })
            return
        }

        if (!String(form.invoice_number || '').trim()) {
            setFeedback({ type: 'error', text: 'Informe o número da nota fiscal.' })
            return
        }

        if (!form.items.length) {
            setFeedback({ type: 'error', text: 'Adicione ao menos um item na entrada.' })
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const data = {
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
                confirm_amount_mismatch: confirmAmountMismatch,
            }

            const response = await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data })
            setRecords((cur) => upsertRecord(cur, response.record))
            setHasLoadedHistory(true)
            handleReset()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            const confirmationMessage = !confirmAmountMismatch ? getAmountConfirmationMessage(error) : null

            if (confirmationMessage) {
                const confirmed = await confirmPopup({
                    type: 'warning',
                    title: 'Valor fora do padrão',
                    message: confirmationMessage,
                    confirmLabel: 'Confirmar mesmo assim',
                    cancelLabel: 'Revisar valor',
                })

                if (confirmed) {
                    await handleSubmit(event, true)
                    return
                }
            } else {
                setFeedback({ type: 'error', text: error.message })
            }
        } finally {
            setSaving(false)
        }
    }

    async function handleLoadHistory() {
        setHistoryLoading(true)
        setFeedback(null)
        try {
            const nextSearch = historySearchControl.apply()
            const response = await apiRequest(buildRecordsUrl(moduleKey), {
                params: {
                    applied: 1,
                    search: nextSearch || undefined,
                    from: historyRange.from || undefined,
                    to: historyRange.to || undefined,
                },
            })
            setRecords(Array.isArray(response?.records) ? response.records : [])
            setHasLoadedHistory(true)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setHistoryLoading(false)
        }
    }

    function handleResetHistory() {
        historySearchControl.clear()
        setHistoryRange({ from: '', to: '' })
        setRecords([])
        setHasLoadedHistory(false)
        setHistoryLoading(false)
    }

    return (
        <div className="inv-page">

            {/* Cabeçalho da página */}
            <div className="inv-page-hero">
                <div className="inv-page-hero-icon">
                    <i className="fa-solid fa-truck-ramp-box" />
                </div>
                <div>
                    <h2 className="inv-page-hero-title">Entrada de mercadoria</h2>
                    <p className="inv-page-hero-sub">Registre o recebimento de produtos com nota fiscal.</p>
                </div>
            </div>

            <Feedback feedback={feedback} />

            <form className="inv-form-grid" onSubmit={handleSubmit}>

                {/* Seção 1 — Fornecedor + NF */}
                <SectionCard title="Fornecedor e nota" icon="fa-building" subtitle="Identifique o recebimento.">
                    <div className="inv-form-row">
                        <label className="inv-label">
                            <span>Fornecedor</span>
                            <select
                                className="ui-select"
                                value={form.supplier_id}
                                onChange={(e) => set('supplier_id', e.target.value)}
                            >
                                <option value="">Selecione o fornecedor</option>
                                {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </label>

                        <label className="inv-label">
                            <span>Número da nota fiscal</span>
                            <input
                                className="ui-input"
                                value={form.invoice_number}
                                onChange={(e) => set('invoice_number', e.target.value)}
                                placeholder="Ex: NF 000123"
                            />
                        </label>
                    </div>
                </SectionCard>

                {/* Seção 2 — Itens */}
                <SectionCard
                    title="Itens da entrada"
                    icon="fa-barcode"
                    subtitle={form.items.length ? `${form.items.length} produto(s) · Subtotal: ${formatMoney(subtotalPreview)}` : 'Adicione os produtos recebidos.'}
                >
                    {/* Scan + seleção manual */}
                    <div className="inv-adder-row">
                        <div className="inv-scan-group">
                            <input
                                ref={scanInputRef}
                                className="ui-input"
                                value={scanCode}
                                onChange={(e) => setScanCode(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanSubmit(e) } }}
                                placeholder="Bipe EAN / código..."
                                autoComplete="off"
                            />
                            <button type="button" className="ui-button" onClick={handleScanSubmit}>
                                <i className="fa-solid fa-barcode" />
                                Bipar
                            </button>
                        </div>

                        <div className="inv-scan-group">
                            <select
                                className="ui-select"
                                value={manualProductId}
                                onChange={(e) => setManualProductId(e.target.value)}
                            >
                                <option value="">Selecionar produto manualmente</option>
                                {filteredProducts.map((p) => (
                                    <option key={p.id} value={p.id}>{getProductOptionLabel(p)}</option>
                                ))}
                            </select>
                            <button type="button" className="ui-button-ghost" onClick={handleManualAdd}>
                                <i className="fa-solid fa-plus" />
                                Adicionar
                            </button>
                        </div>
                    </div>

                    {/* Tabela de itens */}
                    <InboundItemsTable
                        items={form.items}
                        onChange={handleItemChange}
                        onRemove={handleItemRemove}
                    />

                    {form.items.length > 0 ? (
                        <div className="inv-subtotal-bar">
                            <span>{form.items.length} produto(s)</span>
                            <strong>Subtotal: {formatMoney(subtotalPreview)}</strong>
                        </div>
                    ) : null}
                </SectionCard>

                {/* Seção 3 — Boleto (colapsável) */}
                <SectionCard
                    title="Boleto / Pagamento"
                    icon="fa-receipt"
                    subtitle="Opcional — registre o boleto desta nota."
                >
                    <button
                        type="button"
                        className="inv-toggle-billing"
                        onClick={() => setShowBilling((v) => !v)}
                    >
                        <i className={`fa-solid ${showBilling ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                        {showBilling ? 'Ocultar dados do boleto' : 'Informar dados do boleto'}
                    </button>

                    {showBilling ? (
                        <div className="inv-billing-fields">
                            <label className="inv-label inv-label--span2">
                                <span>Código de barras do boleto</span>
                                <input
                                    className="ui-input"
                                    value={form.billing_barcode}
                                    onChange={(e) => set('billing_barcode', e.target.value)}
                                    placeholder="Linha digitável"
                                />
                            </label>
                            <label className="inv-label">
                                <span>Valor do boleto</span>
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.billing_amount}
                                    onChange={(e) => set('billing_amount', e.target.value)}
                                    placeholder="R$ 0,00"
                                />
                            </label>
                            <label className="inv-label">
                                <span>Vencimento</span>
                                <input
                                    className="ui-input"
                                    type="date"
                                    value={form.billing_due_date}
                                    onChange={(e) => set('billing_due_date', e.target.value)}
                                />
                            </label>
                            <label className="inv-label inv-label--span2">
                                <span>Observação</span>
                                <textarea
                                    className="ui-textarea"
                                    rows="2"
                                    value={form.notes}
                                    onChange={(e) => set('notes', e.target.value)}
                                />
                            </label>
                        </div>
                    ) : null}
                </SectionCard>

                {/* Resumo + ações */}
                {form.items.length > 0 ? (
                    <div className="inv-review-bar">
                        <div className="inv-review-chips">
                            {supplierName ? (
                                <span className="inv-chip">
                                    <i className="fa-solid fa-building" />
                                    {supplierName}
                                </span>
                            ) : null}
                            {form.invoice_number ? (
                                <span className="inv-chip">
                                    <i className="fa-solid fa-file-invoice" />
                                    {form.invoice_number}
                                </span>
                            ) : null}
                            <span className="inv-chip">
                                <i className="fa-solid fa-boxes-stacked" />
                                {form.items.length} item(ns)
                            </span>
                            <span className="inv-chip inv-chip--accent">
                                {formatMoney(billingPreview || subtotalPreview)}
                            </span>
                        </div>
                        <div className="inv-form-actions">
                            <button type="button" className="ui-button-ghost" onClick={handleReset}>
                                <i className="fa-solid fa-rotate-left" />
                                Limpar
                            </button>
                            <button type="submit" className="ui-button" disabled={saving}>
                                <i className="fa-solid fa-check" />
                                {saving ? 'Salvando...' : 'Finalizar entrada'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </form>

            {/* ─── Histórico ─── */}
            <div className="inv-history-section">
                <PageHeader
                    title={`Histórico de entradas (${records.length})`}
                    search={{
                        placeholder: 'Buscar NF, fornecedor ou produto',
                        value: historySearchControl.draftValue,
                        onChange: historySearchControl.setDraftValue,
                    }}
                    dateRange={{
                        from: historyRange.from,
                        to: historyRange.to,
                        onChange: setHistoryRange,
                    }}
                    quickDates
                    applyLabel={historyLoading ? 'Buscando...' : 'Filtrar'}
                    onApply={() => void handleLoadHistory()}
                    onReset={handleResetHistory}
                />
                <div className="inv-history-list">
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
                    )) : (
                        <EmptyState
                            title={historyLoading ? 'Buscando entradas' : hasLoadedHistory ? 'Sem entradas' : 'Clique em Filtrar para buscar'}
                            text={hasLoadedHistory ? 'Nenhum recebimento encontrado nesse recorte.' : 'Use a busca e o período acima.'}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
