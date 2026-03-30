import { Head, router, usePage } from '@inertiajs/react'
import './admin-layout.css'

export default function AdminLayout({ title = 'Admin', children }) {
    const { centralAuth } = usePage().props

    function handleLogout() {
        router.post('/admin/logout')
    }

    return (
        <>
            <Head title={title} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap"
                rel="stylesheet"
            />
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
            />

            <div className="admin-layout-root">
                <div className="admin-layout-glow admin-layout-glow-one" />
                <div className="admin-layout-glow admin-layout-glow-two" />

                <div className="admin-layout-shell">
                    <header className="admin-topbar">
                        <div className="admin-brand">
                            <div className="admin-brand-badge">
                                <i className="fa-solid fa-grid-2" />
                            </div>
                            <div>
                                <strong>Nimvo Admin</strong>
                                <span>Central</span>
                            </div>
                        </div>

                        <div className="admin-topbar-actions">
                            <div className="admin-user-chip">
                                <i className="fa-solid fa-user-shield" />
                                <span>{centralAuth?.user?.name || 'Administrador'}</span>
                            </div>

                            <button type="button" className="admin-ghost-button" onClick={handleLogout}>
                                <i className="fa-solid fa-arrow-right-from-bracket" />
                                <span>Sair</span>
                            </button>
                        </div>
                    </header>

                    <main className="admin-content">{children}</main>
                </div>
            </div>
        </>
    )
}
