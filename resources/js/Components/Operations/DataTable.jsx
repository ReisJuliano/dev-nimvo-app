import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'

function renderCell(value, format) {
    if (format === 'money') {
        return formatMoney(value)
    }

    if (format === 'number') {
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

export default function DataTable({ table }) {
    return (
        <section className="operations-table-card">
            <header>
                <h2>{table.title}</h2>
            </header>

            {table.rows.length ? (
                <div className="operations-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                {table.columns.map((column) => (
                                    <th key={column.key}>{column.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {table.rows.map((row, index) => (
                                <tr key={`${table.title}-${index}`}>
                                    {table.columns.map((column) => (
                                        <td key={column.key}>{renderCell(row[column.key], column.format)}</td>
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
