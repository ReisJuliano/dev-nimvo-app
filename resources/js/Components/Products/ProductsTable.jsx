import { formatMoney, formatNumber } from '@/lib/format'

function getStockTone(product) {
    if (Number(product.stock_quantity) <= 0) return 'danger'
    if (Number(product.stock_quantity) <= Number(product.min_stock)) return 'warning'
    return 'success'
}

function getStockLabel(product) {
    if (Number(product.stock_quantity) <= 0) return 'Sem saldo'
    if (Number(product.stock_quantity) <= Number(product.min_stock)) return 'Baixo'
    return 'Saudável'
}

export default function ProductsTable({ products, onEdit, onDelete }) {
    if (!products.length) {
        return null
    }

    return (
        <section className="products-table-card">
            <div className="products-table-scroll ui-table-wrap">
                <table className="products-table ui-table">
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Categoria</th>
                            <th>Precos</th>
                            <th>Estoque</th>
                            <th>Acao</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product) => {
                            const stockTone = getStockTone(product)

                            return (
                                <tr key={product.id}>
                                    <td>
                                        <div className="products-product-cell">
                                            <strong>{product.name}</strong>
                                            <div className="products-row-meta">
                                                {product.code ? <span>#{product.code}</span> : null}
                                                {product.barcode ? <span>{product.barcode}</span> : null}
                                                <span>{product.unit}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="products-category-pill">
                                            {product.category_name || 'Sem categoria'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="products-price-cell">
                                            <small>Custo {formatMoney(product.cost_price)}</small>
                                            <strong>{formatMoney(product.sale_price)}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="products-stock-cell">
                                            <span className={`products-stock-pill is-${stockTone}`}>
                                                {getStockLabel(product)}
                                            </span>
                                            <small>
                                                {formatNumber(product.stock_quantity)} saldo / Min {formatNumber(product.min_stock)}
                                            </small>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="products-actions">
                                            <button
                                                type="button"
                                                className="ui-tooltip"
                                                data-tooltip="Editar"
                                                aria-label={`Editar ${product.name}`}
                                                onClick={() => onEdit(product)}
                                            >
                                                <i className="fa-solid fa-pen" />
                                            </button>
                                            <button
                                                type="button"
                                                className="danger ui-tooltip"
                                                data-tooltip="Desativar"
                                                aria-label={`Desativar ${product.name}`}
                                                onClick={() => onDelete(product)}
                                            >
                                                <i className="fa-solid fa-trash-can" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
