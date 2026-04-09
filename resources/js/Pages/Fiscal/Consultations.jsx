import { Link, router, useForm } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import './consultations.css'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0))

function formatDateTime(value) {
    if (!value) return '--'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return value
    }

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function toneClass(tone) {
    return `tone-${tone || 'neutral'}`
}

function buildFileActions(fiscalDocument) {
    if (!fiscalDocument) {
        return []
    }

    const files = fiscalDocument.files || {}
    const actions = []

    if (files.authorized_xml_url || files.cancelled_xml_url) {
        actions.push({ key: 'preview', label: 'Preview', icon: 'fa-file-pdf', href: files.preview_url })
    }

    if (files.signed_xml_url) {
        actions.push({ key: 'signed', label: 'Assinado', icon: 'fa-file-signature', href: files.signed_xml_url })
    }

    if (files.authorized_xml_url) {
        actions.push({ key: 'authorized', label: 'Autorizado', icon: 'fa-file-circle-check', href: files.authorized_xml_url })
    }

    if (files.response_xml_url) {
        actions.push({ key: 'response', label: 'Retorno', icon: 'fa-file-waveform', href: files.response_xml_url })
    }

    if (files.cancellation_request_xml_url) {
        actions.push({ key: 'cancellation-request', label: 'Pedido', icon: 'fa-file-export', href: files.cancellation_request_xml_url })
    }

    if (files.cancellation_response_xml_url) {
        actions.push({ key: 'cancellation-response', label: 'Retorno cancel.', icon: 'fa-file-import', href: files.cancellation_response_xml_url })
    }

    if (files.cancelled_xml_url) {
        actions.push({ key: 'cancelled', label: 'Cancelado', icon: 'fa-file-circle-xmark', href: files.cancelled_xml_url })
    }

    return actions.filter((item) => item.href)
}

function eventSourceLabel(source) {
    return source === 'agent' ? 'Agente' : source === 'backend' ? 'Backend' : 'Sistema'
}

export default function FiscalConsultationsPage({ filters, periods, summary, range, sales, inutilizations, contingencies }) {
    const [selectedSaleId, setSelectedSaleId] = useState(null)
    const [showInutilizationModal, setShowInutilizationModal] = useState(false)
    const cancelForm = useForm({ reason: '' })
    const inutilizationForm = useForm({
        document_model: '65',
        series: 1,
        number_start: '',
        number_end: '',
        justification: '',
    })

    const selectedSale = useMemo(
        () => sales.data.find((sale) => sale.id === selectedSaleId) || null,
        [sales.data, selectedSaleId],
    )

    useEffect(() => {
        if (!selectedSaleId) {
            return
        }

        if (!sales.data.some((sale) => sale.id === selectedSaleId)) {
            setSelectedSaleId(null)
            cancelForm.reset()
            cancelForm.clearErrors()
        }
    }, [cancelForm, sales.data, selectedSaleId])

    function changePeriod(period) {
        if (period === filters.period) {
            return
        }

        setSelectedSaleId(null)
        router.get('/consultas-cancelamentos', { period }, { preserveScroll: true, replace: true })
    }

    function openSale(sale) {
        setSelectedSaleId(sale.id)
        cancelForm.reset()
        cancelForm.clearErrors()
    }

    function closeModal() {
        setSelectedSaleId(null)
        cancelForm.reset()
        cancelForm.clearErrors()
    }

    function openInutilizationModal() {
        setShowInutilizationModal(true)
        inutilizationForm.clearErrors()
    }

    function closeInutilizationModal() {
        setShowInutilizationModal(false)
        inutilizationForm.reset()
        inutilizationForm.clearErrors()
    }

    function submitCancel(event) {
        event.preventDefault()

        if (!selectedSale) {
            return
        }

        cancelForm.post(`/consultas-cancelamentos/vendas/${selectedSale.id}/cancelar`, {
            preserveScroll: true,
            onSuccess: () => closeModal(),
        })
    }

    function submitInutilization(event) {
        event.preventDefault()

        inutilizationForm.post('/consultas-cancelamentos/inutilizacoes', {
            preserveScroll: true,
            onSuccess: () => closeInutilizationModal(),
        })
    }

    function submitContingency() {
        if (!selectedSale) {
            return
        }

        cancelForm.post(`/consultas-cancelamentos/vendas/${selectedSale.id}/contingencia`, {
            preserveScroll: true,
            onSuccess: () => closeModal(),
        })
    }

    function retryContingencies() {
        router.post('/consultas-cancelamentos/contingencia/retry', {}, { preserveScroll: true })
    }

    return (
        <AppLayout title="Consultas">
            <div className="fiscal-consultations-page">
                <section className="fiscal-consultations-hero">
                    <div className="fiscal-consultations-heading">
                        <span className="fiscal-consultations-eyebrow">
                            <i className="fa-solid fa-wave-square" />
                            {range.label}
                        </span>

                        <div>
                            <h1>Consultas e cancelamentos</h1>
                            <span>{range.from} - {range.to}</span>
                        </div>
                    </div>

                    <div className="fiscal-consultations-periods">
                        <button className="fiscal-period-pill" onClick={retryContingencies} type="button">
                            <i className="fa-solid fa-rotate" />
                            <span>Reenfileirar</span>
                        </button>

                        <button className="fiscal-period-pill active" onClick={openInutilizationModal} type="button">
                            <i className="fa-solid fa-hashtag" />
                            <span>Inutilizar</span>
                        </button>

                        {periods.map((period) => (
                            <button
                                key={period.key}
                                className={`fiscal-period-pill ${filters.period === period.key ? 'active' : ''}`}
                                onClick={() => changePeriod(period.key)}
                                type="button"
                            >
                                <i className={`fa-solid ${filters.period === period.key ? 'fa-circle-dot' : 'fa-circle'}`} />
                                <span>{period.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="fiscal-consultations-summary">
                    {summary.map((item) => (
                        <article key={item.key} className={`fiscal-summary-card ${toneClass(item.tone)}`}>
                            <div className="fiscal-summary-icon">
                                <i className={`fa-solid ${item.icon}`} />
                            </div>

                            <div className="fiscal-summary-copy">
                                <span>{item.label}</span>
                                <strong>{item.format === 'currency' ? formatCurrency(item.value) : item.value}</strong>
                            </div>
                        </article>
                    ))}
                </section>

                <section className="fiscal-consultations-list">
                    <header className="fiscal-consultations-list-header">
                        <div>
                            <strong>Contingencia</strong>
                            <span>{contingencies.length} recentes</span>
                        </div>

                        <div className="fiscal-list-chip">
                            <i className="fa-solid fa-triangle-exclamation" />
                            <span>Pendencias</span>
                        </div>
                    </header>

                    {contingencies.length === 0 ? (
                        <div className="fiscal-consultations-empty fiscal-consultations-empty-sm">
                            <i className="fa-solid fa-triangle-exclamation" />
                            <span>Sem contingencia</span>
                        </div>
                    ) : (
                        <div className="fiscal-inutilization-grid">
                            {contingencies.map((contingency) => (
                                <article key={contingency.id} className="fiscal-inutilization-card">
                                    <div className="fiscal-sale-card-top">
                                        <div className="fiscal-sale-card-title">
                                            <strong>{contingency.sale_number}</strong>
                                            <span>{formatDateTime(contingency.contingency_requested_at)}</span>
                                        </div>

                                        <StatusChip label={contingency.status_label} tone={contingency.status_tone} />
                                    </div>

                                    <div className="fiscal-sale-card-metrics">
                                        <div>
                                            <span>Documento</span>
                                            <strong>{contingency.document_model} / {contingency.series} / {contingency.number}</strong>
                                        </div>

                                        <div>
                                            <span>Tentativas</span>
                                            <strong>{contingency.contingency_attempts}</strong>
                                        </div>
                                    </div>

                                    <div className="fiscal-sale-card-products">
                                        <span>{contingency.contingency_reason || contingency.last_error || '--'}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="fiscal-consultations-list">
                    <header className="fiscal-consultations-list-header">
                        <div>
                            <strong>Inutilizacoes</strong>
                            <span>{inutilizations.length} recentes</span>
                        </div>

                        <div className="fiscal-list-chip">
                            <i className="fa-solid fa-hashtag" />
                            <span>Faixas</span>
                        </div>
                    </header>

                    {inutilizations.length === 0 ? (
                        <div className="fiscal-consultations-empty fiscal-consultations-empty-sm">
                            <i className="fa-solid fa-hashtag" />
                            <span>Sem inutilizacao</span>
                        </div>
                    ) : (
                        <div className="fiscal-inutilization-grid">
                            {inutilizations.map((inutilization) => (
                                <article key={inutilization.id} className="fiscal-inutilization-card">
                                    <div className="fiscal-sale-card-top">
                                        <div className="fiscal-sale-card-title">
                                            <strong>{inutilization.document_model} / {inutilization.series}</strong>
                                            <span>{formatDateTime(inutilization.created_at)}</span>
                                        </div>

                                        <StatusChip label={inutilization.status_label} tone={inutilization.status_tone} />
                                    </div>

                                    <div className="fiscal-sale-card-metrics">
                                        <div>
                                            <span>Faixa</span>
                                            <strong>{inutilization.number_start} - {inutilization.number_end}</strong>
                                        </div>

                                        <div>
                                            <span>Protocolo</span>
                                            <strong>{inutilization.protocol || '--'}</strong>
                                        </div>
                                    </div>

                                    <div className="fiscal-sale-card-products">
                                        <span>{inutilization.justification}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="fiscal-consultations-list">
                    <header className="fiscal-consultations-list-header">
                        <div>
                            <strong>Vendas</strong>
                            <span>{sales.total} registros</span>
                        </div>

                        <div className="fiscal-list-chip">
                            <i className="fa-solid fa-bolt" />
                            <span>{sales.current_page}/{sales.last_page}</span>
                        </div>
                    </header>

                    {sales.data.length === 0 ? (
                        <div className="fiscal-consultations-empty">
                            <i className="fa-solid fa-receipt" />
                            <span>Sem vendas</span>
                        </div>
                    ) : (
                        <div className="fiscal-sales-grid">
                            {sales.data.map((sale) => (
                                <button
                                    key={sale.id}
                                    className={`fiscal-sale-card ${selectedSale?.id === sale.id ? 'selected' : ''}`}
                                    onClick={() => openSale(sale)}
                                    type="button"
                                >
                                    <div className="fiscal-sale-card-top">
                                        <div className="fiscal-sale-card-title">
                                            <strong>{sale.sale_number}</strong>
                                            <span>{formatDateTime(sale.created_at)}</span>
                                        </div>

                                        <StatusChip label={sale.status_label} tone={sale.status_tone} />
                                    </div>

                                    <div className="fiscal-sale-card-metrics">
                                        <div>
                                            <span>Total</span>
                                            <strong>{formatCurrency(sale.total)}</strong>
                                        </div>

                                        <div>
                                            <span>Cliente</span>
                                            <strong>{sale.recipient.label || 'Consumidor final'}</strong>
                                        </div>
                                    </div>

                                    <div className="fiscal-sale-card-tags">
                                        <span><i className="fa-solid fa-boxes-stacked" />{sale.item_count} item(ns)</span>
                                        <span><i className="fa-solid fa-credit-card" />{sale.payment_method}</span>
                                        <span><i className="fa-solid fa-file-invoice-dollar" />{sale.fiscal_document?.status_label || 'Sem fiscal'}</span>
                                    </div>

                                    <div className="fiscal-sale-card-products">
                                        {sale.products_preview.map((product) => (
                                            <span key={`${sale.id}-${product}`}>{product}</span>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {sales.last_page > 1 ? (
                        <footer className="fiscal-pagination">
                            {sales.links.map((link, index) => (
                                link.url ? (
                                    <Link
                                        key={`${link.label}-${index}`}
                                        className={`fiscal-pagination-link ${link.active ? 'active' : ''}`}
                                        href={link.url}
                                        preserveScroll
                                    >
                                        {link.label}
                                    </Link>
                                ) : (
                                    <span key={`${link.label}-${index}`} className="fiscal-pagination-link disabled">
                                        {link.label}
                                    </span>
                                )
                            ))}
                        </footer>
                    ) : null}
                </section>
            </div>

            <SaleDetailsModal
                cancelForm={cancelForm}
                onCancelSubmit={submitCancel}
                onContingencySubmit={submitContingency}
                onClose={closeModal}
                sale={selectedSale}
            />
            <InutilizationModal
                form={inutilizationForm}
                onClose={closeInutilizationModal}
                onSubmit={submitInutilization}
                visible={showInutilizationModal}
            />
        </AppLayout>
    )
}

function SaleDetailsModal({ sale, onClose, cancelForm, onCancelSubmit, onContingencySubmit }) {
    if (!sale) {
        return null
    }

    const fiscalDocument = sale.fiscal_document
    const fileActions = buildFileActions(fiscalDocument)
    const eventCount = fiscalDocument?.events?.length || 0

    return (
        <div className="fiscal-sale-modal-backdrop" onClick={onClose}>
            <section
                aria-modal="true"
                className="fiscal-sale-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
            >
                <header className="fiscal-sale-modal-header">
                    <div className="fiscal-sale-modal-title">
                        <span className="fiscal-sale-modal-badge">
                            <i className="fa-solid fa-receipt" />
                            {sale.sale_number}
                        </span>

                        <div>
                            <h2>{formatCurrency(sale.total)}</h2>
                            <span>{formatDateTime(sale.created_at)}</span>
                        </div>
                    </div>

                    <div className="fiscal-sale-modal-header-actions">
                        <StatusChip label={sale.status_label} tone={sale.status_tone} />
                        {fiscalDocument ? <StatusChip label={fiscalDocument.status_label} tone={fiscalDocument.status_tone} /> : null}
                        <button className="fiscal-modal-close" onClick={onClose} type="button">
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </header>

                <div className="fiscal-sale-highlight-strip">
                    <MiniMetric icon="fa-boxes-stacked" label="Itens" value={sale.item_count} />
                    <MiniMetric icon="fa-sack-dollar" label="Recebido" value={formatCurrency(sale.cash_received)} />
                    <MiniMetric icon="fa-arrow-rotate-left" label="Troco" value={formatCurrency(sale.change_amount)} />
                    <MiniMetric icon="fa-clock-rotate-left" label="Eventos" value={eventCount} />
                </div>

                <div className="fiscal-sale-modal-grid">
                    <section className="fiscal-modal-panel fiscal-modal-panel-lg">
                        <header><strong><i className="fa-solid fa-box-open" />Itens</strong></header>

                        <div className="fiscal-items-list">
                            {sale.items.map((item) => (
                                <article key={item.id} className="fiscal-item-row">
                                    <div>
                                        <strong>{item.name}</strong>
                                        <span>{item.quantity} {item.unit_label || 'un'} - {formatCurrency(item.unit_price)}</span>
                                    </div>

                                    <div className="fiscal-item-row-meta">
                                        {item.discount_amount > 0 ? <span>- {formatCurrency(item.discount_amount)}</span> : null}
                                        <strong>{formatCurrency(item.total)}</strong>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="fiscal-modal-panel">
                        <header><strong><i className="fa-solid fa-id-card" />Cliente</strong></header>
                        <InfoList
                            items={[
                                ['Nome', sale.recipient.label || 'Consumidor final'],
                                ['Doc', sale.recipient.document || '--'],
                                ['Contato', sale.recipient.phone || sale.recipient.email || '--'],
                                ['Endereco', sale.recipient.address || '--'],
                            ]}
                        />
                    </section>

                    <section className="fiscal-modal-panel">
                        <header><strong><i className="fa-solid fa-credit-card" />Pagamentos</strong></header>
                        <InfoList
                            items={[
                                ...sale.payments.map((payment) => [payment.label, formatCurrency(payment.amount)]),
                                ['Troco', formatCurrency(sale.change_amount)],
                            ]}
                        />
                    </section>

                    <section className="fiscal-modal-panel">
                        <header><strong><i className="fa-solid fa-chart-line" />Totais</strong></header>
                        <InfoList
                            items={[
                                ['Subtotal', formatCurrency(sale.subtotal)],
                                ['Desconto', formatCurrency(sale.discount)],
                                ['Total', formatCurrency(sale.total)],
                                ['Operador', sale.operator_name],
                            ]}
                        />
                    </section>

                    <section className="fiscal-modal-panel fiscal-modal-panel-lg">
                        <header><strong><i className="fa-solid fa-file-invoice-dollar" />Fiscal</strong></header>
                        {fiscalDocument ? (
                            <InfoGrid
                                items={[
                                    ['Modelo', fiscalDocument.document_model],
                                    ['Numero', `${fiscalDocument.number} / ${fiscalDocument.series}`],
                                    ['Status', fiscalDocument.status_label],
                                    ['Protocolo', fiscalDocument.protocol || fiscalDocument.cancellation_protocol || '--'],
                                    ['Chave', fiscalDocument.access_key || '--', true],
                                    ['SEFAZ', fiscalDocument.sefaz_status_code ? `${fiscalDocument.sefaz_status_code} - ${fiscalDocument.sefaz_status_reason || '--'}` : '--', true],
                                    ['Autorizada', formatDateTime(fiscalDocument.authorized_at)],
                                    ['Cancelada', formatDateTime(fiscalDocument.cancelled_at)],
                                    ['Contingencia', formatDateTime(fiscalDocument.contingency_requested_at)],
                                    ['Tentativas', fiscalDocument.contingency_attempts],
                                    ['Motivo', fiscalDocument.cancellation_reason || '--', true],
                                    ['Motivo conting.', fiscalDocument.contingency_reason || '--', true],
                                    ['Erro', fiscalDocument.last_error || '--', true],
                                ]}
                            />
                        ) : (
                            <div className="fiscal-modal-empty">
                                <i className="fa-solid fa-file-circle-minus" />
                                <span>Sem fiscal</span>
                            </div>
                        )}
                    </section>

                    <section className="fiscal-modal-panel">
                        <header><strong><i className="fa-solid fa-folder-tree" />Arquivos</strong></header>
                        {fileActions.length > 0 ? (
                            <div className="fiscal-file-grid">
                                {fileActions.map((action) => (
                                    <Link
                                        key={action.key}
                                        className="fiscal-file-link"
                                        href={action.href}
                                        target="_blank"
                                    >
                                        <i className={`fa-solid ${action.icon}`} />
                                        <span>{action.label}</span>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="fiscal-modal-empty fiscal-modal-empty-sm">
                                <i className="fa-solid fa-folder-open" />
                                <span>Sem arquivos</span>
                            </div>
                        )}
                    </section>

                    <section className="fiscal-modal-panel">
                        <header><strong><i className="fa-solid fa-timeline" />Eventos</strong></header>
                        {eventCount > 0 ? (
                            <div className="fiscal-timeline">
                                {fiscalDocument.events.map((event, index) => (
                                    <article key={`${event.status}-${event.created_at || index}`} className="fiscal-timeline-item">
                                        <div className="fiscal-timeline-marker" />
                                        <div className="fiscal-timeline-body">
                                            <div className="fiscal-timeline-head">
                                                <StatusChip label={eventSourceLabel(event.source)} tone={event.source === 'agent' ? 'info' : 'neutral'} />
                                                <span>{formatDateTime(event.created_at)}</span>
                                            </div>
                                            <strong>{event.message}</strong>
                                            <small>{event.status}</small>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="fiscal-modal-empty fiscal-modal-empty-sm">
                                <i className="fa-solid fa-clock-rotate-left" />
                                <span>Sem eventos</span>
                            </div>
                        )}
                    </section>
                </div>

                <footer className="fiscal-sale-modal-footer">
                    <div className="fiscal-cancel-signal fiscal-cancel-signal-stack">
                        <span><i className="fa-solid fa-circle-info" />{sale.cancel_hint || 'Sem cancelamento disponivel'}</span>
                        <span><i className="fa-solid fa-triangle-exclamation" />{sale.contingency_hint || 'Sem contingencia disponivel'}</span>
                    </div>

                    <form className="fiscal-cancel-form" onSubmit={onCancelSubmit}>
                        <textarea
                            name="reason"
                            onChange={(event) => cancelForm.setData('reason', event.target.value)}
                            placeholder="Motivo do cancelamento ou da contingencia"
                            value={cancelForm.data.reason}
                        />

                        {cancelForm.errors.reason ? <span className="fiscal-form-error">{cancelForm.errors.reason}</span> : null}

                        <div className="fiscal-cancel-actions">
                            <button className="fiscal-secondary-button" onClick={onClose} type="button">
                                <i className="fa-solid fa-arrow-left" />
                                <span>Fechar</span>
                            </button>

                            <button className="fiscal-warning-button" disabled={!sale.can_flag_contingency || cancelForm.processing} onClick={onContingencySubmit} type="button">
                                <i className={`fa-solid ${cancelForm.processing ? 'fa-spinner fa-spin' : 'fa-triangle-exclamation'}`} />
                                <span>{sale.can_flag_contingency ? 'Contingencia' : 'Sem conting.'}</span>
                            </button>

                            <button className="fiscal-danger-button" disabled={!sale.can_cancel || cancelForm.processing} type="submit">
                                <i className={`fa-solid ${cancelForm.processing ? 'fa-spinner fa-spin' : 'fa-ban'}`} />
                                <span>{sale.can_cancel ? 'Cancelar' : 'Bloqueado'}</span>
                            </button>
                        </div>
                    </form>
                </footer>
            </section>
        </div>
    )
}

function MiniMetric({ icon, label, value }) {
    return (
        <div className="fiscal-mini-metric">
            <span><i className={`fa-solid ${icon}`} />{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function StatusChip({ label, tone }) {
    return <span className={`fiscal-status-chip ${toneClass(tone)}`}>{label}</span>
}

function InfoList({ items }) {
    return (
        <div className="fiscal-stack-list">
            {items.map(([label, value]) => (
                <div key={`${label}-${value}`}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                </div>
            ))}
        </div>
    )
}

function InfoGrid({ items }) {
    return (
        <div className="fiscal-stack-list fiscal-stack-grid">
            {items.map(([label, value, full]) => (
                <div key={`${label}-${value}`} className={full ? 'full' : ''}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                </div>
            ))}
        </div>
    )
}

function InutilizationModal({ visible, onClose, onSubmit, form }) {
    if (!visible) {
        return null
    }

    return (
        <div className="fiscal-sale-modal-backdrop" onClick={onClose}>
            <section className="fiscal-sale-modal fiscal-sale-modal-sm" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                <header className="fiscal-sale-modal-header">
                    <div className="fiscal-sale-modal-title">
                        <span className="fiscal-sale-modal-badge">
                            <i className="fa-solid fa-hashtag" />
                            Inutilizacao
                        </span>

                        <div>
                            <h2>Nova faixa</h2>
                            <span>Serie e numeracao</span>
                        </div>
                    </div>

                    <button className="fiscal-modal-close" onClick={onClose} type="button">
                        <i className="fa-solid fa-xmark" />
                    </button>
                </header>

                <form className="fiscal-inutilization-form" onSubmit={onSubmit}>
                    <div className="fiscal-form-grid">
                        <label>
                            <span>Modelo</span>
                            <select name="document_model" value={form.data.document_model} onChange={(event) => form.setData('document_model', event.target.value)}>
                                <option value="65">NFC-e 65</option>
                                <option value="55">NF-e 55</option>
                            </select>
                        </label>

                        <label>
                            <span>Serie</span>
                            <input name="series" type="number" value={form.data.series} onChange={(event) => form.setData('series', event.target.value)} />
                        </label>

                        <label>
                            <span>Inicio</span>
                            <input name="number_start" type="number" value={form.data.number_start} onChange={(event) => form.setData('number_start', event.target.value)} />
                        </label>

                        <label>
                            <span>Fim</span>
                            <input name="number_end" type="number" value={form.data.number_end} onChange={(event) => form.setData('number_end', event.target.value)} />
                        </label>
                    </div>

                    <label>
                        <span>Justificativa</span>
                        <textarea
                            name="justification"
                            onChange={(event) => form.setData('justification', event.target.value)}
                            placeholder="Motivo operacional da inutilizacao"
                            value={form.data.justification}
                        />
                    </label>

                    {Object.values(form.errors).length > 0 ? (
                        <div className="fiscal-form-errors">
                            {Object.entries(form.errors).map(([field, message]) => (
                                <span key={field} className="fiscal-form-error">{message}</span>
                            ))}
                        </div>
                    ) : null}

                    <div className="fiscal-cancel-actions">
                        <button className="fiscal-secondary-button" onClick={onClose} type="button">
                            <i className="fa-solid fa-arrow-left" />
                            <span>Fechar</span>
                        </button>

                        <button className="fiscal-danger-button" disabled={form.processing} type="submit">
                            <i className={`fa-solid ${form.processing ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
                            <span>Enviar</span>
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}
