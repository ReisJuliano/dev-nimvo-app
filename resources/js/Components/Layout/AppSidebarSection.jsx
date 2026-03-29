import { Link } from '@inertiajs/react'

export default function AppSidebarSection({ section, currentUrl, onNavigate, collapsed }) {
    function isActive(href) {
        return currentUrl === href || currentUrl.startsWith(`${href}/`)
    }

    if (collapsed) {
        return (
            <div className="app-nav-section is-collapsed">
                {section.items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`app-nav-item ${isActive(item.href) ? 'active' : ''}`}
                        onClick={onNavigate}
                        title={item.label}
                    >
                        <i className={`fas ${item.icon}`} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>
        )
    }

    return (
        <div className="app-nav-section">
            <div className="app-nav-section-toggle">
                <div>
                    <span className="app-nav-section-label">{section.section}</span>
                </div>
            </div>

            <div className="app-nav-section-content">
                {section.items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`app-nav-item ${isActive(item.href) ? 'active' : ''}`}
                        onClick={onNavigate}
                    >
                        <i className={`fas ${item.icon}`} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
