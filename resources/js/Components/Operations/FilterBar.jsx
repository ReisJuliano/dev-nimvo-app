import { router } from '@inertiajs/react'

export default function FilterBar({ filters }) {
    function handleSubmit(event) {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)
        const from = formData.get('from')
        const to = formData.get('to')
        const product = String(formData.get('product') || '').trim()
        const section = String(formData.get('section') || '').trim()

        router.get(
            window.location.pathname,
            {
                from: from || undefined,
                to: to || undefined,
                product: product || undefined,
                section: section || undefined,
            },
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    if (!filters?.showDateRange && !filters?.showProductSearch) {
        return null
    }

    return (
        <form className="operations-filter-bar" onSubmit={handleSubmit}>
            {filters.showDateRange ? (
                <>
                    <label>
                        <span>De</span>
                        <input className="ui-input" name="from" type="date" defaultValue={filters.from || ''} />
                    </label>
                    <label>
                        <span>Ate</span>
                        <input className="ui-input" name="to" type="date" defaultValue={filters.to || ''} />
                    </label>
                </>
            ) : null}

            {filters.showProductSearch ? (
                <label className="operations-filter-search">
                    <span>Produto</span>
                    <div className="operations-search-field">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                            className="ui-input"
                            name="product"
                            type="search"
                            defaultValue={filters.product || ''}
                            placeholder="Buscar por nome, codigo ou EAN"
                        />
                    </div>
                </label>
            ) : null}

            <input name="section" type="hidden" value={filters.section || ''} readOnly />
            <button className="ui-button" type="submit">
                <i className="fa-solid fa-rotate" />
                Atualizar
            </button>
        </form>
    )
}
