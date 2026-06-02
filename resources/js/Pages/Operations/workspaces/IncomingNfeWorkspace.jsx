import { useEffect, useMemo, useState } from 'react'
import { confirmPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney, formatNumber } from '@/lib/format'
import { Badge, EmptyState, Feedback, FeedbackHeader, ListCard } from './shared'

function FieldLabel({ icon, text }) {
    return (
        <span className="ops-workspace-label-with-icon">
            <i className={`fa-solid ${icon}`} />
            {text}
        </span>
    )
}

function digits(value) {
    return String(value || '').replace(/\D+/g, '')
}

function toDateTimeLocal(value) {
    return value ? String(value).slice(0, 16) : ''
}

function toneByStatus(status) {
    if (['processed', 'authorized', 'verified', 'confirmed', 'posted', 'ready', 'matched'].includes(status)) return 'success'
    if (['pending', 'pending_review', 'pending_receipt', 'summary_only', 'review_required', 'divergent', 'unknown', 'science'].includes(status)) return 'warning'
    return 'info'
}

function upsertIncomingRecord(records, record) {
    const exists = records.some((entry) => entry.id === record.id)

    return exists ? records.map((entry) => (entry.id === record.id ? record : entry)) : [record, ...records]
}

function mergeOption(options, candidate) {
    if (!candidate?.id) return options
    if (options.some((entry) => String(entry.id) === String(candidate.id))) return options

    return [candidate, ...options]
}

export default function IncomingNfeWorkspace({ payload }) {
    const [records, setRecords] = useState(payload.incoming_nfe_documents || [])
    const [suppliers, setSuppliers] = useState(payload.suppliers || [])
    const [products] = useState(payload.products || [])
    const [integrationStatus, setIntegrationStatus] = useState(payload.incoming_nfe_status || {})
    const [filters, setFilters] = useState({ from: '', to: '', number: '', supplier: '' })
    const [syncAccessKey, setSyncAccessKey] = useState('')
    const [xmlText, setXmlText] = useState('')
    const [xmlFile, setXmlFile] = useState(null)
    const [selectedId, setSelectedId] = useState((payload.incoming_nfe_documents || [])[0]?.id ?? null)
    const [supplierLinkId, setSupplierLinkId] = useState('')
    const [purchaseLinkId, setPurchaseLinkId] = useState('')
    const [costMethod, setCostMethod] = useState(payload.cost_methods?.[0]?.value || 'last_cost')
    const [autoCreateMissing, setAutoCreateMissing] = useState(false)
    const [receiptAt, setReceiptAt] = useState('')
    const [manifestEvent, setManifestEvent] = useState('science')
    const [manifestJustification, setManifestJustification] = useState('')
    const [busyAction, setBusyAction] = useState(null)
    const [feedback, setFeedback] = useState(null)

    const filteredRecords = useMemo(() => {
        return records.filter((record) => {
            const issuedDate = String(record.issued_at || '').slice(0, 10)
            const numberMatch = !filters.number || String(record.number || '').includes(filters.number)
            const supplierText = `${record.supplier_name || ''} ${record.supplier_document || ''}`.toLowerCase()
            const supplierMatch = !filters.supplier || supplierText.includes(filters.supplier.toLowerCase())
            const fromMatch = !filters.from || !issuedDate || issuedDate >= filters.from
            const toMatch = !filters.to || !issuedDate || issuedDate <= filters.to

            return numberMatch && supplierMatch && fromMatch && toMatch
        })
    }, [filters, records])

    const selectedRecord = useMemo(
        () => records.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null,
        [filteredRecords, records, selectedId],
    )

    const matchedSupplier = useMemo(() => {
        if (!selectedRecord) return null
        const byRecord = suppliers.find((entry) => String(entry.id) === String(selectedRecord.supplier_id))
        if (byRecord) return byRecord

        return suppliers.find((entry) => digits(entry.document) === digits(selectedRecord.supplier_document))
    }, [selectedRecord, suppliers])

    const purchaseOptions = useMemo(() => {
        return (payload.records || []).map((record) => ({
            id: record.id,
            code: record.code,
            supplier_name: record.supplier_name,
            status: record.status,
        }))
    }, [payload.records])

    const linkedPurchase = useMemo(() => {
        if (!selectedRecord?.purchase_id) return null

        return purchaseOptions.find((entry) => String(entry.id) === String(selectedRecord.purchase_id)) || null
    }, [purchaseOptions, selectedRecord?.purchase_id])

    useEffect(() => {
        if (selectedRecord && selectedRecord.id !== selectedId) {
            setSelectedId(selectedRecord.id)
        }
    }, [selectedId, selectedRecord])

    useEffect(() => {
        setSupplierLinkId(matchedSupplier?.id ? String(matchedSupplier.id) : '')
    }, [matchedSupplier?.id, selectedRecord?.id])

    useEffect(() => {
        setPurchaseLinkId(selectedRecord?.purchase_id ? String(selectedRecord.purchase_id) : '')
        setReceiptAt(toDateTimeLocal(selectedRecord?.physical_received_at || selectedRecord?.authorized_at || selectedRecord?.issued_at))
    }, [selectedRecord?.id, selectedRecord?.purchase_id, selectedRecord?.physical_received_at, selectedRecord?.authorized_at, selectedRecord?.issued_at])

    function replaceRecord(record) {
        setRecords((current) => upsertIncomingRecord(current, record))
        setSelectedId(record.id)
    }

    async function handleSync() {
        setBusyAction('sync')
        setFeedback(null)
        try {
            const response = await apiRequest('/api/purchases/incoming-nfe/sync', {
                method: 'post',
                data: { access_key: syncAccessKey || null },
            })
            setRecords((current) => {
                let next = [...current]
                for (const record of response.records || []) {
                    next = upsertIncomingRecord(next, record)
                }
                return next
            })
            setIntegrationStatus(response.status || integrationStatus)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleImportXml() {
        setBusyAction('import')
        setFeedback(null)
        try {
            const data = new FormData()
            if (xmlText.trim()) data.append('xml', xmlText)
            if (xmlFile) data.append('file', xmlFile)

            const response = await apiRequest('/api/purchases/incoming-nfe/import-xml', {
                method: 'post',
                data,
            })

            replaceRecord(response.record)
            setIntegrationStatus(response.status || integrationStatus)
            setXmlText('')
            setXmlFile(null)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleSupplierLink() {
        if (!selectedRecord || !supplierLinkId) return

        setBusyAction('supplier')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/mappings`, {
                method: 'put',
                data: { supplier_id: Number(supplierLinkId) },
            })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handlePurchaseLink() {
        if (!selectedRecord) return

        setBusyAction('purchase-link')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/mappings`, {
                method: 'put',
                data: { purchase_id: purchaseLinkId ? Number(purchaseLinkId) : null },
            })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleQuickSupplierCreate() {
        if (!selectedRecord) return

        setBusyAction('quick-supplier')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/supplier/quick`, {
                method: 'post',
            })
            replaceRecord(response.record)
            setSuppliers((current) => mergeOption(current, {
                id: response.record.supplier_id,
                name: response.record.supplier_name,
                document: response.record.supplier_document,
            }))
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleItemLink(itemId, productId) {
        if (!selectedRecord) return

        setBusyAction(`item-${itemId}`)
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/mappings`, {
                method: 'put',
                data: { items: [{ id: itemId, product_id: productId ? Number(productId) : null }] },
            })
            replaceRecord(response.record)
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleItemAutoCreate(itemId) {
        if (!selectedRecord) return

        setBusyAction(`item-auto-${itemId}`)
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/mappings`, {
                method: 'put',
                data: { items: [{ id: itemId, action: 'auto_create' }] },
            })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleReprocess() {
        if (!selectedRecord) return

        setBusyAction('reprocess')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/reprocess`, { method: 'post' })
            replaceRecord(response.record)
            setIntegrationStatus(response.status || integrationStatus)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleValidateWithSefaz() {
        if (!selectedRecord) return

        setBusyAction('validate-sefaz')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/validate-sefaz`, { method: 'post' })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleManifest() {
        if (!selectedRecord) return

        setBusyAction('manifest')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/manifest`, {
                method: 'post',
                data: {
                    event: manifestEvent,
                    justification: manifestJustification || null,
                },
            })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handlePhysicalReceipt() {
        if (!selectedRecord) return

        setBusyAction('physical-receipt')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/physical-receipt`, {
                method: 'post',
                data: {
                    received_at: receiptAt || null,
                },
            })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    async function handleConfirm() {
        if (!selectedRecord) return

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Confirmar entrada por NF-e',
            message: `Lancar a NF-e ${selectedRecord.number}/${selectedRecord.series} no estoque agora?`,
            confirmLabel: 'Confirmar entrada',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) return

        setBusyAction('confirm')
        setFeedback(null)
        try {
            const response = await apiRequest(`/api/purchases/incoming-nfe/${selectedRecord.id}/confirm`, {
                method: 'post',
                data: {
                    cost_method: costMethod,
                    auto_create_missing: autoCreateMissing,
                    purchase_id: purchaseLinkId ? Number(purchaseLinkId) : null,
                    received_at: receiptAt || null,
                },
            })
            replaceRecord(response.record)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className="ops-workspace-stack">
            <div className="ops-workspace-grid two-columns">
                <section className="ops-workspace-panel">
                    <FeedbackHeader title="Consulta e importação" subtitle="SEFAZ ou XML" />
                    <Feedback feedback={feedback} />
                    <div className="ops-nfe-status-card">
                        <strong>{integrationStatus.configured ? 'Integração fiscal pronta' : 'Integração fiscal pendente'}</strong>
                        <p>{integrationStatus.message || 'Configure o certificado A1.'}</p>
                        <div className="ops-workspace-list-card-meta">
                            <span>{integrationStatus.recipient_name || 'Perfil fiscal não informado'}</span>
                            <span>{integrationStatus.recipient_document || 'Sem CNPJ ativo'}</span>
                        </div>
                    </div>
                    <div className="ops-workspace-form-grid">
                        <label>
                            <FieldLabel icon="fa-calendar-day" text="Periodo inicial" />
                            <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-calendar-check" text="Periodo final" />
                            <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
                        </label>
                        <label>
                            <FieldLabel icon="fa-hashtag" text="Numero da nota" />
                            <input value={filters.number} onChange={(event) => setFilters((current) => ({ ...current, number: event.target.value }))} placeholder="Ex.: 1523" />
                        </label>
                        <label>
                            <FieldLabel icon="fa-truck-ramp-box" text="Fornecedor" />
                            <input value={filters.supplier} onChange={(event) => setFilters((current) => ({ ...current, supplier: event.target.value }))} placeholder="Nome ou CNPJ" />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-key" text="Chave de acesso" />
                            <input value={syncAccessKey} onChange={(event) => setSyncAccessKey(event.target.value)} placeholder="Opcional" />
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <button type="button" className="ui-button-ghost" onClick={handleSync} disabled={busyAction === 'sync'}>
                                {busyAction === 'sync' ? 'Sincronizando...' : 'Sincronizar SEFAZ'}
                            </button>
                        </div>
                        <label className="span-2">
                            <FieldLabel icon="fa-file-code" text="XML da NF-e" />
                            <textarea rows="6" value={xmlText} onChange={(event) => setXmlText(event.target.value)} placeholder="Cole o XML da nota." />
                        </label>
                        <label className="span-2">
                            <FieldLabel icon="fa-file-arrow-up" text="Arquivo XML" />
                            <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => setXmlFile(event.target.files?.[0] || null)} />
                        </label>
                        <div className="ops-workspace-actions span-2">
                            <button type="button" className="ui-button" onClick={handleImportXml} disabled={busyAction === 'import'}>
                                {busyAction === 'import' ? 'Importando...' : 'Importar XML'}
                            </button>
                        </div>
                    </div>
                    <div className="ops-workspace-list-stack">
                        {filteredRecords.length ? (
                            filteredRecords.map((record) => (
                                <ListCard
                                    key={record.id}
                                    active={selectedRecord?.id === record.id}
                                    onClick={() => setSelectedId(record.id)}
                                    title={`NF-e ${record.number || '-'} / ${record.series || '-'}`}
                                    badge={<Badge tone={record.status === 'processed' ? 'success' : record.status === 'ready' ? 'info' : 'warning'}>{record.status}</Badge>}
                                    description={record.supplier_name || 'Fornecedor não identificado'}
                                    meta={[
                                        record.issued_at ? String(record.issued_at).slice(0, 10) : 'Sem data',
                                        formatMoney(record.invoice_total || 0),
                                    ]}
                                />
                            ))
                        ) : (
                            <EmptyState title="Nenhuma NF-e" text="Nenhum documento neste filtro." />
                        )}
                    </div>
                </section>

                <section className="ops-workspace-panel">
                    {selectedRecord ? (
                        <>
                            <FeedbackHeader
                                title={`NF-e ${selectedRecord.number || '-'} / ${selectedRecord.series || '-'}`}
                                subtitle={selectedRecord.supplier_name || 'Fornecedor não identificado'}
                                action={(
                                    <div className="ops-nfe-detail-actions">
                                        {selectedRecord.xml_available ? <a className="ui-button-ghost" href={`/api/purchases/incoming-nfe/${selectedRecord.id}/xml`} target="_blank" rel="noreferrer">XML</a> : null}
                                        {selectedRecord.danfe_available ? <a className="ui-button-ghost" href={`/api/purchases/incoming-nfe/${selectedRecord.id}/danfe`} target="_blank" rel="noreferrer">DANFE</a> : null}
                                    </div>
                                )}
                            />
                            <div className="ops-workspace-list-card-meta">
                                <span>{selectedRecord.access_key}</span>
                                <span>{formatMoney(selectedRecord.invoice_total || 0)}</span>
                                <span>{selectedRecord.recipient_document}</span>
                            </div>
                            <div className="ops-nfe-status-card">
                                <strong>Fornecedor e validação</strong>
                                <p>{matchedSupplier ? matchedSupplier.name : 'Sem fornecedor vinculado'}</p>
                                <div className="ops-workspace-form-grid">
                                    <label>
                                        <FieldLabel icon="fa-id-card" text="CNPJ do fornecedor" />
                                        <input value={selectedRecord.supplier_document || ''} readOnly />
                                    </label>
                                    <label>
                                        <FieldLabel icon="fa-building" text="Fornecedor no cadastro" />
                                        <select value={supplierLinkId} onChange={(event) => setSupplierLinkId(event.target.value)}>
                                            <option value="">Não vinculado</option>
                                            {suppliers.map((supplier) => (
                                                <option key={supplier.id} value={supplier.id}>
                                                    {supplier.name}{supplier.document ? ` - ${supplier.document}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="ops-workspace-actions span-2">
                                        <button type="button" className="ui-button-ghost" onClick={handleSupplierLink} disabled={!supplierLinkId || busyAction === 'supplier'}>
                                            {busyAction === 'supplier' ? 'Vinculando...' : 'Vincular fornecedor'}
                                        </button>
                                        <button type="button" className="ui-button-ghost" onClick={handleQuickSupplierCreate} disabled={busyAction === 'quick-supplier' || !selectedRecord.supplier_document}>
                                            {busyAction === 'quick-supplier' ? 'Cadastrando...' : 'Cadastro rapido'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="ops-nfe-status-card">
                                <strong>Pedido e recebimento</strong>
                                <p>{linkedPurchase ? `${linkedPurchase.code} - ${linkedPurchase.supplier_name || 'Sem fornecedor'}` : 'Sem pedido de compra vinculado'}</p>
                                <div className="ops-workspace-form-grid">
                                    <label>
                                        <FieldLabel icon="fa-cart-shopping" text="Pedido de compra" />
                                        <select value={purchaseLinkId} onChange={(event) => setPurchaseLinkId(event.target.value)}>
                                            <option value="">Não vinculado</option>
                                            {purchaseOptions.map((purchase) => (
                                                <option key={purchase.id} value={purchase.id}>
                                                    {purchase.code} - {purchase.supplier_name || 'Sem fornecedor'} - {purchase.status}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        <FieldLabel icon="fa-box-open" text="Recebimento fisico" />
                                        <input type="datetime-local" value={receiptAt} onChange={(event) => setReceiptAt(event.target.value)} />
                                    </label>
                                    <div className="ops-workspace-actions span-2">
                                        <button type="button" className="ui-button-ghost" onClick={handlePurchaseLink} disabled={busyAction === 'purchase-link'}>
                                            {busyAction === 'purchase-link' ? 'Salvando...' : 'Vincular pedido'}
                                        </button>
                                        <button type="button" className="ui-button-ghost" onClick={handlePhysicalReceipt} disabled={busyAction === 'physical-receipt'}>
                                            {busyAction === 'physical-receipt' ? 'Registrando...' : 'Registrar recebimento'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="ops-nfe-summary-grid">
                                <article>
                                    <span>Itens vinculados</span>
                                    <strong>{selectedRecord.validation?.matched_items || 0}</strong>
                                </article>
                                <article>
                                    <span>Pendencias</span>
                                    <strong>{selectedRecord.validation?.pending_items || 0}</strong>
                                </article>
                                <article>
                                    <span>Alertas de preco</span>
                                    <strong>{selectedRecord.validation?.price_changes || 0}</strong>
                                </article>
                                <article>
                                    <span>Divergencias NCM</span>
                                    <strong>{selectedRecord.validation?.ncm_mismatches || 0}</strong>
                                </article>
                                <article>
                                    <span>Lacunas fiscais</span>
                                    <strong>{selectedRecord.validation?.tax_gaps || 0}</strong>
                                </article>
                                <article>
                                    <span>3-way match</span>
                                    <strong>{selectedRecord.validation?.three_way_divergences || 0}</strong>
                                </article>
                                <article>
                                    <span>Creditos</span>
                                    <strong>{selectedRecord.validation?.credit_suggestions || 0}</strong>
                                </article>
                                <article>
                                    <span>Status fiscal</span>
                                    <strong>{selectedRecord.fiscal_status || 'pendente'}</strong>
                                </article>
                            </div>
                            <div className="ops-nfe-summary-grid">
                                <article>
                                    <span>Assinatura</span>
                                    <strong>{selectedRecord.signature_status || 'pendente'}</strong>
                                </article>
                                <article>
                                    <span>Autenticidade</span>
                                    <strong>{selectedRecord.authenticity_status || 'pendente'}</strong>
                                </article>
                                <article>
                                    <span>Escrituração</span>
                                    <strong>{selectedRecord.bookkeeping_status || 'pendente'}</strong>
                                </article>
                                <article>
                                    <span>Recebimento</span>
                                    <strong>{selectedRecord.physical_receipt_status || 'pendente'}</strong>
                                </article>
                            </div>
                            {selectedRecord.summary_only ? <div className="ops-workspace-inline-alert">NF-e em resumo. Reprocesse para buscar o XML completo.</div> : null}
                            <div className="ops-nfe-status-card">
                                <strong>SEFAZ e manifestação</strong>
                                <p>{selectedRecord.sefaz_status_reason || 'Sem consulta recente na SEFAZ.'}</p>
                                <div className="ops-workspace-list-card-meta">
                                    <span>{selectedRecord.sefaz_status_code || 'Sem cStat'}</span>
                                    <span>{selectedRecord.sefaz_protocol || 'Sem protocolo'}</span>
                                    <span>{selectedRecord.signature_subject || 'Sem certificado lido'}</span>
                                </div>
                                <div className="ops-workspace-form-grid">
                                    <label>
                                        <FieldLabel icon="fa-eye" text="Evento" />
                                        <select value={manifestEvent} onChange={(event) => setManifestEvent(event.target.value)}>
                                            <option value="science">Ciencia</option>
                                            <option value="confirm">Confirmação</option>
                                            <option value="unknown">Desconhecimento</option>
                                            <option value="not_realized">Não realizada</option>
                                        </select>
                                    </label>
                                    <label>
                                        <FieldLabel icon="fa-file-signature" text="Justificativa" />
                                        <input value={manifestJustification} onChange={(event) => setManifestJustification(event.target.value)} placeholder="Opcional" />
                                    </label>
                                    <div className="ops-workspace-actions span-2">
                                        <button type="button" className="ui-button-ghost" onClick={handleValidateWithSefaz} disabled={busyAction === 'validate-sefaz'}>
                                            {busyAction === 'validate-sefaz' ? 'Consultando...' : 'Validar SEFAZ'}
                                        </button>
                                        <button type="button" className="ui-button-ghost" onClick={handleManifest} disabled={busyAction === 'manifest'}>
                                            {busyAction === 'manifest' ? 'Enviando...' : 'Manifestar'}
                                        </button>
                                    </div>
                                </div>
                                {(selectedRecord.manifestations || []).length ? (
                                    <div className="ops-workspace-list-card-meta">
                                        {(selectedRecord.manifestations || []).slice(0, 3).map((entry) => (
                                            <span key={entry.id}>{entry.event_type} {entry.sefaz_status_code ? `(${entry.sefaz_status_code})` : ''}</span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="ops-nfe-status-card">
                                <strong>Tributos e creditos</strong>
                                <p>{formatMoney(selectedRecord.fiscal?.credits?.recoverable_total || 0)} em creditos potencialmente recuperaveis.</p>
                                <div className="ops-workspace-list-card-meta">
                                    <span>ICMS {formatMoney(selectedRecord.fiscal?.taxes?.icms || 0)}</span>
                                    <span>IPI {formatMoney(selectedRecord.fiscal?.taxes?.ipi || 0)}</span>
                                    <span>PIS/COFINS {formatMoney((selectedRecord.fiscal?.taxes?.pis || 0) + (selectedRecord.fiscal?.taxes?.cofins || 0))}</span>
                                </div>
                                {(selectedRecord.tax_credits || []).length ? (
                                    <div className="ops-nfe-item-warnings">
                                        {(selectedRecord.tax_credits || []).slice(0, 4).map((credit) => (
                                            <span key={credit.id || `${credit.tax_type}-${credit.item_id}`}>{credit.tax_type.toUpperCase()} {formatMoney(credit.amount || 0)} - {credit.status}</span>
                                        ))}
                                    </div>
                                ) : null}
                                {(selectedRecord.bookkeeping?.entries || []).length ? (
                                    <div className="ops-workspace-list-card-meta">
                                        {(selectedRecord.bookkeeping?.entries || []).map((entry) => (
                                            <span key={entry.id || entry.entry_type}>{entry.entry_type} {entry.status}</span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            {(selectedRecord.validation?.alerts || []).length ? (
                                <div className="ops-nfe-alert-list">
                                    {(selectedRecord.validation?.alerts || []).slice(0, 6).map((alert, index) => (
                                        <div key={`${alert.code}-${index}`} className="ops-nfe-alert">
                                            <i className="fa-solid fa-triangle-exclamation" />
                                            <span>{alert.message}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            <div className="ops-nfe-item-grid">
                                {selectedRecord.items?.length ? selectedRecord.items.map((item) => (
                                    <article key={item.id} className="ops-nfe-item-card">
                                        <div className="ops-nfe-item-head">
                                            <div>
                                                <strong>{item.description}</strong>
                                                <small>{`Item ${item.item_number} | ${formatNumber(item.quantity || 0)} ${item.unit || 'UN'} | ${formatMoney(item.total_price || 0)}`}</small>
                                            </div>
                                            <Badge tone={item.match_status === 'matched' ? 'success' : 'warning'}>{item.match_status === 'matched' ? 'Vinculado' : 'Pendente'}</Badge>
                                        </div>
                                        <div className="ops-workspace-list-card-meta">
                                            <span>{item.supplier_code || 'Sem código do fornecedor'}</span>
                                            <span>{item.barcode || 'Sem GTIN'}</span>
                                            <span>{item.ncm || 'Sem NCM'}</span>
                                            <span>{item.cfop || 'Sem CFOP'}</span>
                                        </div>
                                        <div className="ops-workspace-list-card-meta">
                                            <span>ICMS {item.icms_cst_csosn || '---'} {formatMoney(item.icms_amount || 0)}</span>
                                            <span>IPI {item.ipi_cst || '---'} {formatMoney(item.ipi_amount || 0)}</span>
                                            <span>PIS {item.pis_cst || '---'} {formatMoney(item.pis_amount || 0)}</span>
                                            <span>COFINS {item.cofins_cst || '---'} {formatMoney(item.cofins_amount || 0)}</span>
                                        </div>
                                        {item.purchase_order_reference || item.fiscal_snapshot?.purchase_match?.status ? (
                                            <div className="ops-workspace-list-card-meta">
                                                <span>{item.purchase_order_reference ? `Pedido ${item.purchase_order_reference}` : 'Sem xPed'}</span>
                                                <span>3-way {item.fiscal_snapshot?.purchase_match?.status || 'pendente'}</span>
                                                <span>Custo aq. {formatMoney(item.fiscal_snapshot?.acquisition_cost?.estimated_total || item.total_price || 0)}</span>
                                            </div>
                                        ) : null}
                                        {(item.validation_warnings || []).length ? (
                                            <div className="ops-nfe-item-warnings">
                                                {(item.validation_warnings || []).map((warning) => <span key={warning.code}>{warning.message}</span>)}
                                            </div>
                                        ) : null}
                                        <div className="ops-workspace-form-grid">
                                            <label className="span-2">
                                                <FieldLabel icon="fa-boxes-stacked" text="Produto do sistema" />
                                                <select value={item.product_id || ''} onChange={(event) => handleItemLink(item.id, event.target.value)}>
                                                    <option value="">Selecionar produto</option>
                                                    {products.map((product) => (
                                                        <option key={product.id} value={product.id}>
                                                            {product.name} ({product.code})
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <div className="ops-workspace-actions span-2">
                                                <button type="button" className="ui-button-ghost" onClick={() => handleItemAutoCreate(item.id)} disabled={busyAction === `item-auto-${item.id}` || item.match_status === 'matched'}>
                                                    {busyAction === `item-auto-${item.id}` ? 'Criando...' : 'Auto cadastrar'}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                )) : <EmptyState title="Sem itens detalhados" text="Importe o XML completo para mapear produtos e confirmar a entrada." />}
                            </div>
                            <div className="ops-workspace-form-grid">
                                <label>
                                    <FieldLabel icon="fa-scale-balanced" text="Atualização de custo" />
                                    <select value={costMethod} onChange={(event) => setCostMethod(event.target.value)}>
                                        {(payload.cost_methods || []).map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <FieldLabel icon="fa-wand-magic-sparkles" text="Produtos faltantes" />
                                    <select value={autoCreateMissing ? 'yes' : 'no'} onChange={(event) => setAutoCreateMissing(event.target.value === 'yes')}>
                                        <option value="no">Validar manualmente</option>
                                        <option value="yes">Cadastrar ao confirmar</option>
                                    </select>
                                </label>
                            </div>
                            <div className="ops-workspace-actions">
                                <button type="button" className="ui-button-ghost" onClick={handleReprocess} disabled={busyAction === 'reprocess'}>
                                    {busyAction === 'reprocess' ? 'Reprocessando...' : 'Reprocessar NF-e'}
                                </button>
                                <button type="button" className="ui-button" onClick={handleConfirm} disabled={busyAction === 'confirm' || selectedRecord.summary_only || selectedRecord.status === 'processed'}>
                                    {busyAction === 'confirm' ? 'Confirmando...' : selectedRecord.status === 'processed' ? 'Entrada concluída' : 'Confirmar entrada'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <EmptyState title="Selecione uma NF-e" text="Escolha um documento importado para revisar fornecedor, vincular produtos e confirmar a entrada." />
                    )}
                </section>
            </div>
        </div>
    )
}
