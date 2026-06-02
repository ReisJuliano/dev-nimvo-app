import ActionButton from '@/Components/UI/ActionButton'

export default function ConditionalSearchPanel({
    filterForm,
    statusOptions,
    onSubmit,
    onReset,
    onStatusChange,
}) {
    return (
        <section className="conditional-toolbar">
            <div className="conditional-toolbar-tabs" role="tablist" aria-label="Filtros de status">
                {statusOptions.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`conditional-toolbar-tab ${filterForm.data.status === option.value ? 'active' : ''}`}
                        onClick={() => onStatusChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <form className="conditional-toolbar-form" onSubmit={onSubmit}>
                <label className="conditional-toolbar-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                        className="products-input"
                        type="search"
                        placeholder="Cliente, código ou operador"
                        value={filterForm.data.search}
                        onChange={(event) => filterForm.setData('search', event.target.value)}
                    />
                </label>

                <div className="conditional-toolbar-actions">
                    <ActionButton icon="fa-magnifying-glass" type="submit">
                        Buscar
                    </ActionButton>
                    <ActionButton icon="fa-rotate-left" tone="ghost" type="button" onClick={onReset}>
                        Limpar
                    </ActionButton>
                </div>
            </form>
        </section>
    )
}
