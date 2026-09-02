import { useEffect, useState } from 'react'
import './receivables.css'
import PageContainer from '@/Components/UI/PageContainer'
import DenseTable from '@/Components/UI/DenseTable'
import CompactModal from '@/Components/UI/CompactModal'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatDateTime } from '@/lib/format'

const BUCKET_LABELS = {
    a_vencer: 'A vencer',
    '1_30': '1-30 dias',
    '31_60': '31-60 dias',
    '61_90': '61-90 dias',
    '90_mais': '+90 dias',
}

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Dinheiro' },
    { value: 'pix', label: 'Pix' },
    { value: 'debit_card', label: 'Cartão de débito' },
    { value: 'credit_card', label: 'Cartão de crédito' },
    { value: 'check', label: 'Cheque' },
]

export default function ReceivablesIndex({ openCashRegisterId = null }) {
    const [rows, setRows] = useState([])
    const [summary, setSummary] = useState({})
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [search, setSearch] = useState('')
    const [bucketFilter, setBucketFilter] = useState('')

    const [statementCustomer, setStatementCustomer] = useState(null)
    const [statement, setStatement] = useState(null)

    const [receiveModalOpen, setReceiveModalOpen] = useState(false)
    const [receiveForm, setReceiveForm] = useState({ customer_id: null, customer_name: '', amount: '', payment_method: 'cash', notes: '' })
    const [receiving, setReceiving] = useState(false)

    async function refresh() {
        setLoading(true)
        try {
            const query = new URLSearchParams({
                ...(search ? { search } : {}),
                ...(bucketFilter ? { aging_bucket: bucketFilter } : {}),
            })
            const response = await apiRequest(`/api/receivables?${query.toString()}`)
            setRows(response.rows || [])
            setSummary(response.summary || {})
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, bucketFilter])

    async function openStatement(row) {
        setStatementCustomer(row)
        try {
            const response = await apiRequest(`/api/receivables/customers/${row.customer_id}/statement`)
            setStatement(response)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        }
    }

    function openReceiveModal(row = null) {
        setReceiveForm({
            customer_id: row?.customer_id || null,
            customer_name: row?.customer_name || '',
            amount: '',
            payment_method: 'cash',
            notes: '',
        })
        setReceiveModalOpen(true)
    }

    async function submitReceive(event) {
        event.preventDefault()

        if (!openCashRegisterId) {
            setFeedback({ type: 'warning', text: 'Abra um caixa antes de registrar o recebimento.' })
            return
        }

        setReceiving(true)

        try {
            const response = await apiRequest('/api/receivables/receive', {
                method: 'post',
                data: {
                    customer_id: receiveForm.customer_id,
                    amount: Number(receiveForm.amount),
                    payment_method: receiveForm.payment_method,
                    cash_register_id: openCashRegisterId,
                    notes: receiveForm.notes || null,
                },
            })
            setFeedback({ type: 'success', text: response.message })
            setReceiveModalOpen(false)
            setStatementCustomer(null)
            await refresh()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setReceiving(false)
        }
    }

    return (
        <AppLayout title="A receber">
            <PageContainer>
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <p>{feedback.text}</p>
                    </div>
                ) : null}

                <div className="receivables-summary-cards">
                    <div className="receivables-summary-card"><span>Total a receber</span><strong>{formatMoney(summary.total)}</strong></div>
                    <div className="receivables-summary-card"><span>Fiado</span><strong>{formatMoney(summary.credit_total)}</strong></div>
                    <div className="receivables-summary-card"><span>Condicional em aberto</span><strong>{formatMoney(summary.conditional_total)}</strong></div>
                    <div className="receivables-summary-card"><span>Entregas não pagas</span><strong>{formatMoney(summary.delivery_total)}</strong></div>
                    <div className="receivables-summary-card"><span>+60 dias</span><strong>{summary.overdue_60_plus || 0} cliente(s)</strong></div>
                </div>

                <div className="ui-filter-bar">
                    <label>
                        <span>Buscar cliente</span>
                        <input className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                </div>
                <p>Clique em um cliente na lista para ver o extrato e registrar um recebimento.</p>

                <div className="receivables-bucket-chips">
                    <button type="button" className={`receivables-bucket-chip ${!bucketFilter ? 'active' : ''}`} onClick={() => setBucketFilter('')}>Todos</button>
                    {Object.entries(BUCKET_LABELS).map(([value, label]) => (
                        <button key={value} type="button" className={`receivables-bucket-chip ${bucketFilter === value ? 'active' : ''}`} onClick={() => setBucketFilter(value)}>
                            {label}
                        </button>
                    ))}
                </div>

                <DenseTable
                    columns={[
                        { key: 'customer_name', label: 'Cliente' },
                        { key: 'credit_balance', label: 'Fiado', render: (row) => formatMoney(row.credit_balance) },
                        { key: 'conditional_balance', label: 'Condicional', render: (row) => formatMoney(row.conditional_balance) },
                        { key: 'delivery_balance', label: 'Entrega', render: (row) => formatMoney(row.delivery_balance) },
                        { key: 'total', label: 'Total', render: (row) => formatMoney(row.total) },
                        { key: 'aging_bucket', label: 'Idade', render: (row) => BUCKET_LABELS[row.aging_bucket] || row.aging_bucket },
                    ]}
                    rows={rows}
                    rowKey="customer_id"
                    onRowClick={(row) => void openStatement(row)}
                    emptyState={<p>{loading ? 'Carregando...' : 'Nenhum saldo a receber no momento.'}</p>}
                />
            </PageContainer>

            <CompactModal
                open={Boolean(statementCustomer)}
                title={statementCustomer?.customer_name}
                description="Extrato de fiado"
                icon="fa-file-invoice-dollar"
                size="lg"
                onClose={() => { setStatementCustomer(null); setStatement(null) }}
                footer={
                    <button type="button" className="ui-button" onClick={() => openReceiveModal(statementCustomer)}>
                        Registrar recebimento
                    </button>
                }
            >
                {statement ? (
                    <>
                        <p>Limite: {formatMoney(statement.customer.credit_limit)} · Saldo atual: {formatMoney(statement.current_balance)}</p>
                        <table className="receivables-statement-table">
                            <thead><tr><th>Data</th><th>Tipo</th><th>Referência</th><th>Valor</th><th>Saldo</th></tr></thead>
                            <tbody>
                                {statement.entries.map((entry, index) => (
                                    <tr key={index}>
                                        <td>{formatDateTime(entry.date)}</td>
                                        <td>{entry.type === 'pagamento' ? 'Pagamento' : 'Venda fiado'}</td>
                                        <td>{entry.reference}</td>
                                        <td className={entry.amount < 0 ? 'receivables-positive' : 'receivables-negative'}>{formatMoney(entry.amount)}</td>
                                        <td>{formatMoney(entry.running_balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : null}
            </CompactModal>

            <CompactModal
                open={receiveModalOpen}
                title="Registrar recebimento"
                icon="fa-hand-holding-dollar"
                onClose={() => setReceiveModalOpen(false)}
            >
                <form onSubmit={submitReceive}>
                    {!openCashRegisterId ? (
                        <div className="ui-alert warning"><p>Abra um caixa antes de registrar recebimentos.</p></div>
                    ) : null}
                    <label>
                        <span>Cliente</span>
                        <input className="ui-input" value={receiveForm.customer_name} disabled placeholder="Selecione um cliente na lista" />
                    </label>
                    <label>
                        <span>Valor recebido</span>
                        <input className="ui-input" type="number" step="0.01" min="0.01" value={receiveForm.amount} onChange={(event) => setReceiveForm((current) => ({ ...current, amount: event.target.value }))} required />
                    </label>
                    <label>
                        <span>Forma de pagamento</span>
                        <select value={receiveForm.payment_method} onChange={(event) => setReceiveForm((current) => ({ ...current, payment_method: event.target.value }))}>
                            {PAYMENT_METHODS.map((method) => (
                                <option key={method.value} value={method.value}>{method.label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Observação</span>
                        <input className="ui-input" value={receiveForm.notes} onChange={(event) => setReceiveForm((current) => ({ ...current, notes: event.target.value }))} />
                    </label>
                    <div className="ui-filter-bar">
                        <button type="button" className="ui-button-ghost" onClick={() => setReceiveModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={receiving || !receiveForm.customer_id}>{receiving ? 'Registrando...' : 'Confirmar recebimento'}</button>
                    </div>
                </form>
            </CompactModal>
        </AppLayout>
    )
}
