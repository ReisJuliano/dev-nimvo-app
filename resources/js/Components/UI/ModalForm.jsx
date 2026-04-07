import ActionButton from './ActionButton'

export default function ModalForm({
    open,
    title,
    description = null,
    icon = 'fa-pen-to-square',
    size = 'md',
    children,
    footer = null,
    onClose,
}) {
    if (!open) {
        return null
    }

    return (
        <div className="modal-form-backdrop" onClick={onClose}>
            <div
                className={['modal-form-card', `size-${size}`].join(' ')}
                onClick={(event) => event.stopPropagation()}
            >
                <header className="modal-form-header">
                    <div className="modal-form-title">
                        <span className="modal-form-icon">
                            <i className={`fa-solid ${icon}`} />
                        </span>
                        <div>
                            <strong>{title}</strong>
                            {description ? <span>{description}</span> : null}
                        </div>
                    </div>

                    <ActionButton
                        aria-label="Fechar"
                        className="modal-form-close"
                        icon="fa-xmark"
                        iconOnly
                        tone="ghost"
                        onClick={onClose}
                    />
                </header>

                <div className="modal-form-body">{children}</div>

                {footer ? <footer className="modal-form-footer">{footer}</footer> : null}
            </div>
        </div>
    )
}
