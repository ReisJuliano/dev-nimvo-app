import { formatMoney, formatNumber } from '@/lib/format'

export default function ProductsTable({ products, onEdit, onDelete }) {
    if (!products.length) {
        return <div className="products-empty-state">Nenhum produto encontrado para os filtros atuais.</div>
    }

    return (
        <section className="products-table-card ui-table-card">
            <div className="products-table-header">
                <div>
                    <h2>Produtos cadastrados</h2>
                    <p>Lista de produtos, precos e saldo.</p>
                </div>
                <span className="products-table-counter">{formatNumber(products.length)} item(ns)</span>
            </div>
            <div className="products-table-scroll ui-table-wrap">
                <table className="products-table ui-table">
                    <thead>
                        <tr>
                            <th>Codigo</th>
                            <th>EAN</th>
                            <th>Produto</th>
                            <th>Categoria</th>
                            <th>Custo</th>
                            <th>Venda</th>
                            <th>Estoque</th>
                            <th>Acao</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product) => (
                            <tr key={product.id}>
                                <td>{product.code}</td>
                                <td>{product.barcode || '-'}</td>
                                <td>
                                    <strong>{product.name}</strong>
                                    <small>{product.unit}</small>
                                </td>
                                <td>
                                    <span className="products-badge ui-badge primary">
                                        {product.category_name || 'Sem categoria'}
                                    </span>
                                </td>
                                <td>{formatMoney(product.cost_price)}</td>
                                <td>{formatMoney(product.sale_price)}</td>
                                <td>
                                    <strong
                                        className={
                                            product.stock_quantity <= 0
                                                ? 'stock-danger'
                                                : product.stock_quantity <= product.min_stock
                                                  ? 'stock-warning'
                                                  : 'stock-ok'
                                        }
                                    >
                                        {formatNumber(product.stock_quantity)}
                                    </strong>
                                    <small>Min. {formatNumber(product.min_stock)}</small>
                                </td>
                                <td>
                                    <div className="products-actions">
                                        <button
                                            className="ui-tooltip"
                                            data-tooltip="Editar cadastro"
                                            onClick={() => onEdit(product)}
                                        >
                                            <i className="fa-solid fa-pen" />
                                            Editar
                                        </button>
                                        <button
                                            className="danger ui-tooltip"
                                            data-tooltip="Desativar produto"
                                            onClick={() => onDelete(product)}
                                        >
                                            <i className="fa-solid fa-trash-can" />
                                            Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
