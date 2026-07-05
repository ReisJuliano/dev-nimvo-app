import { useEffect, useState } from 'react'
import PageContainer from '@/Components/UI/PageContainer'
import DenseTable from '@/Components/UI/DenseTable'
import StatusBadge from '@/Components/UI/StatusBadge'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatDateTime, formatMoney } from '@/lib/format'

function buildOpenRows(registers) {
    return (registers || []).map((register) => ({
        id: register.id,
        till_name: register.till_name,
        user_name: register.user_name || 'Sem operador',
        opened_at: formatDateTime(register.opened_at),
        total_sales: formatMoney(register.total_sales),
        expected_cash: formatMoney(register.expected_cash),
    }))
}

function buildClosedRows(registers) {
    return (registers || []).map((register) => ({
        id: register.id,
        till_name: register.till_name,
        user_name: register.user_name || 'Sem operador',
        opened_at: formatDateTime(register.opened_at),
        closed_at: formatDateTime(register.closed_at),
        total_sales: formatMoney(register.total_sales),
        difference: formatMoney(register.difference),
        tone: Math.abs(Number(register.difference || 0)) > 0.009 ? 'warning' : 'success',
    }))
}

function defaultDateRange() {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 30)

    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    }
}

export default function CashRegisterPanel({ tills = [] }) {
    const [tab, setTab] = useState('open')
    const [openRegisters, setOpenRegisters] = useState([])
    const [closedRegisters, setClosedRegisters] = useState([])
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [tillFilter, setTillFilter] = useState('')
    const [dateRange, setDateRange] = useState(defaultDateRange())

    async function refreshOpen({ quiet = false } = {}) {
        if (!quiet) setLoading(true)

        try {
            const response = await apiRequest('/api/cash-registers/panel/open')
            setOpenRegisters(response.registers || [])
        } catch (error) {
            if (!quiet) setFeedback({ type: 'error', text: error.message })
        } finally {
            if (!quiet) setLoading(false)
        }
    }

    async function refreshClosed() {
        setLoading(true)

        try {
            const query = new URLSearchParams({
                from: dateRange.from,
                to: dateRange.to,
                ...(tillFilter ? { till_id: tillFilter } : {}),
            })
            const response = await apiRequest(`/api/cash-registers/panel/closed?${query.toString()}`)
            setClosedRegisters(response.registers || [])
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void refreshOpen()
        const timer = window.setInterval(() => {
            void refreshOpen({ quiet: true })
        }, 15000)

        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        if (tab === 'closed') {
            void refreshClosed()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, tillFilter, dateRange.from, dateRange.to])

    const openRows = buildOpenRows(openRegisters)
    const closedRows = buildClosedRows(closedRegisters)

    return (
        <AppLayout title="Caixas abertos">
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                <div className="ui-tabs">
                    <button type="button" className={`ui-tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
                        Abertos
                    </button>
                    <button type="button" className={`ui-tab ${tab === 'closed' ? 'active' : ''}`} onClick={() => setTab('closed')}>
                        Fechados
                    </button>
                </div>

                {tab === 'closed' ? (
                    <div className="ui-filter-bar">
                        <label>
                            <span>De</span>
                            <input type="date" value={dateRange.from} onChange={(event) => setDateRange((current) => ({ ...current, from: event.target.value }))} />
                        </label>
                        <label>
                            <span>Até</span>
                            <input type="date" value={dateRange.to} onChange={(event) => setDateRange((current) => ({ ...current, to: event.target.value }))} />
                        </label>
                        <label>
                            <span>Caixa</span>
                            <select value={tillFilter} onChange={(event) => setTillFilter(event.target.value)}>
                                <option value="">Todos</option>
                                {tills.map((till) => (
                                    <option key={till.id} value={till.id}>{till.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : null}

                {tab === 'open' ? (
                    <DenseTable
                        columns={[
                            { key: 'till_name', label: 'Caixa' },
                            { key: 'user_name', label: 'Operador' },
                            { key: 'opened_at', label: 'Abertura' },
                            { key: 'total_sales', label: 'Total vendido' },
                            { key: 'expected_cash', label: 'Esperado em dinheiro' },
                        ]}
                        rows={openRows}
                        rowKey="id"
                        emptyState={<p>{loading ? 'Carregando...' : 'Nenhum caixa aberto no momento.'}</p>}
                    />
                ) : (
                    <DenseTable
                        columns={[
                            { key: 'till_name', label: 'Caixa' },
                            { key: 'user_name', label: 'Operador' },
                            { key: 'opened_at', label: 'Abertura' },
                            { key: 'closed_at', label: 'Fechamento' },
                            { key: 'total_sales', label: 'Total vendido' },
                            {
                                key: 'difference',
                                label: 'Diferença',
                                render: (row) => <StatusBadge compact label={row.difference} tone={row.tone} />,
                            },
                        ]}
                        rows={closedRows}
                        rowKey="id"
                        emptyState={<p>{loading ? 'Carregando...' : 'Nenhum fechamento no período selecionado.'}</p>}
                    />
                )}
            </PageContainer>
        </AppLayout>
    )
}
