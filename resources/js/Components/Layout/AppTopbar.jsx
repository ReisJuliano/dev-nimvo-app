function getTodayLabel() {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(new Date())
}

export default function AppTopbar({ title, collapsed, onToggleSidebar, onToggleMobileSidebar }) {
    return (
        <header className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-mobile-toggle" onClick={onToggleMobileSidebar} type="button">
                    <i className="fas fa-bars" />
                </button>
                <button
                    className="app-desktop-toggle ui-tooltip"
                    data-tooltip={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    onClick={onToggleSidebar}
                    type="button"
                >
                    <i className={`fas ${collapsed ? 'fa-sidebar' : 'fa-bars-staggered'}`} />
                </button>
                <div className="app-topbar-heading">
                    <span className="app-page-title">{title}</span>
                </div>
            </div>

            <div className="app-topbar-right">
                <div className="app-topbar-date-chip">
                    <i className="fas fa-calendar-day" />
                    {getTodayLabel()}
                </div>
            </div>
        </header>
    )
}
