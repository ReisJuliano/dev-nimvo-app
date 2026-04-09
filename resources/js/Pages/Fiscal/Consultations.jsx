import { Link, router, useForm } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import './consultations.css'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0))

function formatDateTime(value) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

const toneClass = (tone) => `tone-${tone || 'neutral'}`

export default function FiscalConsultationsPage({ filters, periods, summary, range, sales }) {
    const [selectedSaleId, setSelectedSaleId] = useState(null)
    const cancelForm = useForm({ reason: '' })

    const selectedSale = useMemo(
        () => sales.data.find((sale) => sale.id === selectedSaleId) || null,
        [sales.data, selectedSaleId],
    )

    useEffect(() => {
        if (!selectedSaleId) return
        if (!sales.data.some((sale) => sale.id === selectedSaleId)) {
            setSelectedSaleId(null)
            cancelForm.reset()
            cancelForm.clearErrors()
        }
    }, [cancelForm, sales.data, selectedSaleId])

    function changePeriod(period) {
        if (period === filters.period) return
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

    function submitCancel(event) {
        event.preventDefault()
        if (!selectedSale) return

        cancelForm.post(`/consultas-cancelamentos/vendas/${selectedSale.id}/cancelar`, {
            preserveScroll: true,
            onSuccess: () => closeModal(),
        })
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
                            <span>{range.from} • {range.to}</span>
                        </div>
                    </div>

                    <div className="fiscal-consultations-periods">
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
                                        <span className={`fiscal-status-chip ${toneClass(sale.status_tone)}`}>{sale.status_label}</span>
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
                                        <span><i className="fa-solid fa-file-waveform" />{sale.fiscal_document?.status_label || 'Sem fiscal'}</span>
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

            <SaleDetailsModal sale={selectedSale} onClose={closeModal} cancelForm={cancelForm} onCancelSubmit={submitCancel} />
        </AppLayout>
    )
}

function SaleDetailsModal({ sale, onClose, cancelForm, onCancelSubmit }) {
    if (!sale) return null

    const fiscalDocument = sale.fiscal_document

    return (
        <div className="fiscal-sale-modal-backdrop" onClick={onClose}>
            <section className="fiscal-sale-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
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
                        <span className={`fiscal-status-chip ${toneClass(sale.status_tone)}`}>{sale.status_label}</span>
                        {fiscalDocument ? <span className={`fiscal-status-chip ${toneClass(fiscalDocument.status_tone)}`}>{fiscalDocument.status_label}</span> : null}
                        <button className="fiscal-modal-close" onClick={onClose} type="button">
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                </header>

                <div className="fiscal-sale-modal-grid">
                    <section className="fiscal-modal-panel fiscal-modal-panel-lg">
                        <header><strong><i className="fa-solid fa-box-open" />Itens</strong></header>
                        <div className="fiscal-items-list">
                            {sale.items.map((item) => (
                                <article key={item.id} className="fiscal-item-row">
                                    <div>
                                        <strong>{item.name}</strong>
                                        <span>{item.quantity} {item.unit_label || 'un'} • {formatCurrency(item.unit_price)}</span>
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
                                    ['SEFAZ', fiscalDocument.sefaz_status_code ? `${fiscalDocument.sefaz_status_code} • ${fiscalDocument.sefaz_status_reason || '--'}` : '--', true],
                                    ['Autorizada', formatDateTime(fiscalDocument.authorized_at)],
                                    ['Cancelada', formatDateTime(fiscalDocument.cancelled_at)],
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
                </div>

                <footer className="fiscal-sale-modal-footer">
                    <div className="fiscal-cancel-signal">
                        <span><i className="fa-solid fa-circle-info" />{sale.cancel_hint || 'Sem cancelamento disponivel'}</span>
                    </div>

                    <form className="fiscal-cancel-form" onSubmit={onCancelSubmit}>
                        <textarea
                            name="reason"
                            onChange={(event) => cancelForm.setData('reason', event.target.value)}
                            placeholder="Justificativa do cancelamento"
                            value={cancelForm.data.reason}
                        />
                        {cancelForm.errors.reason ? <span className="fiscal-form-error">{cancelForm.errors.reason}</span> : null}
                        <div className="fiscal-cancel-actions">
                            <button className="fiscal-secondary-button" onClick={onClose} type="button">
                                <i className="fa-solid fa-arrow-left" />
                                <span>Fechar</span>
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
