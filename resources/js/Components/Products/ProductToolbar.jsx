export default function ProductToolbar({
    search,
    onSearchChange,
    categoryId,
    onCategoryChange,
    categories,
    onCreate,
}) {
    return (
        <section className="products-toolbar">
            <div className="products-toolbar-filters">
                <input
                    className="products-input"
                    type="search"
                    placeholder="Buscar por nome, codigo ou EAN"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                />

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

            <button className="products-primary-button" onClick={onCreate}>
                Novo produto
            </button>
        </section>
    )
}
