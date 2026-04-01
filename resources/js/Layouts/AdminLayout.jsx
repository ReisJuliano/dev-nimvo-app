import { Head, router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import CentralAdminSidebar from '@/Components/CentralAdmin/CentralAdminSidebar'
import CentralAdminTopbar from '@/Components/CentralAdmin/CentralAdminTopbar'
import { CENTRAL_ADMIN_NAVIGATION } from '@/Components/CentralAdmin/navigation'
import './admin-layout.css'

export default function AdminLayout({ title = 'Admin', subtitle = '', children }) {
    const { centralAuth } = usePage().props
    const currentUrl = usePage().url
    const [mobileOpen, setMobileOpen] = useState(false)

    useEffect(() => {
        setMobileOpen(false)
    }, [currentUrl])

    useEffect(() => {
        if (typeof document === 'undefined') {
            return undefined
        }

        document.body.classList.toggle('central-admin-no-scroll', mobileOpen)

        return () => {
            document.body.classList.remove('central-admin-no-scroll')
        }
    }, [mobileOpen])

    function handleLogout() {
        router.post('/admin/logout')
    }

    return (
        <>
            <Head title={title} />
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
            />
            <link
                rel="stylesheet"
                href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
            />

            <div className="central-admin-app">
                <div
                    className={`central-admin-backdrop ${mobileOpen ? 'is-visible' : ''}`}
                    onClick={() => setMobileOpen(false)}
                />

                <CentralAdminSidebar
                    navigationGroups={CENTRAL_ADMIN_NAVIGATION}
                    currentUrl={currentUrl}
                    mobileOpen={mobileOpen}
                    onCloseMobile={() => setMobileOpen(false)}
                />

                <div className="central-admin-main-shell">
                    <CentralAdminTopbar
                        title={title}
                        subtitle={subtitle}
                        userName={centralAuth?.user?.name || 'Administrador'}
                        onLogout={handleLogout}
                        onToggleMobileSidebar={() => setMobileOpen(true)}
                    />

                    <main className="central-admin-content">{children}</main>
                </div>
            </div>
        </>
    )
}
