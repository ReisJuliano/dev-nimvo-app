import { useEffect, useState } from 'react'
import './inventory.css'
import PageContainer from '@/Components/UI/PageContainer'
import DenseTable from '@/Components/UI/DenseTable'
import CompactModal from '@/Components/UI/CompactModal'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber, formatDateTime } from '@/lib/format'

const STATUS_LABELS = {
    draft: 'Rascunho',
    counting: 'Em contagem',
    review: 'Em conferência',
    adjusting: 'Aplicando ajustes',
    completed: 'Concluída',
    cancelled: 'Cancelada',
}

function statusLabel(status) {
    return STATUS_LABELS[status] || status
}

function emptyWizardForm() {
    return {
        type: 'general',
        mode: 'snapshot',
        count_resolution: 'manual_review',
        category_ids: [],
        supplier_ids: [],
        notes: '',
    }
}

export default function InventoryIndex({ categories = [], suppliers = [], supervisors = [], canApprove = false }) {
    const [view, setView] = useState('list')
    const [sessions, setSessions] = useState([])
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const [wizardOpen, setWizardOpen] = useState(false)
    const [wizardForm, setWizardForm] = useState(emptyWizardForm())
    const [savingWizard, setSavingWizard] = useState(false)

    const [layoutsOpen, setLayoutsOpen] = useState(false)

    const [session, setSession] = useState(null)
    const [detailTab, setDetailTab] = useState('contagem')
    const [items, setItems] = useState([])
    const [itemsMeta, setItemsMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
    const [itemsPage, setItemsPage] = useState(1)
    const [itemsDivergentOnly, setItemsDivergentOnly] = useState(false)
    const [selectedItemIds, setSelectedItemIds] = useState(new Set())

    const [scanBarcode, setScanBarcode] = useState('')
    const [scanQuantity, setScanQuantity] = useState('1')

    const [resolveTarget, setResolveTarget] = useState(null)
    const [resolveForm, setResolveForm] = useState({ resolution: 'accept_count', resolution_reason: '' })

    const [importLayouts, setImportLayouts] = useState([])
    const [exportLayouts, setExportLayouts] = useState([])
    const [importForm, setImportForm] = useState({ layout_id: '', count_round: 1, file: null })
    const [importResult, setImportResult] = useState(null)
    const [importing, setImporting] = useState(false)

    const [approveModalOpen, setApproveModalOpen] = useState(false)
    const [approveForm, setApproveForm] = useState({ supervisor_user_id: '', supervisor_password: '' })
    const [approving, setApproving] = useState(false)

    function notify(type, text) {
        setFeedback({ type, text })
    }

    async function refreshSessions() {
        setLoading(true)
        try {
            const query = new URLSearchParams(statusFilter ? { status: statusFilter } : {})
            const response = await apiRequest(`/api/inventory/sessions?${query.toString()}`)
            setSessions(response.sessions || [])
        } catch (error) {
            notify('error', error.message)
        } finally {
            setLoading(false)
        }
    }

    async function loadLayouts() {
        try {
            const response = await apiRequest('/api/inventory/collector-layouts')
            const layouts = response.layouts || []
            setImportLayouts(layouts.filter((layout) => layout.direction === 'import'))
            setExportLayouts(layouts.filter((layout) => layout.direction === 'export'))
        } catch (error) {
            notify('error', error.message)
        }
    }

    useEffect(() => {
        void refreshSessions()
        void loadLayouts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    async function openSession(sessionId) {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${sessionId}`)
            setSession(response.session)
            setView('detail')
            setDetailTab('contagem')
            setItemsPage(1)
            setSelectedItemIds(new Set())
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function refreshSession() {
        if (!session) return
        const response = await apiRequest(`/api/inventory/sessions/${session.id}`)
        setSession(response.session)
    }

    async function refreshItems() {
        if (!session) return
        setLoading(true)
        try {
            const query = new URLSearchParams({
                page: String(itemsPage),
                per_page: '50',
                ...(itemsDivergentOnly ? { divergent_only: '1' } : {}),
            })
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/items?${query.toString()}`)
            setItems(response.items || [])
            setItemsMeta(response.meta || { current_page: 1, last_page: 1, total: 0 })
        } catch (error) {
            notify('error', error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (view === 'detail' && session) {
            void refreshItems()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, session?.id, itemsPage, itemsDivergentOnly])

    async function submitWizard(event) {
        event.preventDefault()
        setSavingWizard(true)

        try {
            const response = await apiRequest('/api/inventory/sessions', {
                method: 'post',
                data: {
                    type: wizardForm.type,
                    mode: wizardForm.mode,
                    count_resolution: wizardForm.count_resolution,
                    notes: wizardForm.notes || null,
                    filters: wizardForm.type === 'partial'
                        ? { category_ids: wizardForm.category_ids, supplier_ids: wizardForm.supplier_ids }
                        : null,
                },
            })

            notify('success', response.message)
            setWizardOpen(false)
            setWizardForm(emptyWizardForm())
            await refreshSessions()
            await openSession(response.session.id)
        } catch (error) {
            notify('error', error.message)
        } finally {
            setSavingWizard(false)
        }
    }

    async function startSession() {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/start`, { method: 'post' })
            notify('success', response.message)
            await refreshSession()
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function cancelSession() {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/cancel`, { method: 'post' })
            notify('success', response.message)
            await refreshSession()
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function finishCounting() {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/finish-counting`, { method: 'post' })
            notify('success', response.message)
            await refreshSession()
            setDetailTab('revisao')
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function submitScan(event) {
        event.preventDefault()

        if (!scanBarcode.trim()) return

        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/counts`, {
                method: 'post',
                data: {
                    barcode: scanBarcode.trim(),
                    quantity: Number(scanQuantity || 1),
                    source: 'scanner',
                },
            })
            notify('success', `${response.item.product_name}: contagem registrada.`)
            setScanBarcode('')
            setScanQuantity('1')
            await refreshItems()
        } catch (error) {
            notify('error', error.message)
        }
    }

    function toggleItemSelection(itemId) {
        setSelectedItemIds((current) => {
            const next = new Set(current)
            if (next.has(itemId)) next.delete(itemId)
            else next.add(itemId)
            return next
        })
    }

    async function runBulkAction(endpoint, successMessage) {
        if (selectedItemIds.size === 0) {
            notify('warning', 'Selecione ao menos um item.')
            return
        }

        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/items/${endpoint}`, {
                method: 'post',
                data: { item_ids: Array.from(selectedItemIds) },
            })
            notify('success', response.message || successMessage)
            setSelectedItemIds(new Set())
            await refreshItems()
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function submitResolve(event) {
        event.preventDefault()

        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/items/${resolveTarget.id}/resolve`, {
                method: 'post',
                data: resolveForm,
            })
            notify('success', response.message)
            setResolveTarget(null)
            await refreshItems()
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function submitImport(event) {
        event.preventDefault()

        if (!importForm.file || !importForm.layout_id) {
            notify('warning', 'Selecione o layout e o arquivo para importar.')
            return
        }

        setImporting(true)

        try {
            const data = new FormData()
            data.append('file', importForm.file)
            data.append('layout_id', importForm.layout_id)
            data.append('count_round', importForm.count_round)

            const response = await apiRequest(`/api/inventory/sessions/${session.id}/import`, { method: 'post', data })
            setImportResult(response.batch)
            notify('success', response.message)
            await refreshItems()
        } catch (error) {
            notify('error', error.message)
        } finally {
            setImporting(false)
        }
    }

    function downloadExport(layoutId) {
        window.location.href = `/api/inventory/sessions/${session.id}/export?layout_id=${layoutId}`
    }

    async function requestApproval() {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/approve`, { method: 'post' })
            notify('success', response.message)
            await refreshSession()
        } catch (error) {
            if (error.errors && (error.errors.supervisor_user_id || error.errors.supervisor_password)) {
                setApproveModalOpen(true)
                return
            }
            notify('error', error.message)
        }
    }

    async function submitApproveWithSupervisor(event) {
        event.preventDefault()
        setApproving(true)

        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/approve`, {
                method: 'post',
                data: {
                    supervisor_user_id: Number(approveForm.supervisor_user_id),
                    supervisor_password: approveForm.supervisor_password,
                },
            })
            notify('success', response.message)
            setApproveModalOpen(false)
            setApproveForm({ supervisor_user_id: '', supervisor_password: '' })
            await refreshSession()
        } catch (error) {
            notify('error', error.message)
        } finally {
            setApproving(false)
        }
    }

    const sessionRows = sessions.map((row) => ({
        ...row,
        status_label: statusLabel(row.status),
        created_at_label: formatDateTime(row.created_at),
    }))

    const itemRows = items.map((item) => ({
        ...item,
        selected: selectedItemIds.has(item.id),
        delta_label: item.delta > 0 ? `+${formatNumber(item.delta, { maximumFractionDigits: 3 })}` : formatNumber(item.delta, { maximumFractionDigits: 3 }),
        delta_value_label: formatMoney(item.delta_value),
        status_label: statusLabel(item.status),
    }))

    return (
        <AppLayout title="Inventário">
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                {view === 'list' ? (
                    <>
                        <div className="ui-filter-bar">
                            <label>
                                <span>Status</span>
                                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                                    <option value="">Todos</option>
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </label>
                            <button type="button" className="ui-button-ghost" onClick={() => setLayoutsOpen(true)}>
                                <i className="fa-solid fa-sliders" />
                                Layouts de coletor
                            </button>
                            <button type="button" className="ui-button" onClick={() => setWizardOpen(true)}>
                                <i className="fa-solid fa-plus" />
                                Novo inventário
                            </button>
                        </div>

                        <DenseTable
                            columns={[
                                { key: 'code', label: 'Código' },
                                { key: 'type', label: 'Tipo', render: (row) => (row.type === 'general' ? 'Geral' : 'Parcial') },
                                { key: 'mode', label: 'Modo', render: (row) => (row.mode === 'frozen' ? 'Congelado' : 'Snapshot') },
                                { key: 'status_label', label: 'Status' },
                                { key: 'items_count', label: 'Itens' },
                                { key: 'created_at_label', label: 'Criado em' },
                            ]}
                            rows={sessionRows}
                            rowKey="id"
                            onRowClick={(row) => void openSession(row.id)}
                            emptyState={<p>{loading ? 'Carregando...' : 'Nenhuma sessão de inventário encontrada.'}</p>}
                        />
                    </>
                ) : null}

                {view === 'detail' && session ? (
                    <>
                        <button type="button" className="ui-button-ghost" onClick={() => setView('list')}>
                            <i className="fa-solid fa-arrow-left" /> Voltar
                        </button>

                        <div className="inventory-session-header">
                            <div>
                                <h2>{session.code}</h2>
                                <p>
                                    {session.type === 'general' ? 'Geral' : 'Parcial'} · {session.mode === 'frozen' ? 'Congelado' : 'Snapshot'} · {statusLabel(session.status)}
                                </p>
                            </div>
                            <div className="inventory-session-actions">
                                {session.status === 'draft' ? (
                                    <button type="button" className="ui-button" onClick={startSession}>Iniciar contagem</button>
                                ) : null}
                                {['draft', 'counting', 'review'].includes(session.status) ? (
                                    <button type="button" className="ui-button-ghost" onClick={cancelSession}>Cancelar sessão</button>
                                ) : null}
                                {session.status === 'counting' ? (
                                    <button type="button" className="ui-button" onClick={finishCounting}>Encerrar contagem</button>
                                ) : null}
                                {session.status === 'review' && canApprove ? (
                                    <button type="button" className="ui-button" onClick={requestApproval}>Aprovar e ajustar</button>
                                ) : null}
                            </div>
                        </div>

                        {session.divergence_summary ? (
                            <div className="inventory-summary-cards">
                                <div className="inventory-summary-card"><span>Itens contados</span><strong>{session.divergence_summary.counted_items}</strong></div>
                                <div className="inventory-summary-card"><span>Divergentes</span><strong>{session.divergence_summary.divergent_items}</strong></div>
                                <div className="inventory-summary-card"><span>Sobra</span><strong>{formatMoney(session.divergence_summary.surplus_value)}</strong></div>
                                <div className="inventory-summary-card"><span>Falta</span><strong>{formatMoney(session.divergence_summary.shortage_value)}</strong></div>
                                <div className="inventory-summary-card"><span>Divergência líquida</span><strong>{formatMoney(session.divergence_summary.net_value)}</strong></div>
                                <div className="inventory-summary-card"><span>Acuracidade</span><strong>{session.divergence_summary.accuracy_percent}%</strong></div>
                            </div>
                        ) : null}

                        <div className="inventory-tabs ui-tabs">
                            <button type="button" className={`ui-tab ${detailTab === 'contagem' ? 'active' : ''}`} onClick={() => setDetailTab('contagem')}>Contagem</button>
                            <button type="button" className={`ui-tab ${detailTab === 'importar' ? 'active' : ''}`} onClick={() => setDetailTab('importar')}>Importar/Exportar</button>
                            <button type="button" className={`ui-tab ${detailTab === 'revisao' ? 'active' : ''}`} onClick={() => setDetailTab('revisao')}>Revisão</button>
                        </div>

                        {detailTab === 'contagem' ? (
                            <>
                                {session.status === 'counting' ? (
                                    <form className="inventory-scan-bar" onSubmit={submitScan}>
                                        <label>
                                            <span>Código de barras</span>
                                            <input className="ui-input" autoFocus value={scanBarcode} onChange={(event) => setScanBarcode(event.target.value)} />
                                        </label>
                                        <label>
                                            <span>Quantidade</span>
                                            <input className="ui-input" type="number" step="0.001" min="0.001" value={scanQuantity} onChange={(event) => setScanQuantity(event.target.value)} />
                                        </label>
                                        <button type="submit" className="ui-button">Registrar</button>
                                    </form>
                                ) : (
                                    <p>Esta sessão não está mais em contagem.</p>
                                )}

                                <DenseTable
                                    columns={[
                                        { key: 'product_code', label: 'Código' },
                                        { key: 'product_name', label: 'Produto' },
                                        { key: 'snapshot_quantity', label: 'Sistema', render: (row) => formatNumber(row.snapshot_quantity, { maximumFractionDigits: 3 }) },
                                        { key: 'counted_quantity', label: 'Contado', render: (row) => (row.counted_quantity === null ? '-' : formatNumber(row.counted_quantity, { maximumFractionDigits: 3 })) },
                                        { key: 'status_label', label: 'Status' },
                                    ]}
                                    rows={itemRows}
                                    rowKey="id"
                                    emptyState={<p>{loading ? 'Carregando...' : 'Nenhum item nesta sessão.'}</p>}
                                />

                                {itemsMeta.last_page > 1 ? (
                                    <div className="ui-pagination">
                                        <button type="button" disabled={itemsMeta.current_page <= 1} onClick={() => setItemsPage((current) => Math.max(1, current - 1))}>Anterior</button>
                                        <span>{itemsMeta.current_page} de {itemsMeta.last_page}</span>
                                        <button type="button" disabled={itemsMeta.current_page >= itemsMeta.last_page} onClick={() => setItemsPage((current) => current + 1)}>Próxima</button>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {detailTab === 'importar' ? (
                            <>
                                <h3>Exportar carga</h3>
                                <div className="inventory-bulk-actions">
                                    {exportLayouts.map((layout) => (
                                        <button key={layout.id} type="button" className="ui-button-ghost" onClick={() => downloadExport(layout.id)}>
                                            <i className="fa-solid fa-file-export" /> {layout.name}
                                        </button>
                                    ))}
                                </div>

                                <h3>Importar contagem</h3>
                                <form className="inventory-scan-bar" onSubmit={submitImport}>
                                    <label>
                                        <span>Layout</span>
                                        <select value={importForm.layout_id} onChange={(event) => setImportForm((current) => ({ ...current, layout_id: event.target.value }))}>
                                            <option value="">Selecione</option>
                                            {importLayouts.map((layout) => (
                                                <option key={layout.id} value={layout.id}>{layout.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <span>Rodada</span>
                                        <input className="ui-input" type="number" min="1" max="5" value={importForm.count_round} onChange={(event) => setImportForm((current) => ({ ...current, count_round: event.target.value }))} />
                                    </label>
                                    <label>
                                        <span>Arquivo (.txt)</span>
                                        <input type="file" accept=".txt" onChange={(event) => setImportForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                                    </label>
                                    <button type="submit" className="ui-button" disabled={importing}>{importing ? 'Processando...' : 'Importar'}</button>
                                </form>

                                {importResult ? (
                                    <div className="ui-alert success">
                                        <p>
                                            Total: {importResult.total_lines} · Casadas: {importResult.matched_lines} · Somadas: {importResult.duplicate_lines} · Não encontradas: {importResult.unmatched_lines}
                                        </p>
                                    </div>
                                ) : null}

                                {importResult?.unmatched_payload?.length ? (
                                    <>
                                        <h4>Pendências</h4>
                                        <DenseTable
                                            columns={[
                                                { key: 'barcode', label: 'Código' },
                                                { key: 'quantity', label: 'Quantidade', render: (row) => formatNumber(row.quantity, { maximumFractionDigits: 3 }) },
                                                { key: 'line_count', label: 'Linhas somadas' },
                                            ]}
                                            rows={importResult.unmatched_payload}
                                            rowKey="barcode"
                                            emptyState={<p>Sem pendências.</p>}
                                        />
                                    </>
                                ) : null}
                            </>
                        ) : null}

                        {detailTab === 'revisao' ? (
                            <>
                                <label>
                                    <input type="checkbox" checked={itemsDivergentOnly} onChange={(event) => setItemsDivergentOnly(event.target.checked)} />
                                    {' '}Mostrar somente divergentes
                                </label>

                                <div className="inventory-bulk-actions">
                                    <button type="button" className="ui-button-ghost" onClick={() => runBulkAction('recount', 'Enviado para recontagem.')}>Enviar para recontagem</button>
                                    <button type="button" className="ui-button-ghost" onClick={() => runBulkAction('mark-zero', 'Marcado como contagem zero.')}>Tratar não contados como zero</button>
                                    <button type="button" className="ui-button-ghost" onClick={() => runBulkAction('mark-skipped', 'Marcado como não contado.')}>Marcar como não contado (sem ajuste)</button>
                                </div>

                                <DenseTable
                                    columns={[
                                        {
                                            key: 'selected',
                                            label: '',
                                            className: 'inventory-checkbox-cell',
                                            render: (row) => (
                                                <input
                                                    type="checkbox"
                                                    checked={row.selected}
                                                    onChange={() => toggleItemSelection(row.id)}
                                                    onClick={(event) => event.stopPropagation()}
                                                />
                                            ),
                                        },
                                        { key: 'product_code', label: 'Código' },
                                        { key: 'product_name', label: 'Produto' },
                                        { key: 'snapshot_quantity', label: 'Sistema', render: (row) => formatNumber(row.snapshot_quantity, { maximumFractionDigits: 3 }) },
                                        { key: 'counted_quantity', label: 'Contado', render: (row) => (row.counted_quantity === null ? '-' : formatNumber(row.counted_quantity, { maximumFractionDigits: 3 })) },
                                        {
                                            key: 'delta_label',
                                            label: 'Divergência',
                                            render: (row) => <span className={row.delta > 0 ? 'inventory-divergence-positive' : row.delta < 0 ? 'inventory-divergence-negative' : ''}>{row.delta_label}</span>,
                                        },
                                        { key: 'delta_value_label', label: 'Valor' },
                                        { key: 'status_label', label: 'Status' },
                                    ]}
                                    rows={itemRows}
                                    rowKey="id"
                                    emptyState={<p>{loading ? 'Carregando...' : 'Nenhum item para revisar.'}</p>}
                                    getRowActions={(row) => (['divergent', 'recount'].includes(row.status) ? [
                                        { key: 'resolve', icon: 'fa-check', label: 'Resolver', onClick: () => { setResolveTarget(row); setResolveForm({ resolution: 'accept_count', resolution_reason: '' }) } },
                                    ] : [])}
                                />
                            </>
                        ) : null}
                    </>
                ) : null}
            </PageContainer>

            <CompactModal
                open={wizardOpen}
                title="Novo inventário"
                icon="fa-clipboard-list"
                onClose={() => setWizardOpen(false)}
            >
                <form onSubmit={submitWizard}>
                    <label>
                        <span>Tipo</span>
                        <select value={wizardForm.type} onChange={(event) => setWizardForm((current) => ({ ...current, type: event.target.value }))}>
                            <option value="general">Geral (todos os produtos ativos)</option>
                            <option value="partial">Parcial (filtrado)</option>
                        </select>
                    </label>

                    {wizardForm.type === 'partial' ? (
                        <>
                            <label>
                                <span>Categorias</span>
                                <select multiple value={wizardForm.category_ids} onChange={(event) => setWizardForm((current) => ({ ...current, category_ids: Array.from(event.target.selectedOptions, (option) => Number(option.value)) }))}>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Fornecedores</span>
                                <select multiple value={wizardForm.supplier_ids} onChange={(event) => setWizardForm((current) => ({ ...current, supplier_ids: Array.from(event.target.selectedOptions, (option) => Number(option.value)) }))}>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                    ))}
                                </select>
                            </label>
                        </>
                    ) : null}

                    <label>
                        <span>Modo</span>
                        <select value={wizardForm.mode} onChange={(event) => setWizardForm((current) => ({ ...current, mode: event.target.value }))}>
                            <option value="snapshot">Snapshot (loja continua vendendo)</option>
                            <option value="frozen">Congelado (bloqueia venda dos itens)</option>
                        </select>
                    </label>

                    <label>
                        <span>Regra de resolução de contagens</span>
                        <select value={wizardForm.count_resolution} onChange={(event) => setWizardForm((current) => ({ ...current, count_resolution: event.target.value }))}>
                            <option value="manual_review">Decisão manual do supervisor</option>
                            <option value="two_matching_counts">Duas contagens iguais confirmam</option>
                            <option value="last_count_wins">Última contagem vale</option>
                        </select>
                    </label>

                    <label>
                        <span>Observações</span>
                        <textarea className="ui-input" value={wizardForm.notes} onChange={(event) => setWizardForm((current) => ({ ...current, notes: event.target.value }))} />
                    </label>

                    <div className="inventory-bulk-actions">
                        <button type="button" className="ui-button-ghost" onClick={() => setWizardOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={savingWizard}>{savingWizard ? 'Criando...' : 'Criar sessão'}</button>
                    </div>
                </form>
            </CompactModal>

            <CompactModal
                open={Boolean(resolveTarget)}
                title="Resolver divergência"
                description={resolveTarget?.product_name}
                icon="fa-scale-balanced"
                onClose={() => setResolveTarget(null)}
            >
                {resolveTarget ? (
                    <form onSubmit={submitResolve}>
                        <p>
                            Sistema: {formatNumber(resolveTarget.snapshot_quantity, { maximumFractionDigits: 3 })} · Contado: {formatNumber(resolveTarget.counted_quantity, { maximumFractionDigits: 3 })} · Divergência: {resolveTarget.delta_label}
                        </p>
                        <label>
                            <span>Decisão</span>
                            <select value={resolveForm.resolution} onChange={(event) => setResolveForm((current) => ({ ...current, resolution: event.target.value }))}>
                                <option value="accept_count">Aceitar contagem (ajustar estoque)</option>
                                <option value="keep_system">Manter sistema (ignorar contagem)</option>
                            </select>
                        </label>
                        <label>
                            <span>Motivo</span>
                            <textarea className="ui-input" value={resolveForm.resolution_reason} onChange={(event) => setResolveForm((current) => ({ ...current, resolution_reason: event.target.value }))} required />
                        </label>
                        <div className="inventory-bulk-actions">
                            <button type="button" className="ui-button-ghost" onClick={() => setResolveTarget(null)}>Cancelar</button>
                            <button type="submit" className="ui-button">Resolver</button>
                        </div>
                    </form>
                ) : null}
            </CompactModal>

            <CompactModal
                open={approveModalOpen}
                title="Autorização de supervisor"
                description="A divergência desta sessão exige autorização para aplicar os ajustes."
                icon="fa-user-shield"
                onClose={() => setApproveModalOpen(false)}
            >
                <form onSubmit={submitApproveWithSupervisor}>
                    <label>
                        <span>Supervisor</span>
                        <select value={approveForm.supervisor_user_id} onChange={(event) => setApproveForm((current) => ({ ...current, supervisor_user_id: event.target.value }))} required>
                            <option value="">Selecione</option>
                            {supervisors.map((supervisor) => (
                                <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Senha</span>
                        <input className="ui-input" type="password" value={approveForm.supervisor_password} onChange={(event) => setApproveForm((current) => ({ ...current, supervisor_password: event.target.value }))} required />
                    </label>
                    <div className="inventory-bulk-actions">
                        <button type="button" className="ui-button-ghost" onClick={() => setApproveModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={approving}>{approving ? 'Aprovando...' : 'Autorizar e aplicar'}</button>
                    </div>
                </form>
            </CompactModal>

            <InventoryLayoutsModal open={layoutsOpen} onClose={() => { setLayoutsOpen(false); void loadLayouts() }} />
        </AppLayout>
    )
}

function emptyLayoutForm() {
    return {
        id: null,
        name: '',
        direction: 'import',
        format: 'delimited',
        delimiter: ';',
        decimal_separator: ',',
        has_header: false,
        encoding: 'UTF-8',
        line_ending: 'CRLF',
        fields: [{ name: 'barcode', position: 1, start: 1, length: 14 }, { name: 'quantity', position: 2, start: 15, length: 10 }],
    }
}

function InventoryLayoutsModal({ open, onClose }) {
    const [layouts, setLayouts] = useState([])
    const [form, setForm] = useState(emptyLayoutForm())
    const [sampleLines, setSampleLines] = useState('')
    const [preview, setPreview] = useState(null)
    const [feedback, setFeedback] = useState(null)

    async function refresh() {
        try {
            const response = await apiRequest('/api/inventory/collector-layouts')
            setLayouts(response.layouts || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    useEffect(() => {
        if (open) void refresh()
    }, [open])

    function updateField(index, key, value) {
        setForm((current) => ({
            ...current,
            fields: current.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, [key]: value } : field)),
        }))
    }

    function addField() {
        setForm((current) => ({ ...current, fields: [...current.fields, { name: 'quantity', position: current.fields.length + 1, start: 1, length: 10 }] }))
    }

    function removeField(index) {
        setForm((current) => ({ ...current, fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index) }))
    }

    function buildConfig() {
        const fields = form.fields.map((field) => (
            form.format === 'fixed_width'
                ? { name: field.name, start: Number(field.start), length: Number(field.length), implied_decimals: field.name === 'quantity' ? Number(field.implied_decimals || 0) : undefined }
                : { name: field.name, position: Number(field.position) }
        ))

        return {
            encoding: form.encoding,
            line_ending: form.line_ending,
            has_header: Boolean(form.has_header),
            delimiter: form.delimiter,
            decimal_separator: form.decimal_separator,
            fields,
        }
    }

    async function runPreview() {
        try {
            const response = await apiRequest('/api/inventory/collector-layouts/preview', {
                method: 'post',
                data: {
                    format: form.format,
                    config: buildConfig(),
                    sample_lines: sampleLines.split('\n').filter((line) => line.trim() !== ''),
                },
            })
            setPreview(response.preview)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function saveLayout(event) {
        event.preventDefault()

        try {
            const payload = { name: form.name, direction: form.direction, format: form.format, config: buildConfig() }
            const response = form.id
                ? await apiRequest(`/api/inventory/collector-layouts/${form.id}`, { method: 'put', data: payload })
                : await apiRequest('/api/inventory/collector-layouts', { method: 'post', data: payload })

            setFeedback({ type: 'success', text: response.message })
            setForm(emptyLayoutForm())
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    async function editLayout(layout) {
        const config = layout.config || {}
        setForm({
            id: layout.id,
            name: layout.name,
            direction: layout.direction,
            format: layout.format,
            delimiter: config.delimiter || ';',
            decimal_separator: config.decimal_separator || ',',
            has_header: Boolean(config.has_header),
            encoding: config.encoding || 'UTF-8',
            line_ending: config.line_ending || 'CRLF',
            fields: config.fields || [],
        })
    }

    async function removeLayout(layout) {
        try {
            const response = await apiRequest(`/api/inventory/collector-layouts/${layout.id}`, { method: 'delete' })
            setFeedback({ type: 'success', text: response.message })
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    return (
        <CompactModal open={open} title="Layouts de coletor" icon="fa-sliders" size="lg" onClose={onClose}>
            {feedback ? (
                <div className={`ui-alert ${feedback.type}`}>
                    <p>{feedback.text}</p>
                </div>
            ) : null}

            <DenseTable
                columns={[
                    { key: 'name', label: 'Nome' },
                    { key: 'direction', label: 'Direção', render: (row) => (row.direction === 'import' ? 'Importação' : 'Exportação') },
                    { key: 'format', label: 'Formato', render: (row) => (row.format === 'delimited' ? 'Delimitado' : 'Posicional') },
                    { key: 'is_default', label: 'Padrão', render: (row) => (row.is_default ? 'Sim' : 'Não') },
                ]}
                rows={layouts}
                rowKey="id"
                emptyState={<p>Nenhum layout cadastrado.</p>}
                getRowActions={(row) => [
                    { key: 'edit', icon: 'fa-pen', label: 'Editar', onClick: () => void editLayout(row) },
                    ...(row.is_default ? [] : [{ key: 'delete', icon: 'fa-trash', label: 'Excluir', onClick: () => void removeLayout(row) }]),
                ]}
            />

            <h4>{form.id ? 'Editar layout' : 'Novo layout'}</h4>
            <form onSubmit={saveLayout}>
                <label>
                    <span>Nome</span>
                    <input className="ui-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label>
                    <span>Direção</span>
                    <select value={form.direction} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value }))}>
                        <option value="import">Importação (contagem)</option>
                        <option value="export">Exportação (carga)</option>
                    </select>
                </label>
                <label>
                    <span>Formato</span>
                    <select value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}>
                        <option value="delimited">Delimitado</option>
                        <option value="fixed_width">Posicional</option>
                    </select>
                </label>
                <label>
                    <span>Codificação</span>
                    <select value={form.encoding} onChange={(event) => setForm((current) => ({ ...current, encoding: event.target.value }))}>
                        <option value="UTF-8">UTF-8</option>
                        <option value="ISO-8859-1">ISO-8859-1</option>
                    </select>
                </label>
                {form.format === 'delimited' ? (
                    <>
                        <label>
                            <span>Delimitador</span>
                            <input className="ui-input" value={form.delimiter} onChange={(event) => setForm((current) => ({ ...current, delimiter: event.target.value }))} />
                        </label>
                        <label>
                            <span>Separador decimal</span>
                            <input className="ui-input" value={form.decimal_separator} onChange={(event) => setForm((current) => ({ ...current, decimal_separator: event.target.value }))} />
                        </label>
                        <label>
                            <input type="checkbox" checked={form.has_header} onChange={(event) => setForm((current) => ({ ...current, has_header: event.target.checked }))} />
                            {' '}Possui cabeçalho
                        </label>
                    </>
                ) : null}

                <h5>Campos</h5>
                <div className="inventory-layout-fields">
                    {form.fields.map((field, index) => (
                        <div key={index} className="inventory-layout-field-row">
                            <select value={field.name} onChange={(event) => updateField(index, 'name', event.target.value)}>
                                <option value="barcode">Código de barras</option>
                                <option value="internal_code">Código interno</option>
                                <option value="quantity">Quantidade</option>
                                <option value="description">Descrição</option>
                            </select>
                            {form.format === 'fixed_width' ? (
                                <>
                                    <input className="ui-input" type="number" placeholder="Início" value={field.start || ''} onChange={(event) => updateField(index, 'start', event.target.value)} />
                                    <input className="ui-input" type="number" placeholder="Tamanho" value={field.length || ''} onChange={(event) => updateField(index, 'length', event.target.value)} />
                                    {field.name === 'quantity' ? (
                                        <input className="ui-input" type="number" placeholder="Decimais implícitas" value={field.implied_decimals || ''} onChange={(event) => updateField(index, 'implied_decimals', event.target.value)} />
                                    ) : <span />}
                                </>
                            ) : (
                                <>
                                    <input className="ui-input" type="number" placeholder="Posição" value={field.position || ''} onChange={(event) => updateField(index, 'position', event.target.value)} />
                                    <span />
                                    <span />
                                </>
                            )}
                            <button type="button" className="ui-icon-button" onClick={() => removeField(index)}><i className="fa-solid fa-xmark" /></button>
                        </div>
                    ))}
                </div>
                <button type="button" className="ui-button-ghost" onClick={addField}>+ Adicionar campo</button>

                <h5>Pré-visualização</h5>
                <textarea className="ui-input" rows={3} placeholder="Cole 2-3 linhas de exemplo" value={sampleLines} onChange={(event) => setSampleLines(event.target.value)} />
                <button type="button" className="ui-button-ghost" onClick={runPreview}>Testar layout</button>

                {preview ? (
                    <table className="inventory-preview-table">
                        <thead><tr><th>Código</th><th>Código interno</th><th>Quantidade</th></tr></thead>
                        <tbody>
                            {preview.map((line, index) => (
                                <tr key={index}>
                                    <td>{line.barcode}</td>
                                    <td>{line.internal_code}</td>
                                    <td>{line.quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : null}

                <div className="inventory-bulk-actions">
                    <button type="button" className="ui-button-ghost" onClick={() => setForm(emptyLayoutForm())}>Limpar</button>
                    <button type="submit" className="ui-button">{form.id ? 'Salvar alterações' : 'Criar layout'}</button>
                </div>
            </form>
        </CompactModal>
    )
}
