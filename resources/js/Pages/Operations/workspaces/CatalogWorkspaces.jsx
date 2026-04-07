import { useMemo, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import ActionButton from '@/Components/UI/ActionButton'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    ListCard,
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

export function CategoriesWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', description: '', active: true }
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
            { label: 'Categorias', value: records.length, caption: 'Base cadastrada' },
            { label: 'Ativas', value: records.filter((record) => record.active).length, caption: 'Disponiveis no catalogo' },
            { label: 'Valor em estoque', value: records.reduce((total, record) => total + Number(record.stock_value || 0), 0), caption: 'Soma por categoria', format: 'money' },
        ],
        [records],
    )

    function handleCreate() {
        setForm(emptyForm)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
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
            title: 'Remover categoria',
            message: `Remover a categoria "${form.name}"?`,
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
                    { key: 'active', label: 'Ativas', icon: 'fa-layer-group' },
                    { key: 'inactive', label: 'Inativas', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                listTitle="Categorias"
                listIcon="fa-layer-group"
                listCount={`${filteredRecords.length} registro(s)`}
                createLabel="Nova categoria"
                onCreate={handleCreate}
                summaryItems={metrics}
                emptyState={<EmptyState title="Sem categorias nesse filtro" text="Ajuste o recorte ou crie um novo cadastro." />}
                formTitle={form.id ? 'Editar categoria' : 'Nova categoria'}
                formSubtitle="Nome, status e descricao"
                formChildren={(
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-layer-group" text="Nome" />
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-align-left" text="Descricao" />
                            <textarea rows="4" value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
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
                                {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar categoria'}
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
                            badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativa' : 'Inativa'}</Badge>}
                            description={record.description || 'Sem descricao'}
                            meta={[`${record.products_count || 0} produto(s)`, formatMoney(record.stock_value || 0)]}
                        />
                    ))}
                </div>
            </WorkspaceCollectionShell>
        </>
    )
}

export function SuppliersWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', document: '', trade_name: '', state_registration: '', city_name: '', state: '', phone: '', email: '', active: true }
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
            { label: 'Fornecedores', value: records.length, caption: 'Base cadastrada' },
            { label: 'Ativos', value: records.filter((record) => record.active).length, caption: 'Disponiveis para compras' },
            { label: 'Com produtos', value: records.filter((record) => Number(record.products_count || 0) > 0).length, caption: 'Vinculados ao catalogo' },
        ],
        [records],
    )

    function handleCreate() {
        setForm(emptyForm)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
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
            title: 'Remover fornecedor',
            message: `Remover o fornecedor "${form.name}"?`,
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
                    { key: 'active', label: 'Ativos', icon: 'fa-truck-ramp-box' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                listTitle="Fornecedores"
                listIcon="fa-truck-ramp-box"
                listCount={`${filteredRecords.length} registro(s)`}
                createLabel="Novo fornecedor"
                onCreate={handleCreate}
                summaryItems={metrics}
                emptyState={<EmptyState title="Sem fornecedores nesse filtro" text="Ajuste o recorte ou crie um novo cadastro." />}
                formTitle={form.id ? 'Editar fornecedor' : 'Novo fornecedor'}
                formSubtitle="Contato e dados comerciais"
                formChildren={(
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-building" text="Nome" />
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label>
                            <FieldLabel icon="fa-id-card" text="CNPJ / Documento" />
                            <input value={form.document || ''} onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))} placeholder="Somente numeros ou formatado" />
                        </label>
                        <label>
                            <FieldLabel icon="fa-store" text="Nome fantasia" />
                            <input value={form.trade_name || ''} onChange={(event) => setForm((current) => ({ ...current, trade_name: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-receipt" text="Inscricao estadual" />
                            <input value={form.state_registration || ''} onChange={(event) => setForm((current) => ({ ...current, state_registration: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-city" text="Cidade" />
                            <input value={form.city_name || ''} onChange={(event) => setForm((current) => ({ ...current, city_name: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-map-location-dot" text="UF" />
                            <input maxLength="2" value={form.state || ''} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value.toUpperCase() }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-phone" text="Telefone" />
                            <input value={form.phone || ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-envelope" text="E-mail" />
                            <input type="email" value={form.email || ''} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
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
                                {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar fornecedor'}
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
                            description={record.document || record.email || 'Sem documento fiscal'}
                            meta={[record.phone || 'Sem telefone', `${record.products_count || 0} produto(s)`]}
                        />
                    ))}
                </div>
            </WorkspaceCollectionShell>
        </>
    )
}

export function CustomersWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', phone: '', credit_limit: '0', active: true }
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
            { label: 'Clientes', value: records.length, caption: 'Cadastro total' },
            { label: 'Ativos', value: records.filter((record) => record.active).length, caption: 'Aptos para venda' },
            { label: 'Limite concedido', value: records.reduce((total, record) => total + Number(record.credit_limit || 0), 0), caption: 'Somatoria de limites', format: 'money' },
        ],
        [records],
    )

    function handleCreate() {
        setForm(emptyForm)
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFeedback(null)
        try {
            const payloadData = {
                ...form,
                credit_limit: Number(form.credit_limit || 0),
            }
            const response = form.id
                ? await apiRequest(buildRecordsUrl(moduleKey, form.id), { method: 'put', data: payloadData })
                : await apiRequest(buildRecordsUrl(moduleKey), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setForm({
                ...emptyForm,
                ...response.record,
                credit_limit: String(response.record.credit_limit || 0),
            })
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
            title: 'Remover cliente',
            message: `Remover o cliente "${form.name}"?`,
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
                    { key: 'active', label: 'Ativos', icon: 'fa-user-group' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-user-slash' },
                ]}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                listTitle="Clientes"
                listIcon="fa-user-group"
                listCount={`${filteredRecords.length} registro(s)`}
                createLabel="Novo cliente"
                onCreate={handleCreate}
                summaryItems={metrics}
                emptyState={<EmptyState title="Sem clientes nesse filtro" text="Ajuste o recorte ou crie um novo cadastro." />}
                formTitle={form.id ? 'Editar cliente' : 'Novo cliente'}
                formSubtitle="Contato e limite de credito"
                formChildren={(
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-user" text="Nome" />
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label>
                            <FieldLabel icon="fa-phone" text="Telefone" />
                            <input value={form.phone || ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-credit-card" text="Limite de credito" />
                            <input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))} />
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
                                {saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Salvar cliente'}
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
                            onClick={() =>
                                setForm({
                                    ...emptyForm,
                                    ...record,
                                    credit_limit: String(record.credit_limit || 0),
                                })
                            }
                            title={record.name}
                            badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativo' : 'Inativo'}</Badge>}
                            description={record.phone || 'Sem telefone'}
                            meta={[`Vendas: ${record.sales_count || 0}`, `Limite: ${formatMoney(record.credit_limit || 0)}`]}
                        />
                    ))}
                </div>
            </WorkspaceCollectionShell>
        </>
    )
}
