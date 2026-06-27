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
            <div className="stock-simple-page">
                {/* Banner */}
                <div className="page-hero page-hero--teal">
                    <div className="page-hero-left">
                        <div className="page-hero-icon">
                            <i className="fa-solid fa-box-open" />
                        </div>
                        <div>
                            <h1 className="page-hero-title">Estoque</h1>
                            <p className="page-hero-sub">Entradas, saídas e produtos que estão acabando</p>
                        </div>
                    </div>
                    <div className="page-hero-stats">
                        <div className="page-hero-stat">
                            <strong>{formatNumber(products.length)}</strong>
                            <span>Produtos</span>
                        </div>
                        {lowStockProducts.length > 0 && (
                            <div className="page-hero-stat page-hero-stat--danger">
                                <strong>{formatNumber(lowStockProducts.length)}</strong>
                                <span>Acabando</span>
                            </div>
                        )}
                    </div>
                    <button type="button" className="page-hero-cta" onClick={() => openReceiveModal()}>
                        <i className="fa-solid fa-dolly" />
                        Recebi mercadoria
                    </button>
                </div>

                <section className="nimvo-action-grid" aria-label="Acoes de estoque">
                    <button type="button" className="nimvo-action-card tone-blue" onClick={() => openReceiveModal()}>
                        <span className="nimvo-action-icon"><i className="fa-solid fa-dolly" /></span>
                        <span className="nimvo-action-copy">
                            <strong>Recebi mercadoria</strong>
                            <small>Registre o que chegou na loja</small>
                        </span>
                    </button>
                    <Link className="nimvo-action-card tone-green" href="/movimentacao-estoque">
                        <span className="nimvo-action-icon"><i className="fa-solid fa-scale-balanced" /></span>
                        <span className="nimvo-action-copy">
                            <strong>Ajustar estoque</strong>
                            <small>Corrija diferencas no estoque</small>
                        </span>
                    </Link>
                    <button
                        type="button"
                        className="nimvo-action-card tone-amber"
                        onClick={() => {
                            setActiveFilter('low')
                            setQuery('')
                            document.getElementById('produtos-em-estoque')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                    >
                        <span className="nimvo-action-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                            {lowStockProducts.length ? <b>{formatNumber(lowStockProducts.length)}</b> : null}
                        </span>
                        <span className="nimvo-action-copy">
                            <strong>Produtos acabando</strong>
                            <small>{lowStockProducts.length ? `${formatNumber(lowStockProducts.length)} produtos abaixo do minimo` : 'Tudo certo por enquanto'}</small>
                        </span>
                    </button>
                    <Link className="nimvo-action-card tone-slate" href="/movimentacao-estoque">
                        <span className="nimvo-action-icon"><i className="fa-solid fa-clock-rotate-left" /></span>
                        <span className="nimvo-action-copy">
                            <strong>Historico do estoque</strong>
                            <small>Veja entradas e ajustes anteriores</small>
                        </span>
                    </Link>
                </section>

                <section id="produtos-em-estoque" className="stock-products-section">
                    <header className="stock-section-header">
                        <div>
                            <h2>Produtos em estoque</h2>
                            <p>Busque um produto e registre entrada quando chegar mais mercadoria.</p>
                        </div>
                    </header>

                    {pageFeedback ? (
                        <div className="stock-feedback success" role="status">
                            {pageFeedback}
                        </div>
                    ) : null}

                    <label className="stock-search-field nimvo-search">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value)
                                setActiveFilter(null)
                                setPageFeedback(null)
                            }}
                            placeholder="Buscar por nome, codigo ou codigo de barras"
                        />
                    </label>

                    {activeFilter === 'low' ? (
                        <div className="stock-active-filter">
                            <span>Mostrando produtos acabando</span>
                            <button type="button" onClick={() => setActiveFilter(null)}>
                                <i className="fa-solid fa-xmark" />
                                Limpar filtro
                            </button>
                        </div>
                    ) : null}

                    {!products.length ? (
                        <div className="stock-empty-state nimvo-empty">
                            <i className="fa-solid fa-box-open" />
                            <strong>Nenhum produto cadastrado ainda</strong>
                            <span>Cadastre seu primeiro produto para comecar a vender.</span>
                            <Link className="ui-button" href="/produtos">Cadastrar produto</Link>
                        </div>
                    ) : !hasRequestedProducts ? (
                        <div className="stock-list-prompt nimvo-empty">
                            <i className="fa-solid fa-magnifying-glass" />
                            <strong>Digite para buscar um produto</strong>
                            <span>Ou use o atalho Produtos acabando acima.</span>
                        </div>
                    ) : filteredProducts.length ? (
                        <div className="stock-table-wrap">
                            <table className="stock-products-table nimvo-table">
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Estoque</th>
                                        <th>Minimo</th>
                                        <th>Acao</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map((product) => {
                                        const state = getStockState(product)

                                        return (
                                            <tr key={product.id} className={`is-${state} ${state === 'zero' ? 'status-zerado' : state === 'low' ? 'status-baixo' : ''}`}>
                                                <td className="col-nome">
                                                    <strong>{product.name}</strong>
                                                    {product.code || product.barcode ? <small>{product.code || product.barcode}</small> : null}
                                                </td>
                                                <td>
                                                    <span className={`stock-status-text ${state}`}>
                                                        {formatNumber(product.stock_quantity || 0)} {product.unit || 'UN'}
                                                    </span>
                                                </td>
                                                <td>{formatNumber(product.min_stock || 0)} {product.unit || 'UN'}</td>
                                                <td>
                                                    <button type="button" className="stock-inline-action" onClick={() => openReceiveModal(product)}>
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
                        <div className="stock-list-prompt nimvo-empty">
                            <i className="fa-solid fa-magnifying-glass" />
                            <strong>Nenhum produto encontrado</strong>
                            <span>Tente outro nome, codigo ou codigo de barras.</span>
                        </div>
                    )}
                </section>
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
