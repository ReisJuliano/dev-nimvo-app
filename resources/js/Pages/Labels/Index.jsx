import { useEffect, useState } from 'react'
import './labels.css'
import PageContainer from '@/Components/UI/PageContainer'
import DenseTable from '@/Components/UI/DenseTable'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatDateTime } from '@/lib/format'

const TEMPLATE_LABELS = {
    gondola: 'Gôndola padrão',
    oferta: 'Gôndola de oferta (De/Por)',
    adesiva_ean: 'Adesiva com EAN-13',
    adesiva_interno: 'Adesiva com código interno (Code-128)',
}

export default function LabelsIndex({ categories = [] }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [pendingOnly, setPendingOnly] = useState(true)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [template, setTemplate] = useState('gondola')
    const [copies, setCopies] = useState(1)
    const [preset, setPreset] = useState('pimaco_6180')
    const [printing, setPrinting] = useState(false)

    async function refresh() {
        setLoading(true)
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

    useEffect(() => {
        void refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, categoryId, pendingOnly])

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
                data: { product_ids: Array.from(selectedIds), template, copies },
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
                data: { product_ids: Array.from(selectedIds), template, copies, preset },
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
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                <div className="labels-toolbar">
                    <label>
                        <span>Buscar</span>
                        <input className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, código ou EAN" />
                    </label>
                    <label>
                        <span>Categoria</span>
                        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                            <option value="">Todas</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />
                        {' '}Somente pendentes (preço alterado desde a última etiqueta)
                    </label>
                    <button type="button" className="ui-button-ghost" onClick={selectAllVisible}>Selecionar todos visíveis</button>
                </div>

                <DenseTable
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
                    emptyState={<p>{loading ? 'Carregando...' : 'Nenhum produto encontrado.'}</p>}
                />

                <div className="labels-actions-bar">
                    <label>
                        <span>Modelo</span>
                        <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                            {Object.entries(TEMPLATE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Cópias por produto</span>
                        <input className="ui-input" type="number" min="1" max="20" value={copies} onChange={(event) => setCopies(Number(event.target.value) || 1)} style={{ width: '80px' }} />
                    </label>
                    <button type="button" className="ui-button" onClick={submitPrint} disabled={printing}>
                        <i className="fa-solid fa-print" /> {printing ? 'Enviando...' : 'Imprimir na térmica'}
                    </button>

                    <label>
                        <span>Folha A4</span>
                        <select value={preset} onChange={(event) => setPreset(event.target.value)}>
                            <option value="pimaco_6180">Pimaco 6180 (66,7 x 25,4mm)</option>
                            <option value="pimaco_6081">Pimaco 6081 (99,6 x 57mm)</option>
                        </select>
                    </label>
                    <button type="button" className="ui-button-ghost" onClick={downloadPdf}>
                        <i className="fa-solid fa-file-pdf" /> Baixar PDF A4
                    </button>
                </div>
            </PageContainer>
        </AppLayout>
    )
}
