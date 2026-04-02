import { Link } from '@inertiajs/react'
import { useState } from 'react'
import ActiveRegisterPanel from '@/Components/CashRegister/ActiveRegisterPanel'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import OpenRegisterCard from '@/Components/CashRegister/OpenRegisterCard'
import PendingOrderDraftsModal from '@/Components/CashRegister/PendingOrderDraftsModal'
import RegisterHistoryTable from '@/Components/CashRegister/RegisterHistoryTable'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest } from '@/lib/http'
import { buildCloseCashRegisterModal, buildCloseCashRegisterRows } from '@/lib/cashRegister'
import { formatMoney } from '@/lib/format'
import './cash-register.css'

export default function CashRegisterIndex({ openRegister, history, pendingOrderDrafts = [], settings }) {
    const [loading, setLoading] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [reportModal, setReportModal] = useState(null)
    const [closeConferenceModal, setCloseConferenceModal] = useState(null)
    const [pendingOrdersModalOpen, setPendingOrdersModalOpen] = useState(false)
    const [refreshAfterClose, setRefreshAfterClose] = useState(false)
    const [activeTab, setActiveTab] = useState(openRegister ? 'active' : 'history')
    const requireConference = settings?.cash_closing?.require_conference !== false
    const pendingOrdersCount = pendingOrderDrafts.length

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

        setCloseConferenceModal(buildCloseCashRegisterModal(openRegister))
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

    const closeConferenceRows = buildCloseCashRegisterRows(closeConferenceModal, true)

    return (
        <AppLayout title="Caixa">
            <div className="cash-register-page">
                <section className="cash-register-hero ui-card">
                    <div className="ui-card-body">
                        <div className="cash-register-hero-grid">
                            <div>
                                <span className={`ui-badge ${openRegister ? 'success' : 'warning'}`}>
                                    {openRegister ? 'Caixa aberto' : 'Caixa fechado'}
                                </span>
                                <h1>Caixa</h1>
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
                        <span>Atual</span>
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

                <div className="cash-register-workspace">
                    <div className="cash-register-main-column">
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

                    <aside className="cash-register-side-rail">
                        <section className="cash-register-card cash-register-side-card">
                            <div className="cash-register-section-header">
                                <div>
                                    <span className="cash-register-section-kicker">Acesso rapido</span>
                                    <h2>Atalhos laterais</h2>
                                    <p>Abra o PDV ou confira as comandas prontas para cobranca sem sair do caixa.</p>
                                </div>
                            </div>

                            <div className="cash-register-side-actions">
                                <Link href="/pdv" className="cash-register-primary-button cash-register-side-action">
                                    <span className="cash-register-side-action-copy">
                                        <i className="fa-solid fa-cash-register" />
                                        <span>Abrir PDV</span>
                                    </span>
                                    <small>Ir para vendas</small>
                                </Link>

                                <button
                                    type="button"
                                    className="cash-register-side-action cash-register-side-action-secondary"
                                    onClick={() => setPendingOrdersModalOpen(true)}
                                >
                                    <span className="cash-register-side-action-copy">
                                        <i className="fa-solid fa-receipt" />
                                        <span>Comandas disponiveis</span>
                                    </span>
                                    <strong className="cash-register-side-action-count">{pendingOrdersCount}</strong>
                                </button>
                            </div>
                        </section>
                    </aside>
                </div>
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
                                <p>Revise os totais antes de concluir o fechamento.</p>
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

            <ClosingReportModal report={reportModal} onClose={closeReportModal} />
            <PendingOrderDraftsModal
                open={pendingOrdersModalOpen}
                orders={pendingOrderDrafts}
                onClose={() => setPendingOrdersModalOpen(false)}
            />
        </AppLayout>
    )
}
