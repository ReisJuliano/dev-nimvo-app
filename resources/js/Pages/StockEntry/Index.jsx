import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format'
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

const TYPE_LABELS = {
    manual_inbound:    'Entrada manual',
    manual_adjustment: 'Ajuste de estoque',
    sale:              'Saída por venda',
    purchase_return:   'Devolução',
    sale_cancellation: 'Cancel. de venda',
    loss:              'Perda registrada',
    initial:           'Estoque inicial',
}

const TYPE_TONES = {
    manual_inbound:    'green',
    manual_adjustment: 'amber',
    sale:              'red',
    purchase_return:   'blue',
    sale_cancellation: 'gray',
    loss:              'red',
    initial:           'blue',
}

export default function StockEntryIndex({ payload }) {
    const [products, setProducts] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [query, setQuery] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)

    // Painel de movimentação
    const [movements, setMovements] = useState([])
    const [movLoading, setMovLoading] = useState(false)
    const [movSearched, setMovSearched] = useState(false)
    const [movFilter, setMovFilter] = useState('')
    const [movFrom, setMovFrom] = useState('')
    const [movTo, setMovTo] = useState('')

    // Ajuste de estoque (inline, dentro do painel do produto)
    const [adjusting, setAdjusting] = useState(false)
    const [adjustQty, setAdjustQty] = useState('')
    const [adjustReason, setAdjustReason] = useState('Ajuste manual de estoque')
    const [adjustNotes, setAdjustNotes] = useState('')
    const [adjustSaving, setAdjustSaving] = useState(false)
    const [adjustFeedback, setAdjustFeedback] = useState(null)

    // Registrar perda (inline, dentro do painel do produto)
    const [registeringLoss, setRegisteringLoss] = useState(false)
    const [lossQty, setLossQty] = useState('')
    const [lossReason, setLossReason] = useState('vencido')
    const [lossSaving, setLossSaving] = useState(false)
    const [lossFeedback, setLossFeedback] = useState(null)

    // Painel "Vencendo em breve"
    const [showExpiring, setShowExpiring] = useState(false)
    const [expiringLots, setExpiringLots] = useState([])
    const [expiringLoading, setExpiringLoading] = useState(false)

    const filteredProducts = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return products
        return products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
    }, [products, query])

    async function loadMovements(product, type = '', from = '', to = '') {
        setMovLoading(true)
        setMovSearched(true)
        try {
            const params = {}
            if (type) params.type = type
            if (from) params.from = from
            if (to)   params.to   = to
            const res = await apiRequest(`/api/stock/products/${product.id}/movements`, { params })
            setMovements(res.movements || [])
        } catch {
            setMovements([])
        } finally {
            setMovLoading(false)
        }
    }

    function openProduct(product) {
        setSelectedProduct(product)
        setMovements([])
        setMovSearched(false)
        setMovFilter('')
        setMovFrom('')
        setMovTo('')
        cancelAdjust()
    }

    function closePanel() {
        setSelectedProduct(null)
        setMovements([])
        setMovSearched(false)
        cancelAdjust()
    }

    function applyMovFilter() {
        if (selectedProduct) loadMovements(selectedProduct, movFilter, movFrom, movTo)
    }

    function startAdjust() {
        setAdjusting(true)
        setAdjustQty(String(selectedProduct?.stock_quantity || 0))
        setAdjustReason('Ajuste manual de estoque')
        setAdjustNotes('')
        setAdjustFeedback(null)
    }

    function cancelAdjust() {
        setAdjusting(false)
        setAdjustQty('')
        setAdjustReason('Ajuste manual de estoque')
        setAdjustNotes('')
        setAdjustFeedback(null)
    }

    function startLoss() {
        setRegisteringLoss(true)
        setLossQty('')
        setLossReason('vencido')
        setLossFeedback(null)
    }

    function cancelLoss() {
        setRegisteringLoss(false)
        setLossQty('')
        setLossFeedback(null)
    }

    async function submitLoss(event, expiryLot = null) {
        event.preventDefault()
        const targetProduct = expiryLot ? { id: expiryLot.product_id, name: expiryLot.product_name } : selectedProduct
        const quantity = expiryLot ? expiryLot.quantity : Number(lossQty)

        if (!targetProduct || !quantity) return

        setLossSaving(true)
        setLossFeedback(null)
        try {
            const res = await apiRequest('/api/stock/register-loss', {
                method: 'post',
                data: {
                    product_id: targetProduct.id,
                    quantity,
                    reason: lossReason,
                    expiry_id: expiryLot?.id || null,
                },
            })
            if (res.product) {
                setProducts((prev) => prev.map((p) => String(p.id) === String(res.product.id) ? { ...p, ...res.product } : p))
                setSelectedProduct((prev) => prev && String(prev.id) === String(res.product.id) ? { ...prev, ...res.product } : prev)
            }
            setLossFeedback({ type: 'success', text: res.message })
            setRegisteringLoss(false)
            if (expiryLot) {
                await loadExpiring()
            } else if (selectedProduct) {
                loadMovements(selectedProduct)
            }
        } catch (err) {
            setLossFeedback({ type: 'error', text: err.message })
        } finally {
            setLossSaving(false)
        }
    }

    async function loadExpiring() {
        setExpiringLoading(true)
        try {
            const res = await apiRequest('/api/stock/expiring')
            setExpiringLots(res.lots || [])
        } catch {
            setExpiringLots([])
        } finally {
            setExpiringLoading(false)
        }
    }

    function toggleExpiring() {
        setShowExpiring((current) => {
            const next = !current
            if (next) loadExpiring()
            return next
        })
    }

    async function submitAdjust(event) {
        event.preventDefault()
        if (!selectedProduct || adjustQty === '') return

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Confirmar ajuste',
            message: `Atualizar "${selectedProduct.name}" de ${formatNumber(selectedProduct.stock_quantity || 0)} para ${formatNumber(Number(adjustQty))} ${selectedProduct.unit || 'UN'}?`,
            confirmLabel: 'Confirmar',
            cancelLabel: 'Cancelar',
        })
        if (!confirmed) return

        setAdjustSaving(true)
        setAdjustFeedback(null)
        try {
            const res = await apiRequest('/api/stock/quick-adjust', {
                method: 'post',
                data: {
                    product_id: selectedProduct.id,
                    counted_quantity: Number(adjustQty),
                    reason: adjustReason.trim() || null,
                    notes: adjustNotes.trim() || null,
                },
            })
            const updated = res.product
            setProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p))
            setSelectedProduct((prev) => prev ? { ...prev, ...updated } : prev)
            setAdjustFeedback({ type: 'success', text: res.message })
            setAdjusting(false)
            loadMovements({ id: updated.id })
        } catch (err) {
            setAdjustFeedback({ type: 'error', text: err.message })
        } finally {
            setAdjustSaving(false)
        }
    }

    // Fechar painel com Escape
    useEffect(() => {
        function onKey(e) { if (e.key === 'Escape') closePanel() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    const movTypes = [...new Set(movements.map((m) => m.type))]

    return (
        <AppLayout title="Estoque">
            <div className="se-page">

                {/* ─── Header ─── */}
                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon">
                            <i className="fa-solid fa-warehouse" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Estoque de produtos</h1>
                            <p className="se-header-sub">Pesquise um produto para ver o estoque e a movimentação.</p>
                        </div>
                    </div>
                    <button type="button" className="ui-button-ghost" onClick={toggleExpiring}>
                        <i className="fa-solid fa-calendar-days" /> {showExpiring ? 'Ocultar vencendo' : 'Vencendo em breve'}
                    </button>
                </div>

                {showExpiring ? (
                    <div className="se-table-card" style={{ margin: '0 0 1rem' }}>
                        {expiringLoading ? (
                            <div className="se-mov-loading"><i className="fa-solid fa-spinner fa-spin" /> Carregando...</div>
                        ) : expiringLots.length ? (
                            <table className="se-table">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Categoria</th>
                                        <th>Vence em</th>
                                        <th>Quantidade</th>
                                        <th>Custo em risco</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expiringLots.map((lot) => (
                                        <tr key={lot.id} className={lot.is_past ? 'se-row--zero' : 'se-row--low'}>
                                            <td>{lot.product_name}</td>
                                            <td>{lot.category_name || 'Sem categoria'}</td>
                                            <td>{formatDateTime(lot.expires_at)}</td>
                                            <td>{formatNumber(lot.quantity)}</td>
                                            <td>{formatMoney(lot.cost_at_risk)}</td>
                                            <td>
                                                <button type="button" className="ui-button-ghost" disabled={lossSaving} onClick={(event) => submitLoss(event, lot)}>
                                                    Registrar perda
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="se-empty-state"><strong>Nenhum lote vencendo no período configurado.</strong></div>
                        )}
                    </div>
                ) : null}

                <div className="se-split">
                    {/* ─── Busca + tabela ─── */}
                    <div className="se-list-col">
                        <div className="se-search-bar">
                            <label className="se-search-wrap" style={{ flex: 1 }}>
                                <i className="fa-solid fa-magnifying-glass" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Buscar por nome, código ou código de barras..."
                                    autoFocus
                                />
                                {query ? (
                                    <button type="button" className="se-clear-search" onClick={() => setQuery('')}>
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                ) : null}
                            </label>
                        </div>

                        {!products.length ? (
                            <div className="se-empty-state">
                                <div className="se-empty-icon"><i className="fa-solid fa-box-open" /></div>
                                <strong>Nenhum produto cadastrado</strong>
                                <p>Cadastre produtos primeiro.</p>
                                <Link className="ui-button" href="/produtos">Cadastrar produto</Link>
                            </div>
                        ) : filteredProducts.length ? (
                            <div className="se-table-card">
                                <table className="se-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Em estoque</th>
                                            <th>Mínimo</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.map((product) => {
                                            const state = getStockState(product)
                                            const isSelected = selectedProduct?.id === product.id
                                            return (
                                                <tr
                                                    key={product.id}
                                                    className={`se-row se-row--${state} se-row--clickable ${isSelected ? 'se-row--selected' : ''}`}
                                                    onClick={() => isSelected ? closePanel() : openProduct(product)}
                                                    title="Clique para ver movimentações"
                                                >
                                                    <td>
                                                        <div className="se-product-cell">
                                                            <div className={`se-product-dot se-product-dot--${state}`} />
                                                            <div>
                                                                <strong>{product.name}</strong>
                                                                {product.code || product.barcode ? (
                                                                    <small>{product.code || product.barcode}</small>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`se-stock-badge se-stock-badge--${state}`}>
                                                            {formatNumber(product.stock_quantity || 0)} {product.unit || 'UN'}
                                                        </span>
                                                    </td>
                                                    <td className="se-min-col">
                                                        {formatNumber(product.min_stock || 0)} {product.unit || 'UN'}
                                                    </td>
                                                    <td>
                                                        {state === 'zero'
                                                            ? <span className="se-status se-status--zero">Sem estoque</span>
                                                            : state === 'low'
                                                                ? <span className="se-status se-status--low">Estoque baixo</span>
                                                                : <span className="se-status se-status--ok">Normal</span>
                                                        }
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="se-empty-state se-empty-state--prompt">
                                <div className="se-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                                <strong>Nenhum produto encontrado</strong>
                                <p>Tente outro nome ou código.</p>
                            </div>
                        )}
                    </div>

                    {/* ─── Painel de movimentação (tela cheia) ─── */}
                    {selectedProduct ? (
                        <div className="se-mov-modal-backdrop" onClick={closePanel}>
                        <div className="se-mov-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                            <div className="se-mov-header">
                                <div className="se-mov-product-info">
                                    <strong>{selectedProduct.name}</strong>
                                    <div className="se-mov-stock-row">
                                        <span className={`se-stock-badge se-stock-badge--${getStockState(selectedProduct)}`}>
                                            {formatNumber(selectedProduct.stock_quantity || 0)} {selectedProduct.unit || 'UN'}
                                        </span>
                                        <span className="se-mov-label">em estoque</span>
                                    </div>
                                </div>
                                {!adjusting && !registeringLoss ? (
                                    <button type="button" className="se-mov-adjust-btn" onClick={startAdjust}>
                                        <i className="fa-solid fa-scale-balanced" /> Ajustar
                                    </button>
                                ) : null}
                                {!adjusting && !registeringLoss ? (
                                    <button type="button" className="se-mov-adjust-btn" onClick={startLoss}>
                                        <i className="fa-solid fa-triangle-exclamation" /> Registrar perda
                                    </button>
                                ) : null}
                                <button type="button" className="se-mov-close" onClick={closePanel}>
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </div>

                            {adjustFeedback && !adjusting ? (
                                <div className={`se-feedback se-feedback--${adjustFeedback.type} se-mov-adjust-feedback`}>
                                    <i className={`fa-solid ${adjustFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                    {adjustFeedback.text}
                                </div>
                            ) : null}

                            {/* Ajuste de estoque inline */}
                            {adjusting ? (
                                <form className="se-mov-adjust-form" onSubmit={submitAdjust}>
                                    <div className="se-form-section">
                                        <label className="se-form-label">Novo estoque (total real) *</label>
                                        <input
                                            className="ui-input"
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={adjustQty}
                                            onChange={(e) => setAdjustQty(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder={`Quantidade em ${selectedProduct.unit || 'UN'}`}
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <div className="se-form-section">
                                        <label className="se-form-label">Motivo do ajuste</label>
                                        <input
                                            className="ui-input"
                                            value={adjustReason}
                                            onChange={(e) => setAdjustReason(e.target.value)}
                                            placeholder="Ex: Inventário, quebra, furto..."
                                        />
                                    </div>

                                    {adjustQty !== '' ? (
                                        (() => {
                                            const delta = Number(adjustQty) - Number(selectedProduct.stock_quantity || 0)
                                            return (
                                                <div className={`se-adjust-preview ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}`}>
                                                    <i className={`fa-solid ${delta > 0 ? 'fa-arrow-trend-up' : delta < 0 ? 'fa-arrow-trend-down' : 'fa-equals'}`} />
                                                    {delta === 0
                                                        ? 'Sem alteração no estoque'
                                                        : `Diferença: ${delta > 0 ? '+' : ''}${formatNumber(delta)} ${selectedProduct.unit || 'UN'}`
                                                    }
                                                </div>
                                            )
                                        })()
                                    ) : null}

                                    <div className="se-form-section">
                                        <label className="se-form-label">Observação (opcional)</label>
                                        <textarea
                                            className="ui-textarea"
                                            rows="2"
                                            value={adjustNotes}
                                            onChange={(e) => setAdjustNotes(e.target.value)}
                                        />
                                    </div>

                                    {adjustFeedback ? (
                                        <div className={`se-feedback se-feedback--${adjustFeedback.type}`}>
                                            <i className={`fa-solid ${adjustFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                            {adjustFeedback.text}
                                        </div>
                                    ) : null}

                                    <div className="se-form-actions">
                                        <button type="button" className="ui-button-ghost" onClick={cancelAdjust}>
                                            <i className="fa-solid fa-rotate-left" /> Cancelar
                                        </button>
                                        <button type="submit" className="se-submit-btn se-submit-btn--violet" disabled={adjustSaving}>
                                            <i className="fa-solid fa-check" />
                                            {adjustSaving ? 'Salvando...' : 'Confirmar ajuste'}
                                        </button>
                                    </div>
                                </form>
                            ) : null}

                            {/* Registrar perda inline */}
                            {registeringLoss ? (
                                <form className="se-mov-adjust-form" onSubmit={(event) => submitLoss(event, null)}>
                                    <div className="se-form-section">
                                        <label className="se-form-label">Quantidade perdida *</label>
                                        <input
                                            className="ui-input"
                                            type="number"
                                            min="0.001"
                                            step="0.001"
                                            value={lossQty}
                                            onChange={(e) => setLossQty(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder={`Quantidade em ${selectedProduct.unit || 'UN'}`}
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <div className="se-form-section">
                                        <label className="se-form-label">Motivo</label>
                                        <select className="ui-input" value={lossReason} onChange={(e) => setLossReason(e.target.value)}>
                                            <option value="vencido">Vencido</option>
                                            <option value="avaria">Avaria</option>
                                            <option value="quebra">Quebra</option>
                                            <option value="outro">Outro</option>
                                        </select>
                                    </div>

                                    {lossFeedback ? (
                                        <div className={`se-feedback se-feedback--${lossFeedback.type}`}>
                                            <i className={`fa-solid ${lossFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                            {lossFeedback.text}
                                        </div>
                                    ) : null}

                                    <div className="se-form-actions">
                                        <button type="button" className="ui-button-ghost" onClick={cancelLoss}>
                                            <i className="fa-solid fa-rotate-left" /> Cancelar
                                        </button>
                                        <button type="submit" className="se-submit-btn se-submit-btn--violet" disabled={lossSaving}>
                                            <i className="fa-solid fa-check" />
                                            {lossSaving ? 'Salvando...' : 'Confirmar perda'}
                                        </button>
                                    </div>
                                </form>
                            ) : null}

                            {/* Filtros */}
                            <div className="se-mov-filters">
                                <select
                                    className="se-mov-filter-select"
                                    value={movFilter}
                                    onChange={(e) => setMovFilter(e.target.value)}
                                >
                                    <option value="">Todas as operações</option>
                                    <option value="manual_inbound">Entradas</option>
                                    <option value="manual_adjustment">Ajustes</option>
                                    <option value="sale">Saídas (venda)</option>
                                    <option value="sale_cancellation">Cancelamentos</option>
                                    <option value="loss">Perdas</option>
                                </select>
                                <input
                                    type="date"
                                    className="se-mov-filter-date"
                                    value={movFrom}
                                    onChange={(e) => setMovFrom(e.target.value)}
                                    title="De"
                                />
                                <input
                                    type="date"
                                    className="se-mov-filter-date"
                                    value={movTo}
                                    onChange={(e) => setMovTo(e.target.value)}
                                    title="Até"
                                />
                                <button type="button" className="se-mov-filter-btn" onClick={applyMovFilter}>
                                    <i className="fa-solid fa-magnifying-glass" />
                                </button>
                            </div>

                            {/* Lista de movimentações */}
                            <div className="se-mov-list">
                                {!movSearched ? (
                                    <div className="se-mov-empty">
                                        <i className="fa-solid fa-magnifying-glass" />
                                        <span>Filtre e pesquise para ver as movimentações</span>
                                    </div>
                                ) : movLoading ? (
                                    <div className="se-mov-loading">
                                        <i className="fa-solid fa-spinner fa-spin" />
                                        Carregando...
                                    </div>
                                ) : movements.length ? movements.map((mov) => {
                                    const tone = TYPE_TONES[mov.type] || 'gray'
                                    const isPositive = Number(mov.quantity_delta) >= 0
                                    return (
                                        <div key={mov.id} className="se-mov-row">
                                            <div className={`se-mov-type-dot se-mov-type-dot--${tone}`} />
                                            <div className="se-mov-info">
                                                <strong>{TYPE_LABELS[mov.type] || mov.type_label || mov.type}</strong>
                                                {mov.notes ? <small>{mov.notes}</small> : null}
                                                <small className="se-mov-date">{mov.occurred_at ? formatDateTime(mov.occurred_at) : '—'}</small>
                                            </div>
                                            <div className="se-mov-delta-col">
                                                <span className={`se-mov-delta ${isPositive ? 'positive' : 'negative'}`}>
                                                    {isPositive ? '+' : ''}{formatNumber(mov.quantity_delta)}
                                                </span>
                                                <small className="se-mov-stock-after">
                                                    → {formatNumber(mov.stock_after)}
                                                </small>
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div className="se-mov-empty">
                                        <i className="fa-solid fa-clock-rotate-left" />
                                        <span>Nenhuma movimentação encontrada</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </AppLayout>
    )
}
