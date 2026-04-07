export default function DataList({
    title,
    count = null,
    icon = 'fa-table-list',
    actions = null,
    empty = null,
    children,
    className = '',
}) {
    const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children)

    return (
        <section className={['data-list', className].filter(Boolean).join(' ')}>
            <header className="data-list-header">
                <div className="data-list-title">
                    <span className="data-list-icon">
                        <i className={`fa-solid ${icon}`} />
                    </span>
                    <div>
                        <strong>{title}</strong>
                        {count !== null ? <small>{count}</small> : null}
                    </div>
                </div>

                {actions ? <div className="data-list-actions">{actions}</div> : null}
            </header>

            <div className="data-list-body">
                {hasContent ? children : empty}
            </div>
        </section>
    )
}
