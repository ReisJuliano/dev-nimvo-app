import { useState } from 'react'
import './labels.css'
import ActionButton from '@/Components/UI/ActionButton'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatDateTime } from '@/lib/format'

export default function LabelsIndex({ categories = [], templates = [] }) {
    const [products, setProducts] = useState([])
    const [hasSearched, setHasSearched] = useState(false)
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [pendingOnly, setPendingOnly] = useState(true)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [templateId, setTemplateId] = useState(() => (templates.find((item) => item.is_default) || templates[0])?.id ?? '')
    const [copies, setCopies] = useState(1)
    const [printing, setPrinting] = useState(false)

    async function refresh() {
        setLoading(true)
        setHasSearched(true)
        try {
            const query = new URLSearchParams({
                ...(search ? { search } : {}),
                ...(categoryId ? { category_id: categoryId } : {}),
                ...(pendingOnly ? { pending_only: '1' } : {}),
            })
            const response = await apiRequest(`/api/labels?${query.toString()}`)
            setProducts(response.products || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    function toggleSelection(id) {
        setSelectedIds((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAllVisible() {
        setSelectedIds(new Set(products.map((product) => product.id)))
    }

    async function submitPrint() {
        if (!selectedIds.size) {
            setFeedback({ type: 'warning', text: 'Selecione ao menos um produto.' })
            return
        }

        setPrinting(true)

        try {
            const response = await apiRequest('/api/labels/print', {
                method: 'post',
                data: { product_ids: Array.from(selectedIds), template_id: templateId, copies },
            })
            setFeedback({ type: response.status === 'queued' ? 'success' : 'warning', text: response.message })
            if (response.status === 'queued') {
                setSelectedIds(new Set())
                await refresh()
            }
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setPrinting(false)
        }
    }

    async function downloadPdf() {
        if (!selectedIds.size) {
            setFeedback({ type: 'warning', text: 'Selecione ao menos um produto.' })
            return
        }

        try {
            const response = await window.axios({
                url: '/api/labels/pdf',
                method: 'post',
                data: { product_ids: Array.from(selectedIds), template_id: templateId, copies },
                responseType: 'blob',
            })

            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.download = 'etiquetas.pdf'
            link.click()
            window.URL.revokeObjectURL(url)
            setSelectedIds(new Set())
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    const rows = products.map((product) => ({ ...product, selected: selectedIds.has(product.id) }))

    return (
        <AppLayout title="Etiquetas">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Etiquetas"
                        actions={(
                            <>
                                <ActionButton icon="fa-check-double" tone="secondary" onClick={selectAllVisible}>
                                    Selecionar todos visíveis
                                </ActionButton>
                                <ActionButton icon="fa-sliders" tone="secondary" href="/etiquetas/padroes">
                                    Gerenciar padrões
                                </ActionButton>
                            </>
                        )}
                        search={{
                            placeholder: 'Nome, código ou EAN',
                            value: search,
                            onChange: setSearch,
                            onApply: () => void refresh(),
                        }}
                        onApply={() => void refresh()}
                        applyLabel={loading ? 'Buscando...' : 'Buscar'}
                    />

                    {feedback ? (
                        <div className={`ui-alert ${feedback.type}`}>
                            <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                            <p>{feedback.text}</p>
                        </div>
                    ) : null}

                    <div className="labels-select-filters">
                        <label>
                            <span>Categoria</span>
                            <select className="ui-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                                <option value="">Todas</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                        </label>
                        <label className="labels-checkbox-filter">
                            <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />
                            {' '}Somente pendentes (preço alterado desde a última etiqueta)
                        </label>
                    </div>

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'selected',
                                    label: '',
                                    className: 'labels-checkbox-cell',
                                    render: (row) => (
                                        <input type="checkbox" checked={row.selected} onChange={() => toggleSelection(row.id)} onClick={(event) => event.stopPropagation()} />
                                    ),
                                },
                                { key: 'code', label: 'Código' },
                                { key: 'name', label: 'Produto' },
                                { key: 'sale_price', label: 'Preço', render: (row) => formatMoney(row.sale_price) + (row.sold_by === 'weight' ? '/KG' : '') },
                                {
                                    key: 'pending',
                                    label: 'Etiqueta',
                                    render: (row) => (row.pending
                                        ? <span className="labels-pending-chip">Pendente</span>
                                        : <span>{formatDateTime(row.label_printed_at)}</span>),
                                },
                            ]}
                            rows={rows}
                            rowKey="id"
                            onRowClick={(row) => toggleSelection(row.id)}
                            emptyMessage={loading
                                ? 'Carregando...'
                                : hasSearched
                                    ? 'Nenhum produto encontrado.'
                                    : 'Use os filtros acima e clique em "Buscar" para listar os produtos.'}
                            emptyIcon="fa-tags"
                        />
                    </section>

                    <div className="labels-print-bar">
                        <label>
                            <span>Padrão de etiqueta</span>
                            <select className="ui-select" value={templateId} onChange={(event) => setTemplateId(Number(event.target.value))}>
                                {templates.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Cópias por produto</span>
                            <input className="ui-input" type="number" min="1" max="20" value={copies} onChange={(event) => setCopies(Number(event.target.value) || 1)} style={{ width: '80px' }} />
                        </label>
                        <ActionButton icon="fa-print" onClick={submitPrint} disabled={printing || !templateId}>
                            {printing ? 'Enviando...' : 'Imprimir na térmica'}
                        </ActionButton>
                        <ActionButton icon="fa-file-pdf" tone="secondary" onClick={downloadPdf} disabled={!templateId}>
                            Baixar PDF A4
                        </ActionButton>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
