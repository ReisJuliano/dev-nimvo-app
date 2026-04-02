export default function OrdersModal({
    title,
    subtitle,
    size = 'lg',
    onClose,
    children,
    footer = null,
    badge = null,
    className = '',
    bodyClassName = '',
    footerClassName = '',
}) {
    const modalClassName = ['orders-modal', `orders-modal-${size}`, className].filter(Boolean).join(' ')
    const modalBodyClassName = ['orders-modal-body', bodyClassName].filter(Boolean).join(' ')
    const modalFooterClassName = ['orders-modal-footer', footerClassName].filter(Boolean).join(' ')

    return (
        <div className="orders-modal-backdrop" onClick={onClose}>
            <div className={modalClassName} onClick={(event) => event.stopPropagation()}>
                <div className="orders-modal-header">
                    <div>
                        <div className="orders-modal-header-topline">
                            <span className="orders-page-kicker">Pedidos / Atendimentos</span>
                            {badge}
                        </div>
                        <h2>{title}</h2>
                        {subtitle ? <p>{subtitle}</p> : null}
                    </div>

                    <button type="button" className="orders-modal-close" onClick={onClose} aria-label="Fechar popup">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className={modalBodyClassName}>{children}</div>

                {footer ? <div className={modalFooterClassName}>{footer}</div> : null}
            </div>
        </div>
    )
}
