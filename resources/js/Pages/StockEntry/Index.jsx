import { Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './stock-entry-simple.css'

function getStockState(product) {
    const stock = Number(product.stock_quantity || 0)
    const minimum = Number(product.min_stock || 0)
    if (stock <= 0) return 'zero'
    if (stock <= minimum) return 'low'
    return 'ok'
}

export default function StockEntryIndex({ moduleTitle = 'Estoque', payload }) {
    const [products] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [query, setQuery] = useState('')
    const [activeFilter, setActiveFilter] = useState(null)

    const lowStockProducts = useMemo(() =>
        products.filter((p) => Number(p.stock_quantity || 0) <= Number(p.min_stock || 0)),
        [products],
    )

    const filteredProducts = useMemo(() => {
        if (activeFilter === 'low') return lowStockProducts
        if (activeFilter === 'zero') return products.filter((p) => Number(p.stock_quantity || 0) <= 0)
        const q = normalizeTextSearch(query)
        if (!q) return []           // sem busca → sem dados (só filtro de status acima)
        return products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
    }, [activeFilter, lowStockProducts, products, query])

    const zeroCount = useMemo(() => products.filter((p) => Number(p.stock_quantity || 0) <= 0).length, [products])

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
                            <p className="se-header-sub">
                                {formatNumber(products.length)} produto(s)
                                {lowStockProducts.length > 0 ? ` · ${formatNumber(lowStockProducts.length)} abaixo do mínimo` : ''}
                                {zeroCount > 0 ? ` · ${formatNumber(zeroCount)} zerado(s)` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="se-header-kpis">
                        <div className="se-kpi">
                            <strong>{formatNumber(products.length)}</strong>
                            <span>Total</span>
                        </div>
                        {lowStockProducts.length > 0 ? (
                            <div className="se-kpi se-kpi--warn">
                                <strong>{formatNumber(lowStockProducts.length)}</strong>
                                <span>Baixo</span>
                            </div>
                        ) : null}
                        {zeroCount > 0 ? (
                            <div className="se-kpi se-kpi--zero">
                                <strong>{formatNumber(zeroCount)}</strong>
                                <span>Zerado</span>
                            </div>
                        ) : null}
                    </div>
                    <div className="se-header-actions">
                        <Link href="/entrada-estoque" className="se-action-btn se-action-btn--primary">
                            <i className="fa-solid fa-arrow-down-to-bracket" />
                            Entrada
                        </Link>
                        <Link href="/ajuste-estoque" className="se-action-btn se-action-btn--ghost">
                            <i className="fa-solid fa-scale-balanced" />
                            Ajuste
                        </Link>
                    </div>
                </div>

                {/* ─── Busca + filtros ─── */}
                <div className="se-search-bar">
                    <label className="se-search-wrap">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setActiveFilter(null) }}
                            placeholder="Nome, código ou código de barras..."
                        />
                        {query ? (
                            <button type="button" className="se-clear-search" onClick={() => setQuery('')}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        ) : null}
                    </label>

                    <div className="se-filter-chips">
                        <button
                            type="button"
                            className={`se-chip ${!activeFilter && !query ? 'active' : ''}`}
                            onClick={() => { setActiveFilter(null); setQuery('') }}
                        >
                            Todos
                            <span className="se-chip-count">{formatNumber(products.length)}</span>
                        </button>
                        {lowStockProducts.length > 0 ? (
                            <button
                                type="button"
                                className={`se-chip ${activeFilter === 'low' ? 'active active-warn' : ''}`}
                                onClick={() => { setActiveFilter('low'); setQuery('') }}
                            >
                                <i className="fa-solid fa-triangle-exclamation" />
                                Estoque baixo
                                <span>{formatNumber(lowStockProducts.length)}</span>
                            </button>
                        ) : null}
                        {zeroCount > 0 ? (
                            <button
                                type="button"
                                className={`se-chip ${activeFilter === 'zero' ? 'active active-danger' : ''}`}
                                onClick={() => { setActiveFilter('zero'); setQuery('') }}
                            >
                                <i className="fa-solid fa-circle-exclamation" />
                                Sem estoque
                                <span>{formatNumber(zeroCount)}</span>
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* ─── Tabela ─── */}
                {!products.length ? (
                    <div className="se-empty-state">
                        <div className="se-empty-icon"><i className="fa-solid fa-box-open" /></div>
                        <strong>Nenhum produto cadastrado</strong>
                        <p>Cadastre produtos primeiro para controlar o estoque.</p>
                        <Link className="ui-button" href="/produtos">Cadastrar produto</Link>
                    </div>
                ) : !activeFilter && !query ? (
                    <div className="se-empty-state se-empty-state--prompt">
                        <div className="se-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                        <strong>Use a busca ou um filtro acima</strong>
                        <p>Pesquise por nome ou clique em "Estoque baixo" / "Sem estoque" para ver os produtos.</p>
                    </div>
                ) : filteredProducts.length ? (
                    <div className="se-table-card">
                        <table className="se-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Código</th>
                                    <th>Fornecedor</th>
                                    <th>Em estoque</th>
                                    <th>Mínimo</th>
                                    <th>Status</th>
                                    <th style={{ width: 110 }}>Ação rápida</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product) => {
                                    const state = getStockState(product)
                                    return (
                                        <tr key={product.id} className={`se-row se-row--${state}`}>
                                            <td>
                                                <div className="se-product-cell">
                                                    <div className={`se-product-dot se-product-dot--${state}`} />
                                                    <strong>{product.name}</strong>
                                                </div>
                                            </td>
                                            <td className="se-min-col">{product.code || product.barcode || '—'}</td>
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
                                                {state === 'zero'
                                                    ? <span className="se-status se-status--zero">Sem estoque</span>
                                                    : state === 'low'
                                                        ? <span className="se-status se-status--low">Estoque baixo</span>
                                                        : <span className="se-status se-status--ok">Normal</span>
                                                }
                                            </td>
                                            <td>
                                                <Link
                                                    href={`/entrada-estoque?product=${product.id}`}
                                                    className="se-receive-btn"
                                                >
                                                    <i className="fa-solid fa-plus" />
                                                    Entrada
                                                </Link>
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
        </AppLayout>
    )
}
