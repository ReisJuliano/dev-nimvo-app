import { router } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CompactModal from '@/Components/UI/CompactModal'
import StatusBadge from '@/Components/UI/StatusBadge'
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

export default function ConsultationsIndex({ filters, range, recordTypes, summary, records }) {
    const [activeType, setActiveType] = useState('all')
    const [search, setSearch] = useState('')
    const [selectedUid, setSelectedUid] = useState(null)
    const [busyAction, setBusyAction] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const normalizedSearch = normalizeTextSearch(search)

    const filteredRecords = useMemo(() => (
        (records || []).filter((record) => {
            if (activeType !== 'all' && record.type !== activeType) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return matchesTextSearchAny([
                record.title,
                record.subtitle,
                ...(record.tags || []),
                record.status_label,
                record.details?.recipient,
                record.details?.supplier,
                record.details?.address,
                record.details?.notes,
            ], normalizedSearch)
        })
    ), [activeType, normalizedSearch, records])

    const selectedRecord = useMemo(
        () => (records || []).find((record) => record.uid === selectedUid) || null,
        [records, selectedUid],
    )

    function changePeriod(period) {
        router.get('/consultas-cancelamentos', { period }, { preserveScroll: true, replace: true })
    }

    function applyCustomRange(event) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        router.get('/consultas-cancelamentos', {
            period: 'custom',
            from: form.get('from'),
            to: form.get('to'),
        }, { preserveScroll: true, replace: true })
    }

    async function handleRetry(url) {
        if (!url) {
            return
        }

        setBusyAction(url)
        setFeedback(null)

        try {
            await apiRequest(url, { method: 'post' })
            router.reload({ preserveScroll: true })
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
            setSelectedUid(null)
            router.reload({ preserveScroll: true })
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
            router.reload({ preserveScroll: true })
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
            setSelectedUid(null)
            router.reload({ preserveScroll: true })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <AppLayout title="Consultas">
            <div className="proc-ui-page">
                <section className="proc-ui-main-card">
                    <div className="proc-ui-main-header">
                        <div>
                            <h2>{range.label}</h2>
                        </div>
                    </div>

                    {feedback ? (
                        <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                            <span>{feedback.text}</span>
                        </div>
                    ) : null}

                    <div className="proc-ui-chip-row">
                        {recordTypes.map((type) => (
                            <button key={type.key} type="button" className={`proc-ui-chip ${activeType === type.key ? 'active' : ''}`} onClick={() => setActiveType(type.key)}>
                                {type.label}
                            </button>
                        ))}
                    </div>

                    <div className="proc-ui-card-toolbar">
                        <div className="proc-ui-chip-row">
                            {[
                                { key: 'day', label: 'Hoje' },
                                { key: 'week', label: 'Semana' },
                                { key: 'month', label: 'Mes' },
                            ].map((period) => (
                                <button key={period.key} type="button" className={`proc-ui-chip ${filters.period === period.key ? 'active' : ''}`} onClick={() => changePeriod(period.key)}>
                                    {period.label}
                                </button>
                            ))}
                        </div>

                        <form className="proc-ui-date-range" onSubmit={applyCustomRange}>
                            <input defaultValue={filters.from} name="from" type="date" />
                            <input defaultValue={filters.to} name="to" type="date" />
                            <button type="submit" className="ui-button">
                                <i className="fa-solid fa-calendar-check" />
                                <span>Aplicar</span>
                            </button>
                        </form>
                    </div>

                    <input className="proc-ui-searchbox" type="search" placeholder="Buscar por numero, cliente, fornecedor, endereco ou status" value={search} onChange={(event) => setSearch(event.target.value)} />

                    <div className="proc-ui-list-stack">
                        {filteredRecords.length ? filteredRecords.map((record) => (
                            <button key={record.uid} type="button" className="proc-ui-record-card" onClick={() => setSelectedUid(record.uid)}>
                                <div className="proc-ui-record-card-top">
                                    <div className="proc-ui-record-card-copy">
                                        <strong>{record.title}</strong>
                                        <span>{record.subtitle}</span>
                                    </div>
                                    <StatusBadge compact icon={summaryIcon(record.type)} label={record.status_label} tone={record.status_tone} />
                                </div>

                                <div className="proc-ui-record-card-meta">
                                    <span>{formatMoney(record.amount)}</span>
                                    <span>{record.date ? formatDateTime(record.date) : 'Sem data'}</span>
                                </div>

                                {(record.tags || []).length ? (
                                    <div className="proc-ui-inline-meta">
                                        {record.tags.map((tag) => <span key={`${record.uid}-${tag}`}>{tag}</span>)}
                                    </div>
                                ) : null}
                            </button>
                        )) : (
                            <div className="proc-ui-empty">
                                <strong>Sem registros nesse recorte</strong>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <CompactModal
                open={Boolean(selectedRecord)}
                title={selectedRecord?.title || 'Detalhes'}
                description={selectedRecord ? `${selectedRecord.subtitle} · ${formatMoney(selectedRecord.amount)}` : ''}
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
                                                    <small>{formatNumber(item.quantity)} un · {formatMoney(item.unit_price)}</small>
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

                                <section className="proc-ui-modal-block">
                                    <h3>Itens recebidos</h3>
                                    <div className="proc-ui-surface-list">
                                        {selectedRecord.details.items.map((item, index) => (
                                            <div key={`${selectedRecord.uid}-item-${index}`} className="proc-ui-surface-item">
                                                <div>
                                                    <strong>{item.name}</strong>
                                                    <small>{formatNumber(item.quantity)} un · {formatMoney(item.unit_cost)}</small>
                                                </div>
                                                <strong>{formatMoney(item.total)}</strong>
                                            </div>
                                        ))}
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
                                    <div>{selectedRecord.details.address || 'Sem endereco'} {selectedRecord.details.neighborhood ? `· ${selectedRecord.details.neighborhood}` : ''}</div>
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

                        <div className="proc-ui-modal-footer">
                            {selectedRecord.type === 'sale' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.preview_url} onClick={() => window.open(selectedRecord.actions.preview_url, '_blank', 'noopener,noreferrer')}>
                                        Reimprimir
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.retry_url || busyAction === selectedRecord.actions.retry_url} onClick={() => handleRetry(selectedRecord.actions.retry_url)}>
                                        Reenfileirar NF-e
                                    </button>
                                    <button type="button" className="ui-button-ghost danger" disabled={busyAction === selectedRecord.actions.cancel_url} onClick={() => handleCancel(selectedRecord.actions.cancel_url, selectedRecord.title)}>
                                        Cancelar
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'entry' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.mirror_url} onClick={() => window.open(selectedRecord.actions.mirror_url, '_blank', 'noopener,noreferrer')}>
                                        Espelho NF
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled title="Cancelamento de entrada ainda nao e suportado neste backend.">
                                        Cancelar entrada
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled title="Estorno de estoque ainda nao e suportado neste backend.">
                                        Estornar estoque
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'delivery' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={busyAction === `${selectedRecord.uid}-dispatched`} onClick={() => handleDeliveryStatus(selectedRecord, 'dispatched')}>
                                        Alterar para rota
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled={busyAction === `${selectedRecord.uid}-delivered`} onClick={() => handleDeliveryStatus(selectedRecord, 'delivered')}>
                                        Marcar entregue
                                    </button>
                                    <button type="button" className="ui-button-ghost danger" disabled={busyAction === selectedRecord.actions.delete_url} onClick={() => handleDeliveryDelete(selectedRecord)}>
                                        Cancelar
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'credit' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled title="Pagamento a prazo permanece centralizado no modulo proprio.">
                                        Registrar pagamento
                                    </button>
                                    <button type="button" className="ui-button-ghost danger" disabled={busyAction === selectedRecord.actions.cancel_url} onClick={() => handleCancel(selectedRecord.actions.cancel_url, selectedRecord.title)}>
                                        Cancelar
                                    </button>
                                </>
                            ) : null}

                            {selectedRecord.type === 'fiscal' ? (
                                <>
                                    <button type="button" className="ui-button-ghost" disabled={!selectedRecord.actions.signed_xml_url} onClick={() => window.open(selectedRecord.actions.signed_xml_url, '_blank', 'noopener,noreferrer')}>
                                        Ver XML
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled={busyAction === selectedRecord.actions.retry_url} onClick={() => handleRetry(selectedRecord.actions.retry_url)}>
                                        Reenfileirar
                                    </button>
                                    <button type="button" className="ui-button-ghost" disabled title="Inutilizacao segue fluxo proprio de numeracao fiscal.">
                                        Inutilizar
                                    </button>
                                    <button type="button" className="ui-button" disabled={!selectedRecord.actions.authorized_xml_url && !selectedRecord.actions.cancelled_xml_url} onClick={() => window.open(selectedRecord.actions.authorized_xml_url || selectedRecord.actions.cancelled_xml_url, '_blank', 'noopener,noreferrer')}>
                                        Download XML
                                    </button>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </CompactModal>
        </AppLayout>
    )
}
