export default function SidebarToolButton({
    icon,
    label,
    hint,
    active = false,
    collapsed = false,
    tone = 'neutral',
    onClick,
    disabled = false,
}) {
    return (
        <button
            type="button"
            className={`orders-sidebar-button ${active ? 'active' : ''} tone-${tone} ${collapsed ? 'collapsed' : ''} ui-tooltip`}
            data-tooltip={collapsed ? label : hint || label}
            onClick={onClick}
            disabled={disabled}
        >
            <span className="orders-sidebar-button-icon">
                <i className={`fa-solid ${icon}`} />
            </span>
            {!collapsed ? (
                <span className="orders-sidebar-button-copy">
                    <strong>{label}</strong>
                    {hint ? <small>{hint}</small> : null}
                </span>
            ) : null}
        </button>
    )
}
