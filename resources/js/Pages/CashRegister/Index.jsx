import { useState } from 'react'
import ActiveRegisterPanel from '@/Components/CashRegister/ActiveRegisterPanel'
import OpenRegisterCard from '@/Components/CashRegister/OpenRegisterCard'
import RegisterHistoryTable from '@/Components/CashRegister/RegisterHistoryTable'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import './cash-register.css'

export default function CashRegisterIndex({ openRegister, history }) {
    const [loading, setLoading] = useState(false)
    const [reportModal, setReportModal] = useState(null)

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

        setReportModal(response.report)
    }

    async function handleViewReport(id) {
        const response = await apiRequest(`/api/cash-registers/${id}/report`)
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
                <div className="cash-register-report-backdrop" onClick={() => setReportModal(null)}>
                    <div className="cash-register-report-card" onClick={(event) => event.stopPropagation()}>
                        <h2>Relatorio do caixa</h2>
                        <div className="cash-register-report-box">
                            Total vendido: <strong>{formatMoney(reportModal.total_sales)}</strong>
                        </div>
                        <div className="cash-register-report-box">
                            Dinheiro esperado: <strong>{formatMoney(reportModal.expected_cash)}</strong>
                        </div>
                        <div className="cash-register-report-box">
                            Diferenca: <strong>{formatMoney(reportModal.difference)}</strong>
                        </div>
                        <button className="cash-register-primary-button" onClick={() => setReportModal(null)}>
                            Fechar
                        </button>
                    </div>
                </div>
            ) : null}
        </AppLayout>
    )
}
