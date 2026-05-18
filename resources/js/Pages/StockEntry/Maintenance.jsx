import { Link } from '@inertiajs/react'
import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatMoney, formatNumber } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import '../Operations/backoffice-workspace.css'

const PERIOD_FILTERS = [
    { key: 'today', label: 'Hoje' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'all', label: 'Tudo' },
]

function matchesPeriod(record, periodKey) {
    if (periodKey === 'all') {
        return true
    }

    const baseValue = record?.received_at || record?.created_at

    if (!baseValue) {
        return true
    }

    const target = new Date(baseValue)
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (periodKey === 'today') {
        return target >= dayStart
    }

    if (periodKey === 'week') {
        const start = new Date(dayStart)
        start.setDate(dayStart.getDate() - 6)

        return target >= start
    }

    if (periodKey === 'month') {
        const start = new Date(dayStart)
        start.setDate(dayStart.getDate() - 29)

        return target >= start
    }

    return true
}

export default function StockEntryMaintenance({ moduleTitle = 'Manutencao de entradas', payload }) {
    const records = Array.isArray(payload?.records) ? payload.records : []
    const importedDocuments = Array.isArray(payload?.incoming_nfe_documents) ? payload.incoming_nfe_documents : []

    const [search, setSearch] = useState('')
    const [periodFilter, setPeriodFilter] = useState('month')
    const [selectedId, setSelectedId] = useState(records[0]?.id ?? null)

    const normalizedSearch = normalizeTextSearch(search)
    const filteredRecords = useMemo(() => (
        records.filter((record) => {
            if (!matchesPeriod(record, periodFilter)) {
                return false
            }

            if (!normalizedSearch) {
                return true
            }

            return matchesTextSearchAny([
                record.invoice_number,
                record.document,
                record.supplier_name,
                record.code,
            ], normalizedSearch)
        })
    ), [normalizedSearch, periodFilter, records])

    const selectedRecord = useMemo(
        () => filteredRecords.find((record) => record.id === selectedId) || records.find((record) => record.id === selectedId) || null,
        [filteredRecords, records, selectedId],
    )

    const selectedDocument = useMemo(() => {
        if (!selectedRecord) {
            return null
        }

        return importedDocuments.find((document) => (
            String(document.purchase_id || '') === String(selectedRecord.id)
            || String(document.access_key || '') === String(selectedRecord.invoice_access_key || '')
        )) || null
    }, [importedDocuments, selectedRecord])

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page">
                <div className="proc-ui-shell">
                    <section className="proc-ui-main-card">
                        <div className="proc-ui-main-header">
                            <div>
                                <h2>{selectedRecord ? `NF ${selectedRecord.invoice_number || selectedRecord.code}` : moduleTitle}</h2>
                                {selectedRecord?.supplier_name ? <span className="proc-ui-muted">{selectedRecord.supplier_name}</span> : null}
                            </div>

                            <div className="proc-ui-statusline">
                                <Link className="ui-button" href="/entrada-estoque">
                                    <i className="fa-solid fa-plus" />
                                    <span>Nova entrada</span>
                                </Link>
                            </div>
                        </div>

                        {selectedRecord ? (
                            <div className="proc-ui-stage">
                                <div className="proc-ui-summary-grid">
                                    <article className="proc-ui-summary-card">
                                        <span>NF</span>
                                        <strong>{selectedRecord.invoice_number || '-'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Fornecedor</span>
                                        <strong>{selectedRecord.supplier_name || '-'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Recebimento</span>
                                        <strong>{selectedRecord.received_at ? formatDate(selectedRecord.received_at) : '-'}</strong>
                                    </article>
                                    <article className="proc-ui-summary-card">
                                        <span>Total</span>
                                        <strong>{formatMoney(selectedRecord.total || 0)}</strong>
                                    </article>
                                </div>

                                <section className="proc-ui-review-card">
                                    <div className="proc-ui-card-toolbar">
                                        <div className="proc-ui-section-title">
                                            <h3>Documento</h3>
                                        </div>
                                        <StatusBadge compact label={selectedRecord.supplier_name || 'Entrada'} tone="info" />
                                    </div>

                                    <div className="proc-ui-two-grid">
                                        <div className="proc-ui-mini-card">
                                            <span>Serie</span>
                                            <strong>{selectedRecord.invoice_series || '-'}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Data NF</span>
                                            <strong>{selectedRecord.invoice_date ? formatDate(selectedRecord.invoice_date) : '-'}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Volumes</span>
                                            <strong>{formatNumber(selectedRecord.quantity_total || 0)}</strong>
                                        </div>
                                        <div className="proc-ui-mini-card">
                                            <span>Itens</span>
                                            <strong>{formatNumber(selectedRecord.items_count || 0)}</strong>
                                        </div>
                                    </div>

                                    <div className="proc-ui-card-toolbar">
                                        <button
                                            type="button"
                                            className="ui-button-ghost"
                                            disabled={!selectedDocument?.danfe_available}
                                            onClick={() => {
                                                if (selectedDocument?.id) {
                                                    window.open(`/api/purchases/incoming-nfe/${selectedDocument.id}/danfe`, '_blank', 'noopener,noreferrer')
                                                }
                                            }}
                                        >
                                            <i className="fa-solid fa-print" />
                                            <span>Espelho NF</span>
                                        </button>

                                        <button type="button" className="ui-button-ghost" disabled title="Cancelamento indisponivel por rastreabilidade.">
                                            <i className="fa-solid fa-xmark" />
                                            <span>Cancelar</span>
                                        </button>
                                    </div>
                                </section>

                                <section className="proc-ui-section-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Itens</h3>
                                    </div>

                                    <div className="proc-ui-table-wrap">
                                        <table className="proc-ui-table">
                                            <thead>
                                                <tr>
                                                    <th>Produto</th>
                                                    <th>Qtd</th>
                                                    <th>Custo</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(selectedRecord.items || []).length ? selectedRecord.items.map((item, index) => (
                                                    <tr key={`${selectedRecord.id}-item-${index}`}>
                                                        <td>
                                                            <div className="proc-ui-record-card-copy">
                                                                <strong>{item.product_name}</strong>
                                                                <span>{item.product_id ? `Produto #${item.product_id}` : '-'}</span>
                                                            </div>
                                                        </td>
                                                        <td>{formatNumber(item.quantity || 0)}</td>
                                                        <td>{formatMoney(item.unit_cost || 0)}</td>
                                                        <td><strong>{formatMoney(item.total || 0)}</strong></td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan="4">
                                                            <div className="proc-ui-empty">
                                                                <strong>Sem itens</strong>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="proc-ui-empty">
                                <strong>Sem entrada selecionada</strong>
                            </div>
                        )}
                    </section>

                    <aside className="proc-ui-sidebar">
                        <div className="proc-ui-sidebar-section">
                            <input className="proc-ui-searchbox" type="search" placeholder="Buscar NF ou fornecedor" value={search} onChange={(event) => setSearch(event.target.value)} />
                        </div>

                        <div className="proc-ui-sidebar-section">
                            <div className="proc-ui-chip-row">
                                {PERIOD_FILTERS.map((filter) => (
                                    <button key={filter.key} type="button" className={`proc-ui-chip ${periodFilter === filter.key ? 'active' : ''}`} onClick={() => setPeriodFilter(filter.key)}>
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-list">
                            {filteredRecords.length ? filteredRecords.map((record) => (
                                <button key={record.id} type="button" className={`proc-ui-record-card ${record.id === selectedId ? 'active' : ''}`} onClick={() => setSelectedId(record.id)}>
                                    <div className="proc-ui-record-card-top">
                                        <strong>{record.invoice_number || record.code}</strong>
                                        <StatusBadge compact label={record.supplier_name || 'Entrada'} tone="info" />
                                    </div>

                                    <div className="proc-ui-record-card-copy">
                                        <strong>{formatMoney(record.total || 0)}</strong>
                                        <span>{`${formatNumber(record.quantity_total || 0)} un | ${record.received_at ? formatDate(record.received_at) : 'Sem data'}`}</span>
                                    </div>
                                </button>
                            )) : (
                                <div className="proc-ui-empty">
                                    <strong>Sem entradas</strong>
                                </div>
                            )}
                        </div>

                        <div className="proc-ui-footer-totals">
                            <span>Total: <strong>{formatMoney(filteredRecords.reduce((carry, record) => carry + Number(record.total || 0), 0))}</strong></span>
                            <span>Volumes: <strong>{formatNumber(filteredRecords.reduce((carry, record) => carry + Number(record.quantity_total || 0), 0))}</strong></span>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    )
}
