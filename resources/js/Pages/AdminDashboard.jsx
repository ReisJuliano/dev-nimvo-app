import { router } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import AdminLayout from '@/Layouts/AdminLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { CUSTOM_PRESET, getPresetLabel, normalizeSettings } from '@/lib/modules'
import './admin-dashboard.css'

function AdminSwitch({ checked, disabled = false, onChange, ariaLabel }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            className={`admin-switch ${checked ? 'checked' : ''}`}
            disabled={disabled}
            onClick={onChange}
        >
            <span className="admin-switch-track">
                <span className="admin-switch-thumb" />
            </span>
        </button>
    )
}

function cloneSettings(settings) {
    return JSON.parse(JSON.stringify(normalizeSettings(settings)))
}

function buildTenantForms(tenants) {
    return Object.fromEntries(tenants.map((tenant) => [tenant.id, cloneSettings(tenant.settings)]))
}

function getValueByPath(object, path) {
    return path.split('.').reduce((current, segment) => current?.[segment], object)
}

function setValueByPath(object, path, value) {
    const segments = path.split('.')
    const nextObject = { ...object }
    let cursor = nextObject

    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            cursor[segment] = value
            return
        }

        cursor[segment] = { ...cursor[segment] }
        cursor = cursor[segment]
    })

    return nextObject
}

function countEnabledModules(settings) {
    return Object.values(settings.modules || {}).filter(Boolean).length
}

const initialCreateForm = {
    client_name: '',
    tenant_name: '',
    tenant_id: '',
    domain: '',
    client_email: '',
    client_document: '',
    active: true,
}

export default function AdminDashboard({
    tenantStats,
    tenants,
    businessPresets,
    generalOptions,
    moduleSections,
}) {
    const [createForm, setCreateForm] = useState(initialCreateForm)
    const [tenantForms, setTenantForms] = useState(() => buildTenantForms(tenants))
    const [selectedTenantId, setSelectedTenantId] = useState(null)
    const [activeSection, setActiveSection] = useState(tenants.length > 0 ? 'configs' : 'create')
    const [feedback, setFeedback] = useState(null)
    const [creating, setCreating] = useState(false)
    const [savingTenantId, setSavingTenantId] = useState(null)
    const [statusTenantId, setStatusTenantId] = useState(null)
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })

    useEffect(() => {
        setTenantForms(buildTenantForms(tenants))

        if (selectedTenantId && !tenants.some((tenant) => tenant.id === selectedTenantId)) {
            setSelectedTenantId(null)
        }
    }, [tenants, selectedTenantId])

    useEffect(() => {
        if (tenants.length === 0 && activeSection !== 'create') {
            setActiveSection('create')
        }
    }, [tenants.length, activeSection])

    const tenantSummaries = tenants.map((tenant) => {
        const form = normalizeSettings(tenantForms[tenant.id] || tenant.settings)

        return {
            ...tenant,
            form,
            activeModules: countEnabledModules(form),
            presetLabel: getPresetLabel(form.business?.preset),
        }
    })

    const selectedTenant = tenantSummaries.find((tenant) => tenant.id === selectedTenantId) || null
    const selectedSectionCounts = selectedTenant
        ? Object.fromEntries(
            moduleSections.map((section) => [
                section.section,
                section.items.filter((item) => selectedTenant.form.modules?.[item.key]).length,
            ]),
        )
        : {}

    const presetUsage = Object.entries(
        tenantSummaries.reduce((accumulator, tenant) => {
            accumulator[tenant.presetLabel] = (accumulator[tenant.presetLabel] || 0) + 1
            return accumulator
        }, {}),
    ).sort((a, b) => b[1] - a[1])

    const moduleUsage = moduleSections
        .flatMap((section) => section.items)
        .map((item) => ({
            label: item.label.replace(/^Usar\s/, ''),
            count: tenantSummaries.filter((tenant) => Boolean(tenant.form.modules?.[item.key])).length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

    const averageModules = tenantSummaries.length > 0
        ? (tenantSummaries.reduce((total, tenant) => total + tenant.activeModules, 0) / tenantSummaries.length).toFixed(1)
        : '0.0'

    const latestTenants = [...tenantSummaries]
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 4)

    function refreshDashboard(only = ['tenants', 'tenantStats']) {
        router.reload({
            only,
            preserveScroll: true,
        })
    }

    function handleSectionChange(section) {
        setActiveSection(section)

        if (section === 'configs') {
            setSelectedTenantId(null)
        }
    }

    function handleOpenTenantConfig(tenantId) {
        setSelectedTenantId(tenantId)
        setActiveSection('configs')
    }

    function handleBackToTenantList() {
        setSelectedTenantId(null)
        setActiveSection('configs')
    }

    function handleCreateFieldChange(field, value) {
        setCreateForm((current) => ({
            ...current,
            [field]: value,
        }))
    }

    function handleTenantToggle(path) {
        if (!selectedTenant) {
            return
        }

        setTenantForms((current) => {
            const next = setValueByPath(current[selectedTenant.id], path, !getValueByPath(current[selectedTenant.id], path))

            if (path.startsWith('modules.')) {
                next.business = {
                    ...next.business,
                    preset: CUSTOM_PRESET,
                }
            }

            return {
                ...current,
                [selectedTenant.id]: next,
            }
        })
    }

    function applyPreset(preset) {
        if (!selectedTenant) {
            return
        }

        setTenantForms((current) => ({
            ...current,
            [selectedTenant.id]: {
                ...current[selectedTenant.id],
                business: {
                    ...current[selectedTenant.id].business,
                    preset: preset.key,
                },
                modules: { ...preset.modules },
            },
        }))
    }

    async function handleCreateTenant(event) {
        event.preventDefault()
        setCreating(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/admin/tenants', {
                method: 'post',
                data: createForm,
            })

            setCreateForm(initialCreateForm)

            if (response.tenant?.id) {
                setSelectedTenantId(response.tenant.id)
                setActiveSection('configs')
            }

            setFeedback({ type: 'success', text: response.message })
            refreshDashboard()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setCreating(false)
        }
    }

    async function handleStatusToggle(tenant) {
        setStatusTenantId(tenant.id)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${tenant.id}/status`, {
                method: 'patch',
                data: { active: !tenant.active },
            })

            setFeedback({ type: 'success', text: response.message })
            refreshDashboard()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setStatusTenantId(null)
        }
    }

    async function handleSaveTenantSettings() {
        if (!selectedTenant) {
            return
        }

        setSavingTenantId(selectedTenant.id)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${selectedTenant.id}/settings`, {
                method: 'put',
                data: tenantForms[selectedTenant.id],
            })

            setFeedback({ type: 'success', text: response.message })
            refreshDashboard(['tenants'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSavingTenantId(null)
        }
    }

    const sidebarItems = [
        { key: 'create', label: 'Criacao de tenant', icon: 'fa-plus-circle', meta: 'Novo cadastro' },
        {
            key: 'configs',
            label: 'Configs por tenant',
            icon: 'fa-sliders',
            meta: tenantSummaries.length > 0 ? `${tenantSummaries.length} tenants cadastrados` : 'Nenhum tenant cadastrado',
        },
        { key: 'reports', label: 'Relatorios', icon: 'fa-chart-column', meta: 'Visao administrativa' },
    ]

    return (
        <AdminLayout title="Admin Central">
            <div className="admin-dashboard-shell">
                <aside className="admin-sidebar">
                    <section className="admin-card admin-brand-card">
                        <div className="admin-card-kicker">Area administrativa</div>
                        <h1>Admin</h1>
                        <p>Botoes laterais para criar, configurar e acompanhar tenants.</p>
                    </section>

                    <section className="admin-card admin-nav-card">
                        <div className="admin-card-head compact">
                            <div>
                                <div className="admin-card-kicker">Menu</div>
                                <h2>Navegacao</h2>
                            </div>
                        </div>

                        <div className="admin-nav-list">
                            {sidebarItems.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={`admin-nav-button ${activeSection === item.key ? 'active' : ''}`}
                                    onClick={() => handleSectionChange(item.key)}
                                >
                                    <div className="admin-nav-icon">
                                        <i className={`fa-solid ${item.icon}`} />
                                    </div>
                                    <div>
                                        <strong>{item.label}</strong>
                                        <small>{item.meta}</small>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </aside>

                <section className="admin-main">
                    {feedback ? <div className={`admin-feedback ${feedback.type}`}>{feedback.text}</div> : null}

                    {activeSection === 'create' ? (
                        <>
                            <section className="admin-card admin-section-hero">
                                <div>
                                    <div className="admin-card-kicker">Criacao de tenant</div>
                                    <h2>Novo cadastro</h2>
                                    <p>Area exclusiva para cadastrar novos tenants e deixar pronto para operacao.</p>
                                </div>

                                {tenantSummaries.length > 0 ? (
                                    <div className="admin-section-hero-actions">
                                        <button type="button" className="admin-ghost-button" onClick={handleBackToTenantList}>
                                            <i className="fa-solid fa-arrow-left" />
                                            <span>Voltar</span>
                                        </button>
                                    </div>
                                ) : null}
                            </section>

                            <div className="admin-main-grid">
                                <section className="admin-card">
                                    <div className="admin-card-head">
                                        <div>
                                            <div className="admin-card-kicker">Formulario</div>
                                            <h2>Dados do tenant</h2>
                                        </div>
                                    </div>

                                    <form className="admin-form-grid" onSubmit={handleCreateTenant}>
                                        <label>
                                            <span>Nome</span>
                                            <input
                                                type="text"
                                                value={createForm.client_name}
                                                onChange={(event) => handleCreateFieldChange('client_name', event.target.value)}
                                                placeholder="Loja Centro"
                                                required
                                            />
                                        </label>

                                        <label>
                                            <span>Tenant ID</span>
                                            <input
                                                type="text"
                                                value={createForm.tenant_id}
                                                onChange={(event) => handleCreateFieldChange('tenant_id', event.target.value)}
                                                placeholder="loja-centro"
                                            />
                                        </label>

                                        <label>
                                            <span>Dominio</span>
                                            <input
                                                type="text"
                                                value={createForm.domain}
                                                onChange={(event) => handleCreateFieldChange('domain', event.target.value)}
                                                placeholder="loja-centro.nimvo.test"
                                                required
                                            />
                                        </label>

                                        <label>
                                            <span>Email</span>
                                            <input
                                                type="email"
                                                value={createForm.client_email}
                                                onChange={(event) => handleCreateFieldChange('client_email', event.target.value)}
                                                placeholder="contato@loja.com"
                                            />
                                        </label>

                                        <label>
                                            <span>Documento</span>
                                            <input
                                                type="text"
                                                value={createForm.client_document}
                                                onChange={(event) => handleCreateFieldChange('client_document', event.target.value)}
                                                placeholder="00.000.000/0001-00"
                                            />
                                        </label>

                                        <div className="admin-switch-row">
                                            <div>
                                                <strong>Tenant ativo</strong>
                                                <small>{createForm.active ? 'Entra ativo' : 'Entra pausado'}</small>
                                            </div>
                                            <AdminSwitch
                                                checked={createForm.active}
                                                ariaLabel="Ativar tenant na criacao"
                                                onChange={() => handleCreateFieldChange('active', !createForm.active)}
                                            />
                                        </div>

                                        <button type="submit" className="admin-primary-button full" disabled={creating}>
                                            {creating ? 'Criando...' : 'Criar tenant'}
                                        </button>
                                    </form>
                                </section>

                                <section className="admin-card">
                                    <div className="admin-card-head">
                                        <div>
                                            <div className="admin-card-kicker">Recentes</div>
                                            <h2>Ultimos tenants</h2>
                                        </div>
                                    </div>

                                    <div className="admin-compact-list">
                                        {latestTenants.length === 0 ? (
                                            <div className="admin-empty-note">Nada criado ainda.</div>
                                        ) : null}

                                        {latestTenants.map((tenant) => (
                                            <div key={tenant.id} className="admin-compact-row">
                                                <div>
                                                    <strong>{tenant.name}</strong>
                                                    <small>{tenant.domain || tenant.id}</small>
                                                </div>
                                                <span className="admin-count-pill">{tenant.active ? 'Ativo' : 'Inativo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </>
                    ) : null}

                    {activeSection === 'configs' ? (
                        selectedTenant ? (
                            <>
                                <section className="admin-card admin-section-hero">
                                    <div>
                                        <div className="admin-card-kicker">Configs por tenant</div>
                                        <h2>{selectedTenant.name}</h2>
                                        <p>{selectedTenant.domain || selectedTenant.id}</p>
                                    </div>

                                    <div className="admin-section-hero-actions">
                                        <button type="button" className="admin-ghost-button" onClick={handleBackToTenantList}>
                                            <i className="fa-solid fa-arrow-left" />
                                            <span>Voltar</span>
                                        </button>

                                        {selectedTenant.url ? (
                                            <a href={selectedTenant.url} target="_blank" rel="noreferrer" className="admin-ghost-button link">
                                                Abrir tenant
                                            </a>
                                        ) : null}

                                        <div className="admin-switch-row compact">
                                            <div>
                                                <strong>Tenant ativo</strong>
                                                <small>{selectedTenant.active ? 'Liberado' : 'Pausado'}</small>
                                            </div>
                                            <AdminSwitch
                                                checked={selectedTenant.active}
                                                disabled={statusTenantId === selectedTenant.id}
                                                ariaLabel="Ativar tenant selecionado"
                                                onChange={() => handleStatusToggle(selectedTenant)}
                                            />
                                        </div>
                                    </div>
                                </section>

                                <div className="admin-main-grid">
                                    <section className="admin-card">
                                        <div className="admin-card-head">
                                            <div>
                                                <div className="admin-card-kicker">Preset</div>
                                                <h2>Tipo rapido</h2>
                                            </div>
                                            <span className="admin-count-pill">{selectedTenant.presetLabel}</span>
                                        </div>

                                        <div className="admin-preset-grid">
                                            {businessPresets.map((preset) => (
                                                <button
                                                    key={preset.key}
                                                    type="button"
                                                    className={`admin-preset-card ${selectedTenant.form.business?.preset === preset.key ? 'active' : ''}`}
                                                    onClick={() => applyPreset(preset)}
                                                >
                                                    <strong>{preset.label}</strong>
                                                    <small>{Object.values(preset.modules || {}).filter(Boolean).length} ativos</small>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="admin-card">
                                        <div className="admin-card-head">
                                            <div>
                                                <div className="admin-card-kicker">Gerais</div>
                                                <h2>Ajustes base</h2>
                                            </div>
                                        </div>

                                        <div className="admin-compact-list">
                                            {generalOptions.map((option) => {
                                                const active = Boolean(getValueByPath(selectedTenant.form, option.key))

                                                return (
                                                    <div key={option.key} className="admin-compact-row">
                                                        <div>
                                                            <strong>{option.label}</strong>
                                                            <small>{active ? 'Ativo' : 'Inativo'}</small>
                                                        </div>
                                                        <AdminSwitch
                                                            checked={active}
                                                            ariaLabel={option.label}
                                                            onChange={() => handleTenantToggle(option.key)}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </section>
                                </div>

                                <div className="admin-module-cards">
                                    {moduleSections.map((section) => (
                                        <section key={section.section} className="admin-card">
                                            <div className="admin-card-head">
                                                <div>
                                                    <div className="admin-card-kicker">Area</div>
                                                    <h2>{section.section}</h2>
                                                </div>
                                                <span className="admin-count-pill">{selectedSectionCounts[section.section]} ativos</span>
                                            </div>

                                            <div className="admin-compact-list">
                                                {section.items.map((item) => {
                                                    const active = Boolean(selectedTenant.form.modules?.[item.key])

                                                    return (
                                                        <div key={item.key} className="admin-compact-row">
                                                            <div>
                                                                <strong>{item.label.replace(/^Usar\s/, '')}</strong>
                                                                <small>{active ? 'Ativo' : 'Inativo'}</small>
                                                            </div>
                                                            <AdminSwitch
                                                                checked={active}
                                                                ariaLabel={item.label}
                                                                onChange={() => handleTenantToggle(`modules.${item.key}`)}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    ))}
                                </div>

                                <section className="admin-card admin-save-card">
                                    <div>
                                        <div className="admin-card-kicker">Publicar</div>
                                        <h2>Salvar tenant</h2>
                                        <p>Aplica as configuracoes compactas do tenant selecionado.</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="admin-primary-button"
                                        onClick={handleSaveTenantSettings}
                                        disabled={savingTenantId === selectedTenant.id}
                                    >
                                        {savingTenantId === selectedTenant.id ? 'Salvando...' : 'Salvar agora'}
                                    </button>
                                </section>
                            </>
                        ) : (
                            <>
                                <section className="admin-card admin-section-hero">
                                    <div>
                                        <div className="admin-card-kicker">Configs por tenant</div>
                                        <h2>Escolha um tenant</h2>
                                        <p>Clique em um tenant abaixo para abrir e editar as configuracoes dele.</p>
                                    </div>
                                </section>

                                <section className="admin-card">
                                    <div className="admin-card-head">
                                        <div>
                                            <div className="admin-card-kicker">Tenants</div>
                                            <h2>Lista de tenants</h2>
                                        </div>
                                        <span className="admin-count-pill">{tenantSummaries.length} cadastrados</span>
                                    </div>

                                    {tenantSummaries.length === 0 ? (
                                        <div className="admin-empty-main">
                                            <div className="admin-card-kicker">Configs por tenant</div>
                                            <h2>Nenhum tenant criado ainda</h2>
                                            <p>Crie um tenant primeiro para liberar essa area de configuracoes.</p>
                                        </div>
                                    ) : (
                                        <div className="admin-config-tenant-list">
                                            {tenantSummaries.map((tenant) => (
                                                <button
                                                    key={tenant.id}
                                                    type="button"
                                                    className="admin-tenant-card"
                                                    onClick={() => handleOpenTenantConfig(tenant.id)}
                                                >
                                                    <div className="admin-tenant-card-head">
                                                        <strong>{tenant.name}</strong>
                                                        <span className={`admin-status-dot ${tenant.active ? 'active' : 'inactive'}`} />
                                                    </div>
                                                    <small>{tenant.domain || tenant.id}</small>
                                                    <div className="admin-tenant-card-meta">
                                                        <span>{tenant.presetLabel}</span>
                                                        <span>{tenant.activeModules} modulos</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </>
                        )
                    ) : null}
                    {activeSection === 'reports' ? (
                        <>
                            <section className="admin-card admin-section-hero">
                                <div>
                                    <div className="admin-card-kicker">Relatorios</div>
                                    <h2>Painel administrativo</h2>
                                    <p>Visao geral da sua base de tenants e uso das configuracoes.</p>
                                </div>

                                <div className="admin-section-hero-actions">
                                    <button type="button" className="admin-ghost-button" onClick={handleBackToTenantList}>
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Voltar</span>
                                    </button>
                                </div>
                            </section>

                            <div className="admin-report-grid">
                                <article className="admin-card admin-report-card">
                                    <small>Tenants ativos</small>
                                    <strong>{tenantStats.active}</strong>
                                </article>
                                <article className="admin-card admin-report-card">
                                    <small>Tenants inativos</small>
                                    <strong>{tenantStats.inactive}</strong>
                                </article>
                                <article className="admin-card admin-report-card">
                                    <small>Media de modulos</small>
                                    <strong>{averageModules}</strong>
                                </article>
                                <article className="admin-card admin-report-card">
                                    <small>Preset personalizado</small>
                                    <strong>{tenantSummaries.filter((tenant) => tenant.form.business?.preset === CUSTOM_PRESET).length}</strong>
                                </article>
                            </div>

                            <div className="admin-main-grid">
                                <section className="admin-card">
                                    <div className="admin-card-head">
                                        <div>
                                            <div className="admin-card-kicker">Uso</div>
                                            <h2>Presets</h2>
                                        </div>
                                    </div>

                                    <div className="admin-compact-list">
                                        {presetUsage.map(([label, count]) => (
                                            <div key={label} className="admin-compact-row">
                                                <div>
                                                    <strong>{label}</strong>
                                                    <small>Tenants usando esse preset</small>
                                                </div>
                                                <span className="admin-count-pill">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="admin-card">
                                    <div className="admin-card-head">
                                        <div>
                                            <div className="admin-card-kicker">Uso</div>
                                            <h2>Modulos mais ligados</h2>
                                        </div>
                                    </div>

                                    <div className="admin-compact-list">
                                        {moduleUsage.map((module) => (
                                            <div key={module.label} className="admin-compact-row">
                                                <div>
                                                    <strong>{module.label}</strong>
                                                    <small>Tenants com esse modulo ativo</small>
                                                </div>
                                                <span className="admin-count-pill">{module.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <section className="admin-card">
                                <div className="admin-card-head">
                                    <div>
                                        <div className="admin-card-kicker">Base</div>
                                        <h2>Todos os tenants</h2>
                                    </div>
                                </div>

                                <div className="admin-compact-list">
                                    {tenantSummaries.map((tenant) => (
                                        <div key={tenant.id} className="admin-compact-row">
                                            <div>
                                                <strong>{tenant.name}</strong>
                                                <small>{tenant.domain || tenant.id}</small>
                                            </div>
                                            <div className="admin-inline-report-meta">
                                                <span className="admin-count-pill">{tenant.presetLabel}</span>
                                                <span className="admin-count-pill">{tenant.activeModules} modulos</span>
                                                <span className="admin-count-pill">{tenant.active ? 'Ativo' : 'Inativo'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </>
                    ) : null}
                </section>
            </div>
        </AdminLayout>
    )
}
