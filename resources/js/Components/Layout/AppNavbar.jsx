import { Link } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'

function isItemActive(item, currentUrl) {
    if (!currentUrl || !item.request_patterns) {
        return false
    }

    return item.request_patterns.some((pattern) => {
        const base = pattern.replace(/\*/g, '').replace(/^\//, '')

        if (!base) {
            return false
        }

        return currentUrl.includes('/' + base) || currentUrl === '/' + base
    })
}

export default function AppNavbar({ auth, navigationGroups, currentUrl, onLogout }) {
    const [moreOpen, setMoreOpen] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const moreRef = useRef(null)

    const mainGroup = navigationGroups[0] || { items: [] }
    const secondaryGroups = navigationGroups.slice(1)
    const secondaryItems = secondaryGroups.flatMap((g) => g.items)

    const firstName = String(auth?.user?.name || '').trim().split(/\s+/)[0] || '?'
    const initials = firstName.slice(0, 2).toUpperCase()

    useEffect(() => {
        if (!moreOpen) {
            return undefined
        }

        function handleClick(e) {
            if (moreRef.current && !moreRef.current.contains(e.target)) {
                setMoreOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClick)

        return () => document.removeEventListener('mousedown', handleClick)
    }, [moreOpen])

    useEffect(() => {
        setMobileOpen(false)
        setMoreOpen(false)
    }, [currentUrl])

    return (
        <>
            <header className="app-navbar">
                {/* Brand */}
                <Link href="/dashboard" className="app-navbar-brand">
                    <div className="app-navbar-logo-icon">
                        <i className="fa-solid fa-bolt" />
                    </div>
                    <span className="app-navbar-brand-name">Nimvo</span>
                </Link>

                {/* Desktop nav */}
                <nav className="app-navbar-nav" aria-label="Navegação principal">
                    {mainGroup.items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`app-navbar-item ${isItemActive(item, currentUrl) ? 'active' : ''}`}
                        >
                            <i className={`fa-solid ${item.icon}`} />
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    {secondaryItems.length > 0 && (
                        <div className="app-navbar-more" ref={moreRef}>
                            <button
                                type="button"
                                className={`app-navbar-item app-navbar-item--more ${moreOpen ? 'active' : ''}`}
                                onClick={() => setMoreOpen((v) => !v)}
                            >
                                <i className="fa-solid fa-grid-2" />
                                <span>Mais</span>
                                <i className={`fa-solid fa-chevron-down app-navbar-chevron ${moreOpen ? 'open' : ''}`} />
                            </button>

                            {moreOpen && (
                                <div className="app-navbar-dropdown">
                                    {secondaryGroups.map((group) => (
                                        <div key={group.section} className="app-navbar-dropdown-group">
                                            {group.section && (
                                                <div className="app-navbar-dropdown-label">{group.section}</div>
                                            )}
                                            {group.items.map((item) => (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`app-navbar-dropdown-item ${isItemActive(item, currentUrl) ? 'active' : ''}`}
                                                    onClick={() => setMoreOpen(false)}
                                                >
                                                    <div className="app-navbar-dropdown-icon">
                                                        <i className={`fa-solid ${item.icon}`} />
                                                    </div>
                                                    {item.label}
                                                </Link>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                {/* Right side: user */}
                <div className="app-navbar-right">
                    <button
                        type="button"
                        className="app-navbar-avatar"
                        onClick={onLogout}
                        title={`${firstName} · Sair`}
                    >
                        {initials}
                    </button>
                </div>

                {/* Mobile toggle */}
                <button
                    type="button"
                    className="app-navbar-mobile-toggle"
                    onClick={() => setMobileOpen((v) => !v)}
                    aria-label="Abrir menu"
                >
                    <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
                </button>
            </header>

            {/* Mobile menu overlay */}
            {mobileOpen && (
                <div className="app-mobile-menu">
                    <div className="app-mobile-menu-inner">
                        {navigationGroups.map((group) => (
                            <div key={group.section} className="app-mobile-group">
                                {group.section && (
                                    <div className="app-mobile-group-label">{group.section}</div>
                                )}
                                {group.items.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`app-mobile-item ${isItemActive(item, currentUrl) ? 'active' : ''}`}
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        <div className="app-mobile-item-icon">
                                            <i className={`fa-solid ${item.icon}`} />
                                        </div>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        ))}
                        <div className="app-mobile-group">
                            <button type="button" className="app-mobile-item app-mobile-logout" onClick={onLogout}>
                                <div className="app-mobile-item-icon">
                                    <i className="fa-solid fa-arrow-right-from-bracket" />
                                </div>
                                <span>Sair</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
