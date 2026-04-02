import { useEffect, useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppSidebar from '@/Components/Layout/AppSidebar'
import AppTopbar from '@/Components/Layout/AppTopbar'
import { buildNavigationGroups } from '@/Components/Layout/navigation'
import useModules from '@/hooks/useModules'
import { useFlashPopup } from '@/lib/errorPopup'
import './app-layout.css'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'app-sidebar-collapsed'

export default function AppLayout({
    children,
    title = 'Inicio',
    settingsOverride = null,
    showTopbar = true,
    contentClassName = '',
}) {
    const { auth, flash, tenantNavigationCatalog, license } = usePage().props
    const currentUrl = usePage().url
    const currentPath = currentUrl.split('?')[0]
    const isPosPage = currentPath === '/pdv' || currentPath.startsWith('/pdv/')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window === 'undefined') {
            return isPosPage
        }

        if (isPosPage) {
            return true
        }

        return window.sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    })
    const moduleState = useModules(settingsOverride)
    useFlashPopup(flash)

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        if (isPosPage) {
            setCollapsed(true)
            return
        }

        setCollapsed(window.sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
    }, [isPosPage])

    useEffect(() => {
        if (typeof window === 'undefined' || isPosPage) {
            return
        }

        window.sessionStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    }, [collapsed, isPosPage])

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

                    <div className={`app-main ${collapsed ? 'collapsed' : ''} ${showTopbar ? '' : 'no-topbar'}`}>
                        {showTopbar ? (
                            <AppTopbar
                                title={title}
                                onToggleMobileSidebar={toggleMobileSidebar}
                            />
                        ) : (
                            <button className="app-mobile-toggle app-mobile-toggle-floating" onClick={toggleMobileSidebar} type="button">
                                <i className="fas fa-bars" />
                            </button>
                        )}

                        {license && license.status !== 'active' ? (
                            <section className={`app-license-banner ${license.status}`}>
                                <div className="app-license-banner-icon">
                                    <i className={`fa-solid ${license.status === 'blocked' ? 'fa-lock' : 'fa-triangle-exclamation'}`} />
                                </div>
                                <div className="app-license-banner-copy">
                                    <strong>{license.status === 'blocked' ? 'Licenca bloqueada' : 'Licenca requer atencao'}</strong>
                                    <span>{license.message}</span>
                                </div>
                            </section>
                        ) : null}

                        <main className={`app-page-content ${contentClassName}`.trim()}>{children}</main>
                    </div>
                </div>
            </div>
        </>
    )
}
