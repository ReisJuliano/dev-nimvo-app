import ActionButton from './ActionButton'

export default function ActionDrawer({
    open,
    title,
    description = null,
    icon = 'fa-sliders',
    size = 'md',
    children,
    footer = null,
    badge = null,
    className = '',
    bodyClassName = '',
    onClose,
}) {
    if (!open) {
        return null
    }

    return (
        <div className="action-drawer-backdrop">
            <aside
                aria-modal="true"
                className={['action-drawer-card', `size-${size}`, className].filter(Boolean).join(' ')}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <header className="action-drawer-header">
                    <div className="action-drawer-titlebox">
                        <span className="action-drawer-icon">
                            <i className={`fa-solid ${icon}`} />
                        </span>
                        <div className="action-drawer-copy">
                            {badge ? <span className="action-drawer-badge">{badge}</span> : null}
                            <strong>{title}</strong>
                            {description ? <span>{description}</span> : null}
                        </div>
                    </div>

                    <ActionButton
                        aria-label="Fechar"
                        className="action-drawer-close"
                        data-tooltip="Fechar"
                        icon="fa-xmark"
                        iconOnly
                        tone="ghost"
                        onClick={onClose}
                    />
                </header>

                <div className={['action-drawer-body', bodyClassName].filter(Boolean).join(' ')}>
                    {children}
                </div>

                {footer ? <footer className="action-drawer-footer">{footer}</footer> : null}
            </aside>
        </div>
    )
}
