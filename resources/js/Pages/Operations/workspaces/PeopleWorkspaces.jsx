import { useMemo, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { requiredMessage, validateEmail } from '@/lib/formValidation'
import { apiRequest } from '@/lib/http'
import ActionButton from '@/Components/UI/ActionButton'
import DataTable from '@/Components/UI/DataTable'
import ModalForm from '@/Components/UI/ModalForm'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    ListCard,
    MetricGrid,
    WorkspaceCollectionShell,
    upsertRecord,
} from './shared'

function FieldLabel({ icon, text }) {
    return (
        <span className="ops-workspace-label-with-icon">
            <i className={`fa-solid ${icon}`} />
            {text}
        </span>
    )
}

export function ProducersWorkspace({ moduleKey, payload }) {
    const emptyForm = {
        id: null,
        name: '',
        document: '',
        phone: '',
        email: '',
        region: '',
        notes: '',
        active: true,
    }

    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('active')
    const [form, setForm] = useState(emptyForm)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(
        () => records.filter((record) => (activeTab === 'active' ? record.active : !record.active)),
        [records, activeTab],
    )

    const metrics = useMemo(
        () => [
            { label: 'Produtores', value: records.length, caption: 'Base total cadastrada' },
            { label: 'Ativos', value: records.filter((record) => record.active).length, caption: 'Disponiveis para compras' },
            { label: 'Com contato', value: records.filter((record) => record.phone || record.email).length, caption: 'Telefone ou e-mail preenchido' },
        ],
        [records],
    )

    async function handleSubmit(event) {
        event.preventDefault()
        setFeedback(null)

        const requiredError = requiredMessage(form.name, 'o nome do produtor')
        if (requiredError) {
            setFeedback({ type: 'warning', text: requiredError })
            return
        }

        if (!validateEmail(form.email)) {
            setFeedback({ type: 'warning', text: 'Informe um endereço de e-mail válido.' })
            return
        }

        setSaving(true)

        try {
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: form })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: form })

            setRecords((current) => upsertRecord(current, response.record))
            setForm({ ...emptyForm, ...response.record })
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!form.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover produtor',
            message: `Remover o produtor "${form.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'delete' })
            setRecords((current) => current.filter((record) => record.id !== form.id))
            setForm(emptyForm)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <WorkspaceCollectionShell
                tabs={[
                    { key: 'active', label: 'Ativos', icon: 'fa-tractor' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                listTitle="Produtores"
                listIcon="fa-tractor"
                listCount={`${filteredRecords.length} registro(s)`}
                createLabel="Novo produtor"
                onCreate={() => setForm(emptyForm)}
                summaryItems={metrics}
                emptyState={<EmptyState title="Sem produtores" text="Nenhum cadastro neste filtro." />}
                formTitle={form.id ? 'Editar produtor' : 'Novo produtor'}
                formSubtitle="Contato e status"
                formChildren={(
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit} noValidate>
                        <label>
                            <FieldLabel icon="fa-signature" text="Nome" />
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-id-card" text="Documento" />
                            <input value={form.document} onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-phone" text="Telefone" />
                            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-envelope" text="E-mail" />
                            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-location-dot" text="Regiao" />
                            <input value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-note-sticky" text="Observacoes" />
                            <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                        </label>
                        <label className="ops-workspace-inline-toggle span-2">
                            <input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                            <span>Produtor ativo</span>
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <ActionButton tone="ghost" onClick={() => setForm(emptyForm)}>
                                Limpar
                            </ActionButton>
                            {form.id ? (
                                <ActionButton tone="danger" onClick={handleDelete}>
                                    Excluir
                                </ActionButton>
                            ) : null}
                            <ActionButton type="submit" disabled={saving}>
                                {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Salvar produtor'}
                            </ActionButton>
                        </div>
                    </form>
                )}
            >
                <div className="ops-workspace-list-stack">
                    {filteredRecords.map((record) => (
                        <ListCard
                            key={record.id}
                            active={form.id === record.id}
                            onClick={() => setForm({ ...emptyForm, ...record })}
                            title={record.name}
                            badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativo' : 'Inativo'}</Badge>}
                            description={record.region || 'Sem regiao'}
                            meta={[record.document || 'Sem documento', record.phone || record.email || 'Sem contato']}
                        />
                    ))}
                </div>
            </WorkspaceCollectionShell>
        </>
    )
}

export function UsersWorkspace({ moduleKey, payload }) {
    const emptyForm = {
        id: null,
        name: '',
        username: '',
        role: 'operator',
        is_supervisor: false,
        active: true,
        must_change_password: false,
        password: '',
        discount_authorization_password: '',
        has_discount_authorization_password: false,
    }

    const [records, setRecords] = useState(payload.records || [])
    const [activeTab, setActiveTab] = useState('active')
    const [form, setForm] = useState(emptyForm)
    const [selectedId, setSelectedId] = useState((payload.records || [])[0]?.id ?? null)
    const [modalOpen, setModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [hasLoadedRecords, setHasLoadedRecords] = useState((payload.records || []).length > 0)
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const roleOptions = payload.roles || []

    const filteredRecords = useMemo(
        () => {
            if (!hasLoadedRecords) {
                return []
            }

            if (activeTab === 'all') {
                return records
            }

            return records.filter((record) => (activeTab === 'active' ? record.active : !record.active))
        },
        [hasLoadedRecords, records, activeTab],
    )

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => String(record.id) === String(selectedId))
            || records.find((record) => String(record.id) === String(selectedId))
            || null,
        [filteredRecords, records, selectedId],
    )

    const metrics = useMemo(
        () => [
            { label: 'Usuarios', value: records.length, caption: 'Base total cadastrada' },
            { label: 'Gerentes', value: records.filter((record) => record.role === 'manager').length, caption: 'Podem autorizar descontos' },
            { label: 'Supervisores', value: records.filter((record) => record.is_supervisor).length, caption: 'Liberam edição do fechamento' },
            { label: 'Com senha gerencial', value: records.filter((record) => record.has_discount_authorization_password).length, caption: 'Senha dedicada cadastrada' },
        ],
        [records],
    )

    const filterCounts = useMemo(() => ({
        all: records.length,
        active: records.filter((record) => record.active).length,
        inactive: records.filter((record) => !record.active).length,
    }), [records])

    function roleLabel(value) {
        return roleOptions.find((role) => role.value === value)?.label || value || '-'
    }

    function buildUserForm(record = null) {
        return {
            ...emptyForm,
            ...(record || {}),
            password: '',
            discount_authorization_password: '',
        }
    }

    function handleCreate() {
        setForm(buildUserForm())
        setModalOpen(true)
    }

    function handleEdit(record = selectedRecord) {
        if (!record) {
            return
        }

        setSelectedId(record.id)
        setForm(buildUserForm(record))
        setModalOpen(true)
    }

    function handleCloseModal() {
        setForm(buildUserForm())
        setModalOpen(false)
    }

    async function handleLoadRecords() {
        setLoading(true)
        setFeedback(null)

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey), {
                params: { applied: 1 },
            })
            const nextRecords = response.records || []
            setRecords(nextRecords)
            setHasLoadedRecords(true)
            setSelectedId(nextRecords[0]?.id ?? null)
            setForm(buildUserForm())
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setFeedback(null)

        const requiredError = requiredMessage(form.name, 'o nome do usuário')
            || requiredMessage(form.username, 'o usuário de acesso')

        if (requiredError) {
            setFeedback({ type: 'warning', text: requiredError })
            return
        }

        setSaving(true)

        try {
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: form })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: form })

            setRecords((current) => upsertRecord(current, response.record))
            setHasLoadedRecords(true)
            setSelectedId(response.record.id)
            handleCloseModal()
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteRecord(record = selectedRecord) {
        if (!record?.id) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover usuário',
            message: `Remover "${record.name}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) {
            return
        }

        try {
            const response = await apiRequest(buildRecordsUrl(moduleKey, record.id), { method: 'delete' })
            setRecords((current) => current.filter((entry) => entry.id !== record.id))

            if (String(selectedId) === String(record.id)) {
                setSelectedId(null)
            }

            if (String(form.id) === String(record.id)) {
                handleCloseModal()
            }

            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <>
            <Feedback feedback={feedback} />
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Usuarios"
                        actions={(
                            <>
                                <ActionButton icon="fa-magnifying-glass" tone="secondary" onClick={() => void handleLoadRecords()} disabled={loading}>
                                    {loading ? 'Buscando...' : 'Buscar'}
                                </ActionButton>
                                <ActionButton icon="fa-plus" onClick={handleCreate}>
                                    Novo usuário
                                </ActionButton>
                                <ActionButton icon="fa-pen" tone="secondary" disabled={!selectedRecord} onClick={() => handleEdit(selectedRecord)}>
                                    Editar
                                </ActionButton>
                                <ActionButton icon="fa-trash-can" tone="danger" disabled={!selectedRecord} onClick={() => handleDeleteRecord(selectedRecord)}>
                                    Excluir
                                </ActionButton>
                            </>
                        )}
                        filters={[
                            { key: 'all', value: 'all', label: 'Todos', count: filterCounts.all },
                            { key: 'active', value: 'active', label: 'Ativos', count: filterCounts.active },
                            { key: 'inactive', value: 'inactive', label: 'Inativos', count: filterCounts.inactive },
                        ]}
                        activeFilter={activeTab}
                        onFilterChange={setActiveTab}
                    />

                    <MetricGrid items={metrics} />

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'name',
                                    label: 'Nome',
                                    render: (record) => <strong>{record.name}</strong>,
                                },
                                {
                                    key: 'username',
                                    label: 'Usuario',
                                    render: (record) => record.username,
                                },
                                {
                                    key: 'role',
                                    label: 'Perfil',
                                    render: (record) => roleLabel(record.role),
                                },
                                {
                                    key: 'supervisor',
                                    label: 'Supervisor',
                                    render: (record) => (record.is_supervisor ? 'Sim' : 'Nao'),
                                },
                                {
                                    key: 'manager_password',
                                    label: 'Senha gerencial',
                                    render: (record) => (record.has_discount_authorization_password ? 'Ativa' : 'Nao cadastrada'),
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (record) => <StatusBadge compact label={record.active ? 'Ativo' : 'Inativo'} tone={record.active ? 'active' : 'inactive'} />,
                                },
                            ]}
                            rows={filteredRecords}
                            rowKey="id"
                            selectedRowKey={selectedId}
                            onRowClick={(record) => setSelectedId(record.id)}
                            onRowDoubleClick={(record) => handleEdit(record)}
                            emptyMessage={loading ? 'Buscando usuários' : hasLoadedRecords ? 'Nenhum usuário encontrado' : 'Clique em Buscar para listar'}
                            emptyIcon={loading ? 'fa-spinner fa-spin' : 'fa-user-check'}
                            actions={(record) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    tone: 'primary',
                                    onClick: () => handleEdit(record),
                                },
                            ]}
                        />
                    </section>
                </div>
            </div>

            <ModalForm
                open={modalOpen}
                title={form.id ? 'Editar usuário' : 'Novo usuário'}
                description="Perfis e autorizacoes"
                icon="fa-user-shield"
                size="lg"
                onClose={handleCloseModal}
                footer={(
                    <>
                        {form.id ? (
                            <ActionButton tone="danger" onClick={() => handleDeleteRecord(form)}>
                                Excluir
                            </ActionButton>
                        ) : <span />}
                        <ActionButton form="user-modal-form" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Salvar usuário'}
                        </ActionButton>
                    </>
                )}
            >
                <form id="user-modal-form" className="ops-workspace-form-grid" onSubmit={handleSubmit} noValidate>
                    <label>
                        <FieldLabel icon="fa-user" text="Nome" />
                        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                    </label>
                    <label>
                        <FieldLabel icon="fa-at" text="Usuario" />
                        <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
                    </label>
                    <label>
                        <FieldLabel icon="fa-user-shield" text="Perfil" />
                        <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                            {roleOptions.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <FieldLabel icon="fa-key" text={form.id ? 'Nova senha de acesso' : 'Senha de acesso'} />
                        <input
                            type="password"
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            placeholder={form.id ? 'Preencha apenas para alterar' : 'Minimo de 4 caracteres'}
                        />
                    </label>
                    <label className="span-2">
                        <FieldLabel icon="fa-money-check-dollar" text="Senha de autorização gerencial" />
                        <input
                            type="password"
                            value={form.discount_authorization_password}
                            onChange={(event) => setForm((current) => ({ ...current, discount_authorization_password: event.target.value }))}
                            placeholder={
                                form.has_discount_authorization_password
                                    ? 'Preencha apenas para trocar a senha gerencial'
                                    : 'Defina a senha usada para autorizar descontos'
                            }
                        />
                    </label>
                    <label className="ops-workspace-inline-toggle">
                        <input
                            type="checkbox"
                            checked={Boolean(form.is_supervisor)}
                            onChange={(event) => setForm((current) => ({ ...current, is_supervisor: event.target.checked }))}
                        />
                        <span>Pode atuar como supervisor no fechamento de caixa</span>
                    </label>
                    <label className="ops-workspace-inline-toggle">
                        <input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                        <span>Usuario ativo</span>
                    </label>
                    <label className="ops-workspace-inline-toggle">
                        <input
                            type="checkbox"
                            checked={Boolean(form.must_change_password)}
                            onChange={(event) => setForm((current) => ({ ...current, must_change_password: event.target.checked }))}
                        />
                        <span>Exigir troca de senha no proximo login</span>
                    </label>
                </form>
            </ModalForm>
        </>
    )
}
