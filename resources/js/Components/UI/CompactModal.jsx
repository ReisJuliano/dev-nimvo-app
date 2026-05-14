import ActionButton from './ActionButton'

export default function CompactModal({
    open,
    title,
    description = null,
    icon = 'fa-window-maximize',
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
        <div className="compact-modal-backdrop" onClick={onClose}>
            <section
                aria-modal="true"
                className={['compact-modal-card', `size-${size}`, className].filter(Boolean).join(' ')}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <header className="compact-modal-header">
                    <div className="compact-modal-titlebox">
                        <span className="compact-modal-icon">
                            <i className={`fa-solid ${icon}`} />
                        </span>
                        <div className="compact-modal-copy">
                            {badge ? <span className="compact-modal-badge">{badge}</span> : null}
                            <strong>{title}</strong>
                            {description ? <span>{description}</span> : null}
                        </div>
                    </div>

                    <ActionButton
                        aria-label="Fechar"
                        className="compact-modal-close"
                        data-tooltip="Fechar"
                        icon="fa-xmark"
                        iconOnly
                        tone="ghost"
                        onClick={onClose}
                    />
                </header>

                <div className={['compact-modal-body', bodyClassName].filter(Boolean).join(' ')}>
                    {children}
                </div>

                {footer ? <footer className="compact-modal-footer">{footer}</footer> : null}
            </section>
        </div>
    )
}
