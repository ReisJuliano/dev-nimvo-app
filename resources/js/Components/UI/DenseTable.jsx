function renderCell(column, row) {
    if (typeof column.render === 'function') {
        return column.render(row)
    }

    return row[column.key] ?? '-'
}

export default function DenseTable({
    columns,
    rows,
    rowKey = 'id',
    selectedRowKey = null,
    onRowClick = null,
    getRowActions = null,
    emptyState = null,
    className = '',
    minWidth = 720,
}) {
    const hasActions = typeof getRowActions === 'function'

    if (!rows.length) {
        return (
            <div className={['dense-table-empty', className].filter(Boolean).join(' ')}>
                {emptyState}
            </div>
        )
    }

    return (
        <div className={['dense-table-wrap', className].filter(Boolean).join(' ')}>
            <table className="dense-table" style={{ minWidth }}>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key} className={column.headerClassName || ''}>
                                {column.label}
                            </th>
                        ))}
                        {hasActions ? <th className="dense-table-actions-head">Acoes</th> : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const key = typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey]
                        const actions = hasActions ? (getRowActions(row) || []).filter(Boolean) : []
                        const isSelected = selectedRowKey !== null && String(selectedRowKey) === String(key)

                        return (
                            <tr
                                key={key}
                                className={[
                                    isSelected ? 'is-selected' : '',
                                    onRowClick ? 'is-clickable' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                            >
                                {columns.map((column) => (
                                    <td key={column.key} className={column.className || ''}>
                                        {renderCell(column, row)}
                                    </td>
                                ))}
                                {hasActions ? (
                                    <td className="dense-table-actions-cell">
                                        <div className="dense-table-actions">
                                            {actions.map((action) => {
                                                const sharedProps = {
                                                    className: ['ui-icon-button', action.tone ? `tone-${action.tone}` : '', 'ui-tooltip']
                                                        .filter(Boolean)
                                                        .join(' '),
                                                    'data-tooltip': action.label,
                                                    title: action.label,
                                                    onClick: (event) => {
                                                        event.stopPropagation()
                                                        action.onClick?.(row, event)
                                                    },
                                                }

                                                if (action.href) {
                                                    return (
                                                        <a
                                                            key={action.key || action.label}
                                                            href={action.href}
                                                            target={action.target}
                                                            rel={action.target === '_blank' ? 'noreferrer' : undefined}
                                                            {...sharedProps}
                                                        >
                                                            <i className={`fa-solid ${action.icon}`} />
                                                        </a>
                                                    )
                                                }

                                                return (
                                                    <button
                                                        key={action.key || action.label}
                                                        type="button"
                                                        disabled={action.disabled}
                                                        {...sharedProps}
                                                    >
                                                        <i className={`fa-solid ${action.icon}`} />
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </td>
                                ) : null}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
