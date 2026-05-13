import ActionButton from '@/Components/UI/ActionButton'

export default function ConditionalSearchPanel({
    filterForm,
    statusOptions,
    onSubmit,
    onReset,
    onStatusChange,
}) {
    return (
        <section className="conditional-search-card">
            <header className="conditional-search-card-head">
                <div className="conditional-search-card-title">
                    <span className="conditional-search-icon" aria-hidden>
                        <i className="fa-solid fa-magnifying-glass" />
                    </span>
                    <div>
                        <h2>Buscar condicionais</h2>
                        <p>Filtre por status e texto (cliente ou codigo).</p>
                    </div>
                </div>
            </header>
            <div className="conditional-search-card-body">
                <form className="conditional-search-form" onSubmit={onSubmit}>
                    <label className="conditional-search-field">
                        <span>Status</span>
                        <select
                            className="products-input"
                            value={filterForm.data.status}
                            onChange={(event) => onStatusChange(event.target.value)}
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="conditional-search-field grow">
                        <span>Busca</span>
                        <input
                            className="products-input"
                            type="search"
                            placeholder="Cliente ou codigo"
                            value={filterForm.data.search}
                            onChange={(event) => filterForm.setData('search', event.target.value)}
                        />
                    </label>
                    <div className="conditional-search-actions">
                        <ActionButton icon="fa-magnifying-glass" type="submit">
                            Aplicar
                        </ActionButton>
                        <ActionButton icon="fa-rotate-left" tone="ghost" type="button" onClick={onReset}>
                            Limpar
                        </ActionButton>
                    </div>
                </form>
            </div>
        </section>
    )
}
