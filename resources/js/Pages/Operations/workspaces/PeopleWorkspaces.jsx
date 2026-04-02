import { useMemo, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import {
    Badge,
    buildRecordsUrl,
    EmptyState,
    Feedback,
    FeedbackHeader,
    ListCard,
    MetricGrid,
    SectionTabs,
    upsertRecord,
} from './shared'

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
        <div className="ops-workspace-stack">
            <SectionTabs
                tabs={[
                    { key: 'active', label: 'Ativos', icon: 'fa-tractor' },
                    { key: 'inactive', label: 'Inativos', icon: 'fa-ban' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
            <MetricGrid items={metrics} />
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Cadastro" subtitle={`${filteredRecords.length} registro(s) no filtro`} />
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
                                    description={record.region || 'Sem regiao informada'}
                                    meta={[record.document || 'Sem documento', record.phone || record.email || 'Sem contato']}
                                />
                            ))
                        ) : (
                            <EmptyState title="Sem produtores nesse recorte" text="Cadastre produtores para abastecimento e relacionamento do agro." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    <FeedbackHeader title={form.id ? 'Editar produtor' : 'Novo produtor'} subtitle="Cadastro real no tenant" />
                    <form className="ops-workspace-form-grid" onSubmit={handleSubmit}>
                        <label>
                            <span>Nome</span>
                            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                        </label>
                        <label>
                            <span>Documento</span>
                            <input value={form.document} onChange={(event) => setForm((current) => ({ ...current, document: event.target.value }))} />
                        </label>
                        <label>
                            <span>Telefone</span>
                            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                        </label>
                        <label>
                            <span>E-mail</span>
                            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <span>Regiao</span>
                            <input value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} />
                        </label>
                        <label className="span-2">
                            <span>Observacoes</span>
                            <textarea rows="4" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                        </label>
                        <label className="ops-workspace-inline-toggle span-2">
                            <input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                            <span>Produtor ativo</span>
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
                                {saving ? 'Salvando...' : form.id ? 'Atualizar produtor' : 'Salvar produtor'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    )
}
