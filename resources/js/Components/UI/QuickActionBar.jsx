export default function QuickActionBar({
    items,
    title = null,
    orientation = 'vertical',
    className = '',
}) {
    return (
        <section className={['quick-action-bar', `orientation-${orientation}`, className].filter(Boolean).join(' ')}>
            {title ? <strong className="quick-action-bar-title">{title}</strong> : null}
            <div className="quick-action-bar-grid">
                {items.map((item) => {
                    const commonProps = {
                        className: ['quick-action-button', item.tone ? `tone-${item.tone}` : '', item.active ? 'active' : '', item.className || '']
                            .filter(Boolean)
                            .join(' '),
                        title: item.label,
                    }

                    const content = (
                        <>
                            <span className="quick-action-icon">
                                <i className={`fa-solid ${item.icon}`} />
                            </span>
                            <div className="quick-action-copy">
                                <span>{item.label}</span>
                                {item.description ? <small>{item.description}</small> : null}
                            </div>
                        </>
                    )

                    if (item.href) {
                        return (
                            <a key={item.key || item.label} href={item.href} {...commonProps}>
                                {content}
                            </a>
                        )
                    }

                    return (
                        <button
                            key={item.key || item.label}
                            type="button"
                            disabled={item.disabled}
                            onClick={item.onClick}
                            {...commonProps}
                        >
                            {content}
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
