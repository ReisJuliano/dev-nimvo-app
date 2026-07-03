import { Link } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
import { apiRequest, getAmountConfirmationMessage } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './entrada.css'

/* ─── helpers ─── */

function todayValue() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function findByBarcode(products, raw) {
    const v = String(raw || '').trim()
    if (!v) return null
    return products.find(
        (p) => String(p.barcode || '').trim() === v || String(p.code || '').trim() === v,
    ) ?? null
}

function upsertItem(items, product) {
    const idx = items.findIndex((i) => i.product.id === product.id)
    if (idx === -1) {
        return [...items, { product, quantity: 1, cost: product.cost_price || 0 }]
    }
    return items.map((item, i) =>
        i === idx ? { ...item, quantity: item.quantity + 1 } : item,
    )
}

function newBoleto() {
    return {
        id: `boleto-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        code: '',
        amount: '',
        due: '',
        notes: '',
    }
}

function addDays(baseDate, days) {
    const next = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
    next.setDate(next.getDate() + days)

    return next
}

function toInputDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function parseBoletoDueDate(factor) {
    const numericFactor = Number(factor)

    if (!Number.isFinite(numericFactor) || numericFactor <= 0) {
        return ''
    }

    const legacyDate = addDays(new Date(1997, 9, 7), numericFactor)
    const resetDate = addDays(new Date(2022, 4, 29), numericFactor)
    const tooFarFuture = new Date()
    tooFarFuture.setFullYear(tooFarFuture.getFullYear() + 10)

    return toInputDate(resetDate > tooFarFuture ? legacyDate : resetDate)
}

function parseBoletoLine(raw) {
    const digits = String(raw || '').replace(/\D/g, '')

    if (![44, 47, 48].includes(digits.length)) {
        return null
    }

    const factor = digits.length === 44
        ? digits.slice(5, 9)
        : digits.slice(33, 37)
    const amountDigits = digits.length === 44
        ? digits.slice(9, 19)
        : digits.slice(37, 47)
    const amount = Number(amountDigits) / 100

    return {
        normalizedCode: digits,
        amount: Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : '',
        due: parseBoletoDueDate(factor),
    }
}

function boletoHasData(boleto) {
    return Boolean(
        String(boleto.code || '').trim()
        || String(boleto.due || '').trim()
        || String(boleto.notes || '').trim()
        || Number(boleto.amount || 0) > 0,
    )
}

/* ─── Indicador de etapas ─── */

function StepBar({ current, steps }) {
    return (
        <div className="ent-step-bar">
            {steps.map((label, idx) => {
                const num = idx + 1
                const done = num < current
                const active = num === current
                return (
                    <div key={label} className={`ent-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                        <div className="ent-step-circle">
                            {done ? <i className="fa-solid fa-check" /> : num}
                        </div>
                        <span>{label}</span>
                        {idx < steps.length - 1 && <div className="ent-step-line" />}
                    </div>
                )
            })}
        </div>
    )
}

/* ─── Componente principal ─── */

const STEPS = ['Identificação', 'Produtos', 'Boleto', 'Confirmar']

export default function StockEntradaPage({ payload }) {
    const products  = useMemo(() => Array.isArray(payload?.products)  ? payload.products  : [], [payload])
    const suppliers = useMemo(() => Array.isArray(payload?.suppliers) ? payload.suppliers : [], [payload])

    const [step, setStep] = useState(1)

    /* Etapa 1 — Identificação */
    const [entryDate,     setEntryDate]     = useState(todayValue)
    const [supplierId,    setSupplierId]    = useState('')
    const [reference,     setReference]     = useState('')

    /* Etapa 2 — Produtos */
    const [items,         setItems]         = useState([])
    const [scanValue,     setScanValue]     = useState('')
    const [textSearch,    setTextSearch]    = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [flash,         setFlash]         = useState(null)

    /* Etapa 3 — Boleto */
    const [boletos,       setBoletos]       = useState(() => [newBoleto()])

    /* Confirmação */
    const [saving,   setSaving]   = useState(false)
    const [progress, setProgress] = useState(null)
    const [done,     setDone]     = useState(false)

    const scanRef    = useRef(null)
    const flashTimer = useRef(null)

    const supplierName = suppliers.find((s) => String(s.id) === String(supplierId))?.name || null
    const totalQty     = items.reduce((s, i) => s + Number(i.quantity), 0)
    const totalValue   = items.reduce((s, i) => s + Number(i.quantity) * Number(i.cost || 0), 0)
    const activeBoletos = boletos.filter(boletoHasData)
    const totalBoletos = activeBoletos.reduce((sum, boleto) => sum + Number(boleto.amount || 0), 0)

    /* Foco no scan sempre que na etapa 2 */
    const refocus = useCallback(() => {
        setTimeout(() => scanRef.current?.focus(), 30)
    }, [])

    useEffect(() => {
        if (step === 2) refocus()
    }, [step, refocus])

    useEffect(() => {
        if (step !== 2) return
        function onClickPage(e) {
            const tag = e.target.tagName
            if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return
            refocus()
        }
        document.addEventListener('click', onClickPage)
        return () => document.removeEventListener('click', onClickPage)
    }, [step, refocus])

    /* Busca de texto */
    useEffect(() => {
        const q = normalizeTextSearch(textSearch)
        if (!q) { setSearchResults([]); return }
        setSearchResults(products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q)).slice(0, 8))
    }, [textSearch, products])

    function showFlash(type, text) {
        clearTimeout(flashTimer.current)
        setFlash({ type, text })
        flashTimer.current = setTimeout(() => setFlash(null), 2000)
    }

    function addProduct(product) {
        setItems((prev) => upsertItem(prev, product))
        setScanValue('')
        setTextSearch('')
        setSearchResults([])
        showFlash('ok', `${product.name}`)
        refocus()
    }

    function handleScan() {
        const raw = scanValue.trim()
        if (!raw) return
        const found = findByBarcode(products, raw)
        if (found) {
            addProduct(found)
        } else {
            showFlash('err', `Não encontrado: "${raw}"`)
            setScanValue('')
            refocus()
        }
    }

    function updateItem(idx, field, val) {
        setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
    }

    function removeItem(idx) {
        setItems((prev) => prev.filter((_, i) => i !== idx))
        refocus()
    }

    function updateBoleto(idx, field, value) {
        setBoletos((prev) => prev.map((boleto, i) => {
            if (i !== idx) return boleto

            if (field !== 'code') {
                return { ...boleto, [field]: value }
            }

            const parsed = parseBoletoLine(value)

            return {
                ...boleto,
                code: parsed?.normalizedCode || value,
                amount: parsed?.amount || boleto.amount,
                due: parsed?.due || boleto.due,
            }
        }))
    }

    function addBoleto() {
        setBoletos((prev) => [...prev, newBoleto()])
    }

    function removeBoleto(idx) {
        setBoletos((prev) => {
            const next = prev.filter((_, i) => i !== idx)

            return next.length ? next : [newBoleto()]
        })
    }

    function buildPayables() {
        const payableBoletos = activeBoletos.filter((boleto) => Number(boleto.amount || 0) > 0)
        const total = Math.max(1, payableBoletos.length)

        return payableBoletos.map((boleto, index) => ({
            description: reference
                ? `Entrada de mercadoria - ${reference}`
                : `Entrada de mercadoria${supplierName ? ` - ${supplierName}` : ''}`,
            amount: Number(boleto.amount),
            due_date: boleto.due || null,
            payment_method: boleto.code ? 'boleto' : 'cash',
            barcode: boleto.code || null,
            installment_label: total > 1 ? `Parcela ${index + 1}/${total}` : 'Parcela unica',
            installment_number: index + 1,
            installment_total: total,
            recurrence: 'once',
            notes: boleto.notes || null,
        }))
    }

    async function confirmZeroAmountBoletos() {
        const zeroAmountBoletos = activeBoletos.filter((boleto) => Number(boleto.amount || 0) <= 0)

        if (!zeroAmountBoletos.length) {
            return true
        }

        return confirmPopup({
            type: 'warning',
            title: 'Boleto sem valor',
            message: 'Existe boleto com codigo, vencimento ou observacao sem valor informado. Ele sera salvo apenas na entrada e nao vai gerar conta a pagar. Continuar?',
            confirmLabel: 'Continuar',
            cancelLabel: 'Revisar boleto',
        })
    }

    async function handleConfirm(confirmAmountMismatch = false) {
        const canContinueWithZeroAmount = await confirmZeroAmountBoletos()

        if (!canContinueWithZeroAmount) {
            setStep(3)
            return
        }

        setSaving(true)
        setProgress({ done: 0, total: 1 })

        const entryNotes = [
            reference ? `Ref: ${reference}` : null,
            supplierName ? `Fornecedor: ${supplierName}` : null,
            ...activeBoletos.map((boleto, index) => boleto.notes ? `Boleto ${index + 1}: ${boleto.notes}` : null),
        ].filter(Boolean).join(' | ') || null

        try {
            await apiRequest('/api/operations/entrada-estoque/records', {
                method: 'post',
                data: {
                    supplier_id: supplierId ? Number(supplierId) : null,
                    invoice_number: reference || null,
                    received_at: entryDate || null,
                    billing_barcode: activeBoletos[0]?.code || null,
                    billing_amount: totalBoletos > 0 ? totalBoletos : null,
                    billing_due_date: activeBoletos[0]?.due || null,
                    notes: entryNotes,
                    items: items.map(({ product, quantity, cost }) => ({
                        product_id: product.id,
                        quantity: Number(quantity),
                        unit_cost: Number(cost || 0),
                    })),
                    payables: buildPayables(),
                    confirm_amount_mismatch: confirmAmountMismatch,
                },
            })

            setProgress({ done: 1, total: 1 })
            setDone(true)
        } catch (error) {
            const confirmationMessage = !confirmAmountMismatch ? getAmountConfirmationMessage(error) : null

            if (confirmationMessage) {
                const confirmed = await confirmPopup({
                    type: 'warning',
                    title: 'Valor fora do padrao',
                    message: confirmationMessage,
                    confirmLabel: 'Confirmar mesmo assim',
                    cancelLabel: 'Revisar valor',
                })

                if (confirmed) {
                    await handleConfirm(true)
                    return
                }
            } else {
                showFlash('err', error?.message || 'Erro ao registrar entrada.')
            }
        } finally {
            setSaving(false)
            setProgress(null)
        }
    }

    function startNew() {
        setStep(1)
        setEntryDate(todayValue())
        setSupplierId('')
        setReference('')
        setItems([])
        setScanValue('')
        setTextSearch('')
        setBoletos([newBoleto()])
        setDone(false)
        setFlash(null)
    }

    /* ─── Tela de sucesso ─── */
    if (done) {
        return (
            <AppLayout title="Entrada de mercadoria">
                <div className="ent-page">
                    <div className="ent-success">
                        <div className="ent-success-icon">
                            <i className="fa-solid fa-circle-check" />
                        </div>
                        <h2>Entrada registrada!</h2>
                        <p>{items.length} produto(s) · {formatNumber(totalQty)} unidade(s) no total</p>
                        {supplierName ? <span className="ent-success-meta"><i className="fa-solid fa-building" /> {supplierName}</span> : null}
                        {reference    ? <span className="ent-success-meta"><i className="fa-solid fa-file-invoice" /> {reference}</span> : null}
                        <div className="ent-success-actions">
                            <button type="button" className="ent-confirm-btn" onClick={startNew}>
                                <i className="fa-solid fa-plus" /> Nova entrada
                            </button>
                            <Link href="/estoque" className="se-action-btn se-action-btn--ghost">
                                Ver estoque
                            </Link>
                        </div>
                    </div>
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout title="Entrada de mercadoria">
            <div className="ent-page">

                {/* Header */}
                <div className="ent-header">
                    <div className="ent-header-left">
                        <div className="ent-header-icon">
                            <i className="fa-solid fa-arrow-down-to-bracket" />
                        </div>
                        <div>
                            <h1 className="ent-header-title">Entrada de mercadoria</h1>
                            <p className="ent-header-sub">Siga as etapas para registrar o recebimento.</p>
                        </div>
                    </div>
                    <Link href="/estoque" className="se-action-btn se-action-btn--ghost">
                        <i className="fa-solid fa-xmark" />
                    </Link>
                </div>

                {/* Barra de etapas */}
                <StepBar current={step} steps={STEPS} />

                {/* ════ ETAPA 1 — Identificação ════ */}
                {step === 1 && (
                    <div className="ent-step-card">
                        <div className="ent-step-card-head">
                            <h2>Identificação da entrada</h2>
                            <p>Diga de onde vem a mercadoria. Tudo opcional, exceto a data.</p>
                        </div>

                        <div className="ent-form-grid">
                            <div className="ent-field">
                                <label>Data de entrada</label>
                                <input
                                    type="date"
                                    className="ui-input"
                                    value={entryDate}
                                    onChange={(e) => setEntryDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="ent-field">
                                <label>Fornecedor <span>(opcional)</span></label>
                                <select
                                    className="ui-select"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                >
                                    <option value="">Sem fornecedor</option>
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="ent-field ent-field--full">
                                <label>Referência / Número da nota <span>(opcional)</span></label>
                                <input
                                    className="ui-input"
                                    value={reference}
                                    onChange={(e) => setReference(e.target.value)}
                                    placeholder="Ex: NF 001234, Entrega semanal, Pedido #45..."
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="ent-step-nav">
                            <div />
                            <button
                                type="button"
                                className="ent-confirm-btn"
                                onClick={() => setStep(2)}
                            >
                                Avançar — Bipar produtos
                                <i className="fa-solid fa-arrow-right" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ════ ETAPA 2 — Produtos ════ */}
                {step === 2 && (
                    <div className="ent-step-card">
                        <div className="ent-step-card-head">
                            <h2>Bipe os produtos</h2>
                            <p>O campo abaixo já está pronto para receber bipagens. Bipe o mesmo produto duas vezes para somar.</p>
                        </div>

                        {/* Flash */}
                        {flash && (
                            <div className={`ent-flash ent-flash--${flash.type}`}>
                                <i className={`fa-solid ${flash.type === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                {flash.text}
                            </div>
                        )}

                        {/* Scan */}
                        <div className="ent-scan-main">
                            <div className="ent-scan-icon">
                                <i className="fa-solid fa-barcode" />
                            </div>
                            <input
                                ref={scanRef}
                                className="ent-scan-input"
                                value={scanValue}
                                onChange={(e) => setScanValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScan() } }}
                                placeholder="Bipe o código de barras aqui..."
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                            />
                            {scanValue && (
                                <button type="button" className="ent-scan-add" onClick={handleScan}>
                                    <i className="fa-solid fa-plus" />
                                </button>
                            )}
                        </div>

                        {/* Busca por nome */}
                        <div className="ent-search-wrap">
                            <div className="ent-search-field">
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    className="ent-search-input"
                                    value={textSearch}
                                    onChange={(e) => setTextSearch(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchResults.length) { e.preventDefault(); addProduct(searchResults[0]) }
                                        if (e.key === 'Escape') { setTextSearch(''); setSearchResults([]); refocus() }
                                    }}
                                    placeholder="Ou busque pelo nome do produto..."
                                    autoComplete="off"
                                />
                                {textSearch && (
                                    <button type="button" onClick={() => { setTextSearch(''); setSearchResults([]) }}>
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                )}
                            </div>
                            {searchResults.length > 0 && (
                                <div className="ent-search-dropdown">
                                    {searchResults.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            className="ent-search-result"
                                            onMouseDown={(e) => { e.preventDefault(); addProduct(p) }}
                                        >
                                            <div>
                                                <strong>{p.name}</strong>
                                                <small>{p.code || p.barcode || 'Sem código'}</small>
                                            </div>
                                            <span className="ent-stock-tag">
                                                {formatNumber(p.stock_quantity || 0)} {p.unit || 'UN'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tabela de itens */}
                        {items.length > 0 ? (
                            <div className="ent-items-table">
                                <table className="ent-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th style={{ width: 80 }}>Qtd</th>
                                            <th style={{ width: 110 }}>Custo unit.</th>
                                            <th style={{ width: 100, textAlign: 'right' }}>Subtotal</th>
                                            <th style={{ width: 36 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={item.product.id} className="ent-row">
                                                <td>
                                                    <div className="ent-product-cell">
                                                        <strong>{item.product.name}</strong>
                                                        <small>{item.product.code || item.product.barcode || '—'}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input className="ent-num-input" type="number" min="0.001" step="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
                                                </td>
                                                <td>
                                                    <input className="ent-num-input" type="number" min="0" step="0.01"
                                                        value={item.cost}
                                                        onChange={(e) => updateItem(idx, 'cost', e.target.value)}
                                                        placeholder="0,00" />
                                                </td>
                                                <td className="ent-subtotal">
                                                    {formatMoney(Number(item.quantity) * Number(item.cost || 0))}
                                                </td>
                                                <td>
                                                    <button type="button" className="ent-remove-btn" onClick={() => removeItem(idx)}>
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="ent-items-footer">
                                    <span>{items.length} produto(s) · {formatNumber(totalQty)} un.</span>
                                    <strong>{formatMoney(totalValue)}</strong>
                                </div>
                            </div>
                        ) : (
                            <div className="ent-empty">
                                <i className="fa-solid fa-barcode" />
                                <strong>Nenhum produto bipado ainda</strong>
                            </div>
                        )}

                        <div className="ent-step-nav">
                            <button type="button" className="ent-back-btn" onClick={() => setStep(1)}>
                                <i className="fa-solid fa-arrow-left" /> Voltar
                            </button>
                            <button
                                type="button"
                                className="ent-confirm-btn"
                                disabled={items.length === 0}
                                onClick={() => setStep(3)}
                            >
                                Avançar — Boleto
                                <i className="fa-solid fa-arrow-right" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ════ ETAPA 3 — Boleto ════ */}
                {step === 3 && (
                    <div className="ent-step-card">
                        <div className="ent-step-card-head">
                            <h2>Boleto / Cobrança</h2>
                            <p>Se essa entrada veio com boleto, preencha abaixo. Tudo opcional — pule se não houver.</p>
                        </div>

                        <div className="ent-form-grid">
                            <div className="ent-field ent-field--full">
                                <label>Código de barras do boleto</label>
                                <input
                                    className="ui-input"
                                    value={boletos[0]?.code || ''}
                                    onChange={(e) => updateBoleto(0, 'code', e.target.value)}
                                    placeholder="Linha digitável"
                                    autoFocus
                                />
                            </div>

                            <div className="ent-field">
                                <label>Valor do boleto</label>
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={boletos[0]?.amount || ''}
                                    onChange={(e) => updateBoleto(0, 'amount', e.target.value)}
                                    placeholder="R$ 0,00"
                                />
                            </div>

                            <div className="ent-field">
                                <label>Vencimento</label>
                                <input
                                    className="ui-input"
                                    type="date"
                                    value={boletos[0]?.due || ''}
                                    onChange={(e) => updateBoleto(0, 'due', e.target.value)}
                                />
                            </div>

                            <div className="ent-field ent-field--full">
                                <label>Observação</label>
                                <textarea
                                    className="ui-textarea"
                                    rows="2"
                                    value={boletos[0]?.notes || ''}
                                    onChange={(e) => updateBoleto(0, 'notes', e.target.value)}
                                    placeholder="Informações adicionais..."
                                />
                            </div>
                        </div>

                        {boletos.slice(1).map((boleto, offset) => {
                            const boletoIndex = offset + 1

                            return (
                                <div className="ent-boleto-extra" key={boleto.id}>
                                    <div className="ent-boleto-extra-head">
                                        <strong>Boleto {boletoIndex + 1}</strong>
                                        <button type="button" className="ent-remove-btn" onClick={() => removeBoleto(boletoIndex)}>
                                            <i className="fa-solid fa-xmark" />
                                        </button>
                                    </div>

                                    <div className="ent-form-grid">
                                        <div className="ent-field ent-field--full">
                                            <label>Codigo de barras do boleto</label>
                                            <input
                                                className="ui-input"
                                                value={boleto.code}
                                                onChange={(e) => updateBoleto(boletoIndex, 'code', e.target.value)}
                                                placeholder="Linha digitavel"
                                            />
                                        </div>

                                        <div className="ent-field">
                                            <label>Valor do boleto</label>
                                            <input
                                                className="ui-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={boleto.amount}
                                                onChange={(e) => updateBoleto(boletoIndex, 'amount', e.target.value)}
                                                placeholder="R$ 0,00"
                                            />
                                        </div>

                                        <div className="ent-field">
                                            <label>Vencimento</label>
                                            <input
                                                className="ui-input"
                                                type="date"
                                                value={boleto.due}
                                                onChange={(e) => updateBoleto(boletoIndex, 'due', e.target.value)}
                                            />
                                        </div>

                                        <div className="ent-field ent-field--full">
                                            <label>Observacao</label>
                                            <textarea
                                                className="ui-textarea"
                                                rows="2"
                                                value={boleto.notes}
                                                onChange={(e) => updateBoleto(boletoIndex, 'notes', e.target.value)}
                                                placeholder="Informacoes adicionais..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        <div className="ent-boleto-actions">
                            <button type="button" className="ent-add-boleto-btn" onClick={addBoleto}>
                                <i className="fa-solid fa-plus" />
                                Adicionar boleto
                            </button>
                        </div>

                        <div className="ent-step-nav">
                            <button type="button" className="ent-back-btn" onClick={() => setStep(2)}>
                                <i className="fa-solid fa-arrow-left" /> Voltar
                            </button>
                            <button type="button" className="ent-confirm-btn" onClick={() => setStep(4)}>
                                {activeBoletos.length ? 'Avancar - Confirmar' : 'Pular - Confirmar'}
                                <i className="fa-solid fa-arrow-right" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ════ ETAPA 4 — Confirmar ════ */}
                {step === 4 && (
                    <div className="ent-step-card">
                        <div className="ent-step-card-head">
                            <h2>Confirmar entrada</h2>
                            <p>Revise as informações abaixo antes de registrar.</p>
                        </div>

                        {/* Resumo da identificação */}
                        <div className="ent-summary-row">
                            <div className="ent-summary-item">
                                <span>Data</span>
                                <strong>{formatDate(entryDate)}</strong>
                            </div>
                            <div className="ent-summary-item">
                                <span>Fornecedor</span>
                                <strong>{supplierName || '—'}</strong>
                            </div>
                            <div className="ent-summary-item">
                                <span>Referência</span>
                                <strong>{reference || '—'}</strong>
                            </div>
                        </div>

                        {/* Resumo de produtos */}
                        <div className="ent-summary-section">
                            <div className="ent-summary-section-title">
                                <i className="fa-solid fa-boxes-stacked" />
                                {items.length} produto(s) · {formatNumber(totalQty)} unidade(s)
                            </div>
                            <div className="ent-items-table">
                                <table className="ent-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th style={{ width: 80, textAlign: 'right' }}>Qtd</th>
                                            <th style={{ width: 110, textAlign: 'right' }}>Custo</th>
                                            <th style={{ width: 100, textAlign: 'right' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => (
                                            <tr key={item.product.id}>
                                                <td><strong>{item.product.name}</strong></td>
                                                <td className="ent-subtotal">{formatNumber(item.quantity)} {item.product.unit || 'UN'}</td>
                                                <td className="ent-subtotal">{formatMoney(Number(item.cost || 0))}</td>
                                                <td className="ent-subtotal">{formatMoney(Number(item.quantity) * Number(item.cost || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="ent-items-footer">
                                    <span>Total da entrada</span>
                                    <strong>{formatMoney(totalValue)}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Resumo do boleto (se preenchido) */}
                        {activeBoletos.length > 0 && (
                            <div className="ent-summary-section">
                                <div className="ent-summary-section-title">
                                    <i className="fa-solid fa-receipt" />
                                    {activeBoletos.length === 1 ? 'Boleto' : `${activeBoletos.length} boletos`}
                                </div>
                                {activeBoletos.map((boleto, index) => (
                                    <div className="ent-summary-row" key={`boleto-summary-${boleto.id || index}`}>
                                        <div className="ent-summary-item">
                                            <span>Parcela</span>
                                            <strong>{index + 1}/{activeBoletos.length}</strong>
                                        </div>
                                        {Number(boleto.amount || 0) > 0 ? (
                                            <div className="ent-summary-item">
                                                <span>Valor</span>
                                                <strong>{formatMoney(Number(boleto.amount))}</strong>
                                            </div>
                                        ) : null}
                                        {boleto.due ? (
                                            <div className="ent-summary-item">
                                                <span>Vencimento</span>
                                                <strong>{formatDate(boleto.due)}</strong>
                                            </div>
                                        ) : null}
                                        {boleto.code ? (
                                            <div className="ent-summary-item ent-summary-item--wide">
                                                <span>Codigo de barras</span>
                                                <strong className="ent-barcode-text">{boleto.code}</strong>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}

                        {flash && (
                            <div className={`ent-flash ent-flash--${flash.type}`}>
                                <i className={`fa-solid ${flash.type === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                {flash.text}
                            </div>
                        )}

                        <div className="ent-step-nav">
                            <button type="button" className="ent-back-btn" onClick={() => setStep(3)} disabled={saving}>
                                <i className="fa-solid fa-arrow-left" /> Voltar
                            </button>
                            <button
                                type="button"
                                className="ent-confirm-btn"
                                onClick={handleConfirm}
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" />
                                        {progress ? `${progress.done} / ${progress.total}` : 'Salvando...'}
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check" />
                                        Registrar entrada
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
