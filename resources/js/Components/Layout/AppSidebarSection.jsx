import { Link } from '@inertiajs/react'

export default function AppSidebarSection({ section, currentUrl, onNavigate }) {
    function isActive(href) {
        return currentUrl === href || currentUrl.startsWith(`${href}/`)
    }

    return (
        <div>
            <div className="app-nav-section-label">{section.section}</div>

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
    )
}
