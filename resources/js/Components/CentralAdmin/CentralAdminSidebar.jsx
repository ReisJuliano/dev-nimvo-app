import CentralAdminSidebarSection from '@/Components/CentralAdmin/CentralAdminSidebarSection'

export default function CentralAdminSidebar({ navigationGroups, currentUrl, mobileOpen, onCloseMobile }) {
    function handleNavigate() {
        onCloseMobile?.()
    }

    return (
        <aside className={`central-admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
            <div className="central-admin-sidebar-header">
                <div className="central-admin-brand">
                    <div className="central-admin-brand-mark">
                        <img src="/assets/img/logo.png" alt="Logo Nimvo" />
                    </div>
                    <div className="central-admin-brand-copy">
                        <strong>Nimvo Admin</strong>
                        <span>Central control</span>
                    </div>
                </div>

                <button type="button" className="central-admin-sidebar-close" onClick={onCloseMobile}>
                    <i className="fa-solid fa-xmark" />
                </button>
            </div>

            <nav className="central-admin-sidebar-nav">
                {navigationGroups.map((group) => (
                    <CentralAdminSidebarSection
                        key={group.section}
                        section={group}
                        currentUrl={currentUrl}
                        onNavigate={handleNavigate}
                    />
                ))}
            </nav>
        </aside>
    )
}
