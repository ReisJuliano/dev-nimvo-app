export default function PageContainer({
    toolbar = null,
    sidebar = null,
    children,
    className = '',
}) {
    return (
        <div className={['page-container', sidebar ? 'has-sidebar' : '', className].filter(Boolean).join(' ')}>
            <div className="page-main">
                {toolbar ? <div className="page-toolbar">{toolbar}</div> : null}
                {children}
            </div>

            {sidebar ? <aside className="page-sidebar">{sidebar}</aside> : null}
        </div>
    )
}
