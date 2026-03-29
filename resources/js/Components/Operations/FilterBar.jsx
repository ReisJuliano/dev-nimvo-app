import { router } from '@inertiajs/react'

export default function FilterBar({ filters }) {
    function handleSubmit(event) {
        event.preventDefault()

        const formData = new FormData(event.currentTarget)

        router.get(
            window.location.pathname,
            {
                from: formData.get('from'),
                to: formData.get('to'),
            },
            { preserveScroll: true, preserveState: true, replace: true },
        )
    }

    if (!filters?.showDateRange) {
        return null
    }

    return (
        <form className="operations-filter-bar" onSubmit={handleSubmit}>
            <label>
                <span>De</span>
                <input className="ui-input" name="from" type="date" defaultValue={filters.from || ''} />
            </label>
            <label>
                <span>Ate</span>
                <input className="ui-input" name="to" type="date" defaultValue={filters.to || ''} />
            </label>
            <button className="ui-button" type="submit">
                <i className="fa-solid fa-rotate" />
                Atualizar
            </button>
        </form>
    )
}
