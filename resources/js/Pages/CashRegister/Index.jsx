import { useEffect, useMemo, useState } from 'react'
import { usePage } from '@inertiajs/react'
import PageContainer from '@/Components/UI/PageContainer'
import CompactModal from '@/Components/UI/CompactModal'
import ActionDrawer from '@/Components/UI/ActionDrawer'
import DenseTable from '@/Components/UI/DenseTable'
import QuickActionBar from '@/Components/UI/QuickActionBar'
import StatusBadge from '@/Components/UI/StatusBadge'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import AppLayout from '@/Layouts/AppLayout'
import { buildCloseCashRegisterModal, buildCloseCashRegisterRows } from '@/lib/cashRegister'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { formatDateTime, formatMoney } from '@/lib/format'
import {
    buildOfflineCashRegisterReport,
    cacheOfflineCashRegisterReport,
    closeOfflineCashRegister,
    configureOfflineWorkspaceBridge,
    createOfflineCashRegister,
    getOfflineCashRegisterHistory,
    getOfflineCashRegisterReport,
    getOfflineWorkspaceSnapshot,
    hasOfflineWorkspaceData,
    hydrateOfflineWorkspace,
    registerOfflineCashMovement,
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

function movementMeta(type) {
    return type === 'withdrawal'
        ? {
            title: 'Sangria',
            description: 'Retire valor do caixa com motivo.',
            tone: 'danger',
            icon: 'fa-arrow-up-right-from-square',
            button: 'Confirmar sangria',
        }
        : {
            title: 'Suprimento',
            description: 'Registre entrada manual no caixa.',
            tone: 'primary',
            icon: 'fa-arrow-down-left-and-arrow-up-right-to-center',
            button: 'Confirmar suprimento',
        }
}

function buildMovementRows(movements) {
    return (movements || []).map((movement) => ({
        id: movement.id,
        type: movement.type === 'withdrawal' ? 'Sangria' : 'Suprimento',
        reason: movement.reason || 'Sem motivo',
        amount: formatMoney(movement.amount),
        createdAt: formatDateTime(movement.created_at),
        tone: movement.type === 'withdrawal' ? 'danger' : 'success',
    }))
}

function buildHistoryRows(history) {
    return (history || []).map((register) => ({
        id: register.id,
        openedAt: formatDateTime(register.opened_at),
        closedAt: formatDateTime(register.closed_at),
        operator: register.user_name || 'Sem operador',
        totalSales: formatMoney(register.total_sales),
        difference: formatMoney(register.difference),
        tone: Math.abs(Number(register.difference || 0)) > 0.009 ? 'warning' : 'success',
    }))
}

function PaymentSummaryTable({ report }) {
    const rows = (report?.payments || []).map((payment) => ({
        key: payment.payment_method,
        label: payment.label,
        total: formatMoney(payment.total),
        entries: `${payment.qtd} lanc.`,
    }))

    return (
        <section className="cash-compact-panel">
            <div className="cash-compact-panel-head">
                <div>
                    <span>Resumo</span>
                    <strong>Formas de pagamento</strong>
                </div>
            </div>
            <DenseTable
                columns={[
                    { key: 'label', label: 'Forma' },
                    { key: 'total', label: 'Total' },
                    { key: 'entries', label: 'Lancamentos' },
                ]}
                rows={rows}
                rowKey="key"
                emptyState={<CashRegisterEmpty icon="fa-credit-card" text="Nenhuma venda registrada no caixa atual." title="Sem pagamentos" />}
            />
        </section>
    )
}

function CashRegisterEmpty({ icon, title, text, action = null }) {
    return (
        <div className="cash-compact-empty">
            <span className="cash-compact-empty-icon">
                <i className={`fa-solid ${icon}`} />
            </span>
            <strong>{title}</strong>
            <p>{text}</p>
            {action}
        </div>
    )
}

export default function CashRegisterIndex({ openRegister, history, settings }) {
    const { auth, tenant, localAgentBridge } = usePage().props
    const tenantId = tenant?.id
    const [loading, setLoading] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [reportModal, setReportModal] = useState(null)
    const [closeConferenceModal, setCloseConferenceModal] = useState(null)
    const [refreshAfterClose, setRefreshAfterClose] = useState(false)
    const [openRegisterState, setOpenRegisterState] = useState(openRegister)
    const [historyState, setHistoryState] = useState(history)
    const [feedback, setFeedback] = useState(null)
    const [openModalVisible, setOpenModalVisible] = useState(false)
    const [movementModalType, setMovementModalType] = useState(null)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [historyDrawerTab, setHistoryDrawerTab] = useState('movements')
    const requireConference = settings?.cash_closing?.require_conference !== false

    useEffect(() => {
        if (!tenantId) {
            return undefined
        }

        let cancelled = false
        let unsubscribe = () => { }

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
            setHistoryState(getOfflineCashRegisterHistory(tenantId))
        }

        const handleOnline = () => {
            syncOfflineWorkspace(tenantId, apiRequest).catch(() => { })
        }

        const bootstrap = async () => {
            configureOfflineWorkspaceBridge(tenantId, localAgentBridge)
            await hydrateOfflineWorkspace(tenantId).catch(() => { })

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
                    cashRegisterHistory: history,
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
    }, [auth?.user?.name, history, localAgentBridge, openRegister, tenantId])

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
                setOpenModalVisible(false)
                setFeedback({
                    type: 'warning',
                    text: 'Caixa aberto no modo offline. A sincronização será feita quando a internet voltar.',
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
                setOpenModalVisible(false)
                setFeedback({
                    type: 'warning',
                    text: 'Caixa aberto no modo offline. A sincronização será feita quando a internet voltar.',
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

        const formData = new FormData(event.currentTarget)
        const payload = {
            type,
            amount: Number(formData.get('amount') || 0),
            reason: formData.get('reason') || null,
        }

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                setFeedback({
                    type: 'error',
                    text: 'Movimentacoes manuais do caixa ainda exigem conexão ativa.',
                })
                return
            }

            await apiRequest(`/api/cash-registers/${openRegisterState.cashRegister.id}/movements`, {
                method: 'post',
                data: payload,
            })

            window.location.reload()
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                registerOfflineCashMovement(tenantId, openRegisterState.cashRegister.id, payload, {
                    userName: auth?.user?.name,
                })
                setMovementModalType(null)
                setFeedback({
                    type: 'warning',
                    text: type === 'withdrawal'
                        ? 'Sangria registrada no modo offline. A sincronização será feita quando a internet voltar.'
                        : 'Suprimento registrado no modo offline. A sincronização será feita quando a internet voltar.',
                })
            } else {
                setFeedback({
                    type: 'error',
                    text: error.message,
                })
            }
        }
    }

    function handleStartCloseConference() {
        if (!openRegisterState) {
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

        const payload = {
            closing_amount: Number(closeConferenceModal.form.amounts.cash || 0),
            closing_notes: closeConferenceModal.form.notes || null,
            closing_totals: Object.fromEntries(
                Object.entries(closeConferenceModal.form.amounts).map(([key, value]) => [key, Number(value || 0)]),
            ),
        }

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const result = closeOfflineCashRegister(tenantId, openRegisterState.cashRegister.id, payload, {
                    userName: auth?.user?.name,
                    fallbackReport: openRegisterState,
                })
                setCloseConferenceModal(null)
                setRefreshAfterClose(false)
                setReportModal(result.report)
                setFeedback({
                    type: 'warning',
                    text: result.message,
                })
                return
            }

            const response = await apiRequest(`/api/cash-registers/${openRegisterState.cashRegister.id}/close`, {
                method: 'post',
                data: payload,
            })

            cacheOfflineCashRegisterReport(tenantId, response.report)
            setCloseConferenceModal(null)
            setRefreshAfterClose(true)
            setReportModal(response.report)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const result = closeOfflineCashRegister(tenantId, openRegisterState.cashRegister.id, payload, {
                    userName: auth?.user?.name,
                    fallbackReport: openRegisterState,
                })
                setCloseConferenceModal(null)
                setRefreshAfterClose(false)
                setReportModal(result.report)
                setFeedback({
                    type: 'warning',
                    text: result.message,
                })
            } else {
                setFeedback({
                    type: 'error',
                    text: error.message,
                })
            }
        } finally {
            setClosingCashRegister(false)
        }
    }

    async function handleViewReport(id) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            const offlineReport = getOfflineCashRegisterReport(tenantId, id, {
                userName: auth?.user?.name,
            })

            if (!offlineReport) {
                setFeedback({
                    type: 'error',
                    text: 'Esse relatório ainda não foi salvo nesta máquina para consulta offline.',
                })
                return
            }

            setRefreshAfterClose(false)
            setReportModal(offlineReport)
            return
        }

        try {
            const response = await apiRequest(`/api/cash-registers/${id}/report`)
            cacheOfflineCashRegisterReport(tenantId, response.report)
            setRefreshAfterClose(false)
            setReportModal(response.report)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineReport = getOfflineCashRegisterReport(tenantId, id, {
                    userName: auth?.user?.name,
                })

                if (offlineReport) {
                    setRefreshAfterClose(false)
                    setReportModal(offlineReport)
                    return
                }
            }

            setFeedback({
                type: 'error',
                text: error.message,
            })
        }
    }

    const closeConferenceRows = buildCloseCashRegisterRows(closeConferenceModal, requireConference)
    const movementRows = useMemo(() => buildMovementRows(openRegisterState?.movements || []), [openRegisterState?.movements])
    const historyRows = useMemo(() => buildHistoryRows(historyState || []), [historyState])
    const movementConfig = movementModalType ? movementMeta(movementModalType) : null
    const quickActions = [
        {
            key: 'withdrawal',
            icon: 'fa-arrow-up-right-from-square',
            label: 'Sangria',
            description: 'Retirar valor',
            tone: 'danger',
            disabled: !openRegisterState,
            onClick: () => setMovementModalType('withdrawal'),
        },
        {
            key: 'supply',
            icon: 'fa-arrow-down-left-and-arrow-up-right-to-center',
            label: 'Suprimento',
            description: 'Registrar entrada',
            tone: 'primary',
            disabled: !openRegisterState,
            onClick: () => setMovementModalType('supply'),
        },
        {
            key: 'history',
            icon: 'fa-clock-rotate-left',
            label: 'Histórico',
            description: 'Movimentos do dia',
            tone: 'ghost',
            onClick: () => {
                setHistoryDrawerTab('movements')
                setHistoryDrawerOpen(true)
            },
        },
        {
            key: 'close',
            icon: 'fa-lock',
            label: 'Fechar caixa',
            description: requireConference ? 'Conferir e encerrar' : 'Encerrar turno',
            tone: 'danger',
            disabled: !openRegisterState,
            onClick: handleStartCloseConference,
        },
    ]
    const summaryTiles = openRegisterState ? [
        {
            key: 'opening',
            label: 'Abertura',
            value: formatMoney(openRegisterState.cashRegister.opening_amount),
            meta: formatDateTime(openRegisterState.cashRegister.opened_at),
        },
        {
            key: 'sales',
            label: 'Vendas',
            value: formatMoney(openRegisterState.total_sales),
            meta: `${openRegisterState.sales_count} registro(s)`,
        },
        {
            key: 'expected',
            label: 'Esperado',
            value: formatMoney(openRegisterState.expected_cash),
            meta: 'dinheiro no caixa',
        },
        {
            key: 'manual',
            label: 'Movimentos',
            value: `${movementRows.length}`,
            meta: `${formatMoney(openRegisterState.total_supplies)} entrada / ${formatMoney(openRegisterState.total_withdrawals)} saida`,
        },
    ] : []

    return (
        <AppLayout title="Caixa">
            <div className="cash-register-page cash-register-page-compact">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Não foi possível concluir a ação' : 'Atualização realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <PageContainer
                    className="cash-page-container"
                    sidebar={(
                        <QuickActionBar
                            className="cash-quick-actions"
                            items={quickActions}
                            title="Acoes rapidas"
                        />
                    )}
                >
                    {openRegisterState ? (
                        <div className="cash-compact-grid">
                            <section className="cash-compact-hero">
                                <div className="cash-compact-hero-copy">
                                    <div className="cash-compact-hero-headline">
                                        <StatusBadge icon="fa-vault" label="Caixa aberto" tone="success" />
                                        <StatusBadge
                                            compact
                                            icon="fa-user"
                                            label={openRegisterState.cashRegister.user_name || 'Operador'}
                                            tone="info"
                                        />
                                    </div>
                                    <strong>{formatMoney(openRegisterState.total_sales)}</strong>
                                    <p>{openRegisterState.sales_count} venda(s) registradas no turno atual.</p>
                                </div>
                                <div className="cash-compact-hero-meta">
                                    <div>
                                        <span>Abertura</span>
                                        <strong>{formatDateTime(openRegisterState.cashRegister.opened_at)}</strong>
                                    </div>
                                    <div>
                                        <span>Dinheiro vendido</span>
                                        <strong>{formatMoney(openRegisterState.cash_sales)}</strong>
                                    </div>
                                    <div>
                                        <span>Conferencia</span>
                                        <strong>{requireConference ? 'Obrigatoria' : 'Simplificada'}</strong>
                                    </div>
                                </div>
                            </section>

                            <section className="cash-compact-metrics">
                                {summaryTiles.map((tile) => (
                                    <article key={tile.key}>
                                        <span>{tile.label}</span>
                                        <strong>{tile.value}</strong>
                                        <small>{tile.meta}</small>
                                    </article>
                                ))}
                            </section>

                            <PaymentSummaryTable report={openRegisterState} />
                        </div>
                    ) : (
                        <section className="cash-compact-closed-state">
                            <CashRegisterEmpty
                                action={(
                                    <button type="button" className="ui-button" onClick={() => setOpenModalVisible(true)}>
                                        <i className="fa-solid fa-lock-open" />
                                        <span>Abrir caixa</span>
                                    </button>
                                )}
                                icon="fa-vault"
                                text="Nenhum caixa aberto no momento. Use apenas o valor inicial e siga com a operação."
                                title="Caixa fechado"
                            />
                        </section>
                    )}
                </PageContainer>
            </div>

            <CompactModal
                open={openModalVisible}
                title="Abrir caixa"
                description="Informe o valor inicial do turno."
                icon="fa-lock-open"
                size="sm"
                onClose={() => setOpenModalVisible(false)}
            >
                <form className="cash-compact-form" onSubmit={handleOpen}>
                    <label>
                        <span>Valor de abertura</span>
                        <input className="ui-input" name="opening_amount" type="number" step="0.01" min="0" defaultValue="0" />
                    </label>
                    <label>
                        <span>Observação</span>
                        <textarea className="ui-textarea" name="opening_notes" rows="3" />
                    </label>
                    <div className="cash-compact-form-actions">
                        <button type="button" className="ui-button-ghost" onClick={() => setOpenModalVisible(false)}>Cancelar</button>
                        <button type="submit" className="ui-button" disabled={loading}>
                            <i className="fa-solid fa-lock-open" />
                            <span>{loading ? 'Abrindo...' : 'Confirmar abertura'}</span>
                        </button>
                    </div>
                </form>
            </CompactModal>

            <CompactModal
                open={Boolean(movementModalType)}
                title={movementConfig?.title || 'Movimento'}
                description={movementConfig?.description || 'Registrar movimento no caixa.'}
                icon={movementConfig?.icon || 'fa-arrow-right-arrow-left'}
                size="sm"
                onClose={() => setMovementModalType(null)}
            >
                <form className="cash-compact-form" onSubmit={(event) => handleMovement(event, movementModalType)}>
                    <label>
                        <span>Valor</span>
                        <input className="ui-input" name="amount" type="number" step="0.01" min="0.01" required />
                    </label>
                    <label>
                        <span>Motivo</span>
                        <input className="ui-input" name="reason" placeholder="Descreva o motivo" />
                    </label>
                    <div className="cash-compact-form-actions">
                        <button type="button" className="ui-button-ghost" onClick={() => setMovementModalType(null)}>Cancelar</button>
                        <button type="submit" className={movementConfig?.tone === 'danger' ? 'ui-button-danger' : 'ui-button'}>
                            <i className={`fa-solid ${movementConfig?.icon || 'fa-check'}`} />
                            <span>{movementConfig?.button || 'Confirmar'}</span>
                        </button>
                    </div>
                </form>
            </CompactModal>

            <ActionDrawer
                open={historyDrawerOpen}
                title="Histórico do caixa"
                description="Movimentos manuais e fechamentos recentes."
                icon="fa-clock-rotate-left"
                size="lg"
                onClose={() => setHistoryDrawerOpen(false)}
            >
                <div className="cash-history-drawer">
                    <div className="cash-history-tabs">
                        <button
                            type="button"
                            className={`ui-tab ${historyDrawerTab === 'movements' ? 'active' : ''}`}
                            onClick={() => setHistoryDrawerTab('movements')}
                        >
                            <i className="fa-solid fa-arrow-right-arrow-left" />
                            <span>Movimentacoes</span>
                        </button>
                        <button
                            type="button"
                            className={`ui-tab ${historyDrawerTab === 'closings' ? 'active' : ''}`}
                            onClick={() => setHistoryDrawerTab('closings')}
                        >
                            <i className="fa-solid fa-file-lines" />
                            <span>Fechamentos</span>
                        </button>
                    </div>

                    {historyDrawerTab === 'movements' ? (
                        <DenseTable
                            columns={[
                                {
                                    key: 'type',
                                    label: 'Tipo',
                                    render: (row) => <StatusBadge compact label={row.type} tone={row.tone} />,
                                },
                                { key: 'reason', label: 'Motivo' },
                                { key: 'amount', label: 'Valor' },
                                { key: 'createdAt', label: 'Horario' },
                            ]}
                            rows={movementRows}
                            emptyState={<CashRegisterEmpty icon="fa-arrow-right-arrow-left" text="Os movimentos manuais do turno aparecerao aqui." title="Sem movimentacoes" />}
                            rowKey="id"
                        />
                    ) : (
                        <DenseTable
                            columns={[
                                { key: 'openedAt', label: 'Abertura' },
                                { key: 'closedAt', label: 'Fechamento' },
                                { key: 'operator', label: 'Operador' },
                                { key: 'totalSales', label: 'Total' },
                                {
                                    key: 'difference',
                                    label: 'Diferenca',
                                    render: (row) => <StatusBadge compact label={row.difference} tone={row.tone} />,
                                },
                            ]}
                            rows={historyRows}
                            emptyState={<CashRegisterEmpty icon="fa-file-lines" text="Os fechamentos concluidos aparecerao nesta fila." title="Sem fechamentos" />}
                            getRowActions={(row) => [
                                {
                                    key: 'report',
                                    icon: 'fa-eye',
                                    label: 'Ver relatório',
                                    tone: 'primary',
                                    onClick: () => handleViewReport(row.id),
                                },
                            ]}
                            rowKey="id"
                        />
                    )}
                </div>
            </ActionDrawer>

            <CompactModal
                open={Boolean(closeConferenceModal)}
                title="Fechamento do caixa"
                description="Confira os totais antes de encerrar o turno."
                icon="fa-lock"
                size="lg"
                onClose={closeConference}
            >
                {closeConferenceModal ? (
                    <form className="cash-close-form" onSubmit={handleConfirmCloseConference}>
                        <div className="cash-close-grid">
                            {closeConferenceRows.map((row) => (
                                <article key={row.key} className="cash-close-card">
                                    <div className="cash-close-card-top">
                                        <div>
                                            <span>{row.label}</span>
                                            <strong>{formatMoney(row.expected)}</strong>
                                        </div>
                                        <StatusBadge compact label={row.key === 'cash' ? 'Obrigatorio' : 'Conferir'} tone={row.key === 'cash' ? 'info' : 'warning'} />
                                    </div>
                                    <label>
                                        <span>Valor informado</span>
                                        <input
                                            className="ui-input"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={closeConferenceModal.form.amounts[row.key]}
                                            onChange={(event) => handleCloseConferenceAmountChange(row.key, event.target.value)}
                                        />
                                    </label>
                                    <div className={`cash-close-difference ${Math.abs(row.difference || 0) > 0.009 ? 'alert' : ''}`}>
                                        <small>Diferenca</small>
                                        <strong>{row.difference === null ? 'A conferir' : formatMoney(row.difference)}</strong>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <label>
                            <span>Observação do fechamento</span>
                            <textarea
                                className="ui-textarea"
                                rows="3"
                                value={closeConferenceModal.form.notes}
                                onChange={(event) => handleCloseConferenceNotesChange(event.target.value)}
                            />
                        </label>

                        <div className="cash-compact-form-actions">
                            <button type="button" className="ui-button-ghost" onClick={closeConference}>Voltar</button>
                            <button className="ui-button-danger" type="submit" disabled={closingCashRegister}>
                                <i className="fa-solid fa-lock" />
                                <span>{closingCashRegister ? 'Fechando...' : 'Confirmar fechamento'}</span>
                            </button>
                        </div>
                    </form>
                ) : null}
            </CompactModal>

            <ClosingReportModal report={reportModal} onClose={closeReportModal} />
        </AppLayout>
    )
}
