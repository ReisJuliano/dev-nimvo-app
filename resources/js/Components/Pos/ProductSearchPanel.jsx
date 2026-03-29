import { formatNumber } from '@/lib/format'

export default function ProductSearchPanel({
    categories,
    selectedCategory,
    onCategoryChange,
    searchTerm,
    onSearchChange,
    hasSearchTerm,
    products,
    loading,
    onAddProduct,
}) {
    return (
        <section className="pos-card">
            <div className="pos-card-header">
                <div>
                    <h2>Buscar produto</h2>
                </div>
            </div>

            <div className="pos-search-grid">
                <select className="ui-select" value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)}>
                    <option value="">Todas as categorias</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <input
                    className="ui-input"
                    type="search"
                    placeholder="Busque por nome, codigo, EAN ou descricao"
                    value={searchTerm}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </div>

            <div className="pos-product-results">
                {!hasSearchTerm ? (
                    <div className="pos-search-empty">
                        <i className="fas fa-search" style={{ fontSize: 48, color: '#ccc' }} />
                        <p>Digite algo para buscar produtos</p>
                    </div>
                ) : loading
                    ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="ui-skeleton" />)
                    : products.length
                        ? products.map((product) => (
                            <button
                                key={product.id}
                                type="button"
                                className="pos-product-card ui-tooltip"
                                data-tooltip="Adicionar ao carrinho"
                                onClick={() => onAddProduct(product)}
                            >
                                <div className="pos-product-copy">
                                    <div className="pos-product-title">
                                        {product.category_name ? <span className="ui-badge info">{product.category_name}</span> : null}
                                        <strong>{product.name}</strong>
                                    </div>
                                    {product.description ? <small>{product.description}</small> : null}
                                    <div className="pos-inline-metadata">
                                        {product.code ? <span className="pos-meta-pill">Cod. {product.code}</span> : null}
                                        {product.barcode ? <span className="pos-meta-pill">EAN {product.barcode}</span> : null}
                                    </div>
                                </div>
                                <div className="pos-product-side">
                                    <div className="pos-stock-chip">
                                        <small>Estoque</small>
                                        <span>{formatNumber(product.stock_quantity)}</span>
                                    </div>
                                </div>
                            </button>
                        ))
                        : (
                            <div className="pos-search-empty">Nenhum produto encontrado para essa pesquisa.</div>
                        )}
            </div>
        </section>
    )
}
