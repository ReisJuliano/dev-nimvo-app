import { useState } from 'react'
import ActiveRegisterPanel from '@/Components/CashRegister/ActiveRegisterPanel'
import OpenRegisterCard from '@/Components/CashRegister/OpenRegisterCard'
import RegisterHistoryTable from '@/Components/CashRegister/RegisterHistoryTable'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatDateTime, formatMoney } from '@/lib/format'
import './cash-register.css'

export default function CashRegisterIndex({ openRegister, history }) {
    const [loading, setLoading] = useState(false)
    const [reportModal, setReportModal] = useState(null)
    const [refreshAfterClose, setRefreshAfterClose] = useState(false)

    function closeReportModal() {
        setReportModal(null)

        if (refreshAfterClose) {
            window.location.reload()
        }
    }

    async function handleOpen(event) {
        event.preventDefault()
        setLoading(true)

        const formData = new FormData(event.currentTarget)

        try {
            await apiRequest('/api/cash-registers', {
                method: 'post',
                data: {
                    opening_amount: Number(formData.get('opening_amount') || 0),
                    opening_notes: formData.get('opening_notes') || null,
                },
            })

            window.location.reload()
        } finally {
            setLoading(false)
        }
    }

    async function handleMovement(event, type) {
        event.preventDefault()

        if (!openRegister) {
            return
        }

        const formData = new FormData(event.currentTarget)

        await apiRequest(`/api/cash-registers/${openRegister.cashRegister.id}/movements`, {
            method: 'post',
            data: {
                type,
                amount: Number(formData.get('amount') || 0),
                reason: formData.get('reason') || null,
            },
        })

        window.location.reload()
    }

    async function handleClose(event) {
        event.preventDefault()

        if (!openRegister) {
            return
        }

        const formData = new FormData(event.currentTarget)
        const response = await apiRequest(`/api/cash-registers/${openRegister.cashRegister.id}/close`, {
            method: 'post',
            data: {
                closing_amount: Number(formData.get('closing_amount') || 0),
                closing_notes: formData.get('closing_notes') || null,
            },
        })

        setRefreshAfterClose(true)
        setReportModal(response.report)
    }

    async function handleViewReport(id) {
        const response = await apiRequest(`/api/cash-registers/${id}/report`)
        setRefreshAfterClose(false)
        setReportModal(response.report)
    }

    return (
        <AppLayout title="Caixa">
            <div className="cash-register-page">
                {openRegister ? (
                    <ActiveRegisterPanel report={openRegister} onMovement={handleMovement} onClose={handleClose} />
                ) : (
                    <OpenRegisterCard onSubmit={handleOpen} loading={loading} />
                )}

                <RegisterHistoryTable history={history} onViewReport={handleViewReport} />
            </div>

            {reportModal ? (
                <div className="cash-register-report-backdrop" onClick={closeReportModal}>
                    <div className="cash-register-report-card" onClick={(event) => event.stopPropagation()}>
                        <div className="cash-register-report-header">
                            <div>
                                <h2>Relatorio do caixa</h2>
                                <p>
                                    Aberto em {formatDateTime(reportModal.cashRegister.opened_at)} e fechado em{' '}
                                    {formatDateTime(reportModal.cashRegister.closed_at)}
                                </p>
                            </div>
                            <button className="cash-register-primary-button" onClick={closeReportModal}>
                                Fechar
                            </button>
                        </div>

                        <div className="cash-register-report-grid">
                            <div className="cash-register-report-box">
                                <span>Total vendido</span>
                                <strong>{formatMoney(reportModal.total_sales)}</strong>
                            </div>
                            <div className="cash-register-report-box">
                                <span>Dinheiro esperado</span>
                                <strong>{formatMoney(reportModal.expected_cash)}</strong>
                            </div>
                            <div className="cash-register-report-box">
                                <span>Contado</span>
                                <strong>{formatMoney(reportModal.cashRegister.closing_amount)}</strong>
                            </div>
                            <div className="cash-register-report-box">
                                <span>Diferenca</span>
                                <strong>{formatMoney(reportModal.difference)}</strong>
                            </div>
                        </div>

                        <div className="cash-register-report-section">
                            <h3>Formas de pagamento</h3>
                            <div className="cash-register-payments">
                                {reportModal.payments.length ? (
                                    reportModal.payments.map((payment) => (
                                        <article key={payment.payment_method}>
                                            <span>{payment.label}</span>
                                            <strong>{formatMoney(payment.total)}</strong>
                                            <small>{payment.qtd} lancamento(s)</small>
                                        </article>
                                    ))
                                ) : (
                                    <div className="cash-register-empty">Nenhuma venda encontrada neste caixa.</div>
                                )}
                            </div>
                        </div>

                        <div className="cash-register-report-section">
                            <h3>Movimentacoes</h3>
                            <div className="cash-register-movements-list compact">
                                {reportModal.movements.length ? (
                                    reportModal.movements.map((movement) => (
                                        <div key={movement.id} className="cash-register-movement-row">
                                            <div>
                                                <strong>
                                                    {movement.type === 'withdrawal' ? 'Sangria' : 'Suprimento'}
                                                </strong>
                                                <span>{movement.reason || 'Sem observacao'}</span>
                                            </div>
                                            <div>
                                                <strong>{formatMoney(movement.amount)}</strong>
                                                <small>{formatDateTime(movement.created_at)}</small>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="cash-register-empty">Nenhuma movimentacao registrada.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </AppLayout>
    )
}
