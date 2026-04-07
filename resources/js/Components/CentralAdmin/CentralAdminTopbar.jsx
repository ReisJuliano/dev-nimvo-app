export default function CentralAdminTopbar({
    title,
    subtitle,
    userName,
    onLogout,
    onToggleCollapsed,
    onToggleMobileSidebar,
}) {
    return (
        <header className="central-admin-topbar">
            <div className="central-admin-topbar-main">
                <button type="button" className="central-admin-topbar-collapse" onClick={onToggleCollapsed}>
                    <i className="fa-solid fa-bars-staggered" />
                </button>

                <button type="button" className="central-admin-topbar-mobile" onClick={onToggleMobileSidebar}>
                    <i className="fa-solid fa-bars" />
                </button>

                <div className="central-admin-topbar-copy">
                    <strong className="central-admin-topbar-title">{title}</strong>
                    {subtitle ? <span className="central-admin-topbar-subtitle">{subtitle}</span> : null}
                </div>
            </div>

            <div className="central-admin-topbar-actions">
                <div className="central-admin-user-chip">
                    <i className="fa-solid fa-user-shield" />
                    <span>{userName}</span>
                </div>

                <button type="button" className="central-admin-action-button" onClick={onLogout}>
                    <i className="fa-solid fa-right-from-bracket" />
                    <span>Sair</span>
                </button>
            </div>
        </header>
    )
}
