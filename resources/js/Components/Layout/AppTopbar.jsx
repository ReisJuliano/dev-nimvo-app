export default function AppTopbar({ title, currentDate, currentTime, onToggleMobileSidebar }) {
    return (
        <header className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-mobile-toggle" onClick={onToggleMobileSidebar} type="button">
                    <i className="fas fa-bars" />
                </button>
                <span className="app-page-title">{title}</span>
            </div>

            <div className="app-topbar-right">
                <div className="app-topbar-info">
                    <i className="far fa-calendar" />
                    <span>{currentDate}</span>
                </div>
                <div className="app-topbar-info">
                    <i className="far fa-clock" />
                    <span>{currentTime}</span>
                </div>
            </div>
        </header>
    )
}
