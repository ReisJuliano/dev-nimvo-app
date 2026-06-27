import { Link } from '@inertiajs/react'
import { useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatMoney, formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './stock-entry-simple.css'

function ProductPicker({ products, query, setQuery, selected, onSelect, onClear }) {
    const results = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return []
        return products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q)).slice(0, 10)
    }, [products, query])

    if (selected) {
        return (
            <div className="se-selected-product">
                <div className="se-selected-info">
                    <strong>{selected.name}</strong>
                    <small>
                        Estoque atual: {formatNumber(selected.stock_quantity || 0)} {selected.unit || 'UN'}
                        {selected.cost_price ? ` · Custo: ${formatMoney(selected.cost_price)}` : ''}
                    </small>
                </div>
                <button type="button" className="se-deselect-btn" onClick={onClear}>
                    <i className="fa-solid fa-xmark" /> Trocar
                </button>
            </div>
        )
    }

    return (
        <div className="se-product-search">
            <label className="se-search-wrap">
                <i className="fa-solid fa-magnifying-glass" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome, código ou EAN do produto..."
                    autoFocus
                    autoComplete="off"
                />
                {query ? (
                    <button type="button" className="se-clear-search" onClick={() => setQuery('')}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                ) : null}
            </label>
            {query.trim() ? (
                <div className="se-search-results">
                    {results.length ? results.map((p) => (
                        <button key={p.id} type="button" className="se-search-result" onClick={() => onSelect(p)}>
                            <div>
                                <strong>{p.name}</strong>
                                <small>{p.code || p.barcode || 'Sem código'}</small>
                            </div>
                            <span className={`se-stock-badge se-stock-badge--${Number(p.stock_quantity || 0) <= 0 ? 'zero' : Number(p.stock_quantity) <= Number(p.min_stock || 0) ? 'low' : 'ok'}`}>
                                {formatNumber(p.stock_quantity || 0)} {p.unit || 'UN'}
                            </span>
                        </button>
                    )) : (
                        <div className="se-search-empty">Nenhum produto encontrado para &ldquo;{query}&rdquo;</div>
                    )}
                </div>
            ) : null}
        </div>
    )
}

export default function StockEntradaPage({ payload }) {
    const products = Array.isArray(payload?.products) ? payload.products : []
    const [localProducts, setLocalProducts] = useState(products)
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState(null)
    const [qty, setQty] = useState('')
    const [cost, setCost] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const qtyRef = useRef(null)

    function selectProduct(product) {
        setSelected(product)
        setQuery('')
        setCost(String(product.cost_price || ''))
        setQty('')
        setFeedback(null)
        setTimeout(() => qtyRef.current?.focus(), 50)
    }

    function reset() {
        setSelected(null)
        setQuery('')
        setQty('')
        setCost('')
        setNotes('')
        setFeedback(null)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!selected) { setFeedback({ type: 'error', text: 'Selecione um produto.' }); return }
        if (!qty || Number(qty) <= 0) { setFeedback({ type: 'error', text: 'Informe a quantidade recebida.' }); return }

        setSaving(true)
        setFeedback(null)
        try {
            const res = await apiRequest('/api/stock/quick-receive', {
                method: 'post',
                data: {
                    product_id: selected.id,
                    quantity: Number(qty),
                    cost_price: cost ? Number(cost) : null,
                    notes: notes.trim() || null,
                },
            })
            const updated = res.product
            setLocalProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p))
            setSelected((prev) => prev ? { ...prev, ...updated } : prev)
            setFeedback({ type: 'success', text: res.message })
            setQty('')
            setNotes('')
        } catch (err) {
            setFeedback({ type: 'error', text: err.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <AppLayout title="Entrada de mercadoria">
            <div className="se-page">

                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', borderColor: 'rgba(6,182,212,0.2)' }}>
                            <i className="fa-solid fa-arrow-down-to-bracket" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Entrada de mercadoria</h1>
                            <p className="se-header-sub">Registre o que chegou na loja. Rápido, sem nota fiscal.</p>
                        </div>
                    </div>
                    <div className="se-header-actions">
                        <Link href="/estoque" className="se-action-btn se-action-btn--ghost">
                            <i className="fa-solid fa-arrow-left" /> Ver estoque
                        </Link>
                    </div>
                </div>

                <div className="se-entry-layout">
                    <div className="se-form-card">
                        <div className="se-form-card-header">
                            <div className="se-form-card-icon se-form-card-icon--teal">
                                <i className="fa-solid fa-dolly" />
                            </div>
                            <div>
                                <h2>Registrar entrada</h2>
                                <p>Busque o produto e informe a quantidade que chegou.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="se-form-body">
                            <div className="se-form-section">
                                <label className="se-form-label">Produto</label>
                                <ProductPicker
                                    products={localProducts}
                                    query={query}
                                    setQuery={setQuery}
                                    selected={selected}
                                    onSelect={selectProduct}
                                    onClear={reset}
                                />
                            </div>

                            {selected ? (
                                <>
                                    <div className="se-form-row">
                                        <div className="se-form-section">
                                            <label className="se-form-label">Quantidade recebida *</label>
                                            <input
                                                ref={qtyRef}
                                                className="ui-input"
                                                type="number"
                                                min="0.001"
                                                step="0.001"
                                                value={qty}
                                                onChange={(e) => setQty(e.target.value)}
                                                placeholder={`Em ${selected.unit || 'UN'}`}
                                                required
                                            />
                                        </div>
                                        <div className="se-form-section">
                                            <label className="se-form-label">Custo unitário (opcional)</label>
                                            <input
                                                className="ui-input"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={cost}
                                                onChange={(e) => setCost(e.target.value)}
                                                placeholder="R$ 0,00"
                                            />
                                        </div>
                                    </div>
                                    <div className="se-form-section">
                                        <label className="se-form-label">Observação (opcional)</label>
                                        <input
                                            className="ui-input"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Ex: chegou no caminhão da manhã..."
                                        />
                                    </div>
                                </>
                            ) : null}

                            {feedback ? (
                                <div className={`se-feedback se-feedback--${feedback.type}`}>
                                    <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                    {feedback.text}
                                </div>
                            ) : null}

                            {selected ? (
                                <div className="se-form-actions">
                                    <button type="button" className="ui-button-ghost" onClick={reset}>
                                        <i className="fa-solid fa-rotate-left" /> Limpar
                                    </button>
                                    <button type="submit" className="se-submit-btn se-submit-btn--teal" disabled={saving}>
                                        <i className="fa-solid fa-check" />
                                        {saving ? 'Registrando...' : 'Confirmar entrada'}
                                    </button>
                                </div>
                            ) : null}
                        </form>
                    </div>

                    <div className="se-tab-side">
                        <div className="se-info-card">
                            <div className="se-info-card-header">
                                <i className="fa-solid fa-circle-info" /> Como funciona
                            </div>
                            <ol className="se-info-steps">
                                <li>Busque o produto pelo nome ou código</li>
                                <li>Informe a quantidade que chegou</li>
                                <li>Informe o custo se quiser atualizar</li>
                                <li>Confirme — estoque é atualizado na hora</li>
                            </ol>
                            </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
