export default function ProductToolbar({
    search,
    onSearchChange,
    categoryId,
    onCategoryChange,
    categories,
    onCreate,
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
                        placeholder="Buscar por nome, codigo ou EAN"
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
            </div>

            <button className="products-primary-button ui-tooltip" onClick={onCreate} data-tooltip="Cadastrar novo item">
                <i className="fa-solid fa-plus" />
                Novo produto
            </button>
        </section>
    )
}
