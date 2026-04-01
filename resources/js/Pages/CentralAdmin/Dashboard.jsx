import { Link } from '@inertiajs/react'
import AdminLayout from '@/Layouts/AdminLayout'
import { getPresetLabel, normalizeSettings } from '@/lib/modules'
import '../admin-dashboard.css'

function countEnabledModules(settings) {
    return Object.values(settings?.modules || {}).filter(Boolean).length
}

function normalizeModuleLabel(label) {
    return String(label || '').replace(/^Usar\s+/i, '').trim()
}

export default function CentralAdminDashboard({ tenantStats, tenants, moduleSections }) {
    const tenantSummaries = tenants.map((tenant) => {
        const form = normalizeSettings(tenant.settings)

        return {
            ...tenant,
            form,
            activeModules: countEnabledModules(form),
            presetLabel: getPresetLabel(form.business?.preset),
        }
    })

    const trackedModules = moduleSections.flatMap((section) => section.items)
    const latestTenants = [...tenantSummaries]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 5)

    const moduleUsage = trackedModules
        .map((item) => ({
            key: item.key,
            label: normalizeModuleLabel(item.label),
            count: tenantSummaries.filter((tenant) => Boolean(tenant.form.modules?.[item.key])).length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

    const averageModules = tenantSummaries.length
        ? (tenantSummaries.reduce((total, tenant) => total + tenant.activeModules, 0) / tenantSummaries.length).toFixed(1)
        : '0.0'

    const customPresetCount = tenantSummaries.filter((tenant) => tenant.form.business?.preset === 'personalizado').length

    return (
        <AdminLayout title="Home">
            <div className="central-admin-page">
                <section className="central-admin-card central-admin-hero">
                    <div className="central-admin-hero-copy">
                        <h1>Painel</h1>
                    </div>

                    <div className="central-admin-hero-actions">
                        <Link href="/admin/clientes" className="central-admin-primary-button">
                            <i className="fa-solid fa-plus" />
                            <span>Novo</span>
                        </Link>
                        <Link href="/admin/feature-flags" className="central-admin-secondary-button">
                            <i className="fa-solid fa-sliders" />
                            <span>Modulos</span>
                        </Link>
                    </div>
                </section>

                <section className="central-admin-stats-grid">
                    <article className="central-admin-card central-admin-stat-card">
                        <div className="central-admin-stat-icon">
                            <i className="fa-solid fa-buildings" />
                        </div>
                        <div className="central-admin-stat-copy">
                            <strong>{tenantStats.total}</strong>
                            <span>Tenants</span>
                        </div>
                    </article>

                    <article className="central-admin-card central-admin-stat-card">
                        <div className="central-admin-stat-icon">
                            <i className="fa-solid fa-circle-check" />
                        </div>
                        <div className="central-admin-stat-copy">
                            <strong>{tenantStats.active}</strong>
                            <span>Ativos</span>
                        </div>
                    </article>

                    <article className="central-admin-card central-admin-stat-card">
                        <div className="central-admin-stat-icon">
                            <i className="fa-solid fa-circle-pause" />
                        </div>
                        <div className="central-admin-stat-copy">
                            <strong>{tenantStats.inactive}</strong>
                            <span>Inativos</span>
                        </div>
                    </article>

                    <article className="central-admin-card central-admin-stat-card">
                        <div className="central-admin-stat-icon">
                            <i className="fa-solid fa-toggle-on" />
                        </div>
                        <div className="central-admin-stat-copy">
                            <strong>{averageModules}</strong>
                            <span>Media</span>
                        </div>
                    </article>
                </section>

                <section className="central-admin-page-grid">
                    <article className="central-admin-card">
                        <div className="central-admin-section-head">
                            <div>
                                <h2>Ultimos cadastrados</h2>
                            </div>
                            <div className="central-admin-section-head-actions">
                                <Link href="/admin/clientes" className="central-admin-secondary-button">
                                    <i className="fa-solid fa-table-list" />
                                    <span>Tenants</span>
                                </Link>
                            </div>
                        </div>

                        <div className="central-admin-list">
                            {latestTenants.length === 0 ? (
                                <div className="central-admin-empty-state">
                                    <i className="fa-solid fa-buildings" />
                                    <h3>Nenhum tenant</h3>
                                </div>
                            ) : null}

                            {latestTenants.map((tenant) => (
                                <div key={tenant.id} className="central-admin-list-row">
                                    <div className="central-admin-list-copy">
                                        <strong>{tenant.name}</strong>
                                        <small>{tenant.domain || tenant.id}</small>
                                    </div>
                                    <div className="central-admin-list-meta">
                                        <span className={`central-admin-status-pill ${tenant.active ? 'is-active' : 'is-inactive'}`}>
                                            {tenant.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                        <span className="central-admin-badge is-info">{tenant.activeModules} modulos</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className="central-admin-card central-admin-note-card">
                        <h3>Configurações</h3>
                        <div className="central-admin-pill-row">
                            <span className="central-admin-badge is-info">{trackedModules.length} modulos</span>
                            <span className="central-admin-badge is-success">{customPresetCount} customizados</span>
                        </div>
                        <Link href="/admin/feature-flags" className="central-admin-primary-button">
                            <i className="fa-solid fa-sliders" />
                            <span>Abrir</span>
                        </Link>
                    </article>
                </section>

                <section className="central-admin-card">
                    <div className="central-admin-section-head">
                        <div>
                            <h2>Modulos mais usados</h2>
                        </div>
                    </div>

                    <div className="central-admin-list">
                        {moduleUsage.length === 0 ? (
                            <div className="central-admin-empty-state">
                                <i className="fa-solid fa-toggle-on" />
                                <h3>Sem modulos ativos</h3>
                            </div>
                        ) : null}

                        {moduleUsage.map((module) => {
                            const percentage = tenantStats.total ? Math.round((module.count / tenantStats.total) * 100) : 0

                            return (
                                <div key={module.key} className="central-admin-list-row">
                                    <div className="central-admin-list-copy">
                                        <strong>{module.label}</strong>
                                        <small>{module.count} ativos</small>
                                    </div>
                                    <div className="central-admin-list-meta">
                                        <div className="central-admin-mini-progress" aria-hidden="true">
                                            <span style={{ width: `${percentage}%` }} />
                                        </div>
                                        <span className="central-admin-badge">{percentage}%</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            </div>
        </AdminLayout>
    )
}
