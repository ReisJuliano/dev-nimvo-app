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
        const normalized = normalizeTextSearch(query)

        if (!normalized) {
            return products
        }

        return products.filter((product) => matchesTextSearchAny([product.name, product.code, product.barcode], normalized))
    }, [products, query])

    function openReceiveModal(product = null) {
        setReceiveProduct(product)
        setReceiveModalOpen(true)
    }

    function handleProductSaved(updatedProduct) {
        setProducts((current) => current.map((product) => (
            String(product.id) === String(updatedProduct.id) ? { ...product, ...updatedProduct } : product
        )))
    }

    return (
        <AppLayout title={moduleTitle}>
            <div className="stock-simple-page">
                <section className="stock-simple-hero">
                    <div className="stock-simple-hero-copy">
                        <span className="stock-simple-icon"><i className="fa-solid fa-box-open" /></span>
                        <div>
                            <h1>Estoque</h1>
                            <p>Controle o que entrou, saiu e esta acabando.</p>
                        </div>
                    </div>
                    {lowStockProducts.length ? (
                        <span className="stock-alert-badge critical">{formatNumber(lowStockProducts.length)} acabando</span>
                    ) : null}
                </section>

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
                    <a className="nimvo-action-card tone-amber" href="#produtos-em-estoque">
                        <span className="nimvo-action-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                            {lowStockProducts.length ? <b>{formatNumber(lowStockProducts.length)}</b> : null}
                        </span>
                        <span className="nimvo-action-copy">
                            <strong>Produtos acabando</strong>
                            <small>{lowStockProducts.length ? `${formatNumber(lowStockProducts.length)} produtos abaixo do minimo` : 'Tudo certo por enquanto'}</small>
                        </span>
                    </a>
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

                    <label className="stock-search-field">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar por nome, codigo ou codigo de barras"
                        />
                    </label>

                    {filteredProducts.length ? (
                        <div className="stock-table-wrap">
                            <table className="stock-products-table">
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
                                            <tr key={product.id} className={`is-${state}`}>
                                                <td>
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
                        <div className="stock-empty-state">
                            <i className="fa-solid fa-box-open" />
                            <strong>Nenhum produto cadastrado ainda</strong>
                            <span>Cadastre seu primeiro produto para comecar a vender.</span>
                            <Link className="ui-button" href="/produtos">Cadastrar produto</Link>
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
