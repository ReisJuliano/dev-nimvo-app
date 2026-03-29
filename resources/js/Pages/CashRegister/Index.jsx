import { useState } from 'react'
import ActiveRegisterPanel from '@/Components/CashRegister/ActiveRegisterPanel'
import OpenRegisterCard from '@/Components/CashRegister/OpenRegisterCard'
import RegisterHistoryTable from '@/Components/CashRegister/RegisterHistoryTable'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { formatDateTime, formatMoney } from '@/lib/format'
import './cash-register.css'

const closingPaymentFields = [
    { key: 'cash', label: 'Dinheiro' },
    { key: 'pix', label: 'Pix' },
    { key: 'debit_card', label: 'Cartao de debito' },
    { key: 'credit_card', label: 'Cartao de credito' },
    { key: 'credit', label: 'Crediario' },
]

function buildCloseConferenceModal(report) {
    const paymentTotals = Object.fromEntries(report.payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]))

    return {
        report,
        form: {
            notes: report.cashRegister.closing_notes || '',
            amounts: {
                cash: '',
                pix: String(Number(paymentTotals.pix || 0).toFixed(2)),
                debit_card: String(Number(paymentTotals.debit_card || 0).toFixed(2)),
                credit_card: String(Number(paymentTotals.credit_card || 0).toFixed(2)),
                credit: String(Number(paymentTotals.credit || 0).toFixed(2)),
            },
        },
    }
}

export default function CashRegisterIndex({ openRegister, history, settings }) {
    const [loading, setLoading] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [reportModal, setReportModal] = useState(null)
    const [closeConferenceModal, setCloseConferenceModal] = useState(null)
    const [refreshAfterClose, setRefreshAfterClose] = useState(false)
    const [activeTab, setActiveTab] = useState(openRegister ? 'active' : 'history')
    const requireConference = settings?.cash_closing?.require_conference !== false

    function closeReportModal() {
        setReportModal(null)

        if (refreshAfterClose) {
            window.location.reload()
        }
    }

    function closeConference() {
        setCloseConferenceModal(null)
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
                closing_totals: {
                    cash: Number(formData.get('closing_amount') || 0),
                },
            },
        })

        setRefreshAfterClose(true)
        setReportModal(response.report)
    }

    function handleStartCloseConference() {
        if (!openRegister) {
            return
        }

        setCloseConferenceModal(buildCloseConferenceModal(openRegister))
    }

    function handleCloseConferenceAmountChange(field, value) {
        setCloseConferenceModal((current) => (
            current
                ? {
                    ...current,
                    form: {
                        ...current.form,
                        amounts: {
                            ...current.form.amounts,
                            [field]: value,
                        },
                    },
                }
                : current
        ))
    }

    function handleCloseConferenceNotesChange(value) {
        setCloseConferenceModal((current) => (
            current
                ? {
                    ...current,
                    form: {
                        ...current.form,
                        notes: value,
                    },
                }
                : current
        ))
    }

    async function handleConfirmCloseConference(event) {
        event.preventDefault()

        if (!openRegister || !closeConferenceModal) {
            return
        }

        if (closeConferenceModal.form.amounts.cash === '') {
            return
        }

        setClosingCashRegister(true)

        try {
            const response = await apiRequest(`/api/cash-registers/${openRegister.cashRegister.id}/close`, {
                method: 'post',
                data: {
                    closing_amount: Number(closeConferenceModal.form.amounts.cash || 0),
                    closing_notes: closeConferenceModal.form.notes || null,
                    closing_totals: Object.fromEntries(
                        Object.entries(closeConferenceModal.form.amounts).map(([key, value]) => [key, Number(value || 0)]),
                    ),
                },
            })

            setCloseConferenceModal(null)
            setRefreshAfterClose(true)
            setReportModal(response.report)
        } finally {
            setClosingCashRegister(false)
        }
    }

    async function handleViewReport(id) {
        const response = await apiRequest(`/api/cash-registers/${id}/report`)
        setRefreshAfterClose(false)
        setReportModal(response.report)
    }

    const closeConferenceRows = closeConferenceModal
        ? closingPaymentFields.map((field) => {
            const breakdown = closeConferenceModal.report.closing_breakdown.find(
                (row) => row.payment_method === field.key,
            )
            const rawInformed = closeConferenceModal.form.amounts[field.key]
            const informed = rawInformed === '' ? null : Number(rawInformed || 0)
            const expected = Number(breakdown?.expected || 0)

            return {
                ...field,
                expected,
                informed,
                difference: informed === null ? null : informed - expected,
            }
        })
        : []

    return (
        <AppLayout title="Caixa">
            <div className="cash-register-page">
                <section className="cash-register-hero ui-card">
                    <div className="ui-card-body">
                        <div className="cash-register-hero-grid">
                            <div>
                                <span className={`ui-badge ${openRegister ? 'success' : 'warning'}`}>
                                    {openRegister ? 'Caixa aberto' : 'Caixa aguardando abertura'}
                                </span>
                                <h1>Pos-conferencia de caixa</h1>
                                <p>Acompanhe abertura, sangrias, fechamento e consulte qualquer conferencia ja realizada.</p>
                            </div>
                            <div className="cash-register-hero-metrics">
                                <div>
                                    <small>Historico</small>
                                    <strong>{history.length}</strong>
                                </div>
                                <div>
                                    <small>Conferencia guiada</small>
                                    <strong>{requireConference ? 'Obrigatoria' : 'Opcional'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="ui-tabs">
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveTab('active')}
                    >
                        <i className="fa-solid fa-vault" />
                        <span>Operacao</span>
                    </button>
                    <button
                        type="button"
                        className={`ui-tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <i className="fa-solid fa-clock-rotate-left" />
                        <span>Historico</span>
                    </button>
                </section>

                {activeTab === 'active' ? (
                    openRegister ? (
                        <ActiveRegisterPanel
                            report={openRegister}
                            onMovement={handleMovement}
                            onClose={handleClose}
                            onStartCloseConference={handleStartCloseConference}
                            requireConference={requireConference}
                        />
                    ) : (
                        <OpenRegisterCard onSubmit={handleOpen} loading={loading} />
                    )
                ) : null}

                {activeTab === 'history' ? (
                    <RegisterHistoryTable history={history} onViewReport={handleViewReport} />
                ) : null}
            </div>

            {closeConferenceModal ? (
                <div className="cash-register-report-backdrop" onClick={closeConference}>
                    <form
                        className="cash-register-report-card"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={handleConfirmCloseConference}
                    >
                        <div className="cash-register-report-header">
                            <div>
                                <h2>Conferencia de fechamento</h2>
                                <p>Revise cada forma de pagamento, incluindo o impacto das sangrias como saida de dinheiro.</p>
                            </div>
                            <button className="cash-register-primary-button" type="button" onClick={closeConference}>
                                Cancelar
                            </button>
                        </div>

                        <div className="cash-register-report-section">
                            <div className="cash-register-breakdown-grid">
                                {closeConferenceRows.map((row) => (
                                    <article key={row.key} className="cash-register-breakdown-card">
                                        <div className="cash-register-breakdown-top">
                                            <strong>{row.label}</strong>
                                            <span>{formatMoney(row.expected)}</span>
                                        </div>
                                        <label>
                                            Valor informado
                                            <input
                                                className="ui-input"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={closeConferenceModal.form.amounts[row.key]}
                                                onChange={(event) => handleCloseConferenceAmountChange(row.key, event.target.value)}
                                            />
                                        </label>
                                        <div className={`cash-register-difference-pill ${Math.abs(row.difference || 0) > 0.009 ? 'alert' : ''}`}>
                                            <small>Diferenca</small>
                                            <strong>{row.difference === null ? 'A conferir' : formatMoney(row.difference)}</strong>
                                        </div>
                                    </article>
                                ))}
                            </div>
                            <label>
                                Observacao do fechamento
                                <textarea
                                    rows="3"
                                    value={closeConferenceModal.form.notes}
                                    onChange={(event) => handleCloseConferenceNotesChange(event.target.value)}
                                />
                            </label>
                        </div>

                        <div className="cash-register-modal-actions">
                            <button className="cash-register-primary-button" type="button" onClick={closeConference}>
                                Voltar
                            </button>
                            <button className="cash-register-danger-button" type="submit" disabled={closingCashRegister}>
                                <i className="fa-solid fa-lock" />
                                {closingCashRegister ? 'Fechando...' : 'Confirmar fechamento'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            {reportModal ? (
                <div className="cash-register-report-backdrop" onClick={closeReportModal}>
                    <div className="cash-register-report-card" onClick={(event) => event.stopPropagation()}>
                        <div className="cash-register-report-header">
                            <div>
                                <h2>Relatorio do fechamento</h2>
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
                                <span>Base de caixa</span>
                                <strong>{formatMoney(reportModal.expected_cash)}</strong>
                            </div>
                            <div className="cash-register-report-box">
                                <span>Contado em dinheiro</span>
                                <strong>{formatMoney(reportModal.cashRegister.closing_amount)}</strong>
                            </div>
                            <div className="cash-register-report-box">
                                <span>Diferenca em dinheiro</span>
                                <strong>{formatMoney(reportModal.difference)}</strong>
                            </div>
                        </div>

                        <div className="cash-register-report-section">
                            <h3>Pos-conferencia por valor</h3>
                            <div className="cash-register-breakdown-grid">
                                {reportModal.closing_breakdown?.length ? (
                                    reportModal.closing_breakdown.map((row) => (
                                        <article key={row.payment_method} className="cash-register-breakdown-card">
                                            <div className="cash-register-breakdown-top">
                                                <strong>{row.label}</strong>
                                                <span>{row.recorded_at ? formatDateTime(row.recorded_at) : 'Sem data'}</span>
                                            </div>
                                            <div className="cash-register-breakdown-values">
                                                <div>
                                                    <small>Esperado</small>
                                                    <strong>{formatMoney(row.expected)}</strong>
                                                </div>
                                                <div>
                                                    <small>Informado</small>
                                                    <strong>{row.informed === null ? 'Nao informado' : formatMoney(row.informed)}</strong>
                                                </div>
                                                <div className={Math.abs(row.difference || 0) > 0.009 ? 'alert' : ''}>
                                                    <small>Diferenca</small>
                                                    <strong>{row.difference === null ? 'Nao conferido' : formatMoney(row.difference)}</strong>
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                ) : (
                                    <div className="cash-register-empty">Nenhuma pos-conferencia registrada neste fechamento.</div>
                                )}
                            </div>
                        </div>

                        <div className="cash-register-report-section">
                            <h3>Formas de pagamento das vendas</h3>
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
                            <h3>Movimentacoes do caixa</h3>
                            <div className="cash-register-summary-grid">
                                <article className="tone-primary">
                                    <span>Abertura</span>
                                    <strong>{formatMoney(reportModal.cashRegister.opening_amount)}</strong>
                                </article>
                                <article className="tone-success">
                                    <span>Suprimentos</span>
                                    <strong>{formatMoney(reportModal.total_supplies)}</strong>
                                </article>
                                <article className="tone-danger">
                                    <span>Sangrias</span>
                                    <strong>{formatMoney(reportModal.total_withdrawals)}</strong>
                                </article>
                                <article className="tone-info">
                                    <span>Dinheiro vendido</span>
                                    <strong>{formatMoney(reportModal.cash_sales)}</strong>
                                </article>
                            </div>

                            <div className="cash-register-movements-list compact">
                                {reportModal.movements.length ? (
                                    reportModal.movements.map((movement) => (
                                        <div key={movement.id} className="cash-register-movement-row">
                                            <div>
                                                <strong>{movement.type === 'withdrawal' ? 'Sangria' : 'Suprimento'}</strong>
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

                        {reportModal.cashRegister.closing_notes ? (
                            <div className="cash-register-report-section">
                                <h3>Observacao do fechamento</h3>
                                <div className="cash-register-empty">{reportModal.cashRegister.closing_notes}</div>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </AppLayout>
    )
}
