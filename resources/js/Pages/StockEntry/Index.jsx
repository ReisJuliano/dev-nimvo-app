import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { apiRequest } from '@/lib/http'
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
    initial:           'Estoque inicial',
}

const TYPE_TONES = {
    manual_inbound:    'green',
    manual_adjustment: 'amber',
    sale:              'red',
    purchase_return:   'blue',
    sale_cancellation: 'gray',
    initial:           'blue',
}

export default function StockEntryIndex({ payload }) {
    const [products] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [query, setQuery] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)

    // Painel de movimentação
    const [movements, setMovements] = useState([])
    const [movLoading, setMovLoading] = useState(false)
    const [movFilter, setMovFilter] = useState('')
    const [movFrom, setMovFrom] = useState('')
    const [movTo, setMovTo] = useState('')

    const filteredProducts = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return []
        return products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
    }, [products, query])

    async function loadMovements(product, type = '', from = '', to = '') {
        setMovLoading(true)
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
        setMovFilter('')
        setMovFrom('')
        setMovTo('')
        loadMovements(product)
    }

    function closePanel() {
        setSelectedProduct(null)
        setMovements([])
    }

    function applyMovFilter() {
        if (selectedProduct) loadMovements(selectedProduct, movFilter, movFrom, movTo)
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
            <div className={`se-page ${selectedProduct ? 'se-page--panel' : ''}`}>

                {/* ─── Header ─── */}
                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon">
                            <i className="fa-solid fa-warehouse" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Estoque de produtos</h1>
                            <p className="se-header-sub">Pesquise um produto para ver o estoque e a movimentaç?.</p>
                        </div>
                    </div>
                </div>

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
                        ) : !query ? (
                            <div className="se-empty-state se-empty-state--prompt">
                                <div className="se-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                                <strong>Pesquise um produto acima</strong>
                                <p>Digite o nome, código ou código de barras.</p>
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

                    {/* ─── Painel lateral de movimentação ─── */}
                    {selectedProduct ? (
                        <div className="se-mov-panel">
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
                                <button type="button" className="se-mov-close" onClick={closePanel}>
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </div>

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
                                {movLoading ? (
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
                    ) : null}
                </div>
            </div>
        </AppLayout>
    )
}
