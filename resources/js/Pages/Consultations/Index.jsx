import { useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import ActionSidebar from '@/Components/UI/ActionSidebar'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import { apiRequest } from '@/lib/http'
import { confirmPopup } from '@/lib/errorPopup'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import '../Operations/backoffice-workspace.css'

function summaryIcon(type) {
    switch (type) {
        case 'sale':
            return 'fa-receipt'
        case 'entry':
            return 'fa-box-open'
        case 'delivery':
            return 'fa-motorcycle'
        case 'credit':
            return 'fa-handshake'
        case 'fiscal':
            return 'fa-file-invoice'
        default:
            return 'fa-layer-group'
    }
}

function recordCounterparty(record) {
    return record.details?.recipient
        || record.details?.supplier
        || record.subtitle
        || '-'
}

function recordPaymentSummary(record) {
    const labels = Array.from(new Set((record.details?.payments || []).map((payment) => payment.label).filter(Boolean)))

    if (labels.length) {
        return labels.join(', ')
    }

    return {
        sale: 'Sem pagamento informado',
        entry: 'Entrada de estoque',
        delivery: 'Delivery',
        credit: 'A prazo',
        fiscal: 'Documento fiscal',
    }[record.type] || 'Nao informado'
}

function recordTypeLabel(recordType, recordTypes) {
    return recordTypes.find((entry) => entry.key === recordType)?.label || 'Registro'
}

function matchDateRange(record, range) {
    const value = String(record.date || '').slice(0, 10)

    if (!value) {
        return true
    }

    if (range.from && value < range.from) {
        return false
    }

    if (range.to && value > range.to) {
        return false
    }

    return true
}

function resolveRecordColumns(activeType, recordTypes) {
    if (activeType === 'fiscal') {
        return [
            {
                key: 'access_key',
                label: 'Chave',
                render: (record) => record.details?.access_key || record.details?.number || record.title || '-',
            },
            {
                key: 'date',
                label: 'Data',
                render: (record) => record.date ? formatDate(record.date) : '-',
            },
            {
                key: 'amount',
                label: 'Valor',
                align: 'right',
                render: (record) => <strong>{formatMoney(record.amount)}</strong>,
            },
            {
                key: 'status',
                label: 'Situacao',
                render: (record) => <StatusBadge compact label={record.status_label} tone={record.status_tone} />,
            },
            {
                key: 'protocol',
                label: 'Protocolo',
                render: (record) => record.details?.protocol || '-',
            },
        ]
    }

    if (activeType === 'sale') {
        return [
            {
                key: 'number',
                label: 'Numero',
                render: (record) => <strong>{record.details?.sale_number || record.title}</strong>,
            },
            {
                key: 'date',
                label: 'Data',
                render: (record) => record.date ? formatDate(record.date) : '-',
            },
            {
                key: 'customer',
                label: 'Cliente',
                render: (record) => recordCounterparty(record),
            },
            {
                key: 'items',
                label: 'Itens',
                align: 'center',
                render: (record) => formatNumber((record.details?.items || []).length),
            },
            {
                key: 'amount',
                label: 'Total',
                align: 'right',
                render: (record) => <strong>{formatMoney(record.amount)}</strong>,
            },
            {
                key: 'status',
                label: 'Status',
                render: (record) => <StatusBadge compact label={record.status_label} tone={record.status_tone} />,
            },
        ]
    }

    return [
        {
            key: 'type',
            label: 'Tipo',
            render: (record) => recordTypeLabel(record.type, recordTypes),
        },
        {
            key: 'title',
            label: 'Numero',
            render: (record) => <strong>{record.title}</strong>,
        },
        {
            key: 'date',
            label: 'Data',
            render: (record) => record.date ? formatDate(record.date) : '-',
        },
        {
            key: 'counterparty',
            label: 'Cliente',
            render: (record) => recordCounterparty(record),
        },
        {
            key: 'amount',
            label: 'Valor',
            align: 'right',
            render: (record) => <strong>{formatMoney(record.amount)}</strong>,
        },
        {
            key: 'status',
            label: 'Status',
            render: (record) => <StatusBadge compact icon={summaryIcon(record.type)} label={record.status_label} tone={record.status_tone} />,
        },
    ]
}

function resolvePrintUrl(record) {
    return record.actions?.preview_url
        || record.actions?.authorized_xml_url
        || record.actions?.cancelled_xml_url
        || record.actions?.signed_xml_url
        || record.actions?.mirror_url
        || null
}

export default function ConsultationsIndex({ recordTypes, records, filters = {} }) {
    const searchControl = useConfirmedSearch(filters?.search || '')
    const [activeType, setActiveType] = useState('all')
    const [range, setRange] = useState({ from: filters?.from || '', to: filters?.to || '' })
    const [appliedRange, setAppliedRange] = useState(Boolean(filters?.applied) ? { from: filters?.from || '', to: filters?.to || '' } : { from: '', to: '' })
    const [selectedUid, setSelectedUid] = useState(null)
    const [busyAction, setBusyAction] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const normalizedSearch = normalizeTextSearch(searchControl.value)

    const filteredRecords = useMemo(() => (
        (records || []).filter((record) => {
            if (activeType !== 'all' && record.type !== activeType) {
                return false
            }

            if (!matchDateRange(record, appliedRange)) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return matchesTextSearchAny([
                record.title,
                record.subtitle,
                record.status_label,
                recordCounterparty(record),
                recordPaymentSummary(record),
                formatMoney(record.amount),
                record.details?.document,
                record.details?.address,
                record.details?.access_key,
                record.details?.number,
            ], normalizedSearch)
        })
    ), [activeType, appliedRange, normalizedSearch, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => record.uid === selectedUid)
            || (records || []).find((record) => record.uid === selectedUid)
            || null,
        [filteredRecords, records, selectedUid],
    )

    const columns = useMemo(
        () => resolveRecordColumns(activeType, recordTypes),
        [activeType, recordTypes],
    )

    async function handleRetry(url) {
        if (!url) {
            return
        }

        setBusyAction(url)
        setFeedback(null)

        try {
            await apiRequest(url, { method: 'post' })
            setFeedback({ type: 'success', text: 'Acao reenfileirada com sucesso.' })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleCancel(url, label) {
        if (!url) {
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: `Cancelar ${label}`,
            message: `Deseja cancelar ${label}?`,
            confirmLabel: 'Cancelar',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        setBusyAction(url)
        setFeedback(null)

        try {
            await apiRequest(url, { method: 'post', data: { reason: 'Cancelado pela central de consultas.' } })
            setFeedback({ type: 'success', text: `${label} cancelado com sucesso.` })
            setSelectedUid(null)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleDeliveryStatus(record, status) {
        setBusyAction(`${record.uid}-${status}`)
        setFeedback(null)

        try {
            await apiRequest(record.actions.mark_dispatched, { method: 'post', data: { status } })
            setFeedback({ type: 'success', text: 'Status da entrega atualizado.' })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleDeliveryDelete(record) {
        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Cancelar entrega',
            message: `Deseja cancelar ${record.title}?`,
            confirmLabel: 'Cancelar entrega',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) {
            return
        }

        setBusyAction(record.actions.delete_url)
        setFeedback(null)

        try {
            await apiRequest(record.actions.delete_url, { method: 'delete' })
            setFeedback({ type: 'success', text: 'Entrega cancelada com sucesso.' })
            setSelectedUid(null)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    function handleApplyFilters() {
        const nextSearch = searchControl.apply()
        const params = { applied: 1 }

        if (String(nextSearch || '').trim()) {
            params.search = String(nextSearch).trim()
        }

        if (range.from) {
            params.from = range.from
        }

        if (range.to) {
            params.to = range.to
        }

        setAppliedRange({ ...range })
        setSelectedUid(null)
        router.get('/consultas-cancelamentos', params, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    function handleResetFilters() {
        searchControl.clear()
        setRange({ from: '', to: '' })
        setAppliedRange({ from: '', to: '' })
        setActiveType('all')
        setSelectedUid(null)
        router.get('/consultas-cancelamentos', {}, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    return (
        <AppLayout title="Consultas">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Consultas"
                        search={{
                            placeholder: 'Buscar por numero ou valor',
                            value: searchControl.draftValue,
                            onChange: searchControl.setDraftValue,
                        }}
                        filters={(recordTypes || []).map((type) => ({
                            key: type.key,
                            value: type.key,
                            label: type.label,
                            count: type.key === 'all'
                                ? (records || []).length
                                : (records || []).filter((record) => record.type === type.key).length,
                        }))}
                        activeFilter={activeType}
                        onFilterChange={setActiveType}
                        dateRange={{
                            from: range.from,
                            to: range.to,
                            onChange: setRange,
                        }}
                        quickDates
                        onApply={handleApplyFilters}
                        onReset={handleResetFilters}
                    />

                    {feedback ? (
                        <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                            <span>{feedback.text}</span>
                        </div>
                    ) : null}

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={columns}
                            rows={filteredRecords}
                            rowKey="uid"
                            selectedRowKey={selectedUid}
                            onRowClick={(record) => setSelectedUid(record.uid)}
                            emptyMessage={filters?.applied ? 'Sem registros nesse recorte' : 'Clique em Filtrar para buscar'}
                            actions={(record) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver detalhes',
                                    tone: 'primary',
                                    onClick: () => setSelectedUid(record.uid),
                                },
                            ]}
                        />
                    </section>
                </div>

                <ActionSidebar
                    storageKey="consultations-index"
                    actions={[
                        {
                            key: 'view',
                            icon: 'fa-eye',
                            label: 'Ver detalhes',
                            tone: 'primary',
                            disabled: !selectedRecord,
                            onClick: () => selectedRecord && setSelectedUid(selectedRecord.uid),
                        },
                        {
                            key: 'retry',
                            icon: 'fa-rotate',
                            label: 'Reenfileirar',
                            disabled: !selectedRecord || activeType !== 'fiscal' || !selectedRecord.actions?.retry_url,
                            onClick: () => selectedRecord && handleRetry(selectedRecord.actions.retry_url),
                        },
                        {
                            key: 'invalidate',
                            icon: 'fa-hashtag',
                            label: 'Inutilizar',
                            disabled: !selectedRecord || activeType !== 'fiscal',
                            onClick: () => setFeedback({ type: 'error', text: 'Inutilizacao segue o fluxo fiscal proprio nesta versao.' }),
                        },
                        {
                            key: 'print',
                            icon: 'fa-print',
                            label: 'Imprimir',
                            disabled: !selectedRecord || !resolvePrintUrl(selectedRecord),
                            onClick: () => {
                                const printUrl = selectedRecord ? resolvePrintUrl(selectedRecord) : null
                                if (printUrl) {
                                    window.open(printUrl, '_blank', 'noopener,noreferrer')
                                }
                            },
                        },
                        {
                            key: 'cancel',
                            icon: 'fa-xmark',
                            label: 'Cancelar',
                            tone: 'danger',
                            dividerBefore: true,
                            disabled: !selectedRecord,
                            onClick: () => {
                                if (!selectedRecord) {
                                    return
                                }

                                if (selectedRecord.type === 'delivery') {
                                    void handleDeliveryDelete(selectedRecord)
                                    return
                                }

                                void handleCancel(selectedRecord.actions?.cancel_url, selectedRecord.title)
                            },
                        },
                    ]}
                />
            </div>

            <CompactModal
                open={Boolean(selectedRecord)}
                title={selectedRecord?.title || 'Detalhes'}
                description={selectedRecord ? `${selectedRecord.subtitle} - ${formatMoney(selectedRecord.amount)}` : ''}
                icon={selectedRecord ? summaryIcon(selectedRecord.type) : 'fa-circle-info'}
                size="lg"
                onClose={() => setSelectedUid(null)}
            >
                {selectedRecord ? (
                    <div className="proc-ui-modal-stack">
                        <div className="proc-ui-card-toolbar">
                            <StatusBadge label={selectedRecord.status_label} tone={selectedRecord.status_tone} />
                            <span className="proc-ui-muted">{selectedRecord.date ? formatDateTime(selectedRecord.date) : 'Sem data'}</span>
                        </div>

                        {selectedRecord.type === 'sale' ? (
                            <>
                                <section className="proc-ui-modal-block">
                                    <h3>Resumo da venda</h3>
                                    <div className="proc-ui-summary-grid">
                                        <article className="proc-ui-summary-card"><span>Operador</span><strong>{selectedRecord.details.operator || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Cliente</span><strong>{selectedRecord.details.recipient || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Documento</span><strong>{selectedRecord.details.document || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Total</span><strong>{formatMoney(selectedRecord.amount)}</strong></article>
                                    </div>
                                </section>

                                <section className="proc-ui-modal-block">
                                    <h3>Itens</h3>
                                    <div className="proc-ui-surface-list">
                                        {selectedRecord.details.items.map((item, index) => (
                                            <div key={`${selectedRecord.uid}-item-${index}`} className="proc-ui-surface-item">
                                                <div>
                                                    <strong>{item.name}</strong>
                                                    <small>{formatNumber(item.quantity)} un - {formatMoney(item.unit_price)}</small>
                                                </div>
                                                <strong>{formatMoney(item.total)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : null}

                        {selectedRecord.type === 'entry' ? (
                            <>
                                <section className="proc-ui-modal-block">
                                    <h3>Resumo da entrada</h3>
                                    <div className="proc-ui-summary-grid">
                                        <article className="proc-ui-summary-card"><span>Fornecedor</span><strong>{selectedRecord.details.supplier || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Codigo</span><strong>{selectedRecord.details.code || '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Recebida em</span><strong>{selectedRecord.details.received_at ? formatDateTime(selectedRecord.details.received_at) : '-'}</strong></article>
                                        <article className="proc-ui-summary-card"><span>Total</span><strong>{formatMoney(selectedRecord.amount)}</strong></article>
                                    </div>
                                </section>
                            </>
                        ) : null}

                        {selectedRecord.type === 'delivery' ? (
                            <section className="proc-ui-modal-block">
                                <h3>Detalhes da entrega</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Destinatario</span><strong>{selectedRecord.details.recipient || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Telefone</span><strong>{selectedRecord.details.phone || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Entregador</span><strong>{selectedRecord.details.courier || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Taxa</span><strong>{formatMoney(selectedRecord.details.delivery_fee || 0)}</strong></article>
                                </div>
                                <div className="proc-ui-banner info">
                                    <i className="fa-solid fa-location-dot" />
                                    <div>{selectedRecord.details.address || 'Sem endereco'} {selectedRecord.details.neighborhood ? ` - ${selectedRecord.details.neighborhood}` : ''}</div>
                                </div>
                            </section>
                        ) : null}

                        {selectedRecord.type === 'credit' ? (
                            <section className="proc-ui-modal-block">
                                <h3>Venda a prazo</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Cliente</span><strong>{selectedRecord.details.recipient || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Documento</span><strong>{selectedRecord.details.document || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Operador</span><strong>{selectedRecord.details.operator || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Total</span><strong>{formatMoney(selectedRecord.amount)}</strong></article>
                                </div>
                            </section>
                        ) : null}

                        {selectedRecord.type === 'fiscal' ? (
                            <section className="proc-ui-modal-block">
                                <h3>Documento fiscal</h3>
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card"><span>Venda</span><strong>{selectedRecord.details.sale_number || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Status</span><strong>{selectedRecord.details.status || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Numero</span><strong>{selectedRecord.details.number || '-'}</strong></article>
                                    <article className="proc-ui-summary-card"><span>Serie</span><strong>{selectedRecord.details.series || '-'}</strong></article>
                                </div>
                                <div className="proc-ui-banner info">
                                    <i className="fa-solid fa-key" />
                                    <div>{selectedRecord.details.access_key || 'Sem chave de acesso armazenada'}</div>
                                </div>
                                {selectedRecord.details.last_error ? (
                                    <div className="proc-ui-banner critical">
                                        <i className="fa-solid fa-triangle-exclamation" />
                                        <div>{selectedRecord.details.last_error}</div>
                                    </div>
                                ) : null}
                            </section>
                        ) : null}

                        {selectedRecord.type === 'delivery' ? (
                            <div className="proc-ui-modal-footer">
                                <button type="button" className="ui-button-ghost" disabled={busyAction === `${selectedRecord.uid}-dispatched`} onClick={() => handleDeliveryStatus(selectedRecord, 'dispatched')}>
                                    Alterar para rota
                                </button>
                                <button type="button" className="ui-button-ghost" disabled={busyAction === `${selectedRecord.uid}-delivered`} onClick={() => handleDeliveryStatus(selectedRecord, 'delivered')}>
                                    Marcar entregue
                                </button>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </CompactModal>
        </AppLayout>
    )
}
