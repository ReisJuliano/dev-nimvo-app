import { useEffect, useRef } from 'react'
import AppSidebarSection from '@/Components/Layout/AppSidebarSection'
import CompactSidebar from '@/Components/Layout/CompactSidebar'

export default function AppSidebar({
    auth,
    navigationGroups,
    currentUrl,
    collapsed,
    sidebarOpen,
    allowCollapse = true,
    onMouseEnter,
    onMouseLeave,
    onToggleCollapsed,
    onCloseMobile,
    onLogout,
}) {
    const navRef = useRef(null)

    useEffect(() => {
        const nav = navRef.current
        if (!nav || typeof window === 'undefined') {
            return undefined
        }

        const saved = window.sessionStorage.getItem('app-sidebar-scroll-top')
        if (saved !== null) {
            nav.scrollTop = Number(saved)
        }

        const persistScroll = () => {
            window.sessionStorage.setItem('app-sidebar-scroll-top', String(nav.scrollTop))
        }

        nav.addEventListener('scroll', persistScroll, { passive: true })

        return () => {
            nav.removeEventListener('scroll', persistScroll)
            persistScroll()
        }
    }, [])

    useEffect(() => {
        const nav = navRef.current
        if (!nav || typeof window === 'undefined') {
            return
        }

        const saved = window.sessionStorage.getItem('app-sidebar-scroll-top')
        if (saved !== null) {
            nav.scrollTop = Number(saved)
        }
    }, [currentUrl])

    function handleNavigate() {
        if (typeof window !== 'undefined' && navRef.current) {
            window.sessionStorage.setItem('app-sidebar-scroll-top', String(navRef.current.scrollTop))
        }

        onCloseMobile?.()
    }

    const userInitials =
        auth?.user?.name
            ?.split(' ')
            .map((name) => name[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'U'

    return (
        <CompactSidebar
            collapsed={collapsed}
            sidebarOpen={sidebarOpen}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="app-sidebar-header">
                <div className="app-logo">
                    <div className="app-logo-icon">
                        <img
                            src="/assets/img/logo.png"
                            alt="Logo Nimvo"
                            onError={(event) => {
                                event.currentTarget.style.display = 'none'
                                event.currentTarget.parentElement.innerHTML =
                                    '<i class="fas fa-store" style="color:white;font-size:16px"></i>'
                            }}
                        />
                    </div>
                    <div className="app-logo-text">
                        <span className="app-logo-name">Nimvo</span>
                    </div>
                </div>

                {allowCollapse ? (
                    <button className="app-sidebar-toggle" onClick={onToggleCollapsed} type="button">
                        <i className="fas fa-bars" />
                    </button>
                ) : null}
            </div>

            <div className="app-sidebar-user">
                <div className="app-user-avatar">{userInitials}</div>
                <div className="app-user-info">
                    <span className="app-user-name">{auth?.user?.name || 'Usuario'}</span>
                    <span className="app-user-role">{auth?.user?.role || 'operador'}</span>
                </div>
            </div>

            <nav className="app-sidebar-nav" ref={navRef}>
                <div className="app-sidebar-nav-kicker">Navegacao principal</div>
                {navigationGroups.map((group) => (
                    <AppSidebarSection
                        key={group.section}
                        section={group}
                        currentUrl={currentUrl}
                        onNavigate={handleNavigate}
                        collapsed={collapsed}
                    />
                ))}
            </nav>

            <div className="app-sidebar-footer">
                <button className="app-logout-button" onClick={onLogout} type="button">
                    <i className="fas fa-right-from-bracket" />
                    <span>Sair</span>
                </button>
            </div>
        </CompactSidebar>
    )
}
