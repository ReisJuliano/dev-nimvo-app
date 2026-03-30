import { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppSidebar from '@/Components/Layout/AppSidebar'
import AppTopbar from '@/Components/Layout/AppTopbar'
import { buildNavigationGroups } from '@/Components/Layout/navigation'
import useModules from '@/hooks/useModules'
import './app-layout.css'

export default function AppLayout({ children, title = 'Inicio', settingsOverride = null }) {
    const { auth } = usePage().props
    const currentUrl = usePage().url
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const [currentTime, setCurrentTime] = useState('')
    const [currentDate, setCurrentDate] = useState('')
    const moduleState = useModules(settingsOverride)

    useEffect(() => {
        function tick() {
            const now = new Date()
            setCurrentTime(
                now.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }),
            )
            setCurrentDate(
                now.toLocaleDateString('pt-BR', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                }),
            )
        }

        tick()
        const interval = setInterval(tick, 1000)

        return () => clearInterval(interval)
    }, [])

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

    const navigationGroups = buildNavigationGroups({
        authRole: auth?.user?.role,
        modules: moduleState.modules,
        capabilities: moduleState.capabilities,
    })
    const userRoleLabel = auth?.user?.role === 'admin' ? 'Administrador' : 'Operacao'

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
                            userRoleLabel={userRoleLabel}
                            currentDate={currentDate}
                            currentTime={currentTime}
                            onToggleMobileSidebar={toggleMobileSidebar}
                        />

                        <main className="app-page-content">{children}</main>
                    </div>
                </div>
            </div>
        </>
    )
}
