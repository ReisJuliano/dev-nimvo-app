import { useMemo, useState } from 'react'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import { Badge, buildRecordsUrl, EmptyState, Feedback, FeedbackHeader, ListCard, MetricGrid, SectionTabs, upsertRecord } from './shared'

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
        if (!form.id || !window.confirm(`Remover a categoria "${form.name}"?`)) {
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
        <div className="ops-workspace-stack">
            <SectionTabs
                tabs={[
                    { key: 'active', label: 'Ativas', icon: 'fa-layer-group' },
                    { key: 'inactive', label: 'Inativas', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Categorias" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? (
                            filteredRecords.map((record) => (
                                <ListCard
                                    key={record.id}
                                    active={form.id === record.id}
                                    onClick={() => setForm({ ...emptyForm, ...record })}
                                    title={record.name}
                                    badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativa' : 'Inativa'}</Badge>}
                                    description={record.description || 'Sem descricao'}
                                    meta={[`${record.products_count || 0} produto(s)`, formatMoney(record.stock_value || 0)]}
                                />
                            ))
                        ) : (
                            <EmptyState title="Sem categorias nesse filtro" text="Cadastre categorias para organizar melhor o catalogo." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar categoria' : 'Nova categoria'} subtitle="Cadastro real com status e descricao" />
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
                            <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>
                                Limpar
                            </button>
                            {form.id ? (
                                <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>
                                    Excluir
                                </button>
                            ) : null}
                            <button type="submit" className="ui-button" disabled={saving}>
                                {saving ? 'Salvando...' : form.id ? 'Atualizar categoria' : 'Salvar categoria'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}

export function SuppliersWorkspace({ moduleKey, payload }) {
    const emptyForm = { id: null, name: '', phone: '', email: '', active: true }
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
        if (!form.id || !window.confirm(`Remover o fornecedor "${form.name}"?`)) {
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
        <div className="ops-workspace-stack">
            <SectionTabs
                tabs={[
                    { key: 'active', label: 'Ativos', icon: 'fa-truck-ramp-box' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Fornecedores" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? (
                            filteredRecords.map((record) => (
                                <ListCard
                                    key={record.id}
                                    active={form.id === record.id}
                                    onClick={() => setForm({ ...emptyForm, ...record })}
                                    title={record.name}
                                    badge={<Badge tone={record.active ? 'success' : 'muted'}>{record.active ? 'Ativo' : 'Inativo'}</Badge>}
                                    description={record.email || 'Sem e-mail'}
                                    meta={[record.phone || 'Sem telefone', `${record.products_count || 0} produto(s)`]}
                                />
                            ))
                        ) : (
                            <EmptyState title="Sem fornecedores nesse filtro" text="Cadastre fornecedores para acelerar compras e reposicoes." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar fornecedor' : 'Novo fornecedor'} subtitle="Contato e status comercial" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <FieldLabel icon="fa-building" text="Nome" />
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
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
                            <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>
                                Limpar
                            </button>
                            {form.id ? (
                                <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>
                                    Excluir
                                </button>
                            ) : null}
                            <button type="submit" className="ui-button" disabled={saving}>
                                {saving ? 'Salvando...' : form.id ? 'Atualizar fornecedor' : 'Salvar fornecedor'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
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
        if (!form.id || !window.confirm(`Remover o cliente "${form.name}"?`)) {
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
        <div className="ops-workspace-stack">
            <SectionTabs
                tabs={[
                    { key: 'active', label: 'Ativos', icon: 'fa-user-group' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-user-slash' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Clientes" subtitle={`${filteredRecords.length} registro(s)`} />
                    <Feedback feedback={feedback} />
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? (
                            filteredRecords.map((record) => (
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
                            ))
                        ) : (
                            <EmptyState title="Sem clientes nesse filtro" text="Cadastre clientes para vendas recorrentes e credito." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar cliente' : 'Novo cliente'} subtitle="Cadastro com limite de credito" />
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
                            <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyForm)}>
                                Limpar
                            </button>
                            {form.id ? (
                                <button type="button" className="ui-button-ghost danger" onClick={handleDelete}>
                                    Excluir
                                </button>
                            ) : null}
                            <button type="submit" className="ui-button" disabled={saving}>
                                {saving ? 'Salvando...' : form.id ? 'Atualizar cliente' : 'Salvar cliente'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}
