import { useEffect, useState } from 'react'
import { usePage } from '@inertiajs/react'
import ActiveRegisterPanel from '@/Components/CashRegister/ActiveRegisterPanel'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import OpenRegisterCard from '@/Components/CashRegister/OpenRegisterCard'
import RegisterHistoryTable from '@/Components/CashRegister/RegisterHistoryTable'
import AppLayout from '@/Layouts/AppLayout'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { buildCloseCashRegisterModal, buildCloseCashRegisterRows } from '@/lib/cashRegister'
import { formatMoney } from '@/lib/format'
import {
    buildOfflineCashRegisterReport,
    configureOfflineWorkspaceBridge,
    createOfflineCashRegister,
    getOfflineWorkspaceSnapshot,
    hasOfflineWorkspaceData,
    hydrateOfflineWorkspace,
    seedOfflineWorkspace,
    subscribeOfflineWorkspace,
    syncOfflineWorkspace,
} from '@/lib/offline/workspace'
import './cash-register.css'

function toCashRegisterSnapshot(report) {
    if (!report?.cashRegister) {
        return null
    }

    return {
        id: report.cashRegister.id,
        user_name: report.cashRegister.user_name || null,
        status: report.cashRegister.status,
        opened_at: report.cashRegister.opened_at,
        opening_amount: report.cashRegister.opening_amount,
        opening_notes: report.cashRegister.opening_notes || null,
    }
}

export default function CashRegisterIndex({ openRegister, history, settings }) {
    const { auth, tenant, localAgentBridge } = usePage().props
    const tenantId = tenant?.id
    const [loading, setLoading] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [reportModal, setReportModal] = useState(null)
    const [closeConferenceModal, setCloseConferenceModal] = useState(null)
    const [refreshAfterClose, setRefreshAfterClose] = useState(false)
    const [activeTab, setActiveTab] = useState(openRegister ? 'active' : 'history')
    const [openRegisterState, setOpenRegisterState] = useState(openRegister)
    const [feedback, setFeedback] = useState(null)
    const requireConference = settings?.cash_closing?.require_conference !== false

    useEffect(() => {
        if (!tenantId) {
            return undefined
        }

        let cancelled = false
        let unsubscribe = () => {}

        const applyWorkspaceState = () => {
            const snapshot = getOfflineWorkspaceSnapshot(tenantId)

            setOpenRegisterState(
                snapshot.cashRegister
                    ? buildOfflineCashRegisterReport(tenantId, {
                        userName: auth?.user?.name,
                        fallbackReport: openRegister,
                    })
                    : null,
            )
        }

        const handleOnline = () => {
            syncOfflineWorkspace(tenantId, apiRequest).catch(() => {})
        }

        const bootstrap = async () => {
            configureOfflineWorkspaceBridge(tenantId, localAgentBridge)
            await hydrateOfflineWorkspace(tenantId).catch(() => {})

            if (cancelled) {
                return
            }

            const shouldSeedSnapshot =
                typeof navigator === 'undefined'
                || navigator.onLine !== false
                || !hasOfflineWorkspaceData(tenantId)

            if (shouldSeedSnapshot) {
                seedOfflineWorkspace(tenantId, {
                    cashRegister: toCashRegisterSnapshot(openRegister),
                })
            }

            if (cancelled) {
                return
            }

            applyWorkspaceState()
            unsubscribe = subscribeOfflineWorkspace(tenantId, () => {
                applyWorkspaceState()
            })
            handleOnline()
        }

        bootstrap()
        window.addEventListener('online', handleOnline)

        return () => {
            cancelled = true
            unsubscribe()
            window.removeEventListener('online', handleOnline)
        }
    }, [auth?.user?.name, localAgentBridge, openRegister, tenantId])

    useEffect(() => {
        if (openRegisterState && activeTab !== 'active') {
            setActiveTab('active')
        }

        if (!openRegisterState && activeTab === 'active') {
            setActiveTab('history')
        }
    }, [activeTab, openRegisterState])

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
        setFeedback(null)

        const formData = new FormData(event.currentTarget)
        const payload = {
            opening_amount: Number(formData.get('opening_amount') || 0),
            opening_notes: formData.get('opening_notes') || null,
        }

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                createOfflineCashRegister(tenantId, payload, { userName: auth?.user?.name })
                setActiveTab('active')
                setFeedback({
                    type: 'warning',
                    text: 'Caixa aberto no modo offline. A sincronizacao sera feita quando a internet voltar.',
                })
                return
            }

            await apiRequest('/api/cash-registers', {
                method: 'post',
                data: payload,
            })

            window.location.reload()
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                createOfflineCashRegister(tenantId, payload, { userName: auth?.user?.name })
                setActiveTab('active')
                setFeedback({
                    type: 'warning',
                    text: 'Caixa aberto no modo offline. A sincronizacao sera feita quando a internet voltar.',
                })
            } else {
                setFeedback({
                    type: 'error',
                    text: error.message,
                })
            }
        } finally {
            setLoading(false)
        }
    }

    async function handleMovement(event, type) {
        event.preventDefault()

        if (!openRegisterState) {
            return
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setFeedback({
                type: 'error',
                text: 'Movimentacoes manuais do caixa ainda exigem conexao ativa.',
            })
            return
        }

        const formData = new FormData(event.currentTarget)

        await apiRequest(`/api/cash-registers/${openRegisterState.cashRegister.id}/movements`, {
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

        if (!openRegisterState) {
            return
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setFeedback({
                type: 'error',
                text: 'Fechamento de caixa ainda exige conexao ativa.',
            })
            return
        }

        const formData = new FormData(event.currentTarget)
        const response = await apiRequest(`/api/cash-registers/${openRegisterState.cashRegister.id}/close`, {
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
        if (!openRegisterState) {
            return
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setFeedback({
                type: 'error',
                text: 'Conferencia e fechamento de caixa ainda exigem conexao ativa.',
            })
            return
        }

        setCloseConferenceModal(buildCloseCashRegisterModal(openRegisterState))
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

        if (!openRegisterState || !closeConferenceModal) {
            return
        }

        if (closeConferenceModal.form.amounts.cash === '') {
            return
        }

        setClosingCashRegister(true)

        try {
            const response = await apiRequest(`/api/cash-registers/${openRegisterState.cashRegister.id}/close`, {
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
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setFeedback({
                type: 'error',
                text: 'Relatorios detalhados de caixas fechados exigem conexao ativa.',
            })
            return
        }

        const response = await apiRequest(`/api/cash-registers/${id}/report`)
        setRefreshAfterClose(false)
        setReportModal(response.report)
    }

    const closeConferenceRows = buildCloseCashRegisterRows(closeConferenceModal, true)

    return (
        <AppLayout title="Caixa">
            <div className="cash-register-page">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Nao foi possivel concluir a acao' : 'Atualizacao realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <section className="cash-register-hero ui-card">
                    <div className="ui-card-body">
                        <div className="cash-register-hero-grid">
                            <div>
                                <span className={`ui-badge ${openRegisterState ? 'success' : 'warning'}`}>
                                    {openRegisterState ? 'Caixa aberto' : 'Caixa fechado'}
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

                {activeTab === 'active' ? (
                    openRegisterState ? (
                        <ActiveRegisterPanel
                            report={openRegisterState}
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
        </AppLayout>
    )
}
