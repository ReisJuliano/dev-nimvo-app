import { Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import { formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './stock-entry-simple.css'

function getStockState(product) {
    const stock = Number(product.stock_quantity || 0)
    const min   = Number(product.min_stock || 0)
    if (stock <= 0) return 'zero'
    if (stock <= min) return 'low'
    return 'ok'
}

export default function StockEntryIndex({ payload }) {
    const [products] = useState(Array.isArray(payload?.products) ? payload.products : [])
    const [query, setQuery] = useState('')

    const filteredProducts = useMemo(() => {
        const q = normalizeTextSearch(query)
        if (!q) return []
        return products.filter((p) => matchesTextSearchAny([p.name, p.code, p.barcode], q))
    }, [products, query])

    return (
        <AppLayout title="Estoque">
            <div className="se-page">

                <div className="se-header">
                    <div className="se-header-left">
                        <div className="se-header-icon">
                            <i className="fa-solid fa-warehouse" />
                        </div>
                        <div>
                            <h1 className="se-header-title">Estoque de produtos</h1>
                            <p className="se-header-sub">{formatNumber(products.length)} produto(s) cadastrado(s)</p>
                        </div>
                    </div>
                </div>

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
                        <p>Cadastre produtos primeiro para controlar o estoque.</p>
                        <Link className="ui-button" href="/produtos">Cadastrar produto</Link>
                    </div>
                ) : !query ? (
                    <div className="se-empty-state se-empty-state--prompt">
                        <div className="se-empty-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                        <strong>Pesquise um produto acima</strong>
                        <p>Digite o nome, código ou código de barras para ver o estoque.</p>
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
