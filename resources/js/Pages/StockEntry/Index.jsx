import { Link } from '@inertiajs/react'
import { useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatMoney, formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { confirmPopup } from '@/lib/errorPopup'
import './stock-entry-simple.css'

function getStockState(product) {
    const stock = Number(product.stock_quantity || 0)
    const minimum = Number(product.min_stock || 0)
    if (stock <= 0) return 'zero'
    if (stock <= minimum) return 'low'
    return 'ok'
}

function ProductSearch({ products, query, setQuery, selectedProduct, onSelect, onClear, placeholder = 'Nome, código ou EAN...' }) {
    const results = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return []
        return products
            .filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
            .slice(0, 8)
    }, [products, query])

    return (
        <div className="se-product-search">
            {selectedProduct ? (
                <div className="se-selected-product">
                    <div className="se-selected-info">
                        <strong>{selectedProduct.name}</strong>
                        <small>
                            Estoque: {formatNumber(selectedProduct.stock_quantity || 0)} {selectedProduct.unit || 'UN'}
                            {selectedProduct.cost_price ? ` · Custo: ${formatMoney(selectedProduct.cost_price)}` : ''}
                        </small>
                    </div>
                    <button type="button" className="se-deselect-btn" onClick={onClear}>
                        <i className="fa-solid fa-xmark" />
                        Trocar
                    </button>
                </div>
            ) : (
                <>
                    <label className="se-search-wrap">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={placeholder}
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
                                    <span className={`se-stock-badge se-stock-badge--${getStockState(p)}`}>
                                        {formatNumber(p.stock_quantity || 0)} {p.unit || 'UN'}
                                    </span>
                                </button>
                            )) : (
                                <div className="se-search-empty">Nenhum produto encontrado.</div>
                            )}
                        </div>
                    ) : null}
                </>
            )}
        </div>
    )
}

export default function StockEntryIndex({ moduleTitle = 'Estoque', payload }) {
    const [products, setProducts] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [activeTab, setActiveTab] = useState('entrada')

    // ─── Tab: Entrada ───
    const [entryQuery, setEntryQuery] = useState('')
    const [entryProduct, setEntryProduct] = useState(null)
    const [entryQty, setEntryQty] = useState('')
    const [entryCost, setEntryCost] = useState('')
    const [entryNotes, setEntryNotes] = useState('')
    const [entrySaving, setEntrySaving] = useState(false)
    const [entryFeedback, setEntryFeedback] = useState(null)

    function selectEntryProduct(product) {
        setEntryProduct(product)
        setEntryQuery('')
        setEntryCost(String(product.cost_price || ''))
        setEntryQty('')
        setEntryFeedback(null)
    }

    function resetEntry() {
        setEntryProduct(null)
        setEntryQuery('')
        setEntryQty('')
        setEntryCost('')
        setEntryNotes('')
        setEntryFeedback(null)
    }

    async function handleEntrySubmit(e) {
        e.preventDefault()
        if (!entryProduct) { setEntryFeedback({ type: 'error', text: 'Selecione um produto.' }); return }
        if (!entryQty || Number(entryQty) <= 0) { setEntryFeedback({ type: 'error', text: 'Informe a quantidade recebida.' }); return }
        setEntrySaving(true)
        setEntryFeedback(null)
        try {
            const response = await apiRequest('/api/stock/quick-receive', {
                method: 'post',
                data: {
                    product_id: entryProduct.id,
                    quantity: Number(entryQty),
                    cost_price: entryCost ? Number(entryCost) : null,
                    notes: entryNotes.trim() || null,
                },
            })
            const updated = response.product
            setProducts((prev) => prev.map((p) => String(p.id) === String(updated.id) ? { ...p, ...updated } : p))
            if (updated) setEntryProduct((prev) => prev ? { ...prev, ...updated } : prev)
            setEntryFeedback({ type: 'success', text: response.message || 'Entrada registrada com sucesso.' })
            setEntryQty('')
            setEntryNotes('')
        } catch (err) {
            setEntryFeedback({ type: 'error', text: err.message })
        } finally {
            setEntrySaving(false)
        }
    }

    // ─── Tab: Ajuste ───
    const [adjustQuery, setAdjustQuery] = useState('')
    const [adjustProduct, setAdjustProduct] = useState(null)
    const [adjustQty, setAdjustQty] = useState('')
    const [adjustReason, setAdjustReason] = useState('Ajuste manual de estoque')
    const [adjustNotes, setAdjustNotes] = useState('')
    const [adjustSaving, setAdjustSaving] = useState(false)
    const [adjustFeedback, setAdjustFeedback] = useState(null)

    function selectAdjustProduct(product) {
        setAdjustProduct(product)
        setAdjustQuery('')
        setAdjustQty(String(product.stock_quantity || 0))
        setAdjustFeedback(null)
    }

    function resetAdjust() {
        setAdjustProduct(null)
        setAdjustQuery('')
        setAdjustQty('')
        setAdjustReason('Ajuste manual de estoque')
        setAdjustNotes('')
        setAdjustFeedback(null)
    }

    async function handleAdjustSubmit(e) {
        e.preventDefault()
        if (!adjustProduct) { setAdjustFeedback({ type: 'error', text: 'Selecione um produto.' }); return }
        if (adjustQty === '') { setAdjustFeedback({ type: 'error', text: 'Informe o novo estoque.' }); return }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Confirmar ajuste',
            message: `Atualizar "${adjustProduct.name}" de ${formatNumber(adjustProduct.stock_quantity || 0)} para ${formatNumber(Number(adjustQty))}?`,
            confirmLabel: 'Confirmar',
            cancelLabel: 'Cancelar',
        })
        if (!confirmed) return

        setAdjustSaving(true)
        setAdjustFeedback(null)
        try {
            const response = await apiRequest('/api/operations/movimentação-estoque/records', {
                method: 'post',
                data: {
                    product_id: adjustProduct.id,
                    counted_quantity: Number(adjustQty),
                    reason: adjustReason.trim() || null,
                    notes: adjustNotes.trim() || null,
                },
            })
            const record = response.record
            setProducts((prev) => prev.map((p) =>
                String(p.id) === String(record.product_id)
                    ? { ...p, stock_quantity: Number(record.stock_after) }
                    : p,
            ))
            setAdjustProduct((prev) => prev ? { ...prev, stock_quantity: Number(record.stock_after) } : prev)
            setAdjustFeedback({ type: 'success', text: response.message || 'Estoque ajustado com sucesso.' })
            setAdjustQty(String(record.stock_after))
            setAdjustNotes('')
        } catch (err) {
            setAdjustFeedback({ type: 'error', text: err.message })
        } finally {
            setAdjustSaving(false)
        }
    }

    // ─── Dados computados ───
    const lowStockProducts = useMemo(() =>
        products
            .filter((p) => Number(p.stock_quantity || 0) <= Number(p.min_stock || 0))
            .sort((a, b) => Number(a.stock_quantity || 0) - Number(b.stock_quantity || 0)),
        [products],
    )

    const tabs = [
        { key: 'entrada', label: 'Entrada de mercadoria', icon: 'fa-dolly' },
        { key: 'ajuste', label: 'Ajuste de estoque', icon: 'fa-scale-balanced' },
        {
            key: 'faltando',
            label: 'Itens faltando',
            icon: 'fa-triangle-exclamation',
            count: lowStockProducts.length,
        },
    ]

    return (
        <AppLayout title="Estoque">
            <div className="se-page">

                {/* ─── Header ─── */}
                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon">
                            <i className="fa-solid fa-box-open" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Controle de Estoque</h1>
                            <p className="se-header-sub">
                                {formatNumber(products.length)} produto(s)
                                {lowStockProducts.length > 0 ? ` · ${formatNumber(lowStockProducts.length)} abaixo do mínimo` : ' · Estoque ok'}
                            </p>
                        </div>
                    </div>
                    <div className="se-header-kpis">
                        <div className="se-kpi">
                            <strong>{formatNumber(products.length)}</strong>
                            <span>Produtos</span>
                        </div>
                        <div className={`se-kpi ${lowStockProducts.length > 0 ? 'se-kpi--warn' : ''}`}>
                            <strong>{formatNumber(lowStockProducts.length)}</strong>
                            <span>Faltando</span>
                        </div>
                        <div className="se-kpi">
                            <strong>{formatNumber(products.filter((p) => Number(p.stock_quantity || 0) <= 0).length)}</strong>
                            <span>Zerados</span>
                        </div>
                    </div>
                </div>

                {/* ─── Abas ─── */}
                <div className="se-tabs-bar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`se-tab ${activeTab === tab.key ? 'active' : ''} ${tab.key === 'faltando' && lowStockProducts.length > 0 ? 'has-alert' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            <i className={`fa-solid ${tab.icon}`} />
                            {tab.label}
                            {tab.count > 0 ? <span className="se-tab-badge">{tab.count}</span> : null}
                        </button>
                    ))}
                </div>

                {/* ─── ABA 1: Entrada ─── */}
                {activeTab === 'entrada' ? (
                    <div className="se-tab-content">
                        <div className="se-tab-layout">
                            <div className="se-tab-main">
                                <div className="se-form-card">
                                    <div className="se-form-card-header">
                                        <div className="se-form-card-icon se-form-card-icon--teal">
                                            <i className="fa-solid fa-dolly" />
                                        </div>
                                        <div>
                                            <h2>Entrada de mercadoria</h2>
                                            <p>Registre o que chegou na loja. Sem necessidade de nota fiscal.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleEntrySubmit} className="se-form-body">
                                        <div className="se-form-section">
                                            <label className="se-form-label">Produto</label>
                                            <ProductSearch
                                                products={products}
                                                query={entryQuery}
                                                setQuery={setEntryQuery}
                                                selectedProduct={entryProduct}
                                                onSelect={selectEntryProduct}
                                                onClear={resetEntry}
                                                placeholder="Buscar produto pelo nome, código ou EAN..."
                                            />
                                        </div>

                                        {entryProduct ? (
                                            <>
                                                <div className="se-form-row">
                                                    <div className="se-form-section">
                                                        <label className="se-form-label">Quantidade recebida *</label>
                                                        <input
                                                            className="ui-input"
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            value={entryQty}
                                                            onChange={(e) => setEntryQty(e.target.value)}
                                                            placeholder={`Em ${entryProduct.unit || 'UN'}`}
                                                            autoFocus
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
                                                            value={entryCost}
                                                            onChange={(e) => setEntryCost(e.target.value)}
                                                            placeholder="R$ 0,00"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="se-form-section">
                                                    <label className="se-form-label">Observação (opcional)</label>
                                                    <input
                                                        className="ui-input"
                                                        value={entryNotes}
                                                        onChange={(e) => setEntryNotes(e.target.value)}
                                                        placeholder="Ex: chegou no caminhão da manhã..."
                                                    />
                                                </div>
                                            </>
                                        ) : null}

                                        {entryFeedback ? (
                                            <div className={`se-feedback se-feedback--${entryFeedback.type}`}>
                                                <i className={`fa-solid ${entryFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                                {entryFeedback.text}
                                            </div>
                                        ) : null}

                                        {entryProduct ? (
                                            <div className="se-form-actions">
                                                <button type="button" className="ui-button-ghost" onClick={resetEntry}>
                                                    <i className="fa-solid fa-rotate-left" />
                                                    Limpar
                                                </button>
                                                <button type="submit" className="se-submit-btn se-submit-btn--teal" disabled={entrySaving}>
                                                    <i className="fa-solid fa-check" />
                                                    {entrySaving ? 'Registrando...' : 'Confirmar entrada'}
                                                </button>
                                            </div>
                                        ) : null}
                                    </form>
                                </div>
                            </div>

                            <div className="se-tab-side">
                                <div className="se-info-card">
                                    <div className="se-info-card-header">
                                        <i className="fa-solid fa-circle-info" />
                                        Como funciona
                                    </div>
                                    <ol className="se-info-steps">
                                        <li>Busque o produto pelo nome ou código</li>
                                        <li>Informe a quantidade que chegou</li>
                                        <li>Opcionalmente informe o custo</li>
                                        <li>Confirme para atualizar o estoque</li>
                                    </ol>
                                    <div className="se-info-divider" />
                                    <p className="se-info-note">
                                        Para entrada com nota fiscal completa, use a página
                                        {' '}<Link href="/entrada-estoque">Entrada de estoque</Link>.
                                    </p>
                                </div>

                                {lowStockProducts.length > 0 ? (
                                    <div className="se-side-alert">
                                        <strong>
                                            <i className="fa-solid fa-triangle-exclamation" />
                                            {formatNumber(lowStockProducts.length)} produto(s) precisam de reposição
                                        </strong>
                                        <div className="se-side-alert-list">
                                            {lowStockProducts.slice(0, 5).map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className="se-side-alert-item"
                                                    onClick={() => selectEntryProduct(p)}
                                                >
                                                    <span>{p.name}</span>
                                                    <span className={`se-stock-badge se-stock-badge--${getStockState(p)}`}>
                                                        {formatNumber(p.stock_quantity || 0)} {p.unit || 'UN'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        {lowStockProducts.length > 5 ? (
                                            <button type="button" className="se-side-alert-more" onClick={() => setActiveTab('faltando')}>
                                                Ver todos os {lowStockProducts.length} →
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* ─── ABA 2: Ajuste ─── */}
                {activeTab === 'ajuste' ? (
                    <div className="se-tab-content">
                        <div className="se-tab-layout">
                            <div className="se-tab-main">
                                <div className="se-form-card">
                                    <div className="se-form-card-header">
                                        <div className="se-form-card-icon se-form-card-icon--violet">
                                            <i className="fa-solid fa-scale-balanced" />
                                        </div>
                                        <div>
                                            <h2>Ajuste de estoque</h2>
                                            <p>Corrija o estoque de um produto após inventário ou identificação de diferença.</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleAdjustSubmit} className="se-form-body">
                                        <div className="se-form-section">
                                            <label className="se-form-label">Produto</label>
                                            <ProductSearch
                                                products={products}
                                                query={adjustQuery}
                                                setQuery={setAdjustQuery}
                                                selectedProduct={adjustProduct}
                                                onSelect={selectAdjustProduct}
                                                onClear={resetAdjust}
                                                placeholder="Buscar produto pelo nome, código ou EAN..."
                                            />
                                        </div>

                                        {adjustProduct ? (
                                            <>
                                                <div className="se-adjust-current">
                                                    <span>Estoque atual registrado:</span>
                                                    <strong className={`se-stock-badge se-stock-badge--${getStockState(adjustProduct)}`}>
                                                        {formatNumber(adjustProduct.stock_quantity || 0)} {adjustProduct.unit || 'UN'}
                                                    </strong>
                                                </div>

                                                <div className="se-form-row">
                                                    <div className="se-form-section">
                                                        <label className="se-form-label">Novo estoque (total real) *</label>
                                                        <input
                                                            className="ui-input"
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={adjustQty}
                                                            onChange={(e) => setAdjustQty(e.target.value)}
                                                            placeholder={`Quantidade em ${adjustProduct.unit || 'UN'}`}
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
                                                </div>

                                                {adjustQty !== '' && adjustProduct ? (
                                                    <div className={`se-adjust-preview ${Number(adjustQty) > Number(adjustProduct.stock_quantity || 0) ? 'positive' : Number(adjustQty) < Number(adjustProduct.stock_quantity || 0) ? 'negative' : 'neutral'}`}>
                                                        <i className={`fa-solid ${Number(adjustQty) > Number(adjustProduct.stock_quantity || 0) ? 'fa-arrow-trend-up' : Number(adjustQty) < Number(adjustProduct.stock_quantity || 0) ? 'fa-arrow-trend-down' : 'fa-equals'}`} />
                                                        {Number(adjustQty) === Number(adjustProduct.stock_quantity || 0)
                                                            ? 'Sem alteração no estoque'
                                                            : `Diferença: ${Number(adjustQty) > Number(adjustProduct.stock_quantity || 0) ? '+' : ''}${formatNumber(Number(adjustQty) - Number(adjustProduct.stock_quantity || 0))} ${adjustProduct.unit || 'UN'}`
                                                        }
                                                    </div>
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
                                            </>
                                        ) : null}

                                        {adjustFeedback ? (
                                            <div className={`se-feedback se-feedback--${adjustFeedback.type}`}>
                                                <i className={`fa-solid ${adjustFeedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                                {adjustFeedback.text}
                                            </div>
                                        ) : null}

                                        {adjustProduct ? (
                                            <div className="se-form-actions">
                                                <button type="button" className="ui-button-ghost" onClick={resetAdjust}>
                                                    <i className="fa-solid fa-rotate-left" />
                                                    Limpar
                                                </button>
                                                <button type="submit" className="se-submit-btn se-submit-btn--violet" disabled={adjustSaving}>
                                                    <i className="fa-solid fa-check" />
                                                    {adjustSaving ? 'Salvando...' : 'Confirmar ajuste'}
                                                </button>
                                            </div>
                                        ) : null}
                                    </form>
                                </div>
                            </div>

                            <div className="se-tab-side">
                                <div className="se-info-card">
                                    <div className="se-info-card-header">
                                        <i className="fa-solid fa-circle-info" />
                                        Diferença do ajuste vs. entrada
                                    </div>
                                    <div className="se-info-compare">
                                        <div className="se-info-compare-item">
                                            <strong>Entrada</strong>
                                            <span>Adiciona à quantidade atual. Use quando chegou mercadoria.</span>
                                        </div>
                                        <div className="se-info-compare-item se-info-compare-item--active">
                                            <strong>Ajuste (esta aba)</strong>
                                            <span>Define a quantidade exata. Use após inventário ou correção.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* ─── ABA 3: Itens faltando ─── */}
                {activeTab === 'faltando' ? (
                    <div className="se-tab-content">
                        <div className="se-report-header">
                            <div>
                                <h2>Relatório: Itens faltando</h2>
                                <p>Produtos com estoque igual ou abaixo do mínimo definido. Reponha para não perder vendas.</p>
                            </div>
                            <div className="se-report-summary">
                                <div className="se-report-kpi se-report-kpi--zero">
                                    <strong>{formatNumber(products.filter((p) => Number(p.stock_quantity || 0) <= 0).length)}</strong>
                                    <span>Zerados</span>
                                </div>
                                <div className="se-report-kpi se-report-kpi--low">
                                    <strong>{formatNumber(lowStockProducts.filter((p) => Number(p.stock_quantity || 0) > 0).length)}</strong>
                                    <span>Estoque baixo</span>
                                </div>
                            </div>
                        </div>

                        {lowStockProducts.length > 0 ? (
                            <div className="se-table-card">
                                <table className="se-table">
                                    <thead>
                                        <tr>
                                            <th>Produto</th>
                                            <th>Fornecedor</th>
                                            <th>Em estoque</th>
                                            <th>Mínimo</th>
                                            <th>Diferença</th>
                                            <th>Status</th>
                                            <th style={{ width: 120 }}>Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lowStockProducts.map((product) => {
                                            const state = getStockState(product)
                                            const diff = Number(product.stock_quantity || 0) - Number(product.min_stock || 0)

                                            return (
                                                <tr key={product.id} className={`se-row se-row--${state}`}>
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
                                                    <td className="se-min-col">{product.supplier_name || '—'}</td>
                                                    <td>
                                                        <span className={`se-stock-badge se-stock-badge--${state}`}>
                                                            {formatNumber(product.stock_quantity || 0)} {product.unit || 'UN'}
                                                        </span>
                                                    </td>
                                                    <td className="se-min-col">
                                                        {formatNumber(product.min_stock || 0)} {product.unit || 'UN'}
                                                    </td>
                                                    <td>
                                                        <span className="se-diff-badge">
                                                            {formatNumber(diff)} {product.unit || 'UN'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {state === 'zero'
                                                            ? <span className="se-status se-status--zero">Sem estoque</span>
                                                            : <span className="se-status se-status--low">Estoque baixo</span>
                                                        }
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="se-receive-btn"
                                                            onClick={() => { selectEntryProduct(product); setActiveTab('entrada') }}
                                                        >
                                                            <i className="fa-solid fa-plus" />
                                                            Repor
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="se-empty-state">
                                <div className="se-empty-icon" style={{ background: 'rgba(16,185,129,0.08)', color: '#10b981', borderColor: 'rgba(16,185,129,0.16)' }}>
                                    <i className="fa-solid fa-circle-check" />
                                </div>
                                <strong>Estoque ok — nenhum item faltando</strong>
                                <p>Todos os produtos estão acima do estoque mínimo definido.</p>
                            </div>
                        )}
                    </div>
                ) : null}

            </div>
        </AppLayout>
    )
}
