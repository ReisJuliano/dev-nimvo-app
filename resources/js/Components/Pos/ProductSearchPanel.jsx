import { formatMoney, formatNumber } from '@/lib/format'

export default function ProductSearchPanel({
    categories,
    selectedCategory,
    onCategoryChange,
    searchTerm,
    onSearchChange,
    products,
    onAddProduct,
}) {
    return (
        <section className="pos-card">
            <div className="pos-card-header">
                <div>
                    <h2>Buscar produto</h2>
                    <p>Pesquisa por nome, codigo ou codigo de barras</p>
                </div>
            </div>

            <div className="pos-search-grid">
                <select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)}>
                    <option value="">Todas as categorias</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <input
                    type="search"
                    placeholder="Digite para buscar produtos"
                    value={searchTerm}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </div>

            <div className="pos-product-results">
                {products.map((product) => (
                    <button key={product.id} className="pos-product-card" onClick={() => onAddProduct(product)}>
                        <div>
                            <strong>{product.name}</strong>
                            <span>
                                {product.code} {product.barcode ? `| ${product.barcode}` : ''}
                            </span>
                        </div>
                        <div>
                            <strong>{formatMoney(product.sale_price)}</strong>
                            <small>Estoque {formatNumber(product.stock_quantity)}</small>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    )
}
