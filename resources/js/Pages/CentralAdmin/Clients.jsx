import { Link, router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import AdminLayout from '@/Layouts/AdminLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { formatMoney } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { printTestViaLocalAgent } from '@/lib/localAgentBridge'
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

function buildLicenseForm(tenant = null) {
    return {
        starts_at: tenant?.license?.starts_at || new Date().toISOString().slice(0, 10),
        cycle_days: String(tenant?.license?.cycle_days || 30),
        grace_days: String(tenant?.license?.grace_days || 10),
        amount: tenant?.license?.amount == null ? '' : String(tenant.license.amount),
        status: tenant?.license?.status === 'warning' || tenant?.license?.status === 'overdue'
            ? 'active'
            : (tenant?.license?.status || 'active'),
    }
}

function buildLocalAgentForm(tenant = null) {
    const agent = tenant?.local_agent

    return {
        name: agent?.name || `Agente fiscal ${tenant?.id || ''}`.trim(),
        active: agent?.active ?? true,
        poll_interval_seconds: String(agent?.runtime_config?.poll_interval_seconds || 3),
    }
}

function buildLocalAgentBridge(agent) {
    const host = agent?.device?.local_api_host || '127.0.0.1'
    const port = agent?.device?.local_api_port || 18123
    const baseUrl = agent?.device?.local_api_url || `http://${host}:${port}`

    return {
        enabled: Boolean(agent?.active && agent?.device?.local_api_enabled !== false),
        base_url: String(baseUrl || '').replace(/\/+$/, ''),
        agent_key: agent?.agent_key || '',
        printer_enabled: agent?.device?.printer_enabled !== false,
    }
}

function getLicenseTone(status) {
    if (!status) return 'is-muted'
    if (status === 'blocked') return 'is-inactive'
    if (status === 'overdue') return 'is-danger'
    if (status === 'paused') return 'is-info'
    if (status === 'warning') return 'is-info'
    return 'is-active'
}

function getLicenseLabel(status) {
    if (!status) return 'Sem licenca'
    if (status === 'blocked') return 'Bloqueada'
    if (status === 'overdue') return 'Vencida'
    if (status === 'paused') return 'Pausada'
    if (status === 'warning') return 'A vencer'
    return 'Ativa'
}

function getLocalAgentTone(status) {
    if (!status) return 'is-muted'
    if (status === 'online') return 'is-active'
    if (status === 'inactive') return 'is-inactive'
    return 'is-info'
}

function getLocalAgentLabel(status) {
    if (!status) return 'Sem agente'
    if (status === 'online') return 'Online'
    if (status === 'inactive') return 'Inativo'
    return 'Offline'
}

function formatDateTime(value) {
    if (!value) {
        return 'Nao informado'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date)
}

function downloadTextFile(filename, content, type = 'application/json;charset=utf-8') {
    const blob = new Blob([content], { type })
    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(objectUrl)
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

function LicenseModal({ open, tenant, form, busy, invoiceBusyId, onClose, onChange, onSubmit, onInvoiceStatusChange }) {
    const invoice = tenant?.license?.invoice

    return (
        <ModalFrame
            open={open}
            icon="fa-file-invoice-dollar"
            title={tenant ? `Licenca de ${tenant.name}` : 'Licenca'}
            description="Controle o ciclo, tolerancia e a fatura ativa da licenca deste tenant."
            onClose={onClose}
        >
            <form onSubmit={onSubmit}>
                <div className="central-admin-modal-body">
                    <div className="central-admin-form-grid">
                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Inicio da licenca</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-calendar-day" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    type="date"
                                    value={form.starts_at}
                                    onChange={(event) => onChange('starts_at', event.target.value)}
                                    required
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Ciclo em dias</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-repeat" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={form.cycle_days}
                                    onChange={(event) => onChange('cycle_days', event.target.value)}
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Tolerancia</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-hourglass-half" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    type="number"
                                    min="0"
                                    max="90"
                                    value={form.grace_days}
                                    onChange={(event) => onChange('grace_days', event.target.value)}
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Valor da fatura</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-money-bill-wave" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.amount}
                                    onChange={(event) => onChange('amount', event.target.value)}
                                    placeholder="0,00"
                                />
                            </span>
                        </label>

                        <label className="central-admin-field is-full">
                            <span className="central-admin-field-label">Status base</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-shield-halved" />
                                </span>
                                <select
                                    className="central-admin-field-input"
                                    value={form.status}
                                    onChange={(event) => onChange('status', event.target.value)}
                                >
                                    <option value="active">Ativa</option>
                                    <option value="paused">Pausada</option>
                                    <option value="blocked">Bloqueada</option>
                                </select>
                            </span>
                        </label>
                    </div>

                    {tenant?.license ? (
                        <div className="central-admin-note-card central-admin-license-card">
                            <div className="central-admin-license-card-top">
                                <h3>Estado atual</h3>
                                <span className={`central-admin-status-pill ${getLicenseTone(tenant.license.status)}`}>
                                    {getLicenseLabel(tenant.license.status)}
                                </span>
                            </div>
                            <p>{tenant.license.message}</p>
                            <div className="central-admin-pill-row">
                                {tenant.license.due_date ? <span className="central-admin-badge">Vence em {tenant.license.due_date}</span> : null}
                                {tenant.license.days_remaining != null ? <span className="central-admin-badge is-info">{tenant.license.days_remaining} dia(s)</span> : null}
                                {tenant.license.amount != null ? <span className="central-admin-badge">{formatMoney(tenant.license.amount)}</span> : null}
                            </div>
                        </div>
                    ) : null}

                    {invoice ? (
                        <div className="central-admin-note-card central-admin-license-card">
                            <div className="central-admin-license-card-top">
                                <h3>Fatura atual</h3>
                                <span className={`central-admin-status-pill ${invoice.status === 'paid' ? 'is-active' : 'is-inactive'}`}>
                                    {invoice.status === 'paid' ? 'Paga' : 'Pendente'}
                                </span>
                            </div>
                            <div className="central-admin-pill-row">
                                <span className="central-admin-badge">{invoice.reference}</span>
                                <span className="central-admin-badge is-info">Vencimento {invoice.due_date}</span>
                                <span className="central-admin-badge">{formatMoney(invoice.amount || 0)}</span>
                            </div>
                            <div className="central-admin-table-actions">
                                <button
                                    type="button"
                                    className="central-admin-secondary-button"
                                    onClick={() => onInvoiceStatusChange(invoice, invoice.status === 'paid' ? 'pending' : 'paid')}
                                    disabled={invoiceBusyId === invoice.id}
                                >
                                    <i className={`fa-solid ${invoice.status === 'paid' ? 'fa-rotate-left' : 'fa-circle-check'}`} />
                                    <span>{invoiceBusyId === invoice.id ? 'Salvando...' : invoice.status === 'paid' ? 'Marcar pendente' : 'Marcar paga'}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="central-admin-note-card central-admin-license-card">
                            <h3>Fatura atual</h3>
                            <p>A fatura sera gerada automaticamente assim que a licenca for salva.</p>
                        </div>
                    )}
                </div>

                <div className="central-admin-modal-footer">
                    <button type="button" className="central-admin-secondary-button" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="central-admin-primary-button" disabled={busy}>
                        <i className="fa-solid fa-floppy-disk" />
                        <span>{busy ? 'Salvando...' : 'Salvar licenca'}</span>
                    </button>
                </div>
            </form>
        </ModalFrame>
    )
}

function LocalAgentModal({
    open,
    tenant,
    form,
    busy,
    printBusy,
    bootstrapBusyMode,
    onClose,
    onChange,
    onSubmit,
    onDownloadBootstrap,
    onTestPrint,
}) {
    const agent = tenant?.local_agent
    const hasAgent = Boolean(agent)

    return (
        <ModalFrame
            open={open}
            icon="fa-desktop"
            title={tenant ? `Agente fiscal de ${tenant.name}` : 'Agente fiscal'}
            description="Gerencie o bootstrap, o status central e acompanhe a configuracao local enviada pela maquina do cliente."
            onClose={onClose}
        >
            <form onSubmit={onSubmit}>
                <div className="central-admin-modal-body">
                    <div className="central-admin-agent-grid">
                        <article className="central-admin-license-card central-admin-agent-card">
                            <div className="central-admin-license-card-top">
                                <h3>Status do agente</h3>
                                <span className={`central-admin-status-pill ${getLocalAgentTone(agent?.status)}`}>
                                    {getLocalAgentLabel(agent?.status)}
                                </span>
                            </div>
                            <div className="central-admin-pill-row">
                                <span className="central-admin-badge">
                                    <i className="fa-solid fa-fingerprint" />
                                    <span>{tenant?.id || 'Tenant'}</span>
                                </span>
                                {agent?.last_seen_label ? (
                                    <span className="central-admin-badge is-info">
                                        <i className="fa-solid fa-clock-rotate-left" />
                                        <span>{agent.last_seen_label}</span>
                                    </span>
                                ) : null}
                                {agent?.last_ip ? (
                                    <span className="central-admin-badge">
                                        <i className="fa-solid fa-network-wired" />
                                        <span>{agent.last_ip}</span>
                                    </span>
                                ) : null}
                            </div>
                            <p>
                                {hasAgent
                                    ? 'Esse registro central controla o bootstrap e a configuracao sincronizada do agente instalado no cliente.'
                                    : 'Salve este cadastro para gerar o primeiro bootstrap do agente fiscal deste tenant.'}
                            </p>
                        </article>

                        <article className="central-admin-license-card central-admin-agent-card">
                            <div className="central-admin-license-card-top">
                                <h3>Bootstrap do instalador</h3>
                                <span className={`central-admin-status-pill ${agent?.bootstrap_available ? 'is-active' : 'is-muted'}`}>
                                    {agent?.bootstrap_available ? 'Disponivel' : 'Pendente'}
                                </span>
                            </div>
                            <p>
                                Baixe o JSON bootstrap e entregue junto com o instalador `nimvo-fiscal-agent-setup.exe`. O setup coleta na propria
                                maquina o certificado A1, a impressora, o logo do cupom e a API local do tenant.
                            </p>
                            <div className="central-admin-table-actions">
                                <button
                                    type="button"
                                    className="central-admin-secondary-button"
                                    disabled={!hasAgent || bootstrapBusyMode !== null}
                                    onClick={() => onDownloadBootstrap(false)}
                                >
                                    <i className="fa-solid fa-file-arrow-down" />
                                    <span>{bootstrapBusyMode === 'download' ? 'Baixando...' : 'Baixar JSON'}</span>
                                </button>
                                <button
                                    type="button"
                                    className="central-admin-secondary-button"
                                    disabled={!hasAgent || bootstrapBusyMode !== null}
                                    onClick={() => onDownloadBootstrap(true)}
                                >
                                    <i className="fa-solid fa-rotate" />
                                    <span>{bootstrapBusyMode === 'rotate' ? 'Gerando...' : 'Regenerar bootstrap'}</span>
                                </button>
                            </div>
                            {hasAgent && !agent?.bootstrap_available ? (
                                <p className="central-admin-field-note">
                                    Este agente foi criado sem bootstrap recuperavel. Use “Regenerar bootstrap” e reinstale no cliente.
                                </p>
                            ) : null}
                        </article>
                    </div>

                    <div className="central-admin-agent-device-grid">
                        <article className="central-admin-license-card central-admin-agent-card">
                            <div className="central-admin-license-card-top">
                                <h3>Ultima maquina conectada</h3>
                                <span className="central-admin-badge is-info">
                                    <i className="fa-solid fa-display" />
                                    <span>{agent?.device?.machine_name || 'Sem heartbeat'}</span>
                                </span>
                            </div>
                            <div className="central-admin-agent-list">
                                <div className="central-admin-agent-item">
                                    <strong>Usuario</strong>
                                    <span>{agent?.device?.machine_user || 'Nao informado'}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>Ultima sincronizacao</strong>
                                    <span>{formatDateTime(agent?.device?.last_sync_at)}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>Projeto Nimvo</strong>
                                    <span className="central-admin-path-copy">{agent?.device?.project_root || 'Nao informado'}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>PHP</strong>
                                    <span className="central-admin-path-copy">{agent?.device?.php_path || 'Nao informado'}</span>
                                </div>
                            </div>
                        </article>

                        <article className="central-admin-license-card central-admin-agent-card">
                            <div className="central-admin-license-card-top">
                                <h3>Dispositivos locais</h3>
                                <span className="central-admin-badge">
                                    <i className="fa-solid fa-print" />
                                    <span>{agent?.device?.printer_name || agent?.device?.printer_host || 'Sem impressora detectada'}</span>
                                </span>
                            </div>
                            <div className="central-admin-agent-list">
                                <div className="central-admin-agent-item">
                                    <strong>Certificado</strong>
                                    <span className="central-admin-path-copy">{agent?.device?.certificate_path || 'Nao informado'}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>Conector</strong>
                                    <span>{agent?.device?.printer_connector || 'Nao informado'}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>Impressao local</strong>
                                    <span>{agent?.device?.printer_enabled ? 'Ativa' : 'Desativada'}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>Config local</strong>
                                    <span className="central-admin-path-copy">{agent?.device?.config_path || 'Nao informado'}</span>
                                </div>
                                <div className="central-admin-agent-item">
                                    <strong>API local</strong>
                                    <span className="central-admin-path-copy">{agent?.device?.local_api_url || 'Nao informado'}</span>
                                </div>
                            </div>
                            <p className="central-admin-field-note">
                                Esses dados sao sincronizados pelo agente instalado. Para trocar impressora, certificado ou logo do cupom, rode o setup
                                novamente na maquina do cliente.
                            </p>
                            <div className="central-admin-table-actions" style={{ marginTop: 16 }}>
                                <button
                                    type="button"
                                    className="central-admin-secondary-button"
                                    disabled={!hasAgent || printBusy}
                                    onClick={onTestPrint}
                                >
                                    <i className="fa-solid fa-print" />
                                    <span>{printBusy ? 'Testando...' : 'Testar impressao'}</span>
                                </button>
                            </div>
                        </article>
                    </div>

                    <div className="central-admin-form-grid">
                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Nome do agente</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-desktop" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    value={form.name}
                                    onChange={(event) => onChange('name', event.target.value)}
                                    placeholder="PDV Loja Centro"
                                    required
                                />
                            </span>
                        </label>

                        <label className="central-admin-field">
                            <span className="central-admin-field-label">Polling em segundos</span>
                            <span className="central-admin-field-shell">
                                <span className="central-admin-field-icon">
                                    <i className="fa-solid fa-stopwatch" />
                                </span>
                                <input
                                    className="central-admin-field-input"
                                    type="number"
                                    min="1"
                                    max="300"
                                    value={form.poll_interval_seconds}
                                    onChange={(event) => onChange('poll_interval_seconds', event.target.value)}
                                    required
                                />
                            </span>
                        </label>

                        <div className="central-admin-field is-full">
                            <span className="central-admin-field-label">Agente ativo</span>
                            <div className="central-admin-list-row">
                                <div className="central-admin-list-copy">
                                    <strong>{form.active ? 'Ativo' : 'Inativo'}</strong>
                                    <small>Quando inativo, o backend deixa de aceitar heartbeat e comandos desse agente.</small>
                                </div>
                                <AdminSwitch
                                    checked={form.active}
                                    ariaLabel="Alternar status do agente fiscal"
                                    onChange={() => onChange('active', !form.active)}
                                />
                            </div>
                        </div>

                        <div className="central-admin-field is-full">
                            <span className="central-admin-field-label">Escopo da configuracao</span>
                            <div className="central-admin-list-row">
                                <div className="central-admin-list-copy">
                                    <strong>Central: nome, status e polling</strong>
                                    <small>Impressora, certificado, logo do cupom e API local ficam na maquina e sao definidos pelo instalador do agente.</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="central-admin-modal-footer">
                    <button type="button" className="central-admin-secondary-button" onClick={onClose}>
                        Fechar
                    </button>
                    <button type="submit" className="central-admin-primary-button" disabled={busy}>
                        <i className="fa-solid fa-floppy-disk" />
                        <span>{busy ? 'Salvando...' : hasAgent ? 'Salvar agente' : 'Criar agente'}</span>
                    </button>
                </div>
            </form>
        </ModalFrame>
    )
}

function TenantsTable({ tenants, onCreate, onEdit, onManageLicense, onManageAgent, onDelete }) {
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
                                <th>Licenca</th>
                                <th>Agente fiscal</th>
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
                                        <span className={`central-admin-status-pill ${getLicenseTone(tenant.license?.status)}`}>
                                            {getLicenseLabel(tenant.license?.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`central-admin-status-pill ${getLocalAgentTone(tenant.local_agent?.status)}`}>
                                            {getLocalAgentLabel(tenant.local_agent?.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="central-admin-table-actions">
                                            <button type="button" className="central-admin-secondary-button" onClick={() => onManageAgent(tenant)}>
                                                <i className="fa-solid fa-desktop" />
                                                <span>Agente</span>
                                            </button>
                                            <button type="button" className="central-admin-secondary-button" onClick={() => onManageLicense(tenant)}>
                                                <i className="fa-solid fa-file-invoice-dollar" />
                                                <span>Licenca</span>
                                            </button>
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

export default function CentralAdminClients({ tenantStats, agentStats, tenants, moduleSections, pageMode = 'tenants' }) {
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
    const [licenseTenant, setLicenseTenant] = useState(null)
    const [licenseForm, setLicenseForm] = useState(buildLicenseForm())
    const [licenseBusy, setLicenseBusy] = useState(false)
    const [invoiceBusyId, setInvoiceBusyId] = useState(null)
    const [localAgentTenant, setLocalAgentTenant] = useState(null)
    const [localAgentForm, setLocalAgentForm] = useState(buildLocalAgentForm())
    const [localAgentBusy, setLocalAgentBusy] = useState(false)
    const [localAgentPrintBusy, setLocalAgentPrintBusy] = useState(false)
    const [bootstrapBusyMode, setBootstrapBusyMode] = useState(null)
    const [tenantSettingsState, setTenantSettingsState] = useState(() => buildTenantSettingsState(tenants))
    const [rowState, setRowState] = useState({})
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })

    useEffect(() => {
        setTenantSettingsState(buildTenantSettingsState(tenants))
    }, [tenants])

    useEffect(() => {
        if (!localAgentTenant) {
            return
        }

        const updatedTenant = tenants.find((tenant) => tenant.id === localAgentTenant.id)
        if (!updatedTenant) {
            setLocalAgentTenant(null)
            setLocalAgentForm(buildLocalAgentForm())
            return
        }

        setLocalAgentTenant(updatedTenant)
        setLocalAgentForm(buildLocalAgentForm(updatedTenant))
    }, [tenants, localAgentTenant])

    const tenantSummaries = buildTenantSummaries(tenants, tenantSettingsState)
    const trackedModules = moduleSections.flatMap((section) => section.items)
    const averageModules = tenantSummaries.length
        ? (tenantSummaries.reduce((total, tenant) => total + tenant.activeModules, 0) / tenantSummaries.length).toFixed(1)
        : '0.0'

    function refresh(only = ['tenants', 'tenantStats', 'agentStats']) {
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

    function openLicenseModal(tenant) {
        setLicenseTenant(tenant)
        setLicenseForm(buildLicenseForm(tenant))
    }

    function openLocalAgentModal(tenant) {
        setLocalAgentTenant(tenant)
        setLocalAgentForm(buildLocalAgentForm(tenant))
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

            setFeedback({ type: 'success', text: response.message || `Configuracoes de ${tenant.name} atualizadas.` })
            setRowState((current) => {
                const next = { ...current }
                delete next[tenant.id]
                return next
            })
        } catch (error) {
            setTenantSettingsState((current) => ({
                ...current,
                [tenant.id]: previousState,
            }))
            setFeedback({ type: 'error', text: error.message })
            setRowState((current) => {
                const next = { ...current }
                delete next[tenant.id]
                return next
            })
        }
    }

    function handleLicenseFieldChange(field, value) {
        setLicenseForm((current) => ({
            ...current,
            [field]: value,
        }))
    }

    function handleLocalAgentFieldChange(field, value) {
        setLocalAgentForm((current) => ({
            ...current,
            [field]: value,
        }))
    }

    async function handleSubmitLicense(event) {
        event.preventDefault()

        if (!licenseTenant) {
            return
        }

        setLicenseBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${licenseTenant.id}/license`, {
                method: 'put',
                data: {
                    ...licenseForm,
                    cycle_days: Number(licenseForm.cycle_days || 30),
                    grace_days: Number(licenseForm.grace_days || 10),
                    amount: licenseForm.amount === '' ? null : Number(licenseForm.amount),
                },
            })

            setFeedback({ type: 'success', text: response.message })
            setLicenseTenant(null)
            refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLicenseBusy(false)
        }
    }

    async function handleLicenseInvoiceStatusChange(invoice, status) {
        if (!invoice) {
            return
        }

        setInvoiceBusyId(invoice.id)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenant-license-invoices/${invoice.id}/status`, {
                method: 'patch',
                data: { status },
            })

            setFeedback({ type: 'success', text: response.message })
            refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setInvoiceBusyId(null)
        }
    }

    async function handleSubmitLocalAgent(event) {
        event.preventDefault()

        if (!localAgentTenant) {
            return
        }

        setLocalAgentBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${localAgentTenant.id}/local-agent`, {
                method: 'put',
                data: {
                    name: localAgentForm.name,
                    active: Boolean(localAgentForm.active),
                    poll_interval_seconds: Number(localAgentForm.poll_interval_seconds || 3),
                },
            })

            setFeedback({ type: 'success', text: response.message })
            setLocalAgentTenant((current) => (
                current
                    ? {
                        ...current,
                        local_agent: response.agent,
                    }
                    : current
            ))
            refresh(['tenants', 'agentStats'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLocalAgentBusy(false)
        }
    }

    async function handleDownloadBootstrap(rotateSecret = false) {
        if (!localAgentTenant) {
            return
        }

        if (rotateSecret) {
            const confirmed = window.confirm('Regenerar o bootstrap troca a credencial do agente. O cliente precisara reinstalar ou atualizar o bootstrap local. Deseja continuar?')
            if (!confirmed) {
                return
            }
        }

        setBootstrapBusyMode(rotateSecret ? 'rotate' : 'download')
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${localAgentTenant.id}/local-agent/bootstrap`, {
                method: 'post',
                data: { rotate_secret: rotateSecret },
            })

            downloadTextFile(response.bootstrap.filename, `${response.bootstrap.content}\n`)
            setFeedback({ type: 'success', text: response.message })
            setLocalAgentTenant((current) => (
                current
                    ? {
                        ...current,
                        local_agent: response.agent,
                    }
                    : current
            ))
            refresh(['tenants', 'agentStats'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBootstrapBusyMode(null)
        }
    }

    async function handleTestLocalAgentPrint() {
        const agent = localAgentTenant?.local_agent

        if (!agent) {
            return
        }

        setLocalAgentPrintBusy(true)
        setFeedback(null)

        try {
            await printTestViaLocalAgent(buildLocalAgentBridge(agent), {
                store_name: localAgentTenant?.name || 'Nimvo',
                message: 'Teste disparado pelo painel administrativo do Nimvo.',
            })

            setFeedback({ type: 'success', text: 'Teste de impressao enviado para a API local do agente.' })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLocalAgentPrintBusy(false)
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
                            <i className={`fa-solid ${isFeatureFlagsPage ? 'fa-toggle-on' : 'fa-desktop'}`} />
                        </div>
                        <div className="central-admin-stat-copy">
                            <strong>{isFeatureFlagsPage ? trackedModules.length : `${agentStats?.online || 0}/${agentStats?.total || 0}`}</strong>
                            <span>{isFeatureFlagsPage ? 'Modulos' : 'Agentes online'}</span>
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
                        onManageLicense={openLicenseModal}
                        onManageAgent={openLocalAgentModal}
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

            <LicenseModal
                open={Boolean(licenseTenant)}
                tenant={licenseTenant}
                form={licenseForm}
                busy={licenseBusy}
                invoiceBusyId={invoiceBusyId}
                onClose={() => setLicenseTenant(null)}
                onChange={handleLicenseFieldChange}
                onSubmit={handleSubmitLicense}
                onInvoiceStatusChange={handleLicenseInvoiceStatusChange}
            />

            <LocalAgentModal
                open={Boolean(localAgentTenant)}
                tenant={localAgentTenant}
                form={localAgentForm}
                busy={localAgentBusy}
                printBusy={localAgentPrintBusy}
                bootstrapBusyMode={bootstrapBusyMode}
                onClose={() => setLocalAgentTenant(null)}
                onChange={handleLocalAgentFieldChange}
                onSubmit={handleSubmitLocalAgent}
                onDownloadBootstrap={handleDownloadBootstrap}
                onTestPrint={handleTestLocalAgentPrint}
            />
        </AdminLayout>
    )
}
