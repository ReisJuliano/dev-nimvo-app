import { useEffect, useState } from 'react'
import '../labels.css'
import ActionButton from '@/Components/UI/ActionButton'
import DataTable from '@/Components/UI/DataTable'
import CompactModal from '@/Components/UI/CompactModal'
import PageHeader from '@/Components/UI/PageHeader'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'

const BARCODE_MODE_LABELS = {
    auto: 'Automático (EAN-13 se disponível)',
    ean13: 'Forçar EAN-13',
    code128: 'Forçar Code-128',
    none: 'Não exibir',
}

function emptyForm() {
    return {
        id: null,
        name: '',
        show_name: true,
        show_price: true,
        show_promo: false,
        barcode_mode: 'auto',
        label_width_mm: '66.7',
        label_height_mm: '25.4',
        columns: '3',
        rows: '9',
        margin_left_mm: '4.5',
        margin_top_mm: '13.5',
        gap_x_mm: '3',
        gap_y_mm: '0',
        is_default: false,
    }
}

export default function LabelTemplatesIndex() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm())
    const [saving, setSaving] = useState(false)

    async function refresh() {
        setLoading(true)
        try {
            const response = await apiRequest('/api/labels/templates')
            setTemplates(response.templates || [])
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
        setModalOpen(true)
    }

    function openEdit(template) {
        setForm({
            id: template.id,
            name: template.name,
            show_name: template.show_name,
            show_price: template.show_price,
            show_promo: template.show_promo,
            barcode_mode: template.barcode_mode,
            label_width_mm: String(template.label_width_mm),
            label_height_mm: String(template.label_height_mm),
            columns: String(template.columns),
            rows: String(template.rows),
            margin_left_mm: String(template.margin_left_mm),
            margin_top_mm: String(template.margin_top_mm),
            gap_x_mm: String(template.gap_x_mm),
            gap_y_mm: String(template.gap_y_mm),
            is_default: template.is_default,
        })
        setModalOpen(true)
    }

    function buildPayload() {
        return {
            name: form.name,
            show_name: Boolean(form.show_name),
            show_price: Boolean(form.show_price),
            show_promo: Boolean(form.show_promo),
            barcode_mode: form.barcode_mode,
            label_width_mm: Number(form.label_width_mm),
            label_height_mm: Number(form.label_height_mm),
            columns: Number(form.columns),
            rows: Number(form.rows),
            margin_left_mm: Number(form.margin_left_mm),
            margin_top_mm: Number(form.margin_top_mm),
            gap_x_mm: Number(form.gap_x_mm),
            gap_y_mm: Number(form.gap_y_mm),
            is_default: Boolean(form.is_default),
        }
    }

    async function submitForm(event) {
        event.preventDefault()
        setSaving(true)

        try {
            const payload = buildPayload()
            const response = form.id
                ? await apiRequest(`/api/labels/templates/${form.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/labels/templates', { method: 'post', data: payload })

            setFeedback({ type: 'success', text: response.message })
            setModalOpen(false)
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    async function removeTemplate(template) {
        try {
            const response = await apiRequest(`/api/labels/templates/${template.id}`, { method: 'delete' })
            setFeedback({ type: 'success', text: response.message })
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    const rows = templates.map((template) => ({
        ...template,
        grid_label: `${template.columns}x${template.rows} — ${template.label_width_mm}x${template.label_height_mm}mm`,
        barcode_label: BARCODE_MODE_LABELS[template.barcode_mode] || template.barcode_mode,
    }))

    return (
        <AppLayout title="Padrões de etiqueta">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Padrões de etiqueta"
                        actions={(
                            <>
                                <ActionButton icon="fa-arrow-left" tone="secondary" href="/etiquetas">
                                    Voltar para etiquetas
                                </ActionButton>
                                <ActionButton icon="fa-plus" onClick={openCreate}>
                                    Novo padrão
                                </ActionButton>
                            </>
                        )}
                    />

                    {feedback ? (
                        <div className={`ui-alert ${feedback.type}`}>
                            <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                            <p>{feedback.text}</p>
                        </div>
                    ) : null}

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                { key: 'name', label: 'Nome' },
                                { key: 'grid_label', label: 'Folha / etiqueta' },
                                { key: 'barcode_label', label: 'Código de barras' },
                                { key: 'show_promo', label: 'Promoção (De/Por)', render: (row) => (row.show_promo ? 'Sim' : 'Não') },
                                { key: 'is_default', label: 'Padrão', render: (row) => (row.is_default ? 'Sim' : 'Não') },
                            ]}
                            rows={rows}
                            rowKey="id"
                            onRowClick={(row) => openEdit(row)}
                            emptyMessage={loading ? 'Carregando...' : 'Nenhum padrão de etiqueta cadastrado.'}
                            emptyIcon="fa-barcode"
                            actions={(row) => [
                                { key: 'layout', icon: 'fa-object-group', label: 'Editar layout', href: `/etiquetas/padroes/${row.id}/layout` },
                                { key: 'delete', icon: 'fa-trash', label: 'Excluir', tone: 'danger', onClick: () => void removeTemplate(row) },
                            ]}
                        />
                    </section>
                </div>
            </div>

            <CompactModal
                open={modalOpen}
                title={form.id ? 'Editar padrão de etiqueta' : 'Novo padrão de etiqueta'}
                icon="fa-barcode"
                size="lg"
                onClose={() => setModalOpen(false)}
            >
                <form onSubmit={submitForm}>
                    <label>
                        <span>Nome</span>
                        <input className="ui-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                    </label>

                    <span>Campos exibidos na etiqueta</span>
                    <div className="labels-toolbar">
                        <label>
                            <input type="checkbox" checked={form.show_name} onChange={(event) => setForm((current) => ({ ...current, show_name: event.target.checked }))} />
                            {' '}Nome do produto
                        </label>
                        <label>
                            <input type="checkbox" checked={form.show_price} onChange={(event) => setForm((current) => ({ ...current, show_price: event.target.checked }))} />
                            {' '}Preço
                        </label>
                        <label>
                            <input type="checkbox" checked={form.show_promo} onChange={(event) => setForm((current) => ({ ...current, show_promo: event.target.checked }))} />
                            {' '}Promoção (De/Por)
                        </label>
                    </div>

                    <label>
                        <span>Código de barras</span>
                        <select value={form.barcode_mode} onChange={(event) => setForm((current) => ({ ...current, barcode_mode: event.target.value }))}>
                            {Object.entries(BARCODE_MODE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>

                    <span>Tamanho da etiqueta (mm)</span>
                    <div className="labels-toolbar">
                        <label>
                            <span>Largura</span>
                            <input className="ui-input" type="number" step="0.1" min="10" value={form.label_width_mm} onChange={(event) => setForm((current) => ({ ...current, label_width_mm: event.target.value }))} required />
                        </label>
                        <label>
                            <span>Altura</span>
                            <input className="ui-input" type="number" step="0.1" min="10" value={form.label_height_mm} onChange={(event) => setForm((current) => ({ ...current, label_height_mm: event.target.value }))} required />
                        </label>
                    </div>

                    <span>Grade da folha A4</span>
                    <div className="labels-toolbar">
                        <label>
                            <span>Colunas</span>
                            <input className="ui-input" type="number" min="1" max="10" value={form.columns} onChange={(event) => setForm((current) => ({ ...current, columns: event.target.value }))} required />
                        </label>
                        <label>
                            <span>Linhas</span>
                            <input className="ui-input" type="number" min="1" max="30" value={form.rows} onChange={(event) => setForm((current) => ({ ...current, rows: event.target.value }))} required />
                        </label>
                    </div>

                    <span>Margens e espaçamento da folha (mm)</span>
                    <div className="labels-toolbar">
                        <label>
                            <span>Margem esquerda</span>
                            <input className="ui-input" type="number" step="0.1" min="0" value={form.margin_left_mm} onChange={(event) => setForm((current) => ({ ...current, margin_left_mm: event.target.value }))} required />
                        </label>
                        <label>
                            <span>Margem superior</span>
                            <input className="ui-input" type="number" step="0.1" min="0" value={form.margin_top_mm} onChange={(event) => setForm((current) => ({ ...current, margin_top_mm: event.target.value }))} required />
                        </label>
                        <label>
                            <span>Espaço horizontal</span>
                            <input className="ui-input" type="number" step="0.1" min="0" value={form.gap_x_mm} onChange={(event) => setForm((current) => ({ ...current, gap_x_mm: event.target.value }))} required />
                        </label>
                        <label>
                            <span>Espaço vertical</span>
                            <input className="ui-input" type="number" step="0.1" min="0" value={form.gap_y_mm} onChange={(event) => setForm((current) => ({ ...current, gap_y_mm: event.target.value }))} required />
                        </label>
                    </div>

                    <label>
                        <input type="checkbox" checked={form.is_default} onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} />
                        {' '}Usar como padrão pré-selecionado na tela de etiquetas
                    </label>

                    <div className="labels-actions-bar">
                        <button type="button" className="ui-button-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                </form>
            </CompactModal>
        </AppLayout>
    )
}
