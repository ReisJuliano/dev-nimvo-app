import { Link } from '@inertiajs/react'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'

function renderCell(value, format) {
    if (format === 'money') {
        if (value == null) {
            return '-'
        }

        return formatMoney(value)
    }

    if (format === 'number') {
        if (value == null) {
            return '-'
        }

        return formatNumber(value)
    }

    if (format === 'datetime') {
        return formatDateTime(value)
    }

    if (format === 'date') {
        return formatDate(value)
    }

    return value ?? '-'
}

function renderActionCell(value) {
    if (!value?.href) {
        return '-'
    }

    const toneClass = {
        primary: 'ui-button',
        secondary: 'ui-button-secondary',
        danger: 'ui-button-danger',
        ghost: 'ui-button-ghost',
    }[value.tone || 'ghost']

    return (
        <Link href={value.href} preserveScroll preserveState className={`operations-table-action ${toneClass}`}>
            {value.icon ? <i className={`fa-solid ${value.icon}`} /> : null}
            <span>{value.label || 'Abrir'}</span>
        </Link>
    )
}

export default function DataTable({ table }) {
    return (
        <section className="operations-table-card ui-table-card">
            <header>
                <h2>{table.title}</h2>
                <span className="operations-card-tag">{table.rows.length} linha(s)</span>
            </header>

            {table.rows.length ? (
                <div className="operations-table-wrap ui-table-wrap">
                    <table className="ui-table">
                        <thead>
                            <tr>
                                {table.columns.map((column) => (
                                    <th key={column.key}>{column.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {table.rows.map((row, index) => (
                                <tr key={`${table.title}-${index}`} className={row._selected ? 'is-selected' : ''}>
                                    {table.columns.map((column) => (
                                        <td key={column.key}>
                                            {column.format === 'action'
                                                ? renderActionCell(row[column.key])
                                                : renderCell(row[column.key], column.format)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="operations-empty-state">{table.emptyText}</div>
            )}
        </section>
    )
}
