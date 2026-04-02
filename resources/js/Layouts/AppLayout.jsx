import { useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppSidebar from '@/Components/Layout/AppSidebar'
import AppTopbar from '@/Components/Layout/AppTopbar'
import { buildNavigationGroups } from '@/Components/Layout/navigation'
import useModules from '@/hooks/useModules'
import { useFlashPopup } from '@/lib/errorPopup'
import './app-layout.css'

export default function AppLayout({ children, title = 'Inicio', settingsOverride = null }) {
    const { auth, flash, tenantNavigationCatalog } = usePage().props
    const currentUrl = usePage().url
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const moduleState = useModules(settingsOverride)
    useFlashPopup(flash)

    function handleLogout() {
        router.post('/logout')
    }

    function toggleCollapsed() {
        setCollapsed((current) => !current)
    }

    function toggleMobileSidebar() {
        setSidebarOpen((current) => !current)
    }

    function closeMobileSidebar() {
        setSidebarOpen(false)
    }

    const navigationGroups = useMemo(
        () => buildNavigationGroups({
            authRole: auth?.user?.role,
            modules: moduleState.modules,
            capabilities: moduleState.capabilities,
            catalog: tenantNavigationCatalog,
        }),
        [auth?.user?.role, moduleState.capabilities, moduleState.modules, tenantNavigationCatalog],
    )

    return (
        <>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
            <link
                href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
                rel="stylesheet"
            />

            <div className="app-layout-root">
                <div className="app-layout-backdrop app-layout-backdrop-two" />
                <div className="app-layout-shell">
                    <div
                        className={`app-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                        onClick={closeMobileSidebar}
                    />

                    <AppSidebar
                        auth={auth}
                        navigationGroups={navigationGroups}
                        currentUrl={currentUrl}
                        collapsed={collapsed}
                        sidebarOpen={sidebarOpen}
                        onToggleCollapsed={toggleCollapsed}
                        onCloseMobile={closeMobileSidebar}
                        onLogout={handleLogout}
                    />

                    <div className={`app-main ${collapsed ? 'collapsed' : ''}`}>
                        <AppTopbar
                            title={title}
                            onToggleMobileSidebar={toggleMobileSidebar}
                        />

                        <main className="app-page-content">{children}</main>
                    </div>
                </div>
            </div>
        </>
    )
}
