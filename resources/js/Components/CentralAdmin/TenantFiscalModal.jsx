const PROFILE_FIELDS = [
    { name: 'environment', label: 'Ambiente', icon: 'fa-flask', type: 'select', options: [{ value: '2', label: 'Homologacao' }, { value: '1', label: 'Producao' }] },
    { name: 'crt', label: 'CRT', icon: 'fa-scale-balanced', type: 'select', options: [{ value: '1', label: '1 Simples' }, { value: '2', label: '2 Excesso' }, { value: '4', label: '4 MEI' }] },
    { name: 'operation_nature', label: 'Natureza', icon: 'fa-receipt', placeholder: 'VENDA NFC-E', full: true, required: true },
    { name: 'series', label: 'Serie', icon: 'fa-layer-group', type: 'number', min: 1, max: 999, required: true },
    { name: 'next_number', label: 'Proximo', icon: 'fa-arrow-right-9', type: 'number', min: 1, required: true },
]

const ISSUER_FIELDS = [
    { name: 'company_name', label: 'Razao social', icon: 'fa-building', placeholder: 'Empresa LTDA', full: true, required: true },
    { name: 'trade_name', label: 'Fantasia', icon: 'fa-store', placeholder: 'Nome fantasia', full: true },
    { name: 'cnpj', label: 'CNPJ', icon: 'fa-id-card', placeholder: '12345678000123', required: true },
    { name: 'ie', label: 'IE', icon: 'fa-file-signature', placeholder: 'Inscricao estadual', required: true },
    { name: 'im', label: 'IM', icon: 'fa-building-circle-check', placeholder: 'Inscricao municipal' },
    { name: 'cnae', label: 'CNAE', icon: 'fa-sitemap', placeholder: '4781400' },
    { name: 'phone', label: 'Telefone', icon: 'fa-phone', placeholder: '11999999999' },
]

const ADDRESS_FIELDS = [
    { name: 'street', label: 'Logradouro', icon: 'fa-road', placeholder: 'Rua Principal', full: true, required: true },
    { name: 'number', label: 'Numero', icon: 'fa-hashtag', placeholder: '100', required: true },
    { name: 'complement', label: 'Complemento', icon: 'fa-location-dot', placeholder: 'Sala, loja, bloco' },
    { name: 'district', label: 'Bairro', icon: 'fa-map', placeholder: 'Centro', required: true },
    { name: 'city_name', label: 'Municipio', icon: 'fa-city', placeholder: 'Sao Paulo', required: true },
    { name: 'city_code', label: 'IBGE', icon: 'fa-location-crosshairs', placeholder: '3550308', required: true },
    { name: 'state', label: 'UF', icon: 'fa-map-pin', placeholder: 'SP', required: true, maxLength: 2 },
    { name: 'zip_code', label: 'CEP', icon: 'fa-mailbox', placeholder: '01001000', required: true },
]

const TRANSMISSION_FIELDS = [
    { name: 'csc_id', label: 'CSC ID', icon: 'fa-hashtag', placeholder: '000001' },
    { name: 'csc_token', label: 'CSC Token', icon: 'fa-key', placeholder: 'Cole o token da SEFAZ', note: 'Deixe em branco para manter o token atual.' },
    { name: 'technical_contact_name', label: 'Responsavel tecnico', icon: 'fa-user-tie', placeholder: 'Equipe fiscal ou software house', full: true },
    { name: 'technical_contact_email', label: 'Email resptec', icon: 'fa-envelope', placeholder: 'fiscal@empresa.com' },
    { name: 'technical_contact_phone', label: 'Telefone resptec', icon: 'fa-phone-volume', placeholder: '11999999999' },
    { name: 'technical_contact_cnpj', label: 'CNPJ resptec', icon: 'fa-id-card-clip', placeholder: '12345678000123' },
]

function AdminSwitch({ checked, onChange, ariaLabel }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            className={`central-admin-toggle ${checked ? 'is-checked' : ''}`}
            onClick={onChange}
        />
    )
}

function formatCertificateDate(value) {
    if (!value) {
        return 'Nao informado'
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
    }).format(date)
}

function renderField(field, form, canPersist, onChange, fiscal) {
    const value = form[field.name] ?? ''
    const placeholder = field.name === 'csc_token' && fiscal?.csc_token_configured
        ? 'Manter token atual'
        : field.placeholder

    return (
        <label key={field.name} className={`central-admin-field ${field.full ? 'is-full' : ''}`}>
            <span className="central-admin-field-label">{field.label}</span>
            <span className="central-admin-field-shell">
                <span className="central-admin-field-icon">
                    <i className={`fa-solid ${field.icon}`} />
                </span>
                {field.type === 'select' ? (
                    <select
                        className="central-admin-field-input"
                        value={value}
                        onChange={(event) => onChange(field.name, event.target.value)}
                        disabled={!canPersist}
                    >
                        {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        className="central-admin-field-input"
                        type={field.type || 'text'}
                        min={field.min}
                        max={field.max}
                        maxLength={field.maxLength}
                        value={value}
                        onChange={(event) => onChange(field.name, event.target.value)}
                        placeholder={placeholder}
                        disabled={!canPersist}
                        required={Boolean(field.required)}
                    />
                )}
            </span>
            {field.note ? <span className="central-admin-field-note">{field.note}</span> : null}
        </label>
    )
}

export default function TenantFiscalModal({
    open,
    tenant,
    form,
    busy,
    autofillBusy = false,
    autofillMeta = null,
    onClose,
    onChange,
    onSubmit,
    onAutofillByCnpj,
    onAutofillByCertificate,
}) {
    if (!open) {
        return null
    }

    const fiscal = tenant?.fiscal
    const certificate = tenant?.local_agent?.device
        ? {
            path: tenant.local_agent.device.certificate_path,
            company_name: tenant.local_agent.device.certificate_company_name,
            cnpj: tenant.local_agent.device.certificate_cnpj,
            valid_from: tenant.local_agent.device.certificate_valid_from,
            valid_to: tenant.local_agent.device.certificate_valid_to,
        }
        : null
    const hasProfile = Boolean(fiscal?.has_nfce_profile)
    const canPersist = fiscal?.status !== 'missing_table'
    const pendingCount = Array.isArray(fiscal?.missing_fields) ? fiscal.missing_fields.length : 0
    const environmentLabel = fiscal?.environment === 1 ? 'Producao' : fiscal?.environment === 2 ? 'Homologacao' : 'Nao informado'
    const hasCertificateSummary = Boolean(certificate?.cnpj || certificate?.company_name || certificate?.valid_to)
    const autofillCount = Array.isArray(autofillMeta?.filled_fields) ? autofillMeta.filled_fields.length : 0
    const autofillMissingCount = Array.isArray(autofillMeta?.missing_fields) ? autofillMeta.missing_fields.length : 0

    return (
        <div className="central-admin-modal-backdrop" onClick={onClose}>
            <div className="central-admin-modal" onClick={(event) => event.stopPropagation()}>
                <div className="central-admin-modal-header">
                    <div className="central-admin-modal-titlebox">
                        <div className="central-admin-modal-icon">
                            <i className="fa-solid fa-key" />
                        </div>
                        <div>
                            <h3>{tenant ? `Fiscal de ${tenant.name}` : 'Fiscal'}</h3>
                        </div>
                    </div>

                    <button type="button" className="central-admin-modal-close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <form onSubmit={onSubmit}>
                    <div className="central-admin-modal-body">
                        <div className="central-admin-agent-grid">
                            <article className="central-admin-license-card central-admin-agent-card">
                                <div className="central-admin-license-card-top">
                                    <h3>Emitente NFC-e</h3>
                                    <span className={`central-admin-status-pill ${fiscal?.tone || 'is-muted'}`}>
                                        {fiscal?.label || 'Sem fiscal'}
                                    </span>
                                </div>

                                <div className="central-admin-agent-list">
                                    <div className="central-admin-agent-item">
                                        <strong>Empresa</strong>
                                        <span>{fiscal?.company_name || 'Nao informado'}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>Ambiente</strong>
                                        <span>{environmentLabel}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>Proximo</strong>
                                        <span>{fiscal?.next_number || 'Nao informado'}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>Pendencias</strong>
                                        <span>{pendingCount}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>Atualizado</strong>
                                        <span>{fiscal?.updated_label || 'Nao informado'}</span>
                                    </div>
                                </div>

                                <p className="central-admin-field-note">
                                    {fiscal?.status === 'missing_table'
                                        ? 'Esse tenant ainda nao recebeu as migrations fiscais. Sem a tabela fiscal nao ha como salvar o emitente.'
                                        : hasProfile
                                            ? 'Os dados sao gravados no banco do proprio tenant, dentro do perfil fiscal NFC-e modelo 65.'
                                            : 'Ao salvar este formulario, o painel cria o perfil fiscal NFC-e 65 diretamente no banco do tenant.'}
                                </p>
                            </article>

                            <article className="central-admin-license-card central-admin-agent-card">
                                <div className="central-admin-license-card-top">
                                    <h3>Transmissao</h3>
                                    <span className={`central-admin-status-pill ${fiscal?.transmission_ready ? 'is-active' : 'is-info'}`}>
                                        {fiscal?.transmission_ready ? 'Pronta' : 'Pendente'}
                                    </span>
                                </div>

                                <div className="central-admin-agent-list">
                                    <div className="central-admin-agent-item">
                                        <strong>CSC ID</strong>
                                        <span>{fiscal?.csc_id || 'Nao informado'}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>Token</strong>
                                        <span>{fiscal?.csc_token_configured ? 'Configurado' : 'Nao configurado'}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>RespTec</strong>
                                        <span>{fiscal?.technical_contact_name || 'Nao informado'}</span>
                                    </div>
                                    <div className="central-admin-agent-item">
                                        <strong>Perfil</strong>
                                        <span>{fiscal?.profile_ready ? 'Completo' : 'Pendente'}</span>
                                    </div>
                                </div>

                                <p className="central-admin-field-note">
                                    Deixe o token em branco para manter o valor atual. Se apagar o CSC ID e deixar o token vazio, a configuracao do CSC sera limpa.
                                </p>
                            </article>
                        </div>

                        <div className="central-admin-fiscal-actions">
                            <button
                                type="button"
                                className="central-admin-secondary-button"
                                disabled={autofillBusy || !canPersist || !String(form.cnpj || '').trim()}
                                onClick={onAutofillByCnpj}
                            >
                                <i className="fa-solid fa-magnifying-glass" />
                                <span>{autofillBusy ? 'Consultando...' : 'Consultar CNPJ'}</span>
                            </button>

                            <button
                                type="button"
                                className="central-admin-secondary-button"
                                disabled={autofillBusy || !canPersist || !hasCertificateSummary}
                                onClick={onAutofillByCertificate}
                            >
                                <i className="fa-solid fa-certificate" />
                                <span>{autofillBusy ? 'Lendo...' : 'Usar certificado'}</span>
                            </button>
                        </div>

                        {(hasCertificateSummary || autofillMeta) ? (
                            <div className="central-admin-agent-grid">
                                {hasCertificateSummary ? (
                                    <article className="central-admin-license-card central-admin-agent-card">
                                        <div className="central-admin-license-card-top">
                                            <h3>Certificado</h3>
                                            <span className="central-admin-status-pill is-active">
                                                A1
                                            </span>
                                        </div>

                                        <div className="central-admin-agent-list">
                                            <div className="central-admin-agent-item">
                                                <strong>Empresa</strong>
                                                <span>{certificate?.company_name || 'Nao informado'}</span>
                                            </div>
                                            <div className="central-admin-agent-item">
                                                <strong>CNPJ</strong>
                                                <span>{certificate?.cnpj || 'Nao informado'}</span>
                                            </div>
                                            <div className="central-admin-agent-item">
                                                <strong>Valido ate</strong>
                                                <span>{formatCertificateDate(certificate?.valid_to)}</span>
                                            </div>
                                        </div>
                                    </article>
                                ) : null}

                                {autofillMeta ? (
                                    <article className="central-admin-license-card central-admin-agent-card">
                                        <div className="central-admin-license-card-top">
                                            <h3>Autofill</h3>
                                            <span className={`central-admin-status-pill ${autofillMissingCount === 0 ? 'is-active' : 'is-info'}`}>
                                                {autofillMeta?.source_label || 'Sugestao'}
                                            </span>
                                        </div>

                                        <div className="central-admin-agent-list">
                                            <div className="central-admin-agent-item">
                                                <strong>CNPJ</strong>
                                                <span>{autofillMeta?.cnpj || 'Nao informado'}</span>
                                            </div>
                                            <div className="central-admin-agent-item">
                                                <strong>Campos</strong>
                                                <span>{autofillCount}</span>
                                            </div>
                                            <div className="central-admin-agent-item">
                                                <strong>Pendencias</strong>
                                                <span>{autofillMissingCount}</span>
                                            </div>
                                        </div>

                                        {autofillMissingCount > 0 ? (
                                            <span className="central-admin-field-note">
                                                {autofillMeta.missing_fields.join(', ')}
                                            </span>
                                        ) : null}

                                        {Array.isArray(autofillMeta?.warnings) && autofillMeta.warnings.length > 0 ? (
                                            <span className="central-admin-field-note">
                                                {autofillMeta.warnings.join(' ')}
                                            </span>
                                        ) : null}
                                    </article>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="central-admin-form-grid">
                            <div className="central-admin-field is-full">
                                <span className="central-admin-field-label">Status</span>
                                <div className="central-admin-list-row">
                                    <div className="central-admin-list-copy">
                                        <strong>{form.active ? 'Ativo' : 'Inativo'}</strong>
                                    </div>
                                    <AdminSwitch
                                        checked={Boolean(form.active)}
                                        ariaLabel="Alternar status do perfil fiscal"
                                        onChange={() => onChange('active', !form.active)}
                                    />
                                </div>
                            </div>

                            {PROFILE_FIELDS.map((field) => renderField(field, form, canPersist, onChange, fiscal))}
                        </div>

                        <div className="central-admin-form-grid">
                            {ISSUER_FIELDS.map((field) => renderField(field, form, canPersist, onChange, fiscal))}
                        </div>

                        <div className="central-admin-form-grid">
                            {ADDRESS_FIELDS.map((field) => renderField(field, form, canPersist, onChange, fiscal))}
                        </div>

                        <div className="central-admin-form-grid">
                            {TRANSMISSION_FIELDS.map((field) => renderField(field, form, canPersist, onChange, fiscal))}
                        </div>
                    </div>

                    <div className="central-admin-modal-footer">
                        <button type="button" className="central-admin-secondary-button" onClick={onClose}>
                            Fechar
                        </button>
                        <button type="submit" className="central-admin-primary-button" disabled={busy || !canPersist}>
                            <i className="fa-solid fa-floppy-disk" />
                            <span>{busy ? 'Salvando...' : hasProfile ? 'Salvar fiscal' : 'Criar perfil'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
