import { router } from '@inertiajs/react'

function getTodayLabel() {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(new Date())
}

export function goBackOrFallback(fallback = '/dashboard') {
    if (typeof window !== 'undefined' && window.history.length > 1) {
        window.history.back()
        return
    }

    router.visit(fallback)
}

export default function AppTopbar({ title, collapsed, onToggleSidebar, onToggleMobileSidebar }) {
    return (
        <header className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-mobile-toggle" onClick={onToggleMobileSidebar} type="button">
                    <i className="fas fa-bars" />
                </button>
                <button
                    className="app-desktop-toggle ui-tooltip"
                    data-tooltip={collapsed ? 'Expandir menu' : 'Recolher menu'}
                    onClick={onToggleSidebar}
                    type="button"
                >
                    <i className={`fas ${collapsed ? 'fa-sidebar' : 'fa-bars-staggered'}`} />
                </button>
                <button
                    className="app-back-button ui-tooltip"
                    data-tooltip="Voltar"
                    onClick={() => goBackOrFallback()}
                    type="button"
                >
                    <i className="fas fa-arrow-left" />
                </button>
                <div className="app-topbar-heading">
                    <span className="app-page-title">{title}</span>
                </div>
            </div>

            <div className="app-topbar-right">
                <div className="app-topbar-date-chip">
                    <i className="fas fa-calendar-day" />
                    {getTodayLabel()}
                </div>
            </div>
        </header>
    )
}
