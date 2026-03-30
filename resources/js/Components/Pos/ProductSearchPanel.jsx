import { formatNumber } from '@/lib/format'

export default function ProductSearchPanel({
    categories,
    selectedCategory,
    onCategoryChange,
    searchTerm,
    onSearchChange,
    searchInputRef,
    hasSearchTerm,
    products,
    loading,
    onAddProduct,
    title = 'Buscar produto',
    subtitle = '',
    actions = null,
    categoryPlaceholder = 'Todas as categorias',
    searchPlaceholder = 'Busque por nome, codigo, EAN ou descricao',
    emptyMessage = 'Digite algo para buscar produtos',
    noResultsMessage = 'Nenhum produto encontrado para essa pesquisa.',
}) {
    const normalizedSearchTerm =
        searchTerm == null || String(searchTerm).toLowerCase() === 'null'
            ? ''
            : String(searchTerm)

    return (
        <section className="pos-card">
            <div className="pos-card-header">
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>

                {actions ? <div className="pos-card-header-actions">{actions}</div> : null}
            </div>

            <div className="pos-search-grid">
                <select className="ui-select" value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)}>
                    <option value="">{categoryPlaceholder}</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                <input
                    ref={searchInputRef}
                    className="ui-input"
                    type="search"
                    placeholder={searchPlaceholder}
                    value={normalizedSearchTerm}
                    onChange={(event) => onSearchChange(event.target.value)}
                />
            </div>

            <div className="pos-product-results">
                {!hasSearchTerm ? (
                    <div className="pos-search-empty">
                        <i className="fas fa-search" style={{ fontSize: 48, color: '#ccc' }} />
                        <p>{emptyMessage}</p>
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
                            <div className="pos-search-empty">{noResultsMessage}</div>
                        )}
            </div>
        </section>
    )
}
