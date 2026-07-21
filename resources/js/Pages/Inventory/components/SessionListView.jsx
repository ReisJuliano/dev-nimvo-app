import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ActionButton from '@/Components/UI/ActionButton'
import DataTable from '@/Components/UI/DataTable'
import { formatDateTime, formatNumber } from '@/lib/format'
import { statusLabel, STATUS_LABELS } from '../constants'

function AccuracyHistoryStrip({ history }) {
    if (!history || history.length < 2) {
        return null
    }

    const data = history.map((entry) => ({ code: entry.code, accuracy: entry.accuracy_percent }))

    return (
        <div className="nimvo-card ivs-history-strip">
            <div className="ivs-history-strip-header">
                <i className="fa-solid fa-chart-line" />
                <div>
                    <strong>Evolução da acuracidade</strong>
                    <span>Últimas {history.length} sessões concluídas</span>
                </div>
            </div>
            <div className="ivs-history-chart">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                        <XAxis dataKey="code" tick={{ fontSize: 10 }} interval={0} tickFormatter={(value) => value.split('-').pop()} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={32} />
                        <Tooltip formatter={(value) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, 'Acuracidade']} />
                        <Line type="monotone" dataKey="accuracy" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

export default function SessionListView({ sessions, statusFilter, setStatusFilter, loading, accuracyHistory, onOpenSession, onOpenWizard, onOpenLayouts }) {
    const rows = sessions.map((row) => ({
        ...row,
        status_label: statusLabel(row.status),
        created_at_label: formatDateTime(row.created_at),
    }))

    return (
        <>
            <div className="page-hero page-hero--indigo">
                <div className="page-hero-left">
                    <div className="page-hero-icon">
                        <i className="fa-solid fa-clipboard-list" />
                    </div>
                    <div>
                        <h1 className="page-hero-title">Inventário</h1>
                        <p className="page-hero-sub">Contagem de estoque com a loja aberta — vendas e entradas são descontadas automaticamente</p>
                    </div>
                </div>
                <div className="ivs-hero-actions">
                    <ActionButton icon="fa-sliders" tone="secondary" onClick={onOpenLayouts}>
                        Layouts de coletor
                    </ActionButton>
                    <ActionButton icon="fa-plus" onClick={onOpenWizard}>
                        Novo inventário
                    </ActionButton>
                </div>
            </div>

            <AccuracyHistoryStrip history={accuracyHistory} />

            <div className="ui-filter-bar ivs-list-filter-bar">
                <label>
                    <span>Status</span>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </label>
            </div>

            <DataTable
                columns={[
                    { key: 'code', label: 'Código' },
                    { key: 'type', label: 'Tipo', render: (row) => (row.type === 'general' ? 'Geral' : 'Parcial') },
                    { key: 'mode', label: 'Modo', render: (row) => (row.mode === 'frozen' ? 'Congelado' : 'Snapshot') },
                    { key: 'blind_count', label: 'Cega', render: (row) => (row.blind_count ? 'Sim' : 'Não') },
                    { key: 'status_label', label: 'Status' },
                    { key: 'items_count', label: 'Itens' },
                    { key: 'created_at_label', label: 'Criado em' },
                ]}
                rows={rows}
                rowKey="id"
                onRowClick={(row) => onOpenSession(row.id)}
                emptyMessage={loading ? 'Carregando...' : 'Nenhuma sessão de inventário encontrada.'}
                emptyIcon="fa-clipboard-list"
            />
        </>
    )
}
