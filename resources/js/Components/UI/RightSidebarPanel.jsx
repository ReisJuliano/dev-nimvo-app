export function RightSidebarSection({ title, subtitle = null, children, className = '' }) {
    return (
        <section className={['right-sidebar-section', className].filter(Boolean).join(' ')}>
            {(title || subtitle) ? (
                <header className="right-sidebar-section-header">
                    {title ? <strong>{title}</strong> : null}
                    {subtitle ? <span>{subtitle}</span> : null}
                </header>
            ) : null}

            <div className="right-sidebar-section-body">{children}</div>
        </section>
    )
}

export default function RightSidebarPanel({ children, className = '' }) {
    return (
        <div className={['right-sidebar-panel', className].filter(Boolean).join(' ')}>
            {children}
        </div>
    )
}
