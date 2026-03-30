export default function OrdersModal({ title, subtitle, size = 'lg', onClose, children, footer = null, badge = null }) {
    return (
        <div className="orders-modal-backdrop" onClick={onClose}>
            <div className={`orders-modal orders-modal-${size}`} onClick={(event) => event.stopPropagation()}>
                <div className="orders-modal-header">
                    <div>
                        <div className="orders-modal-header-topline">
                            <span className="orders-page-kicker">Pedidos / Comandas</span>
                            {badge}
                        </div>
                        <h2>{title}</h2>
                        {subtitle ? <p>{subtitle}</p> : null}
                    </div>

                    <button type="button" className="orders-modal-close" onClick={onClose} aria-label="Fechar popup">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="orders-modal-body">{children}</div>

                {footer ? <div className="orders-modal-footer">{footer}</div> : null}
            </div>
        </div>
    )
}
