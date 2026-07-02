import { Link, router, usePage } from '@inertiajs/react'
import { useEffect, useState } from 'react'
import TenantFiscalModal from '@/Components/CentralAdmin/TenantFiscalModal'
import PageContainer from '@/Components/UI/PageContainer'
import RightSidebarPanel, { RightSidebarSection } from '@/Components/UI/RightSidebarPanel'
import AdminLayout from '@/Layouts/AdminLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { formatMoney } from '@/lib/format'
import { apiRequest } from '@/lib/http'
import { CUSTOM_PRESET, getPresetLabel, normalizeSettings } from '@/lib/modules'
import '../admin-dashboard.css'

const INITIAL_TENANT_FORM = {
    client_name: '',
    tenant_name: '',
    tenant_id: '',
    subdomain: '',
    client_email: '',
    client_document: '',
    active: true,
    cnpj_lookup: '',
}

const INITIAL_FISCAL_FORM = {
    active: true,
    environment: '2',
    operation_nature: 'VENDA NFC-E',
    series: '1',
    next_number: '1',
    company_name: '',
    trade_name: '',
    cnpj: '',
    ie: '',
    im: '',
    cnae: '',
    crt: '1',
    phone: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city_code: '',
    city_name: '',
    state: '',
    zip_code: '',
    csc_id: '',
    csc_token: '',
    technical_contact_name: '',
    technical_contact_email: '',
    technical_contact_phone: '',
    technical_contact_cnpj: '',
}

const MANAGE_TABS = [
    { key: 'geral', label: 'Geral', icon: 'fa-buildings' },
    { key: 'fiscal', label: 'Fiscal', icon: 'fa-key' },
    { key: 'licenca', label: 'Licença', icon: 'fa-file-invoice-dollar' },
    { key: 'agente', label: 'Agente & Impressora', icon: 'fa-desktop' },
    { key: 'modulos', label: 'Módulos', icon: 'fa-toggle-on' },
]

function feedbackIcon(type) {
    if (type === 'success') {
        return 'fa-circle-check'
    }

    if (type === 'info') {
        return 'fa-spinner fa-spin'
    }

    return 'fa-circle-xmark'
}

function coerceFiscalFormValue(field, value) {
    if (field === 'active') {
        return Boolean(value)
    }

    return value == null ? '' : String(value)
}

function mergeFiscalForm(current, patch = {}) {
    const next = { ...current }

    Object.entries(patch || {}).forEach(([field, value]) => {
        if (!(field in next)) {
            return
        }

        next[field] = coerceFiscalFormValue(field, value)
    })

    return next
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

function normalizeSubdomainInput(value, tenantBaseDomain) {
    const sanitized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^httpsó:\/\//, '')
        .split(/[/?#]/)[0]

    const withoutBaseDomain = tenantBaseDomain && sanitized.endsWith(`.${tenantBaseDomain}`)
        ? sanitized.slice(0, -(tenantBaseDomain.length + 1))
        : sanitized

    return withoutBaseDomain
        .replace(/\.+/g, '-')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

function buildTenantForm(tenant = null) {
    if (!tenant) {
        return { ...INITIAL_TENANT_FORM }
    }

    return {
        client_name: tenant.client_name || tenant.name || '',
        tenant_name: tenant.name || '',
        tenant_id: tenant.id || '',
        subdomain: tenant.subdomain || '',
        client_email: tenant.email || '',
        client_document: tenant.document || '',
        active: Boolean(tenant.active),
        cnpj_lookup: '',
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

function buildFiscalForm(tenant = null) {
    const fiscal = tenant?.fiscal

    return {
        active: fiscal?.active ?? INITIAL_FISCAL_FORM.active,
        environment: String(fiscal?.environment ?? INITIAL_FISCAL_FORM.environment),
        operation_nature: fiscal?.operation_nature || INITIAL_FISCAL_FORM.operation_nature,
        series: String(fiscal?.series ?? INITIAL_FISCAL_FORM.series),
        next_number: String(fiscal?.next_number ?? INITIAL_FISCAL_FORM.next_number),
        company_name: fiscal?.company_name || INITIAL_FISCAL_FORM.company_name,
        trade_name: fiscal?.trade_name || INITIAL_FISCAL_FORM.trade_name,
        cnpj: fiscal?.cnpj || INITIAL_FISCAL_FORM.cnpj,
        ie: fiscal?.ie || INITIAL_FISCAL_FORM.ie,
        im: fiscal?.im || INITIAL_FISCAL_FORM.im,
        cnae: fiscal?.cnae || INITIAL_FISCAL_FORM.cnae,
        crt: fiscal?.crt || INITIAL_FISCAL_FORM.crt,
        phone: fiscal?.phone || INITIAL_FISCAL_FORM.phone,
        street: fiscal?.street || INITIAL_FISCAL_FORM.street,
        number: fiscal?.number || INITIAL_FISCAL_FORM.number,
        complement: fiscal?.complement || INITIAL_FISCAL_FORM.complement,
        district: fiscal?.district || INITIAL_FISCAL_FORM.district,
        city_code: fiscal?.city_code || INITIAL_FISCAL_FORM.city_code,
        city_name: fiscal?.city_name || INITIAL_FISCAL_FORM.city_name,
        state: fiscal?.state || INITIAL_FISCAL_FORM.state,
        zip_code: fiscal?.zip_code || INITIAL_FISCAL_FORM.zip_code,
        csc_id: fiscal?.csc_id || INITIAL_FISCAL_FORM.csc_id,
        csc_token: '',
        technical_contact_name: fiscal?.technical_contact_name || INITIAL_FISCAL_FORM.technical_contact_name,
        technical_contact_email: fiscal?.technical_contact_email || INITIAL_FISCAL_FORM.technical_contact_email,
        technical_contact_phone: fiscal?.technical_contact_phone || INITIAL_FISCAL_FORM.technical_contact_phone,
        technical_contact_cnpj: fiscal?.technical_contact_cnpj || INITIAL_FISCAL_FORM.technical_contact_cnpj,
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
    if (!status) return 'Sem licença'
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
        return 'Não informado'
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

function ConfirmModal({ open, tenant, busy, onClose, onConfirm }) {
    if (!open) {
        return null
    }

    return (
        <div className="central-admin-modal-backdrop" onClick={onClose}>
            <div className="central-admin-modal" onClick={(event) => event.stopPropagation()}>
                <div className="central-admin-modal-header">
                    <div className="central-admin-modal-titlebox">
                        <div className="central-admin-modal-icon">
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>
                        <div>
                            <h3>Excluir tenant</h3>
                        </div>
                    </div>
                    <button type="button" className="central-admin-modal-close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

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
            </div>
        </div>
    )
}

function TenantGeneralTab({ form, isCreating, tenantBaseDomain, cnpjLookupBusy, onChange, onLookupCnpj }) {
    const tenantPreview = form.subdomain
        ? `${form.subdomain}.${tenantBaseDomain}`
        : `tenant.${tenantBaseDomain}`

    return (
        <>
            {isCreating ? (
                <>
                    <label className="central-admin-field is-full">
                        <span className="central-admin-field-label">CNPJ do cliente</span>
                        <span className="central-admin-field-shell">
                            <span className="central-admin-field-icon">
                                <i className="fa-solid fa-magnifying-glass" />
                            </span>
                            <input
                                className="central-admin-field-input"
                                value={form.cnpj_lookup}
                                onChange={(event) => onChange('cnpj_lookup', event.target.value)}
                                placeholder="Digite o CNPJ para buscar os dados automaticamente"
                            />
                        </span>
                        <span className="central-admin-field-note">
                            Preenche nome e endereço automaticamente (BrasilAPI) - já deixa a aba Fiscal adiantada.
                        </span>
                    </label>
                    <div className="central-admin-field is-full">
                        <button
                            type="button"
                            className="central-admin-primary-button"
                            disabled={cnpjLookupBusy || !form.cnpj_lookup}
                            onClick={onLookupCnpj}
                        >
                            <i className="fa-solid fa-magnifying-glass" />
                            <span>{cnpjLookupBusy ? 'Buscando...' : 'Buscar dados do CNPJ'}</span>
                        </button>
                    </div>
                </>
            ) : null}

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

            <label className={`central-admin-field ${!isCreating ? 'is-readonly' : ''}`}>
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
                        readOnly={!isCreating}
                        required
                    />
                </span>
            </label>

            <label className="central-admin-field">
                <span className="central-admin-field-label">Subdomínio</span>
                <span className="central-admin-field-shell">
                    <span className="central-admin-field-icon">
                        <i className="fa-solid fa-globe" />
                    </span>
                    <input
                        className="central-admin-field-input"
                        value={form.subdomain}
                        onChange={(event) => onChange('subdomain', event.target.value)}
                        placeholder="tenantnome"
                        required
                    />
                    <span className="central-admin-field-suffix">.{tenantBaseDomain}</span>
                </span>
                <span className="central-admin-field-note">
                    URL final: {tenantPreview}
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
        </>
    )
}

function TenantLicenseTab({ tenant, form, invoiceBusyId, onChange, onInvoiceStatusChange }) {
    const invoice = tenant?.license?.invoice

    return (
        <>
            <div className="central-admin-form-grid">
                <label className="central-admin-field">
                    <span className="central-admin-field-label">Início da licença</span>
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
                    <span className="central-admin-field-label">Tolerância</span>
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
                    <p>A fatura será gerada automaticamente assim que a licença for salva.</p>
                </div>
            )}
        </>
    )
}

function TenantAgentTab({
    tenant,
    form,
    printBusy,
    activationBusy,
    activationPreview,
    onChange,
    onGenerateActivationCode,
    onCopyActivationCode,
    onTestPrint,
}) {
    const agent = tenant?.local_agent
    const hasAgent = Boolean(agent)
    const hasActivationPreview = Boolean(
        tenant?.id
        && activationPreview?.tenantId
        && activationPreview.tenantId === tenant.id
        && activationPreview.code,
    )

    return (
        <>
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
                            ? 'Esse registro central controla a ativação e a configuração sincronizada do agente instalado no cliente.'
                            : 'Salve este cadastro para gerar o primeiro código de ativação do agente fiscal deste tenant.'}
                    </p>
                </article>

                <article className="central-admin-license-card central-admin-agent-card">
                    <div className="central-admin-license-card-top">
                        <h3>Código de ativação</h3>
                        <span className={`central-admin-status-pill ${agent?.activation?.pending ? 'is-active' : agent?.activation?.activated_at ? 'is-info' : 'is-muted'}`}>
                            {agent?.activation?.pending ? 'Pendente' : agent?.activation?.activated_at ? 'Usado' : 'Não gerado'}
                        </span>
                    </div>
                    <p>
                        Gere um código temporário e informe junto com a URL do Nimvo no instalador do agente. O setup troca esse código por
                        credenciais internas e segue com a configuração da impressora na própria máquina do cliente.
                    </p>
                    {hasActivationPreview ? (
                        <div className="central-admin-note-card" style={{ marginBottom: 16 }}>
                            <h3>
                                <i className="fa-solid fa-key" /> Código atual
                            </h3>
                            <p className="central-admin-path-copy">{activationPreview.code}</p>
                            <p>
                                Backend: {activationPreview.backend_url || 'Não informado'}
                                <br />
                                Expira em: {formatDateTime(activationPreview.expires_at)}
                            </p>
                        </div>
                    ) : null}
                    <div className="central-admin-table-actions">
                        <button
                            type="button"
                            className="central-admin-secondary-button"
                            disabled={!hasAgent || activationBusy}
                            onClick={onGenerateActivationCode}
                        >
                            <i className="fa-solid fa-key" />
                            <span>{activationBusy ? 'Gerando...' : agent?.activation?.pending ? 'Gerar novo código' : 'Gerar código'}</span>
                        </button>
                        <button
                            type="button"
                            className="central-admin-secondary-button"
                            disabled={!hasActivationPreview}
                            onClick={onCopyActivationCode}
                        >
                            <i className="fa-solid fa-copy" />
                            <span>Copiar código</span>
                        </button>
                    </div>
                    {hasAgent && agent?.activation?.pending ? (
                        <p className="central-admin-field-note">
                            O código fica válido até {formatDateTime(agent?.activation?.expires_at)}. Se expirar, gere um novo código e rode o setup novamente no cliente.
                        </p>
                    ) : null}
                </article>
            </div>

            <div className="central-admin-agent-device-grid">
                <article className="central-admin-license-card central-admin-agent-card">
                    <div className="central-admin-license-card-top">
                        <h3>Última máquina conectada</h3>
                        <span className="central-admin-badge is-info">
                            <i className="fa-solid fa-display" />
                            <span>{agent?.device?.machine_name || 'Sem heartbeat'}</span>
                        </span>
                    </div>
                    <div className="central-admin-agent-list">
                        <div className="central-admin-agent-item">
                            <strong>Usuário</strong>
                            <span>{agent?.device?.machine_user || 'Não informado'}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>Última sincronização</strong>
                            <span>{formatDateTime(agent?.device?.last_sync_at)}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>Bridge fiscal</strong>
                            <span className="central-admin-path-copy">{agent?.device?.bridge_root || 'Não informado'}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>PHP</strong>
                            <span className="central-admin-path-copy">{agent?.device?.php_path || 'Não informado'}</span>
                        </div>
                    </div>
                </article>

                <article className="central-admin-license-card central-admin-agent-card">
                    <div className="central-admin-license-card-top">
                        <h3>Impressora</h3>
                        <span className="central-admin-badge">
                            <i className="fa-solid fa-print" />
                            <span>{agent?.device?.printer_name || agent?.device?.printer_host || 'Sem impressora detectada'}</span>
                        </span>
                    </div>
                    <div className="central-admin-agent-list">
                        <div className="central-admin-agent-item">
                            <strong>Certificado</strong>
                            <span className="central-admin-path-copy">{agent?.device?.certificate_path || 'Não informado'}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>Conector</strong>
                            <span>{agent?.device?.printer_connector || 'Não informado'}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>Impressão local</strong>
                            <span>{agent?.device?.printer_enabled ? 'Ativa' : 'Desativada'}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>Config local</strong>
                            <span className="central-admin-path-copy">{agent?.device?.config_path || 'Não informado'}</span>
                        </div>
                        <div className="central-admin-agent-item">
                            <strong>API local</strong>
                            <span className="central-admin-path-copy">{agent?.device?.local_api_url || 'Não informado'}</span>
                        </div>
                    </div>
                    <p className="central-admin-field-note">
                        Esses dados são sincronizados pelo agente instalado. O setup do terminal já solicita o caminho do certificado A1 e a
                        senha local. Para trocar impressora, certificado, bridge fiscal ou logo do cupom, rode o setup novamente na máquina do cliente.
                    </p>
                    <div className="central-admin-table-actions" style={{ marginTop: 16 }}>
                        <button
                            type="button"
                            className="central-admin-secondary-button"
                            disabled={!hasAgent || printBusy}
                            onClick={onTestPrint}
                        >
                            <i className="fa-solid fa-print" />
                            <span>{printBusy ? 'Testando...' : 'Testar impressão'}</span>
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
            </div>
        </>
    )
}

function TenantModulesTab({ tenant, moduleSections, saving, onToggle }) {
    const modules = moduleSections.flatMap((section) =>
        section.items.map((item) => ({
            key: item.key,
            label: normalizeModuleLabel(item.label),
        })),
    )

    return (
        <>
            <div className="central-admin-feature-tenant-meta" style={{ marginBottom: '1rem' }}>
                <span className="central-admin-badge">{tenant.activeModules} módulos ativos</span>
                <span className="central-admin-badge is-info">{tenant.presetLabel}</span>
            </div>
            <div className="central-admin-feature-modules">
                {modules.map((module) => {
                    const enabled = Boolean(tenant.form.modules?.[module.key])

                    return (
                        <label
                            key={module.key}
                            className={`central-admin-feature-chip ${enabled ? 'is-active' : ''}`}
                        >
                            <span>{module.label}</span>
                            <AdminSwitch
                                checked={enabled}
                                disabled={saving}
                                saving={saving}
                                ariaLabel={`${module.label} para ${tenant.name}`}
                                onChange={() => onToggle(tenant, module.key)}
                            />
                        </label>
                    )
                })}
            </div>
        </>
    )
}

function TenantManagePanel({
    open,
    isCreating,
    tenant,
    activeTab,
    tenantBaseDomain,
    moduleSections,
    tenantForm,
    licenseForm,
    fiscalForm,
    localAgentForm,
    formBusy,
    cnpjLookupBusy,
    licenseBusy,
    invoiceBusyId,
    fiscalBusy,
    fiscalAutofillBusy,
    fiscalAutofillMeta,
    fiscalToggleBusy,
    localAgentBusy,
    localAgentPrintBusy,
    activationBusy,
    activationPreview,
    moduleSaving,
    onClose,
    onTabChange,
    onTenantFieldChange,
    onLookupCnpj,
    onLicenseFieldChange,
    onFiscalFieldChange,
    onLocalAgentFieldChange,
    onModuleToggle,
    onSubmitGeneral,
    onSubmitLicense,
    onSubmitFiscal,
    onSubmitLocalAgent,
    onAutofillByCnpj,
    onAutofillByCertificate,
    onToggleFiscalActive,
    onGenerateActivationCode,
    onCopyActivationCode,
    onTestPrint,
    onInvoiceStatusChange,
}) {
    if (!open) {
        return null
    }

    const availableTabs = isCreating ? MANAGE_TABS.filter((tab) => tab.key === 'geral') : MANAGE_TABS
    const title = isCreating ? 'Novo tenant' : tenant?.name || 'Tenant'

    const submitHandlers = {
        geral: onSubmitGeneral,
        licenca: onSubmitLicense,
        fiscal: onSubmitFiscal,
        agente: onSubmitLocalAgent,
    }

    const busyByTab = {
        geral: formBusy,
        licenca: licenseBusy,
        fiscal: fiscalBusy,
        agente: localAgentBusy,
    }

    const saveLabelByTab = {
        geral: isCreating ? 'Criar tenant' : 'Salvar geral',
        licenca: 'Salvar licença',
        fiscal: tenant?.fiscal?.has_nfce_profile ? 'Salvar fiscal' : 'Criar perfil',
        agente: tenant?.local_agent ? 'Salvar agente' : 'Criar agente',
    }

    const activeSubmit = submitHandlers[activeTab]
    const showFooterSave = Boolean(activeSubmit)

    return (
        <div className="central-admin-modal-backdrop" onClick={onClose}>
            <div className="central-admin-modal" onClick={(event) => event.stopPropagation()}>
                <div className="central-admin-modal-header">
                    <div className="central-admin-modal-titlebox">
                        <div className="central-admin-modal-icon">
                            <i className={`fa-solid ${isCreating ? 'fa-plus' : 'fa-buildings'}`} />
                        </div>
                        <div>
                            <h3>{title}</h3>
                            {!isCreating ? <p>{tenant?.domain || tenant?.id}</p> : null}
                        </div>
                    </div>
                    <button type="button" className="central-admin-modal-close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="central-admin-tabs">
                    {availableTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            className={`central-admin-tab ${activeTab === tab.key ? 'is-active' : ''}`}
                            onClick={() => onTabChange(tab.key)}
                        >
                            <i className={`fa-solid ${tab.icon}`} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                <form onSubmit={activeSubmit || ((event) => event.preventDefault())}>
                    <div className="central-admin-modal-body">
                        {activeTab === 'geral' ? (
                            <div className="central-admin-form-grid">
                                <TenantGeneralTab
                                    form={tenantForm}
                                    isCreating={isCreating}
                                    tenantBaseDomain={tenantBaseDomain}
                                    cnpjLookupBusy={cnpjLookupBusy}
                                    onChange={onTenantFieldChange}
                                    onLookupCnpj={onLookupCnpj}
                                />
                            </div>
                        ) : null}

                        {activeTab === 'fiscal' && !isCreating ? (
                            <TenantFiscalModal
                                tenant={tenant}
                                form={fiscalForm}
                                autofillBusy={fiscalAutofillBusy}
                                autofillMeta={fiscalAutofillMeta}
                                onChange={onFiscalFieldChange}
                                onAutofillByCnpj={onAutofillByCnpj}
                                onAutofillByCertificate={onAutofillByCertificate}
                                toggleBusy={fiscalToggleBusy}
                                onToggleActive={onToggleFiscalActive}
                            />
                        ) : null}

                        {activeTab === 'licenca' && !isCreating ? (
                            <TenantLicenseTab
                                tenant={tenant}
                                form={licenseForm}
                                invoiceBusyId={invoiceBusyId}
                                onChange={onLicenseFieldChange}
                                onInvoiceStatusChange={onInvoiceStatusChange}
                            />
                        ) : null}

                        {activeTab === 'agente' && !isCreating ? (
                            <TenantAgentTab
                                tenant={tenant}
                                form={localAgentForm}
                                printBusy={localAgentPrintBusy}
                                activationBusy={activationBusy}
                                activationPreview={activationPreview}
                                onChange={onLocalAgentFieldChange}
                                onGenerateActivationCode={onGenerateActivationCode}
                                onCopyActivationCode={onCopyActivationCode}
                                onTestPrint={onTestPrint}
                            />
                        ) : null}

                        {activeTab === 'modulos' && !isCreating ? (
                            <TenantModulesTab
                                tenant={tenant}
                                moduleSections={moduleSections}
                                saving={moduleSaving}
                                onToggle={onModuleToggle}
                            />
                        ) : null}
                    </div>

                    <div className="central-admin-modal-footer">
                        <button type="button" className="central-admin-secondary-button" onClick={onClose}>
                            Fechar
                        </button>
                        {showFooterSave ? (
                            <button type="submit" className="central-admin-primary-button" disabled={busyByTab[activeTab]}>
                                <i className="fa-solid fa-floppy-disk" />
                                <span>{busyByTab[activeTab] ? 'Salvando...' : saveLabelByTab[activeTab]}</span>
                            </button>
                        ) : null}
                    </div>
                </form>
            </div>
        </div>
    )
}

function TenantsTable({ tenants, onCreate, onManage, onDelete, fiscalToggleBusyId, onQuickToggleFiscal }) {
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
                                <th>NFC-e</th>
                                <th>Licença</th>
                                <th>Agente fiscal</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map((tenant) => {
                                const hasFiscalProfile = Boolean(tenant.fiscal?.has_nfce_profile)

                                return (
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
                                            <div className="central-admin-list-row" style={{ padding: 0, background: 'none', border: 0, gap: '0.5rem' }}>
                                                <span className={`central-admin-status-pill ${tenant.fiscal?.tone || 'is-muted'}`}>
                                                    {tenant.fiscal?.label || 'Sem fiscal'}
                                                </span>
                                                {hasFiscalProfile ? (
                                                    <AdminSwitch
                                                        checked={Boolean(tenant.fiscal?.active)}
                                                        disabled={fiscalToggleBusyId === tenant.id}
                                                        saving={fiscalToggleBusyId === tenant.id}
                                                        ariaLabel={`Alternar NFC-e de ${tenant.name}`}
                                                        onChange={() => onQuickToggleFiscal(tenant)}
                                                    />
                                                ) : null}
                                            </div>
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
                                                <button type="button" className="central-admin-primary-button" onClick={() => onManage(tenant)}>
                                                    <i className="fa-solid fa-sliders" />
                                                    <span>Gerenciar</span>
                                                </button>
                                                <a
                                                    className="central-admin-secondary-button"
                                                    href={`/app/baixar?store=${encodeURIComponent(tenant.domain || tenant.id)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <i className="fa-solid fa-qrcode" />
                                                    <span>App</span>
                                                </a>
                                                <button type="button" className="central-admin-secondary-button is-danger" onClick={() => onDelete(tenant)}>
                                                    <i className="fa-solid fa-trash" />
                                                    <span>Excluir</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
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
                    <h2>Módulos</h2>
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
                                        <span className="central-admin-badge">{tenant.activeModules} módulos</span>
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

export default function CentralAdminClients({
    tenantStats = {},
    agentStats = {},
    tenants = [],
    moduleSections = [],
    tenantBaseDomain = 'nimvo.com.br',
    pageMode = 'tenants',
}) {
    const safeTenantStats = {
        total: 0,
        active: 0,
        inactive: 0,
        ...tenantStats,
    }
    const safeAgentStats = {
        total: 0,
        online: 0,
        offline: 0,
        ...agentStats,
    }
    const safeTenants = Array.isArray(tenants) ? tenants : []
    const safeModuleSections = Array.isArray(moduleSections) ? moduleSections : []
    const currentUrl = usePage().url
    const highlightedTenantId = new URLSearchParams(currentUrl.split('?')[1] || '').get('tenant')
    const isFeatureFlagsPage = pageMode === 'feature-flags'

    const [feedback, setFeedback] = useState(null)
    const [managingTenant, setManagingTenant] = useState(null) // null | 'new' | tenant object
    const [activeManageTab, setActiveManageTab] = useState('geral')
    const [formBusy, setFormBusy] = useState(false)
    const [cnpjLookupBusy, setCnpjLookupBusy] = useState(false)
    const [tenantForm, setTenantForm] = useState({ ...INITIAL_TENANT_FORM })
    const [tenantToDelete, setTenantToDelete] = useState(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const [licenseForm, setLicenseForm] = useState(buildLicenseForm())
    const [licenseBusy, setLicenseBusy] = useState(false)
    const [invoiceBusyId, setInvoiceBusyId] = useState(null)
    const [fiscalForm, setFiscalForm] = useState(buildFiscalForm())
    const [fiscalBusy, setFiscalBusy] = useState(false)
    const [fiscalAutofillBusy, setFiscalAutofillBusy] = useState(false)
    const [fiscalAutofillMeta, setFiscalAutofillMeta] = useState(null)
    const [fiscalToggleBusyId, setFiscalToggleBusyId] = useState(null)
    const [localAgentForm, setLocalAgentForm] = useState(buildLocalAgentForm())
    const [localAgentBusy, setLocalAgentBusy] = useState(false)
    const [localAgentPrintBusy, setLocalAgentPrintBusy] = useState(false)
    const [activationBusy, setActivationBusy] = useState(false)
    const [activationPreview, setActivationPreview] = useState(null)
    const [tenantSettingsState, setTenantSettingsState] = useState(() => buildTenantSettingsState(safeTenants))
    const [rowState, setRowState] = useState({})
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })

    const isCreating = managingTenant === 'new'
    const currentTenant = isCreating ? null : managingTenant
    const isPanelOpen = managingTenant !== null

    useEffect(() => {
        setTenantSettingsState(buildTenantSettingsState(safeTenants))
    }, [safeTenants])

    useEffect(() => {
        if (!currentTenant) {
            return
        }

        const updatedTenant = safeTenants.find((tenant) => tenant.id === currentTenant.id)
        if (!updatedTenant) {
            setManagingTenant(null)
            return
        }

        setManagingTenant(updatedTenant)
        setLicenseForm(buildLicenseForm(updatedTenant))
        setFiscalForm(buildFiscalForm(updatedTenant))
        setLocalAgentForm(buildLocalAgentForm(updatedTenant))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeTenants])

    const tenantSummaries = buildTenantSummaries(safeTenants, tenantSettingsState)
    const managingTenantSummary = currentTenant
        ? tenantSummaries.find((tenant) => tenant.id === currentTenant.id) || currentTenant
        : null
    const trackedModules = safeModuleSections.flatMap((section) => section.items || [])
    const averageModules = tenantSummaries.length
        ? (tenantSummaries.reduce((total, tenant) => total + tenant.activeModules, 0) / tenantSummaries.length).toFixed(1)
        : '0.0'

    function refresh(only = ['tenants', 'tenantStats', 'agentStats']) {
        router.reload({
            only,
            preserveScroll: true,
        })
    }

    function handleTenantFieldChange(field, value) {
        setTenantForm((current) => ({
            ...current,
            [field]: field === 'subdomain' ? normalizeSubdomainInput(value, tenantBaseDomain) : value,
        }))
    }

    function openCreatePanel() {
        setManagingTenant('new')
        setActiveManageTab('geral')
        setTenantForm(buildTenantForm())
        setLicenseForm(buildLicenseForm())
        setFiscalForm(buildFiscalForm())
        setLocalAgentForm(buildLocalAgentForm())
        setFiscalAutofillMeta(null)
        setActivationPreview(null)
    }

    function openManagePanel(tenant, tab = 'geral') {
        setManagingTenant(tenant)
        setActiveManageTab(tab)
        setTenantForm(buildTenantForm(tenant))
        setLicenseForm(buildLicenseForm(tenant))
        setFiscalForm(buildFiscalForm(tenant))
        setLocalAgentForm(buildLocalAgentForm(tenant))
        setFiscalAutofillMeta(null)
        setActivationPreview(null)
    }

    function closeManagePanel() {
        setManagingTenant(null)
    }

    async function handleLookupCnpjForNewTenant() {
        if (!tenantForm.cnpj_lookup) {
            return
        }

        setCnpjLookupBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest('/admin/cnpj-lookup', {
                method: 'post',
                data: { cnpj: tenantForm.cnpj_lookup },
            })

            const company = response.company || {}

            if (Object.keys(company).length === 0) {
                setFeedback({ type: 'error', text: 'Não foi possível encontrar dados para esse CNPJ.' })
                return
            }

            setTenantForm((current) => ({
                ...current,
                client_name: company.trade_name || company.company_name || current.client_name,
                client_document: company.cnpj || current.client_document,
            }))
            setFiscalForm((current) => mergeFiscalForm(current, company))
            setFeedback({ type: 'success', text: 'Dados do CNPJ encontrados. Revise a aba Fiscal depois de criar o tenant.' })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setCnpjLookupBusy(false)
        }
    }

    async function handleSubmitTenant(event) {
        event.preventDefault()
        setFormBusy(true)
        setFeedback(null)

        const isEdit = !isCreating
        const url = isEdit ? `/admin/tenants/${tenantForm.tenant_id}` : '/admin/tenants'
        const method = isEdit ? 'put' : 'post'

        try {
            const response = await apiRequest(url, {
                method,
                data: tenantForm,
            })

            setFeedback({ type: 'success', text: response.message })

            if (!isEdit && response.tenant) {
                // Just created - keep the panel open and move to Fiscal so the
                // CNPJ data already looked up can be reviewed and saved.
                setManagingTenant(response.tenant)
                setActiveManageTab('fiscal')
            }

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

            setFeedback({ type: 'success', text: response.message || `Configurações de ${tenant.name} atualizadas.` })
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

    function handleFiscalFieldChange(field, value) {
        setFiscalForm((current) => ({
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

        if (!currentTenant) {
            return
        }

        setLicenseBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${currentTenant.id}/license`, {
                method: 'put',
                data: {
                    ...licenseForm,
                    cycle_days: Number(licenseForm.cycle_days || 30),
                    grace_days: Number(licenseForm.grace_days || 10),
                    amount: licenseForm.amount === '' ? null : Number(licenseForm.amount),
                },
            })

            setFeedback({ type: 'success', text: response.message })
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

    async function handleSubmitFiscal(event) {
        event.preventDefault()

        if (!currentTenant) {
            return
        }

        setFiscalBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${currentTenant.id}/fiscal`, {
                method: 'put',
                data: {
                    active: Boolean(fiscalForm.active),
                    environment: fiscalForm.environment,
                    operation_nature: fiscalForm.operation_nature,
                    series: fiscalForm.series,
                    next_number: fiscalForm.next_number,
                    company_name: fiscalForm.company_name,
                    trade_name: fiscalForm.trade_name,
                    cnpj: fiscalForm.cnpj,
                    ie: fiscalForm.ie,
                    im: fiscalForm.im,
                    cnae: fiscalForm.cnae,
                    crt: fiscalForm.crt,
                    phone: fiscalForm.phone,
                    street: fiscalForm.street,
                    number: fiscalForm.number,
                    complement: fiscalForm.complement,
                    district: fiscalForm.district,
                    city_code: fiscalForm.city_code,
                    city_name: fiscalForm.city_name,
                    state: fiscalForm.state,
                    zip_code: fiscalForm.zip_code,
                    csc_id: fiscalForm.csc_id,
                    csc_token: fiscalForm.csc_token,
                    technical_contact_name: fiscalForm.technical_contact_name,
                    technical_contact_email: fiscalForm.technical_contact_email,
                    technical_contact_phone: fiscalForm.technical_contact_phone,
                    technical_contact_cnpj: fiscalForm.technical_contact_cnpj,
                },
            })

            setFeedback({ type: 'success', text: response.message })
            setManagingTenant((current) => (
                current && current !== 'new'
                    ? { ...current, fiscal: response.fiscal }
                    : current
            ))
            setFiscalForm(buildFiscalForm({ fiscal: response.fiscal }))
            refresh(['tenants'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setFiscalBusy(false)
        }
    }

    async function handleAutofillFiscal(source) {
        if (!currentTenant) {
            return
        }

        setFiscalAutofillBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${currentTenant.id}/fiscal/autofill`, {
                method: 'post',
                data: {
                    source,
                    cnpj: fiscalForm.cnpj,
                },
            })

            setFiscalForm((current) => mergeFiscalForm(current, response.fiscal))
            setFiscalAutofillMeta(response.meta || null)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setFiscalAutofillBusy(false)
        }
    }

    async function toggleFiscalActiveForTenant(tenant, nextActive) {
        setFiscalToggleBusyId(tenant.id)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${tenant.id}/fiscal/active`, {
                method: 'patch',
                data: { active: nextActive },
            })

            setFeedback({ type: 'success', text: response.message })
            setManagingTenant((current) => (
                current && current !== 'new' && current.id === tenant.id
                    ? { ...current, fiscal: response.fiscal }
                    : current
            ))
            setFiscalForm((current) => (
                currentTenant?.id === tenant.id
                    ? mergeFiscalForm(current, response.fiscal)
                    : current
            ))
            refresh(['tenants'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setFiscalToggleBusyId(null)
        }
    }

    function handleQuickToggleFiscal(tenant) {
        toggleFiscalActiveForTenant(tenant, !tenant.fiscal?.active)
    }

    function handleToggleFiscalActiveInPanel() {
        if (!currentTenant) {
            return
        }

        toggleFiscalActiveForTenant(currentTenant, !fiscalForm.active)
    }

    async function handleSubmitLocalAgent(event) {
        event.preventDefault()

        if (!currentTenant) {
            return
        }

        setLocalAgentBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${currentTenant.id}/local-agent`, {
                method: 'put',
                data: {
                    name: localAgentForm.name,
                    active: Boolean(localAgentForm.active),
                    poll_interval_seconds: Number(localAgentForm.poll_interval_seconds || 3),
                },
            })

            setFeedback({ type: 'success', text: response.message })
            setManagingTenant((current) => (
                current && current !== 'new'
                    ? { ...current, local_agent: response.agent }
                    : current
            ))
            refresh(['tenants', 'agentStats'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLocalAgentBusy(false)
        }
    }

    async function handleGenerateActivationCode() {
        if (!currentTenant) {
            return
        }

        setActivationBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${currentTenant.id}/local-agent/activation-code`, {
                method: 'post',
            })

            setActivationPreview({
                tenantId: currentTenant.id,
                ...response.activation,
            })
            setFeedback({ type: 'success', text: response.message })
            setManagingTenant((current) => (
                current && current !== 'new'
                    ? { ...current, local_agent: response.agent }
                    : current
            ))
            refresh(['tenants', 'agentStats'])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setActivationBusy(false)
        }
    }

    async function handleCopyActivationCode() {
        if (!activationPreview?.code) {
            return
        }

        try {
            await navigator.clipboard.writeText(activationPreview.code)
            setFeedback({ type: 'success', text: 'Código de ativação copiado.' })
        } catch (error) {
            setFeedback({ type: 'error', text: 'Não foi possível copiar o código de ativação automaticamente.' })
        }
    }

    async function handleTestLocalAgentPrint() {
        if (!currentTenant?.local_agent) {
            return
        }

        const tenantId = currentTenant.id
        setLocalAgentPrintBusy(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/admin/tenants/${tenantId}/local-agent/test-print`, {
                method: 'post',
            })

            const commandId = response.command?.id
            if (!commandId) {
                setFeedback({ type: 'success', text: response.message })
                return
            }

            setFeedback({ type: 'info', text: 'Teste enviado. Aguardando o agente local confirmar a impressão...' })

            const outcome = await pollLocalAgentCommand(tenantId, commandId)
            setFeedback({
                type: outcome.status === 'completed' ? 'success' : 'error',
                text: outcome.message,
            })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLocalAgentPrintBusy(false)
        }
    }

    async function pollLocalAgentCommand(tenantId, commandId, attempts = 15, delayMs = 1000) {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const command = await apiRequest(`/admin/tenants/${tenantId}/local-agent/commands/${commandId}`)

            if (command.status === 'completed' || command.status === 'failed') {
                return command
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }

        return {
            status: 'failed',
            message: 'O agente local nao confirmou a impressao a tempo. Verifique se ele esta online e tente novamente.',
        }
    }

    return (
        <AdminLayout title={isFeatureFlagsPage ? 'Configurações' : 'Tenants'}>
            <div className="central-admin-page">
                <PageContainer
                    sidebar={(
                        <RightSidebarPanel>
                            <RightSidebarSection title="Contexto" subtitle={isFeatureFlagsPage ? 'Configurações por tenant' : 'Base de tenants'}>
                                <div className="right-sidebar-meta">
                                    <div className="right-sidebar-meta-item">
                                        <span>Tenants</span>
                                        <strong>{safeTenantStats.total}</strong>
                                    </div>
                                    <div className="right-sidebar-meta-item">
                                        <span>Ativos</span>
                                        <strong>{safeTenantStats.active}</strong>
                                    </div>
                                    <div className="right-sidebar-meta-item">
                                        <span>Inativos</span>
                                        <strong>{safeTenantStats.inactive}</strong>
                                    </div>
                                    <div className="right-sidebar-meta-item">
                                        <span>{isFeatureFlagsPage ? 'Módulos' : 'Agentes online'}</span>
                                        <strong>{isFeatureFlagsPage ? trackedModules.length : `${safeAgentStats.online}/${safeAgentStats.total}`}</strong>
                                    </div>
                                </div>
                            </RightSidebarSection>

                            <RightSidebarSection title="Ações" subtitle="Atalhos">
                                {isFeatureFlagsPage ? (
                                    <Link href="/admin/clientes" className="action-button tone-ghost">
                                        <i className="fa-solid fa-table-list" />
                                        <span>Tenants</span>
                                    </Link>
                                ) : (
                                    <button type="button" className="action-button tone-primary" onClick={openCreatePanel}>
                                        <i className="fa-solid fa-plus" />
                                        <span>Novo tenant</span>
                                    </button>
                                )}

                                <Link
                                    href={isFeatureFlagsPage ? '/admin/painel' : '/admin/feature-flags'}
                                    className="action-button tone-ghost"
                                >
                                    <i className={`fa-solid ${isFeatureFlagsPage ? 'fa-house' : 'fa-sliders'}`} />
                                    <span>{isFeatureFlagsPage ? 'Home' : 'Módulos'}</span>
                                </Link>

                                {feedback ? (
                                    <div className={`central-admin-feedback is-${feedback.type}`}>
                                        <i className={`fa-solid ${feedbackIcon(feedback.type)}`} />
                                        <span>{feedback.text}</span>
                                    </div>
                                ) : null}
                            </RightSidebarSection>
                        </RightSidebarPanel>
                    )}
                >
                    {isFeatureFlagsPage ? (
                        <FeatureFlagsList
                            tenants={tenantSummaries}
                            moduleSections={safeModuleSections}
                            rowState={rowState}
                            highlightedTenantId={highlightedTenantId}
                            onToggle={handleToggleModule}
                        />
                    ) : (
                        <TenantsTable
                            tenants={tenantSummaries}
                            onCreate={openCreatePanel}
                            onManage={openManagePanel}
                            onDelete={setTenantToDelete}
                            fiscalToggleBusyId={fiscalToggleBusyId}
                            onQuickToggleFiscal={handleQuickToggleFiscal}
                        />
                    )}
                </PageContainer>
            </div>

            <TenantManagePanel
                open={isPanelOpen}
                isCreating={isCreating}
                tenant={managingTenantSummary}
                activeTab={activeManageTab}
                tenantBaseDomain={tenantBaseDomain}
                moduleSections={safeModuleSections}
                tenantForm={tenantForm}
                licenseForm={licenseForm}
                fiscalForm={fiscalForm}
                localAgentForm={localAgentForm}
                formBusy={formBusy}
                cnpjLookupBusy={cnpjLookupBusy}
                licenseBusy={licenseBusy}
                invoiceBusyId={invoiceBusyId}
                fiscalBusy={fiscalBusy}
                fiscalAutofillBusy={fiscalAutofillBusy}
                fiscalAutofillMeta={fiscalAutofillMeta}
                fiscalToggleBusy={currentTenant ? fiscalToggleBusyId === currentTenant.id : false}
                localAgentBusy={localAgentBusy}
                localAgentPrintBusy={localAgentPrintBusy}
                activationBusy={activationBusy}
                activationPreview={activationPreview}
                moduleSaving={currentTenant ? Boolean(rowState[currentTenant.id]?.saving) : false}
                onClose={closeManagePanel}
                onTabChange={setActiveManageTab}
                onTenantFieldChange={handleTenantFieldChange}
                onLookupCnpj={handleLookupCnpjForNewTenant}
                onLicenseFieldChange={handleLicenseFieldChange}
                onFiscalFieldChange={handleFiscalFieldChange}
                onLocalAgentFieldChange={handleLocalAgentFieldChange}
                onModuleToggle={handleToggleModule}
                onSubmitGeneral={handleSubmitTenant}
                onSubmitLicense={handleSubmitLicense}
                onSubmitFiscal={handleSubmitFiscal}
                onSubmitLocalAgent={handleSubmitLocalAgent}
                onAutofillByCnpj={() => handleAutofillFiscal('cnpj')}
                onAutofillByCertificate={() => handleAutofillFiscal('certificate')}
                onToggleFiscalActive={handleToggleFiscalActiveInPanel}
                onGenerateActivationCode={handleGenerateActivationCode}
                onCopyActivationCode={handleCopyActivationCode}
                onTestPrint={handleTestLocalAgentPrint}
                onInvoiceStatusChange={handleLicenseInvoiceStatusChange}
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
