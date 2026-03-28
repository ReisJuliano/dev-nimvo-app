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
                <input name="from" type="date" defaultValue={filters.from || ''} />
            </label>
            <label>
                <span>Até</span>
                <input name="to" type="date" defaultValue={filters.to || ''} />
            </label>
            <button type="submit">Atualizar</button>
        </form>
    )
}
