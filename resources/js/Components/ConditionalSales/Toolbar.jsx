import ActionButton from '@/Components/UI/ActionButton'

export default function Toolbar({ filterForm, onSubmit, onReset }) {
    return (
        <section className="products-search-panel">
            <form className="products-search-row" onSubmit={onSubmit}>
                <label className="products-search-input">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                        type="search"
                        aria-label="Buscar condicional"
                        placeholder="Buscar cliente ou codigo"
                        value={filterForm.data.search}
                        onChange={(event) => filterForm.setData('search', event.target.value)}
                    />
                </label>

                <ActionButton icon="fa-magnifying-glass" type="submit">
                    Buscar
                </ActionButton>

                <ActionButton icon="fa-rotate-left" tone="ghost" type="button" onClick={onReset}>
                    Limpar
                </ActionButton>
            </form>
        </section>
    )
}
