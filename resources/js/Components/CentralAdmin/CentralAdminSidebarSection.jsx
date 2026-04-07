import { Link } from '@inertiajs/react'

function normalizePath(input) {
    if (!input) {
        return '/'
    }

    const pathname = String(input).split('?')[0] || '/'
    const normalized = pathname.replace(/\/+$/, '')

    return normalized.length ? normalized : '/'
}

export default function CentralAdminSidebarSection({ section, currentUrl, collapsed, onNavigate }) {
    function isActive(href) {
        const currentPath = normalizePath(currentUrl)
        const hrefPath = normalizePath(href)

        return currentPath === hrefPath || currentPath.startsWith(`${hrefPath}/`)
    }

    return (
        <section className="central-admin-nav-section">
            {collapsed ? null : <span className="central-admin-nav-section-title">{section.section}</span>}

            <div className="central-admin-nav-section-list">
                {section.items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`central-admin-nav-item ${isActive(item.href) ? 'is-active' : ''}`}
                        onClick={onNavigate}
                        title={item.label}
                    >
                        <span className="central-admin-nav-icon">
                            <i className={`fa-solid ${item.icon}`} />
                        </span>
                        {collapsed ? null : <span className="central-admin-nav-label">{item.label}</span>}
                    </Link>
                ))}
            </div>
        </section>
    )
}
