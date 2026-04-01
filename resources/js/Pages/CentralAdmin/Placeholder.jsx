import { Link } from '@inertiajs/react'
import AdminLayout from '@/Layouts/AdminLayout'
import '../admin-dashboard.css'

export default function CentralAdminPlaceholder({ title, icon }) {
    return (
        <AdminLayout title={title}>
            <div className="central-admin-page">
                <section className="central-admin-card central-admin-hero">
                    <div className="central-admin-hero-copy">
                        <h1>{title}</h1>
                    </div>

                    <div className="central-admin-hero-actions">
                        <Link href="/admin/clientes" className="central-admin-secondary-button">
                            <i className="fa-solid fa-buildings" />
                            <span>Tenants</span>
                        </Link>
                        <Link href="/admin/feature-flags" className="central-admin-primary-button">
                            <i className="fa-solid fa-sliders" />
                            <span>Configuracoes</span>
                        </Link>
                    </div>
                </section>

                <section className="central-admin-card central-admin-note-card">
                    <div className="central-admin-badge is-info">
                        <i className={`fa-solid ${icon}`} />
                        <span>{title}</span>
                    </div>
                </section>
            </div>
        </AdminLayout>
    )
}
