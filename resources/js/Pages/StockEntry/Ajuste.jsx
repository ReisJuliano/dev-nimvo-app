import { Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './stock-entry-simple.css'

function getStockState(product) {
    const stock = Number(product.stock_quantity || 0)
    const min   = Number(product.min_stock || 0)
    if (stock <= 0) return 'zero'
    if (stock <= min) return 'low'
    return 'ok'
}

export default function StockAjustePage({ payload }) {
    const products = Array.isArray(payload?.products) ? payload.products : []
    const [localProducts, setLocalProducts] = useState(products)
    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState(null)
    const [newQty, setNewQty] = useState('')
    const [reason, setReason] = useState('Ajuste manual de estoque')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const results = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return []
        return localProducts.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q)).slice(0, 10)
    }, [localProducts, query])

    const delta = selected && newQty !== ''
        ? Number(newQty) - Number(selected.stock_quantity || 0)
        : null

    function selectProduct(product) {
        setSelected(product)
        setQuery('')
        setNewQty(String(product.stock_quantity || 0))
        setFeedback(null)
    }

    function reset() {
        setSelected(null)
        setQuery('')
        setNewQty('')
        setReason('Ajuste manual de estoque')
        setNotes('')
        setFeedback(null)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!selected) { setFeedback({ type: 'error', text: 'Selecione um produto.' }); return }
        if (newQty === '') { setFeedback({ type: 'error', text: 'Informe o novo estoque.' }); return }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Confirmar ajuste',
            message: `Atualizar "${selected.name}" de ${formatNumber(selected.stock_quantity || 0)} para ${formatNumber(Number(newQty))} ${selected.unit || 'UN'}?`,
            confirmLabel: 'Confirmar',
            cancelLabel: 'Cancelar',
        })
        if (!confirmed) return

        setSaving(true)
        setFeedback(null)
        try {
            const res = await apiRequest('/api/stock/quick-adjust', {
                method: 'post',
                data: {
                    product_id: selected.id,
                    counted_quantity: Number(newQty),
                    reason: reason.trim() || null,
                    notes: notes.trim() || null,
                },
            })
            const updated = res.product
            setLocalProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p))
            setSelected((prev) => prev ? { ...prev, ...updated } : prev)
            setNewQty(String(updated.stock_quantity))
            setFeedback({ type: 'success', text: res.message })
            setNotes('')
        } catch (err) {
            setFeedback({ type: 'error', text: err.message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <AppLayout title="Ajuste de estoque">
            <div className="se-page">

                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.2)' }}>
                            <i className="fa-solid fa-scale-balanced" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Ajuste de estoque</h1>
                            <p className="se-header-sub">Corrija a quantidade de um produto após inventário ou diferença identificada.</p>
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
                            <div className="se-form-card-icon se-form-card-icon--violet">
                                <i className="fa-solid fa-scale-balanced" />
                            </div>
                            <div>
                                <h2>Ajustar quantidade</h2>
                                <p>Busque o produto e informe o estoque real contado.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="se-form-body">

                            {/* Busca */}
                            {!selected ? (
                                <div className="se-form-section">
                                    <label className="se-form-label">Produto</label>
                                    <div className="se-product-search">
                                        <label className="se-search-wrap">
                                            <i className="fa-solid fa-magnifying-glass" />
                                            <input
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Nome, código ou EAN..."
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
                                                    <button key={p.id} type="button" className="se-search-result" onClick={() => selectProduct(p)}>
                                                        <div>
                                                            <strong>{p.name}</strong>
                                                            <small>{p.code || p.barcode || 'Sem código'}</small>
                                                        </div>
                                                        <span className={`se-stock-badge se-stock-badge--${getStockState(p)}`}>
                                                            {formatNumber(p.stock_quantity || 0)} {p.unit || 'UN'}
                                                        </span>
                                                    </button>
                                                )) : (
                                                    <div className="se-search-empty">Nenhum produto encontrado.</div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Produto selecionado */}
                                    <div className="se-selected-product" style={{ background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}>
                                        <div className="se-selected-info">
                                            <strong>{selected.name}</strong>
                                            <small>
                                                Estoque atual: <b>{formatNumber(selected.stock_quantity || 0)} {selected.unit || 'UN'}</b>
                                                {selected.code ? ` · ${selected.code}` : ''}
                                            </small>
                                        </div>
                                        <button type="button" className="se-deselect-btn" style={{ borderColor: 'rgba(139,92,246,0.25)', color: '#8b5cf6' }} onClick={reset}>
                                            <i className="fa-solid fa-xmark" /> Trocar
                                        </button>
                                    </div>

                                    {/* Campos */}
                                    <div className="se-form-row">
                                        <div className="se-form-section">
                                            <label className="se-form-label">Novo estoque (total real) *</label>
                                            <input
                                                className="ui-input"
                                                type="number"
                                                min="0"
                                                step="0.001"
                                                value={newQty}
                                                onChange={(e) => setNewQty(e.target.value)}
                                                placeholder={`Quantidade em ${selected.unit || 'UN'}`}
                                                autoFocus
                                                required
                                            />
                                        </div>
                                        <div className="se-form-section">
                                            <label className="se-form-label">Motivo do ajuste</label>
                                            <input
                                                className="ui-input"
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                placeholder="Ex: Inventário, quebra, furto..."
                                            />
                                        </div>
                                    </div>

                                    {delta !== null ? (
                                        <div className={`se-adjust-preview ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}`}>
                                            <i className={`fa-solid ${delta > 0 ? 'fa-arrow-trend-up' : delta < 0 ? 'fa-arrow-trend-down' : 'fa-equals'}`} />
                                            {delta === 0
                                                ? 'Sem alteração no estoque'
                                                : `Diferença: ${delta > 0 ? '+' : ''}${formatNumber(delta)} ${selected.unit || 'UN'}`
                                            }
                                        </div>
                                    ) : null}

                                    <div className="se-form-section">
                                        <label className="se-form-label">Observação (opcional)</label>
                                        <textarea
                                            className="ui-textarea"
                                            rows="2"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </div>
                                </>
                            )}

                            {feedback ? (
                                <div className={`se-feedback se-feedback--${feedback.type}`}>
                                    <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                    {feedback.text}
                                </div>
                            ) : null}

                            {selected ? (
                                <div className="se-form-actions">
                                    <button type="button" className="ui-button-ghost" onClick={reset}>
                                        <i className="fa-solid fa-rotate-left" /> Cancelar
                                    </button>
                                    <button type="submit" className="se-submit-btn se-submit-btn--violet" disabled={saving}>
                                        <i className="fa-solid fa-check" />
                                        {saving ? 'Salvando...' : 'Confirmar ajuste'}
                                    </button>
                                </div>
                            ) : null}
                        </form>
                    </div>

                    <div className="se-tab-side">
                        <div className="se-info-card">
                            <div className="se-info-card-header">
                                <i className="fa-solid fa-circle-info" /> Ajuste vs. Entrada
                            </div>
                            <div className="se-info-compare">
                                <div className="se-info-compare-item">
                                    <strong>Entrada</strong>
                                    <span>Adiciona à quantidade atual. Use quando chegou mercadoria.</span>
                                </div>
                                <div className="se-info-compare-item se-info-compare-item--active">
                                    <strong>Ajuste (esta tela)</strong>
                                    <span>Define o total exato. Use após inventário físico ou identificação de erro.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
