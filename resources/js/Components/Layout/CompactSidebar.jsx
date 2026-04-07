export default function CompactSidebar({ collapsed, sidebarOpen, children }) {
    return (
        <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${sidebarOpen ? 'mobile-open' : ''}`}>
            {children}
        </aside>
    )
}
