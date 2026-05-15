import { Link, router, useForm } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import PageContainer from '@/Components/UI/PageContainer'
import CompactModal from '@/Components/UI/CompactModal'
import DenseTable from '@/Components/UI/DenseTable'
import StatusBadge from '@/Components/UI/StatusBadge'
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

    if (files.authorized_xml_url || files.cancelled_xml_url || (fiscalDocument.mode === 'contingency_offline' && files.signed_xml_url)) {
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

function MiniMetric({ icon, label, value }) {
    return (
        <article className="fiscal-detail-metric">
            <span>
                <i className={`fa-solid ${icon}`} />
                {label}
            </span>
            <strong>{value}</strong>
        </article>
    )
}

function InfoList({ items }) {
    return (
        <div className="fiscal-detail-info-list">
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
        <div className="fiscal-detail-info-grid">
            {items.map(([label, value, full]) => (
                <div key={`${label}-${value}`} className={full ? 'full' : ''}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                </div>
            ))}
        </div>
    )
}

export default function FiscalConsultationsPage({ filters, periods, summary, range, sales }) {
    const [selectedSaleId, setSelectedSaleId] = useState(null)
    const cancelForm = useForm({ reason: '' })
    const rangeForm = useForm({
        from: filters.from || range.from || '',
        to: filters.to || range.to || '',
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

    useEffect(() => {
        rangeForm.setData({
            from: filters.from || range.from || '',
            to: filters.to || range.to || '',
        })
    }, [filters.from, filters.to, range.from, range.to])

    function changePeriod(period) {
        if (period === filters.period) {
            return
        }

        setSelectedSaleId(null)
        router.get('/consultas-cancelamentos', { period }, { preserveScroll: true, replace: true })
    }

    function applyCustomRange(event) {
        event.preventDefault()

        setSelectedSaleId(null)
        router.get('/consultas-cancelamentos', {
            period: 'custom',
            from: rangeForm.data.from,
            to: rangeForm.data.to,
        }, {
            preserveScroll: true,
            replace: true,
        })
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

    return (
        <AppLayout title="Vendas">
            <div className="fiscal-consultations-page fiscal-compact-page">
                <PageContainer className="fiscal-page-container">
                    <div className="fiscal-compact-stack">
                        <section className="fiscal-compact-toolbar">
                            <div className="fiscal-compact-heading">
                                <StatusBadge compact icon="fa-wave-square" label={range.label} tone="info" />
                                <div>
                                    <strong>Vendas do periodo</strong>
                                    <span>Acompanhe faturamento, cancelamentos e documentos emitidos.</span>
                                </div>
                            </div>

                            <div className="fiscal-filter-stack">
                                <div className="ui-tabs fiscal-period-tabs">
                                    {periods.map((period) => (
                                        <button
                                            key={period.key}
                                            className={`ui-tab ${filters.period === period.key ? 'active' : ''}`}
                                            onClick={() => changePeriod(period.key)}
                                            type="button"
                                        >
                                            <i className={`fa-solid ${filters.period === period.key ? 'fa-circle-dot' : 'fa-circle'}`} />
                                            <span>{period.label}</span>
                                        </button>
                                    ))}
                                    {filters.period === 'custom' ? (
                                        <span className="fiscal-custom-indicator">
                                            <i className="fa-solid fa-calendar-days" />
                                            <span>Personalizado</span>
                                        </span>
                                    ) : null}
                                </div>

                                <form className="fiscal-custom-range-form" onSubmit={applyCustomRange}>
                                    <label>
                                        <span>De</span>
                                        <input
                                            type="date"
                                            value={rangeForm.data.from}
                                            onChange={(event) => rangeForm.setData('from', event.target.value)}
                                        />
                                    </label>
                                    <label>
                                        <span>Ate</span>
                                        <input
                                            type="date"
                                            value={rangeForm.data.to}
                                            onChange={(event) => rangeForm.setData('to', event.target.value)}
                                        />
                                    </label>
                                    <button type="submit" className="fiscal-range-apply">
                                        <i className="fa-solid fa-calendar-check" />
                                        <span>Aplicar</span>
                                    </button>
                                </form>
                            </div>
                        </section>

                        <section className="fiscal-compact-summary">
                            {summary.map((item) => (
                                <article key={item.key} className={`fiscal-summary-card compact ${toneClass(item.tone)}`}>
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

                        <section className="fiscal-sales-panel">
                            <header className="fiscal-sales-panel-head">
                                <div>
                                    <strong>Vendas e cancelamentos</strong>
                                    <span>{sales.total} registro(s) em {range.from} ate {range.to}</span>
                                </div>
                                <StatusBadge compact icon="fa-receipt" label={`${sales.current_page}/${sales.last_page}`} tone="warning" />
                            </header>

                            <DenseTable
                                className="fiscal-sales-table"
                                columns={[
                                    { key: 'saleNumber', label: 'Venda', render: (sale) => <strong>{sale.sale_number}</strong> },
                                    { key: 'createdAt', label: 'Data', render: (sale) => formatDateTime(sale.created_at) },
                                    { key: 'recipient', label: 'Cliente', render: (sale) => sale.recipient.label || 'Consumidor final' },
                                    { key: 'total', label: 'Valor', render: (sale) => formatCurrency(sale.total) },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (sale) => <StatusBadge compact label={sale.status_label} tone={sale.status_tone} />,
                                    },
                                    {
                                        key: 'fiscal',
                                        label: 'Fiscal',
                                        render: (sale) => sale.fiscal_document
                                            ? <StatusBadge compact label={sale.fiscal_document.status_label} tone={sale.fiscal_document.status_tone} />
                                            : <StatusBadge compact label="Sem fiscal" tone="neutral" />,
                                    },
                                ]}
                                rows={sales.data}
                                rowKey="id"
                                selectedRowKey={selectedSale?.id}
                                onRowClick={openSale}
                                showActionLabels
                                emptyState={<div className="fiscal-dense-empty"><i className="fa-solid fa-receipt" /><span>Sem vendas no periodo selecionado.</span></div>}
                                getRowActions={(sale) => [
                                    {
                                        key: 'view',
                                        icon: 'fa-eye',
                                        label: 'Ver',
                                        tone: 'primary',
                                        onClick: () => openSale(sale),
                                    },
                                    sale.can_cancel ? {
                                        key: 'cancel',
                                        icon: 'fa-ban',
                                        label: 'Cancelar',
                                        tone: 'danger',
                                        onClick: () => openSale(sale),
                                    } : null,
                                    sale.can_flag_contingency ? {
                                        key: 'pending',
                                        icon: 'fa-triangle-exclamation',
                                        label: 'Pendente',
                                        tone: 'info',
                                        onClick: () => openSale(sale),
                                    } : null,
                                ]}
                            />

                            {sales.last_page > 1 ? (
                                <footer className="fiscal-pagination compact">
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
                </PageContainer>
            </div>

            <SaleDetailsModal
                cancelForm={cancelForm}
                onCancelSubmit={submitCancel}
                onClose={closeModal}
                sale={selectedSale}
            />
        </AppLayout>
    )
}

function SaleDetailsModal({ sale, onClose, cancelForm, onCancelSubmit }) {
    if (!sale) {
        return null
    }

    const fiscalDocument = sale.fiscal_document
    const fileActions = buildFileActions(fiscalDocument)
    const eventCount = fiscalDocument?.events?.length || 0

    return (
        <CompactModal
            open={Boolean(sale)}
            title={sale.sale_number}
            description={`${formatDateTime(sale.created_at)} • ${formatCurrency(sale.total)}`}
            icon="fa-receipt"
            size="lg"
            onClose={onClose}
        >
            <div className="fiscal-detail-stack">
                <div className="fiscal-detail-top">
                    <StatusBadge label={sale.status_label} tone={sale.status_tone} />
                    {fiscalDocument ? <StatusBadge label={fiscalDocument.status_label} tone={fiscalDocument.status_tone} /> : null}
                </div>

                <section className="fiscal-detail-metrics">
                    <MiniMetric icon="fa-boxes-stacked" label="Itens" value={sale.item_count} />
                    <MiniMetric icon="fa-sack-dollar" label="Recebido" value={formatCurrency(sale.cash_received)} />
                    <MiniMetric icon="fa-arrow-rotate-left" label="Troco" value={formatCurrency(sale.change_amount)} />
                    <MiniMetric icon="fa-clock-rotate-left" label="Eventos" value={eventCount} />
                </section>

                <div className="fiscal-detail-grid">
                    <section className="fiscal-detail-panel span-2">
                        <header><strong>Itens</strong></header>
                        <DenseTable
                            columns={[
                                { key: 'name', label: 'Item', render: (item) => item.name },
                                { key: 'quantity', label: 'Qtd', render: (item) => `${item.quantity} ${item.unit_label || 'un'}` },
                                { key: 'unitPrice', label: 'Unit.', render: (item) => formatCurrency(item.unit_price) },
                                { key: 'discount', label: 'Desc.', render: (item) => item.discount_amount > 0 ? formatCurrency(item.discount_amount) : '--' },
                                { key: 'total', label: 'Total', render: (item) => formatCurrency(item.total) },
                            ]}
                            rows={sale.items}
                            rowKey="id"
                            emptyState={<div className="fiscal-dense-empty"><i className="fa-solid fa-box-open" /><span>Sem itens.</span></div>}
                            minWidth={620}
                        />
                    </section>

                    <section className="fiscal-detail-panel">
                        <header><strong>Cliente</strong></header>
                        <InfoList
                            items={[
                                ['Nome', sale.recipient.label || 'Consumidor final'],
                                ['Doc', sale.recipient.document || '--'],
                                ['Contato', sale.recipient.phone || sale.recipient.email || '--'],
                                ['Endereco', sale.recipient.address || '--'],
                            ]}
                        />
                    </section>

                    <section className="fiscal-detail-panel">
                        <header><strong>Pagamentos</strong></header>
                        <InfoList
                            items={[
                                ...sale.payments.map((payment) => [payment.label, formatCurrency(payment.amount)]),
                                ['Troco', formatCurrency(sale.change_amount)],
                            ]}
                        />
                    </section>

                    <section className="fiscal-detail-panel">
                        <header><strong>Totais</strong></header>
                        <InfoList
                            items={[
                                ['Subtotal', formatCurrency(sale.subtotal)],
                                ['Desconto', formatCurrency(sale.discount)],
                                ['Total', formatCurrency(sale.total)],
                                ['Operador', sale.operator_name],
                            ]}
                        />
                    </section>

                    <section className="fiscal-detail-panel span-2">
                        <header><strong>Fiscal</strong></header>
                        {fiscalDocument ? (
                            <InfoGrid
                                items={[
                                    ['Modelo', fiscalDocument.document_model],
                                    ['Modo', fiscalDocument.mode === 'contingency_offline' ? 'Offline legal' : (fiscalDocument.mode || '--')],
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
                            <div className="fiscal-dense-empty"><i className="fa-solid fa-file-circle-minus" /><span>Sem documento fiscal.</span></div>
                        )}
                    </section>

                    <section className="fiscal-detail-panel">
                        <header><strong>Arquivos</strong></header>
                        {fileActions.length > 0 ? (
                            <div className="fiscal-file-grid compact">
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
                            <div className="fiscal-dense-empty"><i className="fa-solid fa-folder-open" /><span>Sem arquivos.</span></div>
                        )}
                    </section>

                    <section className="fiscal-detail-panel">
                        <header><strong>Eventos</strong></header>
                        {eventCount > 0 ? (
                            <div className="fiscal-timeline compact">
                                {fiscalDocument.events.map((event, index) => (
                                    <article key={`${event.status}-${event.created_at || index}`} className="fiscal-timeline-item">
                                        <div className="fiscal-timeline-marker" />
                                        <div className="fiscal-timeline-body">
                                            <div className="fiscal-timeline-head">
                                                <StatusBadge compact label={eventSourceLabel(event.source)} tone={event.source === 'agent' ? 'info' : 'warning'} />
                                                <span>{formatDateTime(event.created_at)}</span>
                                            </div>
                                            <strong>{event.message}</strong>
                                            <small>{event.status}</small>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="fiscal-dense-empty"><i className="fa-solid fa-clock-rotate-left" /><span>Sem eventos.</span></div>
                        )}
                    </section>
                </div>

                <form className="fiscal-detail-actions" onSubmit={onCancelSubmit}>
                    <div className="fiscal-cancel-signal fiscal-cancel-signal-stack compact">
                        <span><i className="fa-solid fa-circle-info" />{sale.cancel_hint || 'Sem cancelamento disponivel'}</span>
                        <span><i className="fa-solid fa-triangle-exclamation" />{sale.contingency_hint || 'Sem contingencia disponivel'}</span>
                    </div>

                    <textarea
                        name="reason"
                        onChange={(event) => cancelForm.setData('reason', event.target.value)}
                        placeholder="Motivo do cancelamento ou da contingencia"
                        value={cancelForm.data.reason}
                    />

                    {cancelForm.errors.reason ? <span className="fiscal-form-error">{cancelForm.errors.reason}</span> : null}

                    <div className="fiscal-cancel-actions compact">
                        <button className="fiscal-secondary-button" onClick={onClose} type="button">
                            <i className="fa-solid fa-arrow-left" />
                            <span>Fechar</span>
                        </button>

                        <button className="fiscal-danger-button" disabled={!sale.can_cancel || cancelForm.processing} type="submit">
                            <i className={`fa-solid ${cancelForm.processing ? 'fa-spinner fa-spin' : 'fa-ban'}`} />
                            <span>{sale.can_cancel ? 'Cancelar venda' : 'Bloqueado'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </CompactModal>
    )
}
