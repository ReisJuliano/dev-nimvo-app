import { Link } from '@inertiajs/react'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'
import AdminLayout from '@/Layouts/AdminLayout'
import '../admin-dashboard.css'

export default function CentralAdminPlaceholder({ title, icon }) {
    return (
        <AdminLayout title={title}>
            <div className="central-admin-page">
                <PageContainer
                    sidebar={(
                        <RightSidebarPanel>
                            <RightSidebarSection title="Acoes" subtitle="Navegacao rapida">
                                <Link href="/admin/clientes" className="action-button tone-ghost">
                                    <i className="fa-solid fa-buildings" />
                                    <span>Tenants</span>
                                </Link>
                                <Link href="/admin/feature-flags" className="action-button tone-primary">
                                    <i className="fa-solid fa-sliders" />
                                    <span>Configuracoes</span>
                                </Link>
                            </RightSidebarSection>
                        </RightSidebarPanel>
                    )}
                >
                    <section className="central-admin-card central-admin-note-card">
                        <div className="central-admin-badge is-info">
                            <i className={`fa-solid ${icon}`} />
                            <span>{title}</span>
                        </div>
                    </section>
                </PageContainer>
            </div>
        </AdminLayout>
    )
}
