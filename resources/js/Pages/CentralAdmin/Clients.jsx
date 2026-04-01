import { Link, router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import AdminLayout from '@/Layouts/AdminLayout'
import { showErrorPopup, useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { CUSTOM_PRESET, getPresetLabel, normalizeSettings } from '@/lib/modules'
import '../admin-dashboard.css'

const INITIAL_TENANT_FORM = {
    client_name: '',
    tenant_name: '',
    tenant_id: '',
    domain: '',
    client_email: '',
    client_document: '',
    active: true,
}

function countEnabledModules(settings) {
    return Object.values(settings?.modules || {}).filter(Boolean).length
}

function normalizeModuleLabel(label) {
    return String(label || '').replace(/^Usar\s+/i, '').trim()
}

function buildTenantSettingsState(tenants) {
    return Object.fromEntries(tenants.map((tenant) => [tenant.id, normalizeSettings(tenant.settings)]))
}

function buildTenantForm(tenant = null) {
    if (!tenant) {
        return { ...INITIAL_TENANT_FORM }
    }

    return {
        client_name: tenant.client_name || tenant.name || '',
        tenant_name: tenant.name || '',
        tenant_id: tenant.id || '',
        domain: tenant.domain || '',
        client_email: tenant.email || '',
        client_document: tenant.document || '',
        active: Boolean(tenant.active),
    }
}

function buildTenantSummaries(tenants, settingsState) {
    return tenants.map((tenant) => {
        const form = normalizeSettings(settingsState?.[tenant.id] || tenant.settings)

        return {
            ...tenant,
            form,
            activeModules: countEnabledModules(form),
            presetLabel: getPresetLabel(form.business?.preset),
        }
    })
}

function AdminSwitch({ checked, disabled = false, saving = false, onChange, ariaLabel }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            className={`central-admin-toggle ${checked ? 'is-checked' : ''} ${saving ? 'is-saving' : ''}`}
            disabled={disabled}
            onClick={onChange}
        />
    )
}

function ModalFrame({ open, icon, title, description, onClose, children }) {
    if (!open) {
        return null
    }

    return (
        <div className="central-admin-modal-backdrop" onClick={onClose}>
            <div className="central-admin-modal" onClick={(event) => event.stopPropagation()}>
                <div className="central-admin-modal-header">
                    <div className="central-admin-modal-titlebox">
                        <div className="central-admin-modal-icon">
                            <i className={`fa-solid ${icon}`} />
                        </div>
                        <div>
                            <h3>{title}</h3>
                            {description ? <p>{description}</p> : null}
                        </div>
                    </div>

                    <button type="button" className="central-admin-modal-close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                {children}
            </div>
        </div>
    )
}

function TenantFormModal({ open, mode, form, busy, onClose, onChange, onSubmit }) {
    const isEdit = mode === 'edit'

    return (
        <ModalFrame
            open={open}
            icon={isEdit ? 'fa-pen-to-square' : 'fa-plus'}
            title={isEdit ? 'Editar tenant' : 'Novo tenant'}
            onClose={onClose}
        >
            <form onSubmit={onSubmit}>
                <div className="central-admin-modal-body">
                    <div className="central-admin-form-grid">
                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Nome</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-buildings" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.client_name}
                                    onChange={(event) => onChange('client_name', event.target.value)}
                                    placeholder="Loja Centro"
                                    required
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Nome interno</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-tag" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.tenant_name}
                                    onChange={(event) => onChange('tenant_name', event.target.value)}
                                    placeholder="loja-centro"
                                />
                            </span>
                        </label>

                        <label className={`central-admin-field ${isEdit ? 'is-readonly' : ''}`}>
                            <span className="central-admin-field-label">ID</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-fingerprint" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.tenant_id}
                                    onChange={(event) => onChange('tenant_id', event.target.value)}
                                    placeholder="loja-centro"
                                    readOnly={isEdit}
                                    required
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Dominio</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-globe" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.domain}
                                    onChange={(event) => onChange('domain', event.target.value)}
                                    placeholder="tenant.test.lvh.me"
                                    required
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Email</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-envelope" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.client_email}
                                    onChange={(event) => onChange('client_email', event.target.value)}
                                    placeholder="contato@tenant.com"
                                    type="email"
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Documento</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-id-card" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.client_document}
                                    onChange={(event) => onChange('client_document', event.target.value)}
                                    placeholder="CPF ou CNPJ"
                                />
                            </span>
                        </label>

                        <div className="central-admin-field is-full">
                            <span className="central-admin-field-label">Status</span>
                            <div className="central-admin-list-row">
                                <div className="central-admin-list-copy">
                                    <strong>{form.active ? 'Ativo' : 'Inativo'}</strong>
                                </div>
                                <AdminSwitch
                                    checked={form.active}
                                    ariaLabel="Alternar status do tenant"
                                    onChange={() => onChange('active', !form.active)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="central-admin-modal-footer">
                    <button type="button" className="central-admin-secondary-button" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="central-admin-primary-button" disabled={busy}>
                        <i className={`fa-solid ${isEdit ? 'fa-floppy-disk' : 'fa-plus'}`} />
                        <span>{busy ? (isEdit ? 'Salvando...' : 'Criando...') : isEdit ? 'Salvar' : 'Criar'}</span>
                    </button>
                </div>
            </form>
        </ModalFrame>
    )
}

function ConfirmModal({ open, tenant, busy, onClose, onConfirm }) {
    return (
        <ModalFrame
            open={open}
            icon="fa-triangle-exclamation"
            title="Excluir tenant"
            onClose={onClose}
        >
            <div className="central-admin-modal-body">
                <div className="central-admin-note-card">
                    <h3>{tenant?.name || 'Tenant selecionado'}</h3>
                </div>
            </div>

            <div className="central-admin-modal-footer">
                <button type="button" className="central-admin-secondary-button" onClick={onClose}>
                    Voltar
                </button>
                <button type="button" className="central-admin-secondary-button is-danger" onClick={onConfirm} disabled={busy}>
                    <i className="fa-solid fa-trash" />
                    <span>{busy ? 'Excluindo...' : 'Excluir'}</span>
                </button>
            </div>
        </ModalFrame>
    )
}

function TenantsTable({ tenants, onCreate, onEdit, onDelete }) {
    return (
        <section className="central-admin-card">
            <div className="central-admin-section-head">
                <div>
                    <h2>Tenants</h2>
                </div>
                <div className="central-admin-section-head-actions">
                    <button type="button" className="central-admin-primary-button" onClick={onCreate}>
                        <i className="fa-solid fa-plus" />
                        <span>Novo</span>
                    </button>
                </div>
            </div>

            {tenants.length === 0 ? (
                <div className="central-admin-empty-state">
                    <i className="fa-solid fa-buildings" />
                    <h3>Nenhum tenant</h3>
                </div>
            ) : (
                <div className="central-admin-table-wrap">
                    <table className="central-admin-table">
                        <thead>
                            <tr>
                                <th>Nome do tenant</th>
                                <th>ID</th>
                                <th>Status</th>
                                <th>Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => (
                                <tr key={tenant.id}>
                                    <td>
                                        <div className="central-admin-name-cell">
                                            <strong>{tenant.name}</strong>
                                            <span className="central-admin-name-meta">{tenant.domain || tenant.id}</span>
                                        </div>
                                    </td>
                                    <td>{tenant.id}</td>
                                    <td>
                                        <span className={`central-admin-status-pill ${tenant.active ? 'is-active' : 'is-inactive'}`}>
                                            {tenant.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="central-admin-table-actions">
                                            <button type="button" className="central-admin-secondary-button" onClick={() => onEdit(tenant)}>
                                                <i className="fa-solid fa-pen" />
                                                <span>Editar</span>
                                            </button>
                                            <button type="button" className="central-admin-secondary-button is-danger" onClick={() => onDelete(tenant)}>
                                                <i className="fa-solid fa-trash" />
                                                <span>Excluir</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}

function FeatureFlagsList({ tenants, moduleSections, rowState, highlightedTenantId, onToggle }) {
    const modules = moduleSections.flatMap((section) =>
        section.items.map((item) => ({
            key: item.key,
            label: normalizeModuleLabel(item.label),
        })),
    )

    return (
        <section className="central-admin-card">
            <div className="central-admin-section-head">
                <div>
                    <h2>Modulos</h2>
                </div>
            </div>

            {tenants.length === 0 ? (
                <div className="central-admin-empty-state">
                    <i className="fa-solid fa-toggle-on" />
                    <h3>Nenhum tenant</h3>
                </div>
            ) : (
                <div className="central-admin-feature-wrapper">
                    {tenants.map((tenant) => {
                        const state = rowState[tenant.id]

                        return (
                            <article
                                key={tenant.id}
                                className={`central-admin-feature-row ${highlightedTenantId === tenant.id ? 'is-highlighted' : ''}`}
                            >
                                <div className="central-admin-feature-tenant">
                                    <div className="central-admin-feature-tenant-head">
                                        <strong>{tenant.name}</strong>
                                        <span className={`central-admin-status-pill ${tenant.active ? 'is-active' : 'is-inactive'}`}>
                                            {tenant.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <small>{tenant.id}</small>
                                    <div className="central-admin-feature-tenant-meta">
                                        <span className="central-admin-badge">{tenant.activeModules} modulos</span>
                                        <span className="central-admin-badge is-info">{tenant.presetLabel}</span>
                                    </div>
                                    {state ? (
                                        <span className={`central-admin-inline-feedback is-${state.type}`}>
                                            <i className={`fa-solid ${state.type === 'error' ? 'fa-circle-xmark' : state.type === 'success' ? 'fa-circle-check' : 'fa-arrows-rotate'}`} />
                                            <span>{state.text}</span>
                                        </span>
                                    ) : null}
                                </div>

                                <div className="central-admin-feature-modules">
                                    {modules.map((module) => {
                                        const enabled = Boolean(tenant.form.modules?.[module.key])

                                        return (
                                            <label
                                                key={`${tenant.id}-${module.key}`}
                                                className={`central-admin-feature-chip ${enabled ? 'is-active' : ''}`}
                                            >
                                                <span>{module.label}</span>
                                                <AdminSwitch
                                                    checked={enabled}
                                                    disabled={Boolean(state?.saving)}
                                                    saving={Boolean(state?.saving)}
                                                    ariaLabel={`${module.label} para ${tenant.name}`}
                                                    onChange={() => onToggle(tenant, module.key)}
                                                />
                                            </label>
                                        )
                                    })}
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

export default function CentralAdminClients({ tenantStats, tenants, moduleSections, pageMode = 'tenants' }) {
    const currentUrl = usePage().url
    const highlightedTenantId = new URLSearchParams(currentUrl.split('?')[1] || '').get('tenant')
    const isFeatureFlagsPage = pageMode === 'feature-flags'

    const [feedback, setFeedback] = useState(null)
    const [formMode, setFormMode] = useState('create')
    const [formOpen, setFormOpen] = useState(false)
    const [formBusy, setFormBusy] = useState(false)
    const [tenantForm, setTenantForm] = useState({ ...INITIAL_TENANT_FORM })
    const [tenantToDelete, setTenantToDelete] = useState(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [tenantSettingsState, setTenantSettingsState] = useState(() => buildTenantSettingsState(tenants))
    const [rowState, setRowState] = useState({})
    useErrorFeedbackPopup(feedback)

    useEffect(() => {
        setTenantSettingsState(buildTenantSettingsState(tenants))
    }, [tenants])

    const tenantSummaries = buildTenantSummaries(tenants, tenantSettingsState)
    const trackedModules = moduleSections.flatMap((section) => section.items)
    const averageModules = tenantSummaries.length
        ? (tenantSummaries.reduce((total, tenant) => total + tenant.activeModules, 0) / tenantSummaries.length).toFixed(1)
        : '0.0'

    function refresh(only = ['tenants', 'tenantStats']) {
        router.reload({
            only,
            preserveScroll: true,
        })
    }

    function handleFieldChange(field, value) {
        setTenantForm((current) => ({
            ...current,
            [field]: value,
        }))
    }

    function openCreateModal() {
        setFormMode('create')
        setTenantForm(buildTenantForm())
        setFormOpen(true)
    }

    function openEditModal(tenant) {
        setFormMode('edit')
        setTenantForm(buildTenantForm(tenant))
        setFormOpen(true)
    }

    async function handleSubmitTenant(event) {
        event.preventDefault()
        setFormBusy(true)
        setFeedback(null)

        const isEdit = formMode === 'edit'
        const url = isEdit ? `/admin/tenants/${tenantForm.tenant_id}` : '/admin/tenants'
        const method = isEdit ? 'put' : 'post'

        try {
            const response = await apiRequest(url, {
                method,
                data: tenantForm,
            })

            setFormOpen(false)
            setTenantForm(buildTenantForm())
            setFeedback({ type: 'success', text: response.message })
            refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setFormBusy(false)
        }
    }

    async function handleConfirmDelete() {
        if (!tenantToDelete) {
            return
        }

        setDeleteBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${tenantToDelete.id}`, {
                method: 'delete',
            })

            setTenantToDelete(null)
            setFeedback({ type: 'success', text: response.message })
            refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setDeleteBusy(false)
        }
    }

    async function handleToggleModule(tenant, moduleKey) {
        const previousState = normalizeSettings(tenantSettingsState[tenant.id] || tenant.settings)
        const nextState = normalizeSettings({
            ...previousState,
            business: {
                ...previousState.business,
                preset: CUSTOM_PRESET,
            },
            modules: {
                ...previousState.modules,
                [moduleKey]: !previousState.modules?.[moduleKey],
            },
        })

        setTenantSettingsState((current) => ({
            ...current,
            [tenant.id]: nextState,
        }))

        setRowState((current) => ({
            ...current,
            [tenant.id]: { type: 'info', text: 'Salvando...', saving: true },
        }))

        try {
            const response = await apiRequest(`/admin/tenants/${tenant.id}/settings`, {
                method: 'put',
                data: nextState,
            })

            setTenantSettingsState((current) => ({
                ...current,
                [tenant.id]: normalizeSettings(response.settings || nextState),
            }))

            setRowState((current) => ({
                ...current,
                [tenant.id]: { type: 'success', text: 'Salvo', saving: false },
            }))
        } catch (error) {
            setTenantSettingsState((current) => ({
                ...current,
                [tenant.id]: previousState,
            }))
            showErrorPopup(error.message)

            setRowState((current) => ({
                ...current,
                [tenant.id]: { type: 'error', text: error.message, saving: false },
            }))
        }
    }

    return (
        <AdminLayout title={isFeatureFlagsPage ? 'Configuracoes' : 'Tenants'}>
            <div className="central-admin-page">
                <section className="central-admin-card central-admin-hero">
                    <div className="central-admin-hero-copy">
                        <h1>{isFeatureFlagsPage ? 'Configuracoes' : 'Tenants'}</h1>
                    </div>

                    <div className="central-admin-hero-actions">
                        {isFeatureFlagsPage ? (
                            <Link href="/admin/clientes" className="central-admin-secondary-button">
                                <i className="fa-solid fa-table-list" />
                                <span>Tenants</span>
                            </Link>
                        ) : (
                            <button type="button" className="central-admin-primary-button" onClick={openCreateModal}>
                                <i className="fa-solid fa-plus" />
                                <span>Novo</span>
                            </button>
                        )}

                        <Link
                            href={isFeatureFlagsPage ? '/admin/painel' : '/admin/feature-flags'}
                            className="central-admin-secondary-button"
                        >
                            <i className={`fa-solid ${isFeatureFlagsPage ? 'fa-house' : 'fa-sliders'}`} />
                            <span>{isFeatureFlagsPage ? 'Home' : 'Modulos'}</span>
                        </Link>
                    </div>
                </section>

                {feedback ? (
                    <div className={`central-admin-feedback is-${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                        <span>{feedback.text}</span>
                    </div>
                ) : null}

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
                            <strong>{isFeatureFlagsPage ? trackedModules.length : averageModules}</strong>
                            <span>{isFeatureFlagsPage ? 'Modulos' : 'Media'}</span>
                        </div>
                    </article>
                </section>

                {isFeatureFlagsPage ? (
                    <FeatureFlagsList
                        tenants={tenantSummaries}
                        moduleSections={moduleSections}
                        rowState={rowState}
                        highlightedTenantId={highlightedTenantId}
                        onToggle={handleToggleModule}
                    />
                ) : (
                    <TenantsTable
                        tenants={tenantSummaries}
                        onCreate={openCreateModal}
                        onEdit={openEditModal}
                        onDelete={setTenantToDelete}
                    />
                )}
            </div>

            <TenantFormModal
                open={formOpen}
                mode={formMode}
                form={tenantForm}
                busy={formBusy}
                onClose={() => setFormOpen(false)}
                onChange={handleFieldChange}
                onSubmit={handleSubmitTenant}
            />

            <ConfirmModal
                open={Boolean(tenantToDelete)}
                tenant={tenantToDelete}
                busy={deleteBusy}
                onClose={() => setTenantToDelete(null)}
                onConfirm={handleConfirmDelete}
            />
        </AdminLayout>
    )
}
