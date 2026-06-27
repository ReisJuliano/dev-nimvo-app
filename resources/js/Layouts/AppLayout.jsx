import { useEffect, useMemo } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppNavbar from '@/Components/Layout/AppNavbar'
import { buildNavigationGroups } from '@/Components/Layout/navigation'
import useModules from '@/hooks/useModules'
import { useFlashPopup } from '@/lib/errorPopup'
import useOfflineStatus from '@/lib/offline/useOfflineStatus'
import { configureOfflineWorkspaceBridge, hydrateOfflineWorkspace } from '@/lib/offline/workspace'
import './app-layout.css'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'app-sidebar-collapsed'

export default function AppLayout({
    children,
    title = 'Resumo',
    settingsOverride = null,
    showTopbar = true,
    contentClassName = '',
    navigationMode = 'default',
    defaultCollapsed = false,
}) {
    const { auth, flash, tenant, tenantNavigationCatalog, license, localAgentBridge } = usePage().props
    const currentUrl = usePage().url
    const isHiddenNavigation = navigationMode === 'hidden'
    const moduleState = useModules(settingsOverride)
    const offlineStatus = useOfflineStatus(tenant?.id)
    useFlashPopup(flash)

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

    const navigationGroups = useMemo(
        () => buildNavigationGroups({
            authRole: auth?.user?.role,
            modules: moduleState.modules,
            capabilities: moduleState.capabilities,
            catalog: tenantNavigationCatalog,
            preset: moduleState.preset,
        }),
        [auth?.user?.role, moduleState.capabilities, moduleState.modules, moduleState.preset, tenantNavigationCatalog],
    )

    const shouldShowOfflineBanner = Boolean(
        tenant?.id
        && (offlineStatus.isOffline || offlineStatus.pendingCount > 0 || offlineStatus.lastSyncError),
    )
    const offlineBannerTone = offlineStatus.isOffline ? 'offline' : offlineStatus.lastSyncError ? 'warning' : 'syncing'
    const offlineBannerTitle = offlineStatus.isOffline
        ? 'Modo offline ativo'
        : offlineStatus.pendingCount > 0 ? 'Reconectado com fila pendente' : 'Sincronização requer revisão'
    const offlineBannerText = offlineStatus.isOffline
        ? `Alterações salvas nesta máquina. ${offlineStatus.pendingCount} pendencia(s).`
        : offlineStatus.pendingCount > 0
            ? `${offlineStatus.pendingCount} pendencia(s) aguardando sincronização.`
            : offlineStatus.lastSyncError || 'Sincronização requer atenção.'

    return (
        <>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
            <link
                href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
                rel="stylesheet"
            />

            <div className="app-layout-root">
                {!isHiddenNavigation && showTopbar && (
                    <AppNavbar
                        auth={auth}
                        navigationGroups={navigationGroups}
                        currentUrl={currentUrl}
                        onLogout={handleLogout}
                    />
                )}

                <div className="app-layout-body">
                    {license && license.status !== 'active' ? (
                        <div className={`app-notice app-notice--${license.status === 'blocked' ? 'danger' : 'warning'}`}>
                            <i className={`fa-solid ${license.status === 'blocked' ? 'fa-lock' : 'fa-triangle-exclamation'}`} />
                            <span><strong>{license.status === 'blocked' ? 'Licença bloqueada.' : 'Licença requer atenção.'}</strong> {license.message}</span>
                        </div>
                    ) : null}

                    {shouldShowOfflineBanner ? (
                        <div className={`app-notice app-notice--${offlineBannerTone === 'offline' ? 'warning' : 'info'}`}>
                            <i className={`fa-solid ${offlineStatus.isOffline ? 'fa-wifi-slash' : 'fa-rotate'}`} />
                            <span><strong>{offlineBannerTitle}.</strong> {offlineBannerText}</span>
                        </div>
                    ) : null}

                    <main className={`app-page-content ${contentClassName}`.trim()}>
                        {children}
                    </main>
                </div>
            </div>
        </>
    )
}
