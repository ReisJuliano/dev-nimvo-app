import { Link } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatMoney, formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './entrada.css'

/* ─── helpers ─── */

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

/* ─── Componente ─── */

function todayValue() {
    return new Date().toISOString().slice(0, 10)
}

export default function StockEntradaPage({ payload }) {
    const products  = useMemo(() => Array.isArray(payload?.products)  ? payload.products  : [], [payload])
    const suppliers = useMemo(() => Array.isArray(payload?.suppliers) ? payload.suppliers : [], [payload])

    // Header da entrada
    const [entryDate, setEntryDate]         = useState(todayValue)
    const [entrySupplier, setEntrySupplier] = useState('')
    const [entryName, setEntryName]         = useState('')

    const [items, setItems] = useState([])
    const [scanValue, setScanValue] = useState('')
    const [textSearch, setTextSearch] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [flash, setFlash] = useState(null)
    const [saving, setSaving] = useState(false)
    const [progress, setProgress] = useState(null)

    const scanRef = useRef(null)
    const flashTimer = useRef(null)

    const totalItems = items.reduce((s, i) => s + i.quantity, 0)
    const totalValue = items.reduce((s, i) => s + i.quantity * Number(i.cost || 0), 0)

    /* Mantém o input de scan sempre focado */
    const refocus = useCallback(() => {
        setTimeout(() => scanRef.current?.focus(), 30)
    }, [])

    useEffect(() => {
        refocus()
    }, [refocus])

    /* Clique em qualquer lugar da página → volta o foco pro scan */
    useEffect(() => {
        function handleClick(e) {
            const tag = e.target.tagName
            if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return
            refocus()
        }
        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [refocus])

    function showFlash(type, text) {
        clearTimeout(flashTimer.current)
        setFlash({ type, text })
        flashTimer.current = setTimeout(() => setFlash(null), 2200)
    }

    /* Busca de texto para dropdown */
    useEffect(() => {
        const q = normalizeTextSearch(textSearch)
        if (!q) { setSearchResults([]); return }
        setSearchResults(
            products
                .filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
                .slice(0, 8),
        )
    }, [textSearch, products])

    /* Adiciona produto à lista (barcode ou seleção manual) */
    function addProduct(product) {
        setItems((prev) => upsertItem(prev, product))
        setScanValue('')
        setTextSearch('')
        setSearchResults([])
        showFlash('ok', `${product.name} adicionado`)
        refocus()
    }

    /* Tenta resolver um código bipado */
    function handleScan() {
        const raw = scanValue.trim()
        if (!raw) return

        const found = findByBarcode(products, raw)
        if (found) {
            addProduct(found)
        } else {
            showFlash('err', `Produto não encontrado: "${raw}"`)
            setScanValue('')
            refocus()
        }
    }

    /* Edição inline na tabela */
    function updateItem(idx, field, val) {
        setItems((prev) =>
            prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)),
        )
    }

    function removeItem(idx) {
        setItems((prev) => prev.filter((_, i) => i !== idx))
        refocus()
    }

    /* Confirma tudo */
    async function handleConfirm() {
        if (!items.length) return
        setSaving(true)
        setProgress({ done: 0, total: items.length })

        let erros = 0
        for (let i = 0; i < items.length; i++) {
            const { product, quantity, cost } = items[i]
            try {
                await apiRequest('/api/stock/quick-receive', {
                    method: 'post',
                    data: {
                        product_id: product.id,
                        quantity: Number(quantity),
                        cost_price: cost ? Number(cost) : null,
                    },
                })
            } catch {
                erros++
            }
            setProgress({ done: i + 1, total: items.length })
        }

        setSaving(false)
        setProgress(null)

        if (erros === 0) {
            showFlash('ok', `${items.length} produto(s) registrado(s) com sucesso!`)
            setItems([])
        } else {
            showFlash('err', `${erros} produto(s) falharam. Verifique e tente novamente.`)
        }
        refocus()
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
                            <p className="ent-header-sub">
                                Bipe os produtos — eles vão acumulando na lista abaixo.
                            </p>
                        </div>
                    </div>
                    <Link href="/estoque" className="se-action-btn se-action-btn--ghost">
                        <i className="fa-solid fa-arrow-left" /> Voltar
                    </Link>
                </div>

                {/* Mini-form: cabeçalho da entrada */}
                <div className="ent-meta-card">
                    <div className="ent-meta-field">
                        <label className="ent-meta-label">Data da entrada</label>
                        <input
                            type="date"
                            className="ent-meta-input"
                            value={entryDate}
                            onChange={(e) => setEntryDate(e.target.value)}
                        />
                    </div>
                    <div className="ent-meta-field">
                        <label className="ent-meta-label">Fornecedor <span>(opcional)</span></label>
                        <select
                            className="ent-meta-input"
                            value={entrySupplier}
                            onChange={(e) => setEntrySupplier(e.target.value)}
                        >
                            <option value="">Sem fornecedor</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="ent-meta-field ent-meta-field--wide">
                        <label className="ent-meta-label">Identificação <span>(opcional)</span></label>
                        <input
                            className="ent-meta-input"
                            value={entryName}
                            onChange={(e) => setEntryName(e.target.value)}
                            placeholder="Ex: NF 1234, Entrega da manhã..."
                        />
                    </div>
                </div>

                {/* Flash feedback */}
                {flash ? (
                    <div className={`ent-flash ent-flash--${flash.type}`}>
                        <i className={`fa-solid ${flash.type === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                        {flash.text}
                    </div>
                ) : null}

                {/* Zona de scan — sempre focada */}
                <div className="ent-scan-zone">
                    <div className="ent-scan-main">
                        <div className="ent-scan-icon">
                            <i className="fa-solid fa-barcode" />
                        </div>
                        <input
                            ref={scanRef}
                            className="ent-scan-input"
                            value={scanValue}
                            onChange={(e) => setScanValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleScan()
                                }
                            }}
                            placeholder="Bipe o código de barras aqui..."
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {scanValue ? (
                            <button type="button" className="ent-scan-add" onClick={handleScan}>
                                <i className="fa-solid fa-plus" />
                            </button>
                        ) : null}
                    </div>

                    {/* Busca por nome (alternativa ao barcode) */}
                    <div className="ent-search-wrap">
                        <div className="ent-search-field">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                className="ent-search-input"
                                value={textSearch}
                                onChange={(e) => setTextSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && searchResults.length) {
                                        e.preventDefault()
                                        addProduct(searchResults[0])
                                    }
                                    if (e.key === 'Escape') {
                                        setTextSearch('')
                                        setSearchResults([])
                                        refocus()
                                    }
                                }}
                                placeholder="Ou busque pelo nome..."
                                autoComplete="off"
                            />
                            {textSearch ? (
                                <button type="button" onClick={() => { setTextSearch(''); setSearchResults([]) }}>
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            ) : null}
                        </div>

                        {searchResults.length > 0 ? (
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
                        ) : null}
                    </div>
                </div>

                {/* Lista de itens acumulados */}
                {items.length > 0 ? (
                    <div className="ent-table-card">
                        <div className="ent-table-head">
                            <span>{items.length} produto(s) · {formatNumber(totalItems)} unidade(s)</span>
                            <button type="button" className="ent-clear-btn" onClick={() => { setItems([]); refocus() }}>
                                <i className="fa-solid fa-trash" /> Limpar tudo
                            </button>
                        </div>

                        <div className="ent-table-wrap">
                            <table className="ent-table">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th style={{ width: 90 }}>Qtd</th>
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
                                                <input
                                                    className="ent-num-input"
                                                    type="number"
                                                    min="0.001"
                                                    step="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="ent-num-input"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={item.cost}
                                                    onChange={(e) => updateItem(idx, 'cost', e.target.value)}
                                                    placeholder="0,00"
                                                />
                                            </td>
                                            <td className="ent-subtotal">
                                                {formatMoney(item.quantity * Number(item.cost || 0))}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="ent-remove-btn"
                                                    onClick={() => removeItem(idx)}
                                                    title="Remover"
                                                >
                                                    <i className="fa-solid fa-xmark" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="ent-table-footer">
                            <span className="ent-total-label">
                                Total da entrada: <strong>{formatMoney(totalValue)}</strong>
                            </span>
                            <button
                                type="button"
                                className="ent-confirm-btn"
                                onClick={handleConfirm}
                                disabled={saving || !items.length}
                            >
                                {saving ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" />
                                        {progress ? `${progress.done}/${progress.total}` : 'Salvando...'}
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check" />
                                        Confirmar entrada ({items.length})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="ent-empty">
                        <i className="fa-solid fa-barcode" />
                        <strong>Nenhum produto bipado ainda</strong>
                        <p>Bipe os produtos acima — eles aparecem aqui automaticamente.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}
