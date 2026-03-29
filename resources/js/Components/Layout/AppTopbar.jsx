import { Link } from '@inertiajs/react'

const quickActions = [
    { href: '/pdv', label: 'Abrir PDV', icon: 'fa-cash-register', tooltip: 'Ir para o ponto de venda' },
    { href: '/produtos', label: 'Produtos', icon: 'fa-boxes-stacked', tooltip: 'Gerenciar catalogo' },
]

export default function AppTopbar({ title, currentDate, currentTime, onToggleMobileSidebar }) {
    return (
        <header className="app-topbar">
            <div className="app-topbar-left">
                <button className="app-mobile-toggle" onClick={onToggleMobileSidebar} type="button">
                    <i className="fas fa-bars" />
                </button>
                <div className="app-topbar-heading">
                    <span className="app-page-kicker">Workspace Nimvo</span>
                    <span className="app-page-title">{title}</span>
                </div>
            </div>

            <div className="app-topbar-right">
                <div className="app-topbar-actions">
                    {quickActions.map((action) => (
                        <Link
                            key={action.href}
                            href={action.href}
                            className="app-topbar-action ui-tooltip"
                            data-tooltip={action.tooltip}
                        >
                            <i className={`fas ${action.icon}`} />
                            <span>{action.label}</span>
                        </Link>
                    ))}
                </div>
                <div className="app-topbar-info app-topbar-info-date">
                    <i className="far fa-calendar" />
                    <div>
                        <strong>{currentDate}</strong>
                        <span>Data de hoje</span>
                    </div>
                </div>
                <div className="app-topbar-info">
                    <i className="far fa-clock" />
                    <div>
                        <strong>Horario</strong>
                        <span>{currentTime}</span>
                    </div>
                </div>
            </div>
        </header>
    )
}
