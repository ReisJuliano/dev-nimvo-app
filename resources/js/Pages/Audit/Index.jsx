import { useEffect, useState } from 'react'
import './audit.css'
import ActionButton from '@/Components/UI/ActionButton'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatDateTime } from '@/lib/format'

function defaultDateRange() {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)

    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    }
}

function buildRows(logs) {
    return (logs || []).map((log) => ({
        id: log.id,
        action_label: log.action_label,
        user_name: log.user_name || 'Sistema',
        auditable: log.auditable_type ? `${log.auditable_type.split('\\').pop()} #${log.auditable_id}` : '-',
        occurred_at: formatDateTime(log.occurred_at),
    }))
}

export default function AuditIndex({ actions = [], users = [] }) {
    const [logs, setLogs] = useState([])
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 })
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [dateRange, setDateRange] = useState(defaultDateRange())
    const [actionFilter, setActionFilter] = useState('')
    const [userFilter, setUserFilter] = useState('')
    const [search, setSearch] = useState('')
    const [detail, setDetail] = useState(null)

    async function refresh() {
        setLoading(true)

        try {
            const query = new URLSearchParams({
                from: dateRange.from,
                to: dateRange.to,
                page: String(page),
                ...(actionFilter ? { action: actionFilter } : {}),
                ...(userFilter ? { user_id: userFilter } : {}),
                ...(search ? { search } : {}),
            })
            const response = await apiRequest(`/api/audit/logs?${query.toString()}`)
            setLogs(response.logs || [])
            setMeta(response.meta || { current_page: 1, last_page: 1, total: 0 })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    async function openDetail(row) {
        try {
            const response = await apiRequest(`/api/audit/logs/${row.id}`)
            setDetail(response.log)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    useEffect(() => {
        void refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, actionFilter, userFilter, dateRange.from, dateRange.to])

    function handleSearchApply(value) {
        setPage(1)
        setSearch(value)
    }

    function handleDateRangeChange(nextRange) {
        setPage(1)
        setDateRange(nextRange)
    }

    function handleReset() {
        setPage(1)
        setSearch('')
        setActionFilter('')
        setUserFilter('')
        setDateRange(defaultDateRange())
    }

    const rows = buildRows(logs)

    return (
        <AppLayout title="Auditoria">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Auditoria"
                        search={{
                            placeholder: 'ID do registro afetado',
                            value: search,
                            onChange: setSearch,
                            onApply: handleSearchApply,
                        }}
                        dateRange={{
                            from: dateRange.from,
                            to: dateRange.to,
                            onChange: handleDateRangeChange,
                        }}
                        onApply={() => { setPage(1); void refresh() }}
                        onReset={handleReset}
                    />

                    {feedback ? (
                        <div className={`ui-alert ${feedback.type}`}>
                            <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                            <p>{feedback.text}</p>
                        </div>
                    ) : null}

                    <div className="audit-select-filters">
                        <label>
                            <span>Ação</span>
                            <select className="ui-select" value={actionFilter} onChange={(event) => { setPage(1); setActionFilter(event.target.value) }}>
                                <option value="">Todas</option>
                                {actions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span>Usuário</span>
                            <select className="ui-select" value={userFilter} onChange={(event) => { setPage(1); setUserFilter(event.target.value) }}>
                                <option value="">Todos</option>
                                {users.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                { key: 'occurred_at', label: 'Quando' },
                                { key: 'action_label', label: 'Ação' },
                                { key: 'user_name', label: 'Usuário' },
                                { key: 'auditable', label: 'Registro afetado' },
                            ]}
                            rows={rows}
                            rowKey="id"
                            onRowClick={(row) => void openDetail(row)}
                            emptyMessage={loading ? 'Carregando...' : 'Nenhum registro de auditoria no período selecionado.'}
                            emptyIcon="fa-clipboard-check"
                        />
                    </section>

                    {meta.last_page > 1 ? (
                        <div className="audit-pagination">
                            <ActionButton
                                icon="fa-chevron-left"
                                tone="secondary"
                                disabled={meta.current_page <= 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                Anterior
                            </ActionButton>
                            <span>{meta.current_page} de {meta.last_page}</span>
                            <ActionButton
                                icon="fa-chevron-right"
                                tone="secondary"
                                disabled={meta.current_page >= meta.last_page}
                                onClick={() => setPage((current) => current + 1)}
                            >
                                Próxima
                            </ActionButton>
                        </div>
                    ) : null}
                </div>
            </div>

            <CompactModal
                open={Boolean(detail)}
                title={detail?.action_label}
                description={detail ? `${detail.user_name || 'Sistema'} · ${formatDateTime(detail.occurred_at)}` : null}
                icon="fa-clipboard-check"
                size="lg"
                onClose={() => setDetail(null)}
            >
                {detail ? (
                    <div className="audit-detail-grid">
                        <div>
                            <h4>Antes</h4>
                            <pre>{detail.before ? JSON.stringify(detail.before, null, 2) : '—'}</pre>
                        </div>
                        <div>
                            <h4>Depois</h4>
                            <pre>{detail.after ? JSON.stringify(detail.after, null, 2) : '—'}</pre>
                        </div>
                        {detail.metadata ? (
                            <div className="audit-detail-metadata">
                                <h4>Detalhes</h4>
                                <pre>{JSON.stringify(detail.metadata, null, 2)}</pre>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </CompactModal>
        </AppLayout>
    )
}
