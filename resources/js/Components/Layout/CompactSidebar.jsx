export default function CompactSidebar({ collapsed, sidebarOpen, onMouseEnter, onMouseLeave, children }) {
    return (
        <aside
            className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${sidebarOpen ? 'mobile-open' : ''}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {children}
        </aside>
    )
}
