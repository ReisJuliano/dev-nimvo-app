export default function AppTopbar({ title, onToggleMobileSidebar }) {
    return (
        <header className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-mobile-toggle" onClick={onToggleMobileSidebar} type="button">
                    <i className="fas fa-bars" />
                </button>
                <div className="app-topbar-heading">
                    <span className="app-page-title">{title}</span>
                </div>
            </div>
        </header>
    )
}
