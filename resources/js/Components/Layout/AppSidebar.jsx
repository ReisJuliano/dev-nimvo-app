import AppSidebarSection from '@/Components/Layout/AppSidebarSection'

export default function AppSidebar({
    auth,
    navigationGroups,
    currentUrl,
    collapsed,
    sidebarOpen,
    onToggleCollapsed,
    onCloseMobile,
    onLogout,
}) {
    const userInitials =
        auth?.user?.name
            ?.split(' ')
            .map((name) => name[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'U'

    return (
        <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${sidebarOpen ? 'mobile-open' : ''}`}>
            <div className="app-sidebar-header">
                <div className="app-logo">
                    <div className="app-logo-icon">
                        <img
                            src="/assets/img/logo.png"
                            alt="Logo"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none'
                                event.currentTarget.parentElement.innerHTML =
                                    '<i class="fas fa-store" style="color:white;font-size:16px"></i>'
                            }}
                        />
                    </div>
                    <div className="app-logo-text">
                        <span className="app-logo-name">Nimvo</span>
                        <span className="app-logo-sub">Sistema Inteligente</span>
                    </div>
                </div>

                <button className="app-sidebar-toggle" onClick={onToggleCollapsed} type="button">
                    <i className="fas fa-bars" />
                </button>
            </div>

            <div className="app-sidebar-user">
                <div className="app-user-avatar">{userInitials}</div>
                <div className="app-user-info">
                    <span className="app-user-name">{auth?.user?.name || 'Usuario'}</span>
                    <span className="app-user-role">{auth?.user?.role || 'operador'}</span>
                </div>
            </div>

            <nav className="app-sidebar-nav">
                {navigationGroups.map((group) => (
                    <AppSidebarSection
                        key={group.section}
                        section={group}
                        currentUrl={currentUrl}
                        onNavigate={onCloseMobile}
                    />
                ))}
            </nav>

            <div className="app-sidebar-footer">
                <button className="app-logout-button" onClick={onLogout} type="button">
                    <i className="fas fa-right-from-bracket" />
                    <span>Sair</span>
                </button>
            </div>
        </aside>
    )
}
