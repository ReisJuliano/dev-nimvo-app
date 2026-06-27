import { Link } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import RecebiMercadoriaModal from './RecebiMercadoriaModal'
import './stock-entry-simple.css'

function getStockState(product) {
    const stock = Number(product.stock_quantity || 0)
    const minimum = Number(product.min_stock || 0)

    if (stock <= 0) return 'zero'
    if (stock <= minimum) return 'low'

    return 'ok'
}

export default function StockEntryIndex({ moduleTitle = 'Estoque', payload }) {
    const [products, setProducts] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [query, setQuery] = useState('')
    const [activeFilter, setActiveFilter] = useState(null)
    const [pageFeedback, setPageFeedback] = useState(null)
    const [receiveModalOpen, setReceiveModalOpen] = useState(false)
    const [receiveProduct, setReceiveProduct] = useState(null)
    const [initialProductHandled, setInitialProductHandled] = useState(false)

    useEffect(() => {
        if (initialProductHandled || typeof window === 'undefined' || !products.length) return

        const productId = new URLSearchParams(window.location.search).get('product')
        if (!productId) {
            setInitialProductHandled(true)
            return
        }

        const product = products.find((item) => String(item.id) === String(productId))
        if (product) {
            openReceiveModal(product)
        }
        setInitialProductHandled(true)
    }, [initialProductHandled, products])

    const lowStockProducts = useMemo(() => (
        products
            .filter((product) => Number(product.stock_quantity || 0) <= Number(product.min_stock || 0))
            .sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0))
    ), [products])

    const filteredProducts = useMemo(() => {
        if (activeFilter === 'low') {
            return lowStockProducts
        }

        const normalized = normalizeTextSearch(query)

        if (!normalized) {
            return []
        }

        return products.filter((product) => matchesTextSearchAny([product.name, product.code, product.barcode], normalized))
    }, [activeFilter, lowStockProducts, products, query])

    const hasRequestedProducts = query.trim().length > 0 || activeFilter !== null

    function openReceiveModal(product = null) {
        setReceiveProduct(product)
        setReceiveModalOpen(true)
    }

    function handleProductSaved(updatedProduct, message) {
        setProducts((current) => current.map((product) => (
            String(product.id) === String(updatedProduct.id) ? { ...product, ...updatedProduct } : product
        )))
        setPageFeedback(message || 'Entrada registrada e estoque atualizado.')
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="se-page">

                {/* ─── Header ─── */}
                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon">
                            <i className="fa-solid fa-box-open" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Estoque</h1>
                            <p className="se-header-sub">
                                {formatNumber(products.length)} produto(s) cadastrado(s)
                                {lowStockProducts.length > 0 ? ` · ${formatNumber(lowStockProducts.length)} acabando` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="se-header-actions">
                        <button type="button" className="se-action-btn se-action-btn--primary" onClick={() => openReceiveModal()}>
                            <i className="fa-solid fa-dolly" />
                            Recebi mercadoria
                        </button>
                        <Link className="se-action-btn se-action-btn--ghost" href="/movimentacao-estoque">
                            <i className="fa-solid fa-scale-balanced" />
                            Ajustar estoque
                        </Link>
                        <Link className="se-action-btn se-action-btn--ghost" href="/entrada-estoque">
                            <i className="fa-solid fa-clock-rotate-left" />
                            Histórico
                        </Link>
                    </div>
                </div>

                {/* ─── Alerta estoque baixo ─── */}
                {lowStockProducts.length > 0 ? (
                    <div className="se-alert">
                        <div className="se-alert-left">
                            <div className="se-alert-icon">
                                <i className="fa-solid fa-triangle-exclamation" />
                            </div>
                            <div>
                                <strong>{formatNumber(lowStockProducts.length)} produto(s) abaixo do estoque mínimo</strong>
                                <span>Reponha o estoque para não perder vendas.</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="se-alert-btn"
                            onClick={() => { setActiveFilter('low'); setQuery('') }}
                        >
                            Ver produtos acabando
                        </button>
                    </div>
                ) : null}

                {/* ─── Feedback ─── */}
                {pageFeedback ? (
                    <div className="se-feedback">
                        <i className="fa-solid fa-circle-check" />
                        {pageFeedback}
                    </div>
                ) : null}

                {/* ─── Busca + filtros ─── */}
                <div className="se-search-bar">
                    <label className="se-search-wrap">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            value={query}
                            onChange={(e) => { setQuery(e.target.value); setActiveFilter(null); setPageFeedback(null) }}
                            placeholder="Nome, código ou código de barras..."
                        />
                        {query ? (
                            <button type="button" className="se-clear-search" onClick={() => { setQuery(''); setPageFeedback(null) }}>
                                <i className="fa-solid fa-xmark" />
                            </button>
                        ) : null}
                    </label>

                    <div className="se-filter-chips">
                        <button
                            type="button"
                            className={`se-chip ${activeFilter === null && !query ? 'active' : ''}`}
                            onClick={() => { setActiveFilter(null); setQuery('') }}
                        >
                            <i className="fa-solid fa-list" />
                            Buscar
                        </button>
                        <button
                            type="button"
                            className={`se-chip ${activeFilter === 'low' ? 'active active-warn' : ''}`}
                            onClick={() => { setActiveFilter('low'); setQuery('') }}
                        >
                            <i className="fa-solid fa-triangle-exclamation" />
                            Acabando
                            {lowStockProducts.length > 0 ? <span>{formatNumber(lowStockProducts.length)}</span> : null}
                        </button>
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
                ) : !hasRequestedProducts ? (
                    <div className="se-empty-state se-empty-state--prompt">
                        <div className="se-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                        <strong>Digite um nome ou clique em "Acabando"</strong>
                        <p>Para ver todos os produtos, use o filtro acima.</p>
                    </div>
                ) : filteredProducts.length ? (
                    <div className="se-table-card">
                        <table className="se-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Em estoque</th>
                                    <th>Estoque mínimo</th>
                                    <th>Status</th>
                                    <th style={{ width: 110 }}>Ação</th>
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
                                                {state === 'zero' ? (
                                                    <span className="se-status se-status--zero">Sem estoque</span>
                                                ) : state === 'low' ? (
                                                    <span className="se-status se-status--low">Estoque baixo</span>
                                                ) : (
                                                    <span className="se-status se-status--ok">Normal</span>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="se-receive-btn"
                                                    onClick={() => openReceiveModal(product)}
                                                >
                                                    <i className="fa-solid fa-plus" />
                                                    Recebi mais
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
                        <div className="se-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                        <strong>Nenhum produto encontrado</strong>
                        <p>Tente outro nome, código ou código de barras.</p>
                    </div>
                )}
            </div>

            <RecebiMercadoriaModal
                open={receiveModalOpen}
                products={products}
                initialProduct={receiveProduct}
                onClose={() => setReceiveModalOpen(false)}
                onSaved={handleProductSaved}
            />
        </AppLayout>
    )
}
