function renderCell(column, row) {
    if (typeof column.render === 'function') {
        return column.render(row)
    }

    return row?.[column.key] ?? '-'
}

function resolveAlignClass(align) {
    if (align === 'center') {
        return 'align-center'
    }

    if (align === 'right') {
        return 'align-right'
    }

    return 'align-left'
}

function resolveRowActions(actions, row) {
    if (typeof actions === 'function') {
        return (actions(row) || []).filter(Boolean)
    }

    return (actions || []).filter(Boolean).map((action) => ({
        ...action,
        disabled: typeof action.disabled === 'function' ? action.disabled(row) : action.disabled,
    }))
}

export default function DataTable({
    columns,
    rows,
    rowKey = 'id',
    selectedRowKey = null,
    onRowClick = null,
    onRowDoubleClick = null,
    actions = [],
    emptyMessage = 'Nenhum registro encontrado',
    emptyIcon = 'fa-inbox',
    className = '',
}) {
    const hasActions = typeof actions === 'function' || (Array.isArray(actions) && actions.length > 0)
    const hasRowInteraction = Boolean(onRowClick || onRowDoubleClick)

    if (!rows.length) {
        return (
            <section className={['ui-data-table-empty', className].filter(Boolean).join(' ')}>
                <i className={`fa-solid ${emptyIcon}`} />
                <span>{emptyMessage}</span>
            </section>
        )
    }

    return (
        <div className={['ui-data-table-wrap', className].filter(Boolean).join(' ')}>
            <table className="ui-data-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className={[
                                    resolveAlignClass(column.align),
                                    column.headerClassName || '',
                                ].filter(Boolean).join(' ')}
                                style={column.width ? { width: column.width } : undefined}
                            >
                                {column.label}
                            </th>
                        ))}
                        {hasActions ? <th className="ui-data-table-actions-head" /> : null}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const key = typeof rowKey === 'function' ? rowKey(row, index) : row?.[rowKey]
                        const rowActions = resolveRowActions(actions, row)
                        const isSelected = selectedRowKey !== null && String(selectedRowKey) === String(key)

                        return (
                            <tr
                                key={key}
                                className={[
                                    isSelected ? 'is-selected' : '',
                                    hasRowInteraction ? 'is-clickable' : '',
                                ].filter(Boolean).join(' ')}
                                onClick={onRowClick ? () => onRowClick(row, key) : undefined}
                                onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row, key) : undefined}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className={[
                                            resolveAlignClass(column.align),
                                            column.className || '',
                                        ].filter(Boolean).join(' ')}
                                    >
                                        {renderCell(column, row)}
                                    </td>
                                ))}

                                {hasActions ? (
                                    <td className="ui-data-table-actions-cell">
                                        <div className="ui-data-table-actions">
                                            {rowActions.map((action) => {
                                                const commonProps = {
                                                    className: [
                                                        'ui-data-table-action',
                                                        action.tone ? `tone-${action.tone}` : '',
                                                        'ui-tooltip',
                                                    ].filter(Boolean).join(' '),
                                                    'data-tooltip': action.label,
                                                    title: action.label,
                                                    onClick: (event) => {
                                                        event.stopPropagation()
                                                        if (onRowClick && action.selectRow !== false) {
                                                            onRowClick(row, key)
                                                        }
                                                        action.onClick?.(row, event)
                                                    },
                                                    onDoubleClick: (event) => {
                                                        event.stopPropagation()
                                                    },
                                                }

                                                if (action.href) {
                                                    return (
                                                        <a
                                                            key={action.key || action.label}
                                                            href={action.href}
                                                            target={action.target}
                                                            rel={action.target === '_blank' ? 'noreferrer' : undefined}
                                                            {...commonProps}
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
                                                        {...commonProps}
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
