import { useEffect, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import ActionButton from '@/Components/UI/ActionButton'
import DataTable from '@/Components/UI/DataTable'
import ModalForm from '@/Components/UI/ModalForm'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import { apiRequest } from '@/lib/http'
import './tax-rules.css'

const UF_OPTIONS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO',
]

function emptyForm() {
    return {
        id: null,
        name: '',
        active: true,
        regime: '',
        ncm_pattern: '',
        cfop: '',
        uf_origem: '',
        uf_destino: '',
        origin_code: '',
        csosn: '',
        cst_icms: '',
        icms_rate: '',
        st_mva: '',
        st_fcp: '',
        pis_cst: '',
        pis_rate: '',
        cofins_cst: '',
        cofins_rate: '',
        ibs_cbs_cst: '',
        c_class_trib: '',
        priority: '0',
        notes: '',
    }
}

function toFormValue(value) {
    return value === null || value === undefined ? '' : String(value)
}

function ruleToForm(rule) {
    return {
        id: rule.id,
        name: rule.name,
        active: Boolean(rule.active),
        regime: toFormValue(rule.regime),
        ncm_pattern: toFormValue(rule.ncm_pattern),
        cfop: toFormValue(rule.cfop),
        uf_origem: toFormValue(rule.uf_origem),
        uf_destino: toFormValue(rule.uf_destino),
        origin_code: toFormValue(rule.origin_code),
        csosn: toFormValue(rule.csosn),
        cst_icms: toFormValue(rule.cst_icms),
        icms_rate: toFormValue(rule.icms_rate),
        st_mva: toFormValue(rule.st_mva),
        st_fcp: toFormValue(rule.st_fcp),
        pis_cst: toFormValue(rule.pis_cst),
        pis_rate: toFormValue(rule.pis_rate),
        cofins_cst: toFormValue(rule.cofins_cst),
        cofins_rate: toFormValue(rule.cofins_rate),
        ibs_cbs_cst: toFormValue(rule.ibs_cbs_cst),
        c_class_trib: toFormValue(rule.c_class_trib),
        priority: toFormValue(rule.priority),
        notes: toFormValue(rule.notes),
    }
}

function numberOrNull(value) {
    if (value === '' || value === null || value === undefined) {
        return null
    }

    const parsed = Number(value)

    return Number.isNaN(parsed) ? null : parsed
}

function textOrNull(value) {
    const trimmed = String(value ?? '').trim()

    return trimmed === '' ? null : trimmed
}

function buildPayload(form) {
    return {
        name: form.name,
        active: Boolean(form.active),
        regime: textOrNull(form.regime),
        ncm_pattern: textOrNull(form.ncm_pattern),
        cfop: textOrNull(form.cfop),
        uf_origem: textOrNull(form.uf_origem),
        uf_destino: textOrNull(form.uf_destino),
        origin_code: textOrNull(form.origin_code),
        csosn: textOrNull(form.csosn),
        cst_icms: textOrNull(form.cst_icms),
        icms_rate: numberOrNull(form.icms_rate),
        st_mva: numberOrNull(form.st_mva),
        st_fcp: numberOrNull(form.st_fcp),
        pis_cst: textOrNull(form.pis_cst),
        pis_rate: numberOrNull(form.pis_rate),
        cofins_cst: textOrNull(form.cofins_cst),
        cofins_rate: numberOrNull(form.cofins_rate),
        ibs_cbs_cst: textOrNull(form.ibs_cbs_cst),
        c_class_trib: textOrNull(form.c_class_trib),
        priority: Number(form.priority || 0),
        notes: textOrNull(form.notes),
    }
}

function summarizeConditions(rule) {
    const parts = []

    if (rule.ncm_pattern) {
        parts.push(`NCM ${rule.ncm_pattern}*`)
    }

    if (rule.cfop) {
        parts.push(`CFOP ${rule.cfop}`)
    }

    if (rule.uf_origem || rule.uf_destino) {
        parts.push(`UF ${rule.uf_origem || '*'} → ${rule.uf_destino || '*'}`)
    }

    if (rule.regime) {
        parts.push(rule.regime === 'simples' ? 'Simples Nacional' : 'Regime normal')
    }

    return parts.length ? parts.join(' · ') : 'Qualquer produto'
}

export default function TaxRulesIndex() {
    const [rules, setRules] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm())
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState('')

    async function refresh() {
        setLoading(true)
        try {
            const response = await apiRequest('/api/fiscal/tax-rules')
            setRules(response.rules || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void refresh()
    }, [])

    function openCreate() {
        setForm(emptyForm())
        setFormError('')
        setModalOpen(true)
    }

    function openEdit(rule) {
        setForm(ruleToForm(rule))
        setFormError('')
        setModalOpen(true)
    }

    async function submitForm(event) {
        event.preventDefault()
        setSaving(true)
        setFormError('')

        try {
            const payload = buildPayload(form)
            const response = form.id
                ? await apiRequest(`/api/fiscal/tax-rules/${form.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/fiscal/tax-rules', { method: 'post', data: payload })

            setFeedback({ type: 'success', text: response.message })
            setModalOpen(false)
            await refresh()
        } catch (error) {
            setFormError(error.message)
        } finally {
            setSaving(false)
        }
    }

    async function removeRule(rule) {
        if (!window.confirm(`Excluir a regra "${rule.name}"?`)) {
            return
        }

        try {
            const response = await apiRequest(`/api/fiscal/tax-rules/${rule.id}`, { method: 'delete' })
            setFeedback({ type: 'success', text: response.message })
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <AppLayout title="Matriz tributária">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Matriz tributária"
                        actions={(
                            <ActionButton icon="fa-plus" onClick={openCreate}>
                                Nova regra
                            </ActionButton>
                        )}
                    />

                    {feedback ? (
                        <div className={`ui-alert ${feedback.type}`}>
                            <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                            <p>{feedback.text}</p>
                        </div>
                    ) : null}

                    <p className="ui-page-header-hint">
                        Regras usadas como reserva quando um produto não tem CSOSN/PIS/COFINS/IBS-CBS próprios cadastrados.
                        Nenhuma regra vem pré-cadastrada — cadastre com base na orientação do seu contador.
                    </p>

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                { key: 'name', label: 'Nome' },
                                { key: 'conditions', label: 'Condições', render: summarizeConditions },
                                { key: 'csosn', label: 'CSOSN', render: (rule) => rule.csosn || '-' },
                                { key: 'ibs_cbs_cst', label: 'IBS/CBS CST', render: (rule) => rule.ibs_cbs_cst || '-' },
                                { key: 'priority', label: 'Prioridade', align: 'right' },
                                {
                                    key: 'active',
                                    label: 'Status',
                                    render: (rule) => (
                                        <StatusBadge
                                            compact
                                            label={rule.active ? 'Ativa' : 'Inativa'}
                                            tone={rule.active ? 'success' : 'neutral'}
                                        />
                                    ),
                                },
                            ]}
                            rows={rules}
                            rowKey="id"
                            onRowClick={openEdit}
                            emptyMessage={loading ? 'Carregando...' : 'Nenhuma regra tributária cadastrada.'}
                            emptyIcon="fa-scale-balanced"
                            actions={(rule) => [
                                { key: 'edit', icon: 'fa-pen', label: 'Editar', onClick: () => openEdit(rule) },
                                { key: 'delete', icon: 'fa-trash', label: 'Excluir', tone: 'danger', onClick: () => void removeRule(rule) },
                            ]}
                        />
                    </section>
                </div>
            </div>

            <ModalForm
                open={modalOpen}
                title={form.id ? 'Editar regra tributária' : 'Nova regra tributária'}
                icon="fa-scale-balanced"
                size="lg"
                onClose={() => setModalOpen(false)}
            >
                <form onSubmit={submitForm}>
                    <label>
                        <span>Nome</span>
                        <input
                            className="ui-input"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            required
                        />
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={form.active}
                            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                        />
                        {' '}Regra ativa
                    </label>

                    <span className="ui-form-section-title">Condições de aplicação (deixe em branco para não filtrar)</span>
                    <div className="ui-form-grid">
                        <label>
                            <span>Prefixo do NCM</span>
                            <input
                                className="ui-input"
                                placeholder="Ex: 2203"
                                maxLength={8}
                                value={form.ncm_pattern}
                                onChange={(event) => setForm((current) => ({ ...current, ncm_pattern: event.target.value.replace(/\D/g, '') }))}
                            />
                        </label>
                        <label>
                            <span>CFOP</span>
                            <input
                                className="ui-input"
                                placeholder="Ex: 5102"
                                maxLength={4}
                                value={form.cfop}
                                onChange={(event) => setForm((current) => ({ ...current, cfop: event.target.value.replace(/\D/g, '') }))}
                            />
                        </label>
                        <label>
                            <span>UF de origem</span>
                            <select
                                value={form.uf_origem}
                                onChange={(event) => setForm((current) => ({ ...current, uf_origem: event.target.value }))}
                            >
                                <option value="">Qualquer</option>
                                {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>UF de destino</span>
                            <select
                                value={form.uf_destino}
                                onChange={(event) => setForm((current) => ({ ...current, uf_destino: event.target.value }))}
                            >
                                <option value="">Qualquer</option>
                                {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Regime tributário</span>
                            <select
                                value={form.regime}
                                onChange={(event) => setForm((current) => ({ ...current, regime: event.target.value }))}
                            >
                                <option value="">Qualquer</option>
                                <option value="simples">Simples Nacional</option>
                                <option value="normal">Regime normal</option>
                            </select>
                        </label>
                        <label>
                            <span>Prioridade (maior vence empate)</span>
                            <input
                                className="ui-input"
                                type="number"
                                min="0"
                                value={form.priority}
                                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                            />
                        </label>
                    </div>

                    <span className="ui-form-section-title">ICMS</span>
                    <div className="ui-form-grid">
                        <label>
                            <span>Origem da mercadoria</span>
                            <input
                                className="ui-input"
                                placeholder="0-8"
                                maxLength={1}
                                value={form.origin_code}
                                onChange={(event) => setForm((current) => ({ ...current, origin_code: event.target.value.replace(/\D/g, '') }))}
                            />
                        </label>
                        <label>
                            <span>CSOSN (Simples Nacional)</span>
                            <input
                                className="ui-input"
                                maxLength={3}
                                value={form.csosn}
                                onChange={(event) => setForm((current) => ({ ...current, csosn: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>CST ICMS (regime normal)</span>
                            <input
                                className="ui-input"
                                maxLength={3}
                                value={form.cst_icms}
                                onChange={(event) => setForm((current) => ({ ...current, cst_icms: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>Alíquota ICMS (%)</span>
                            <input
                                className="ui-input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.icms_rate}
                                onChange={(event) => setForm((current) => ({ ...current, icms_rate: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>MVA/IVA ST (%)</span>
                            <input
                                className="ui-input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.st_mva}
                                onChange={(event) => setForm((current) => ({ ...current, st_mva: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>FCP (%)</span>
                            <input
                                className="ui-input"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.st_fcp}
                                onChange={(event) => setForm((current) => ({ ...current, st_fcp: event.target.value }))}
                            />
                        </label>
                    </div>

                    <span className="ui-form-section-title">PIS / COFINS</span>
                    <div className="ui-form-grid">
                        <label>
                            <span>CST PIS</span>
                            <input
                                className="ui-input"
                                maxLength={2}
                                value={form.pis_cst}
                                onChange={(event) => setForm((current) => ({ ...current, pis_cst: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>Alíquota PIS (%)</span>
                            <input
                                className="ui-input"
                                type="number"
                                step="0.0001"
                                min="0"
                                value={form.pis_rate}
                                onChange={(event) => setForm((current) => ({ ...current, pis_rate: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>CST COFINS</span>
                            <input
                                className="ui-input"
                                maxLength={2}
                                value={form.cofins_cst}
                                onChange={(event) => setForm((current) => ({ ...current, cofins_cst: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>Alíquota COFINS (%)</span>
                            <input
                                className="ui-input"
                                type="number"
                                step="0.0001"
                                min="0"
                                value={form.cofins_rate}
                                onChange={(event) => setForm((current) => ({ ...current, cofins_rate: event.target.value }))}
                            />
                        </label>
                    </div>

                    <span className="ui-form-section-title">Reforma tributária (IBS/CBS)</span>
                    <div className="ui-form-grid">
                        <label>
                            <span>CST IBS/CBS</span>
                            <input
                                className="ui-input"
                                maxLength={3}
                                value={form.ibs_cbs_cst}
                                onChange={(event) => setForm((current) => ({ ...current, ibs_cbs_cst: event.target.value }))}
                            />
                        </label>
                        <label>
                            <span>Código de classificação tributária</span>
                            <input
                                className="ui-input"
                                maxLength={6}
                                value={form.c_class_trib}
                                onChange={(event) => setForm((current) => ({ ...current, c_class_trib: event.target.value }))}
                            />
                        </label>
                    </div>

                    <label>
                        <span>Observações</span>
                        <textarea
                            className="ui-input"
                            rows={2}
                            value={form.notes}
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                        />
                    </label>

                    {formError ? <span className="tax-rules-form-error">{formError}</span> : null}

                    <div className="tax-rules-actions-bar">
                        <button type="button" className="ui-button-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                </form>
            </ModalForm>
        </AppLayout>
    )
}
