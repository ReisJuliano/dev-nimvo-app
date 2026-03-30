export default function ProductToolbar({
    search,
    onSearchChange,
    categoryId,
    onCategoryChange,
    collection,
    onCollectionChange,
    collections,
    visibility,
    onVisibilityChange,
    categories,
    onCreate,
    isFashionMode = false,
}) {
    const normalizedSearch =
        search == null || String(search).toLowerCase() === 'null'
            ? ''
            : String(search)

    return (
        <section className="products-toolbar">
            <div className="products-toolbar-filters">
                <div className="products-search-field">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                        className="products-input"
                        type="search"
                        placeholder={
                            isFashionMode
                                ? 'Buscar por nome, codigo, referencia, cor, tamanho ou colecao'
                                : 'Buscar por nome, codigo ou EAN'
                        }
                        value={normalizedSearch}
                        onChange={(event) => onSearchChange(event.target.value)}
                    />
                </div>

                <select
                    className="products-input"
                    value={categoryId}
                    onChange={(event) => onCategoryChange(event.target.value)}
                >
                    <option value="">Todas as categorias</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>

                {isFashionMode ? (
                    <select
                        className="products-input"
                        value={collection}
                        onChange={(event) => onCollectionChange(event.target.value)}
                    >
                        <option value="">Todas as colecoes</option>
                        {collections.map((collectionName) => (
                            <option key={collectionName} value={collectionName}>
                                {collectionName}
                            </option>
                        ))}
                    </select>
                ) : null}

                {isFashionMode ? (
                    <select
                        className="products-input"
                        value={visibility}
                        onChange={(event) => onVisibilityChange(event.target.value)}
                    >
                        <option value="all">Toda a vitrine</option>
                        <option value="published">Somente publicados</option>
                        <option value="hidden">Somente ocultos</option>
                    </select>
                ) : null}
            </div>

            <button
                className="products-primary-button ui-tooltip"
                onClick={onCreate}
                data-tooltip={isFashionMode ? 'Cadastrar nova peca ou variante' : 'Cadastrar novo item'}
            >
                <i className="fa-solid fa-plus" />
                Novo produto
            </button>
        </section>
    )
}
