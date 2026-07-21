import { useEffect, useState } from 'react'
import './inventory.css'
import ActionButton from '@/Components/UI/ActionButton'
import CompactModal from '@/Components/UI/CompactModal'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatNumber } from '@/lib/format'
import SessionListView from './components/SessionListView'
import SessionHero from './components/SessionHero'
import CategoryProgress from './components/CategoryProgress'
import CountingConsole from './components/CountingConsole'
import ItemsTable from './components/ItemsTable'
import ReconciliationDrawer from './components/ReconciliationDrawer'
import ImportExportPanel from './components/ImportExportPanel'
import LayoutsModal from './components/LayoutsModal'
import NewSessionWizard, { emptyWizardForm } from './components/NewSessionWizard'

export default function InventoryIndex({ categories = [], suppliers = [], supervisors = [], canApprove = false }) {
    const [view, setView] = useState('list')
    const [sessions, setSessions] = useState([])
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [accuracyHistory, setAccuracyHistory] = useState([])

    const [wizardOpen, setWizardOpen] = useState(false)
    const [wizardForm, setWizardForm] = useState(emptyWizardForm())
    const [savingWizard, setSavingWizard] = useState(false)

    const [layoutsOpen, setLayoutsOpen] = useState(false)

    const [session, setSession] = useState(null)
    const [detailTab, setDetailTab] = useState('contagem')
    const [progress, setProgress] = useState({ category_progress: [], movement_breakdown: {} })
    const [items, setItems] = useState([])
    const [itemsMeta, setItemsMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
    const [itemsPage, setItemsPage] = useState(1)
    const [itemsDivergentOnly, setItemsDivergentOnly] = useState(false)
    const [selectedItemIds, setSelectedItemIds] = useState(new Set())

    const [resolveTarget, setResolveTarget] = useState(null)
    const [resolveForm, setResolveForm] = useState({ resolution: 'accept_count', resolution_reason: '' })

    const [reconciliationTarget, setReconciliationTarget] = useState(null)
    const [reconciliationData, setReconciliationData] = useState(null)
    const [reconciliationLoading, setReconciliationLoading] = useState(false)

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

    async function refreshAccuracyHistory() {
        try {
            const response = await apiRequest('/api/inventory/sessions-accuracy-history')
            setAccuracyHistory(response.history || [])
        } catch {
            setAccuracyHistory([])
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
        void refreshAccuracyHistory()
        void loadLayouts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    async function refreshProgress(sessionId) {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${sessionId}/progress`)
            setProgress({ category_progress: response.category_progress || [], movement_breakdown: response.movement_breakdown || {} })
        } catch {
            setProgress({ category_progress: [], movement_breakdown: {} })
        }
    }

    async function openSession(sessionId) {
        try {
            const response = await apiRequest(`/api/inventory/sessions/${sessionId}`)
            setSession(response.session)
            setView('detail')
            setDetailTab('contagem')
            setItemsPage(1)
            setSelectedItemIds(new Set())
            await refreshProgress(sessionId)
        } catch (error) {
            notify('error', error.message)
        }
    }

    async function refreshSession() {
        if (!session) return
        const response = await apiRequest(`/api/inventory/sessions/${session.id}`)
        setSession(response.session)
        await refreshProgress(session.id)
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
                    blind_count: wizardForm.blind_count,
                    notes: wizardForm.notes || null,
                    filters: wizardForm.type === 'partial'
                        ? { category_ids: wizardForm.category_ids, supplier_ids: wizardForm.supplier_ids, product_ids: wizardForm.product_ids }
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
            await refreshItems()
            setDetailTab('revisao')
        } catch (error) {
            notify('error', error.message)
        }
    }

    function handleScanned() {
        void refreshSession()
        void refreshItems()
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

    async function openReconciliation(item) {
        setReconciliationTarget(item)
        setReconciliationData(null)
        setReconciliationLoading(true)

        try {
            const response = await apiRequest(`/api/inventory/sessions/${session.id}/items/${item.id}/reconciliation`)
            setReconciliationData(response.reconciliation)
        } catch (error) {
            notify('error', error.message)
        } finally {
            setReconciliationLoading(false)
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

    const blind = Boolean(session?.blind_count) && session?.status === 'counting'

    return (
        <AppLayout title="Inventário">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                {view === 'list' ? (
                    <SessionListView
                        sessions={sessions}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        loading={loading}
                        accuracyHistory={accuracyHistory}
                        onOpenSession={(id) => void openSession(id)}
                        onOpenWizard={() => setWizardOpen(true)}
                        onOpenLayouts={() => setLayoutsOpen(true)}
                    />
                ) : null}

                {view === 'detail' && session ? (
                    <>
                        <ActionButton icon="fa-arrow-left" tone="secondary" className="ivs-back" onClick={() => setView('list')}>
                            Voltar
                        </ActionButton>

                        <SessionHero
                            session={session}
                            movementBreakdown={progress.movement_breakdown}
                            actions={(
                                <>
                                    {session.status === 'draft' ? (
                                        <ActionButton onClick={startSession}>Iniciar contagem</ActionButton>
                                    ) : null}
                                    {['draft', 'counting', 'review'].includes(session.status) ? (
                                        <ActionButton tone="secondary" onClick={cancelSession}>Cancelar sessão</ActionButton>
                                    ) : null}
                                    {session.status === 'counting' ? (
                                        <ActionButton onClick={finishCounting}>Encerrar contagem</ActionButton>
                                    ) : null}
                                    {session.status === 'review' && canApprove ? (
                                        <ActionButton onClick={requestApproval}>Aprovar e ajustar</ActionButton>
                                    ) : null}
                                </>
                            )}
                        />

                        <CategoryProgress categories={progress.category_progress} />

                        <div className="ivs-tabs ui-tabs">
                            <button type="button" className={`ui-tab ${detailTab === 'contagem' ? 'active' : ''}`} onClick={() => setDetailTab('contagem')}>Contagem</button>
                            <button type="button" className={`ui-tab ${detailTab === 'importar' ? 'active' : ''}`} onClick={() => setDetailTab('importar')}>Importar/Exportar</button>
                            <button type="button" className={`ui-tab ${detailTab === 'revisao' ? 'active' : ''}`} onClick={() => setDetailTab('revisao')}>Revisão</button>
                        </div>

                        {detailTab === 'contagem' ? (
                            <>
                                {session.status === 'counting' ? (
                                    <CountingConsole
                                        sessionId={session.id}
                                        blind={blind}
                                        onScanned={handleScanned}
                                        onError={(message) => notify('error', message)}
                                    />
                                ) : (
                                    <div className="ui-alert info"><p>Esta sessão não está mais em contagem.</p></div>
                                )}

                                <ItemsTable items={items} blind={blind} loading={loading} />

                                {itemsMeta.last_page > 1 ? (
                                    <div className="ui-pagination">
                                        <ActionButton icon="fa-chevron-left" tone="secondary" disabled={itemsMeta.current_page <= 1} onClick={() => setItemsPage((current) => Math.max(1, current - 1))}>Anterior</ActionButton>
                                        <span>{itemsMeta.current_page} de {itemsMeta.last_page}</span>
                                        <ActionButton icon="fa-chevron-right" tone="secondary" disabled={itemsMeta.current_page >= itemsMeta.last_page} onClick={() => setItemsPage((current) => current + 1)}>Próxima</ActionButton>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        {detailTab === 'importar' ? (
                            <ImportExportPanel
                                exportLayouts={exportLayouts}
                                importLayouts={importLayouts}
                                importForm={importForm}
                                setImportForm={setImportForm}
                                importResult={importResult}
                                importing={importing}
                                onSubmitImport={submitImport}
                                onDownloadExport={downloadExport}
                            />
                        ) : null}

                        {detailTab === 'revisao' ? (
                            <>
                                <label className="ivs-divergent-toggle">
                                    <input type="checkbox" checked={itemsDivergentOnly} onChange={(event) => setItemsDivergentOnly(event.target.checked)} />
                                    {' '}Mostrar somente divergentes
                                </label>

                                <div className="ivs-bulk-actions">
                                    <ActionButton tone="secondary" onClick={() => runBulkAction('recount', 'Enviado para recontagem.')}>Enviar para recontagem</ActionButton>
                                    <ActionButton tone="secondary" onClick={() => runBulkAction('mark-zero', 'Marcado como contagem zero.')}>Tratar não contados como zero</ActionButton>
                                    <ActionButton tone="secondary" onClick={() => runBulkAction('mark-skipped', 'Marcado como não contado.')}>Marcar como não contado (sem ajuste)</ActionButton>
                                </div>

                                <ItemsTable
                                    items={items}
                                    blind={false}
                                    loading={loading}
                                    selectable
                                    selectedIds={selectedItemIds}
                                    onToggleSelect={toggleItemSelection}
                                    onRowClick={(row) => void openReconciliation(row)}
                                    getRowActions={(row) => (['divergent', 'recount'].includes(row.status) ? [
                                        { key: 'resolve', icon: 'fa-check', label: 'Resolver', onClick: () => { setResolveTarget(row); setResolveForm({ resolution: 'accept_count', resolution_reason: '' }) } },
                                    ] : [])}
                                />

                                {itemsMeta.last_page > 1 ? (
                                    <div className="ui-pagination">
                                        <ActionButton icon="fa-chevron-left" tone="secondary" disabled={itemsMeta.current_page <= 1} onClick={() => setItemsPage((current) => Math.max(1, current - 1))}>Anterior</ActionButton>
                                        <span>{itemsMeta.current_page} de {itemsMeta.last_page}</span>
                                        <ActionButton icon="fa-chevron-right" tone="secondary" disabled={itemsMeta.current_page >= itemsMeta.last_page} onClick={() => setItemsPage((current) => current + 1)}>Próxima</ActionButton>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                    </>
                ) : null}
                </div>
            </div>

            <NewSessionWizard
                open={wizardOpen}
                form={wizardForm}
                setForm={setWizardForm}
                categories={categories}
                suppliers={suppliers}
                saving={savingWizard}
                onSubmit={submitWizard}
                onClose={() => setWizardOpen(false)}
            />

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
                            Sistema: {formatNumber(resolveTarget.snapshot_quantity, { maximumFractionDigits: 3 })} · Contado: {formatNumber(resolveTarget.counted_quantity, { maximumFractionDigits: 3 })} · Divergência: {resolveTarget.delta > 0 ? '+' : ''}{formatNumber(resolveTarget.delta, { maximumFractionDigits: 3 })}
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
                        <div className="ivs-bulk-actions">
                            <ActionButton tone="secondary" type="button" onClick={() => setResolveTarget(null)}>Cancelar</ActionButton>
                            <ActionButton type="submit">Resolver</ActionButton>
                        </div>
                    </form>
                ) : null}
            </CompactModal>

            <ReconciliationDrawer
                open={Boolean(reconciliationTarget)}
                item={reconciliationTarget}
                data={reconciliationData}
                loading={reconciliationLoading}
                onClose={() => setReconciliationTarget(null)}
            />

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
                    <div className="ivs-bulk-actions">
                        <ActionButton tone="secondary" type="button" onClick={() => setApproveModalOpen(false)}>Cancelar</ActionButton>
                        <ActionButton type="submit" disabled={approving}>{approving ? 'Aprovando...' : 'Autorizar e aplicar'}</ActionButton>
                    </div>
                </form>
            </CompactModal>

            <LayoutsModal open={layoutsOpen} onClose={() => { setLayoutsOpen(false); void loadLayouts() }} />
        </AppLayout>
    )
}
