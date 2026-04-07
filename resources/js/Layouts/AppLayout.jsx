import { useEffect, useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppSidebar from '@/Components/Layout/AppSidebar'
import AppTopbar from '@/Components/Layout/AppTopbar'
import { buildNavigationGroups } from '@/Components/Layout/navigation'
import useModules from '@/hooks/useModules'
import { formatDateTime } from '@/lib/format'
import { useFlashPopup } from '@/lib/errorPopup'
import useOfflineStatus from '@/lib/offline/useOfflineStatus'
import { configureOfflineWorkspaceBridge, hydrateOfflineWorkspace } from '@/lib/offline/workspace'
import './app-layout.css'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'app-sidebar-collapsed'

export default function AppLayout({
    children,
    title = 'Inicio',
    settingsOverride = null,
    showTopbar = true,
    contentClassName = '',
    navigationMode = 'default',
    defaultCollapsed = false,
}) {
    const { auth, flash, tenant, tenantNavigationCatalog, license, localAgentBridge } = usePage().props
    const currentUrl = usePage().url
    const currentPath = currentUrl.split('?')[0]
    const isPosPage = currentPath === '/pdv' || currentPath.startsWith('/pdv/')
    const isDashboardPage = currentPath === '/dashboard'
    const isOverlayNavigation = navigationMode === 'overlay'
    const isHiddenNavigation = navigationMode === 'hidden'
    const shouldAutoCompact = !isHiddenNavigation && !isOverlayNavigation && !isPosPage && !isDashboardPage
    const shouldStartCollapsed = isPosPage || defaultCollapsed || shouldAutoCompact
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window === 'undefined') {
            return shouldStartCollapsed || isOverlayNavigation
        }

        if (shouldStartCollapsed || isOverlayNavigation) {
            return true
        }

        return window.sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true'
    })
    const moduleState = useModules(settingsOverride)
    const offlineStatus = useOfflineStatus(tenant?.id)
    useFlashPopup(flash)

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        if (shouldStartCollapsed || isOverlayNavigation) {
            setCollapsed(true)
            return
        }

        setCollapsed(window.sessionStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true')
    }, [isOverlayNavigation, shouldStartCollapsed])

    useEffect(() => {
        if (typeof window === 'undefined' || shouldStartCollapsed || isOverlayNavigation) {
            return
        }

        window.sessionStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed))
    }, [collapsed, isOverlayNavigation, shouldStartCollapsed])

    useEffect(() => {
        if (!tenant?.id) {
            return
        }

        configureOfflineWorkspaceBridge(tenant.id, localAgentBridge)
        hydrateOfflineWorkspace(tenant.id).catch(() => {})
    }, [
        localAgentBridge?.agent_key,
        localAgentBridge?.base_url,
        localAgentBridge?.enabled,
        tenant?.id,
    ])

    function handleLogout() {
        router.post('/logout')
    }

    function toggleCollapsed() {
        if (isHiddenNavigation || isOverlayNavigation) {
            return
        }

        setCollapsed((current) => !current)
    }

    function toggleMobileSidebar() {
        if (isHiddenNavigation) {
            return
        }

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
    const shouldShowOfflineBanner = Boolean(
        tenant?.id
        && (offlineStatus.isOffline || offlineStatus.pendingCount > 0 || offlineStatus.lastSyncError),
    )
    const offlineBannerTone = offlineStatus.isOffline
        ? 'offline'
        : offlineStatus.lastSyncError
            ? 'warning'
            : 'syncing'
    const offlineBannerTitle = offlineStatus.isOffline
        ? 'Modo offline ativo'
        : offlineStatus.pendingCount > 0
            ? 'Reconectado com fila pendente'
            : 'Sincronizacao requer revisao'
    const offlineBannerText = offlineStatus.isOffline
        ? `As alteracoes ficam salvas nesta maquina e serao sincronizadas depois. ${offlineStatus.pendingCount} pendencia(s) local(is).`
        : offlineStatus.pendingCount > 0
            ? `${offlineStatus.pendingCount} pendencia(s) aguardando sincronizacao com o servidor.`
            : offlineStatus.lastSyncError || 'Existe uma sincronizacao que precisa de atencao.'
    const offlineBannerMeta = offlineStatus.lastSyncAt
        ? `Ultima sincronizacao concluida em ${formatDateTime(offlineStatus.lastSyncAt)}.`
        : 'Ainda nao houve uma sincronizacao concluida nesta maquina.'

    return (
        <>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
            <link
                href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
                rel="stylesheet"
            />

            <div
                className={`app-layout-root ${isOverlayNavigation ? 'overlay-nav' : ''} ${isHiddenNavigation ? 'no-sidebar' : ''}`.trim()}
            >
                <div className="app-layout-backdrop app-layout-backdrop-two" />
                <div className="app-layout-shell">
                    {isHiddenNavigation ? null : (
                        <div
                            className={`app-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                            onClick={closeMobileSidebar}
                        />
                    )}

                    {isHiddenNavigation ? null : (
                        <AppSidebar
                            auth={auth}
                            navigationGroups={navigationGroups}
                            currentUrl={currentUrl}
                            collapsed={collapsed}
                            sidebarOpen={sidebarOpen}
                            allowCollapse={!isOverlayNavigation}
                            onToggleCollapsed={toggleCollapsed}
                            onCloseMobile={closeMobileSidebar}
                            onLogout={handleLogout}
                        />
                    )}

                    <div className={`app-main ${collapsed ? 'collapsed' : ''} ${showTopbar ? '' : 'no-topbar'}`}>
                        {showTopbar ? (
                            <AppTopbar
                                title={title}
                                onToggleMobileSidebar={toggleMobileSidebar}
                            />
                        ) : !isHiddenNavigation ? (
                            <button className="app-mobile-toggle app-mobile-toggle-floating" onClick={toggleMobileSidebar} type="button">
                                <i className="fas fa-bars" />
                            </button>
                        ) : null}

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

                        {shouldShowOfflineBanner ? (
                            <section className={`app-offline-banner ${offlineBannerTone}`}>
                                <div className="app-offline-banner-icon">
                                    <i className={`fa-solid ${offlineStatus.isOffline ? 'fa-wifi-slash' : offlineStatus.lastSyncError ? 'fa-triangle-exclamation' : 'fa-rotate'}`} />
                                </div>
                                <div className="app-offline-banner-copy">
                                    <strong>{offlineBannerTitle}</strong>
                                    <span>{offlineBannerText}</span>
                                    <small>{offlineBannerMeta}</small>
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
