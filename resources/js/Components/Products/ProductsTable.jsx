import { formatMoney, formatNumber } from '@/lib/format'

export default function ProductsTable({ products, onEdit, onDelete }) {
    if (!products.length) {
        return <div className="products-empty-state">Nenhum produto encontrado para os filtros atuais.</div>
    }

    return (
        <section className="products-table-card">
            <div className="products-table-scroll">
                <table className="products-table">
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
                                <td>{product.category_name || 'Sem categoria'}</td>
                                <td>{formatMoney(product.cost_price)}</td>
                                <td>{formatMoney(product.sale_price)}</td>
                                <td>
                                    <strong>{formatNumber(product.stock_quantity)}</strong>
                                    <small>Min. {formatNumber(product.min_stock)}</small>
                                </td>
                                <td>
                                    <div className="products-actions">
                                        <button onClick={() => onEdit(product)}>Editar</button>
                                        <button className="danger" onClick={() => onDelete(product)}>
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
