import { useEffect, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import CompactModal from '@/Components/UI/CompactModal'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import { apiRequest } from '@/lib/http'
import { showErrorPopup } from '@/lib/errorPopup'
import { formatDateTime, formatMoney } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import './nfe-nfce.css'

const TABS = [
    { key: 'issued', label: 'Notas emitidas', icon: 'fa-list' },
    { key: 'from-sale', label: 'Emitir a partir de venda', icon: 'fa-receipt' },
    { key: 'manual', label: 'Emitir manual', icon: 'fa-pen-to-square' },
]

const DOCUMENT_MODEL_FILTERS = [
    { key: 'all', value: 'all', label: 'Todos' },
    { key: '65', value: '65', label: 'NFC-e' },
    { key: '55', value: '55', label: 'NF-e' },
]

const STATUS_FILTERS = [
    { key: 'all', value: 'all', label: 'Todas' },
    { key: 'authorized', value: 'authorized', label: 'Autorizadas' },
    { key: 'pending', value: 'pending', label: 'Processando' },
    { key: 'cancelled', value: 'cancelled', label: 'Canceladas' },
    { key: 'failed', value: 'failed', label: 'Falhas' },
]

const EMPTY_RECIPIENT = {
    type: 'document',
    customer_id: '',
    name: '',
    document: '',
    email: '',
    phone: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city_name: '',
    city_code: '',
    state: '',
    zip_code: '',
}

function recipientFromCustomer(customer) {
    return {
        ...EMPTY_RECIPIENT,
        type: 'customer',
        customer_id: customer.id,
        name: customer.name,
        document: customer.document || '',
        email: customer.email || '',
        phone: customer.phone || '',
        street: customer.street || '',
        number: customer.number || '',
        complement: customer.complement || '',
        district: customer.district || '',
        city_name: customer.city_name || '',
        city_code: customer.city_code || '',
        state: customer.state || '',
        zip_code: customer.zip_code || '',
    }
}

export default function NfeNfce({ filters, documents, customers = [], canEmitManual = false, canRequestCorrection = false, canExportAccountantPackage = false }) {
    const [tab, setTab] = useState('issued')

    return (
        <AppLayout title="NFe/NFCe">
            <div className="nfe-page">
                <div className="nfe-tabs" role="tablist">
                    {TABS.map((item) => (
                        (item.key !== 'issued' && !canEmitManual) ? null : (
                            <button
                                key={item.key}
                                type="button"
                                role="tab"
                                className={`nfe-tab ${tab === item.key ? 'active' : ''}`}
                                onClick={() => setTab(item.key)}
                            >
                                <i className={`fa-solid ${item.icon}`} />
                                <span>{item.label}</span>
                            </button>
                        )
                    ))}
                </div>

                {tab === 'issued' ? (
                    <IssuedTab
                        filters={filters}
                        documents={documents}
                        canRequestCorrection={canRequestCorrection}
                        canExportAccountantPackage={canExportAccountantPackage}
                    />
                ) : null}
                {tab === 'from-sale' && canEmitManual ? <FromSaleTab /> : null}
                {tab === 'manual' && canEmitManual ? <ManualTab customers={customers} /> : null}
            </div>
        </AppLayout>
    )
}

function IssuedTab({ filters, documents, canRequestCorrection, canExportAccountantPackage }) {
    const [search, setSearch] = useState(filters.search || '')
    const [dateRange, setDateRange] = useState({ from: filters.from, to: filters.to })
    const [documentModel, setDocumentModel] = useState(filters.document_model || 'all')
    const [status, setStatus] = useState(filters.status || 'all')
    const [correctionDocumentId, setCorrectionDocumentId] = useState(null)
    const [exportMonth, setExportMonth] = useState(() => new Date().toISOString().slice(0, 7))

    function handleExportAccountantPackage() {
        const [year, month] = exportMonth.split('-')
        window.location.href = `/api/fiscal/accountant-export?year=${year}&month=${Number(month)}`
    }

    function applyFilters(overrides = {}) {
        router.get('/fiscal/notas', {
            applied: 1,
            search,
            from: dateRange.from,
            to: dateRange.to,
            document_model: documentModel,
            status,
            ...overrides,
        }, { preserveScroll: true, preserveState: true, replace: true })
    }

    const columns = [
        { key: 'document_label', label: 'Modelo', render: (row) => <strong>{row.document_label}</strong> },
        { key: 'sale_number', label: 'Venda', render: (row) => row.sale_number || '-' },
        { key: 'recipient_name', label: 'Destinatário', render: (row) => row.recipient_name || 'Consumidor final' },
        { key: 'total', label: 'Valor', align: 'right', render: (row) => formatMoney(row.total) },
        { key: 'created_at', label: 'Emitida em', render: (row) => row.created_at ? formatDateTime(row.created_at) : '-' },
        { key: 'status', label: 'Situação', render: (row) => <StatusBadge compact label={row.status_label} tone={row.status_tone} /> },
    ]

    return (
        <div className="nfe-panel">
            <PageHeader
                title="Notas emitidas"
                search={{ value: search, placeholder: 'Buscar por chave, venda ou destinatário', onChange: setSearch }}
                dateRange={{ ...dateRange, onChange: setDateRange }}
                filters={DOCUMENT_MODEL_FILTERS.map((item) => ({ ...item, active: item.value === documentModel }))}
                onFilterChange={(value) => { setDocumentModel(value); applyFilters({ document_model: value }) }}
                onApply={() => applyFilters()}
                onReset={() => {
                    setSearch('')
                    setDocumentModel('all')
                    setStatus('all')
                    router.get('/fiscal/notas', {}, { preserveScroll: true, replace: true })
                }}
            />

            {canExportAccountantPackage ? (
                <div className="nfe-accountant-export">
                    <label>
                        <span>Pacote do contador</span>
                        <input type="month" value={exportMonth} onChange={(event) => setExportMonth(event.target.value)} />
                    </label>
                    <button type="button" className="nfe-primary-button" onClick={handleExportAccountantPackage}>
                        <i className="fa-solid fa-file-zipper" /> Exportar mês
                    </button>
                </div>
            ) : null}

            <div className="nfe-status-filters">
                {STATUS_FILTERS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`nfe-status-filter ${status === item.value ? 'active' : ''}`}
                        onClick={() => { setStatus(item.value); applyFilters({ status: item.value }) }}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <DataTable
                columns={columns}
                rows={documents.data}
                emptyMessage={filters.applied ? 'Nenhuma nota encontrada para esse filtro.' : 'Use os filtros acima e clique em Filtrar.'}
                emptyIcon="fa-file-invoice"
                actions={(row) => [
                    row.can_reprint ? {
                        key: 'reprint',
                        label: 'Reimprimir',
                        icon: 'fa-print',
                        href: row.preview_url,
                        target: '_blank',
                        selectRow: false,
                    } : null,
                    (row.can_correct && canRequestCorrection) ? {
                        key: 'correct',
                        label: 'Carta de correção',
                        icon: 'fa-file-pen',
                        onClick: () => setCorrectionDocumentId(row.id),
                        selectRow: false,
                    } : null,
                ]}
            />

            {documents.total > documents.data.length ? (
                <div className="nfe-pagination">
                    <span>{documents.data.length} de {documents.total} notas</span>
                    <div className="nfe-pagination-buttons">
                        <button type="button" disabled={documents.current_page <= 1} onClick={() => applyFilters({ page: documents.current_page - 1 })}>Anterior</button>
                        <button type="button" disabled={documents.current_page >= documents.last_page} onClick={() => applyFilters({ page: documents.current_page + 1 })}>Próxima</button>
                    </div>
                </div>
            ) : null}

            {correctionDocumentId ? (
                <CorrectionLetterModal
                    documentId={correctionDocumentId}
                    onClose={() => setCorrectionDocumentId(null)}
                />
            ) : null}
        </div>
    )
}

function CorrectionLetterModal({ documentId, onClose }) {
    const MIN_LENGTH = 15
    const MAX_LENGTH = 1000

    const [loading, setLoading] = useState(true)
    const [events, setEvents] = useState([])
    const [text, setText] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState(null)

    async function loadDocument() {
        setLoading(true)
        try {
            const response = await apiRequest(`/api/fiscal/documents/${documentId}`)
            setEvents((response.document?.events || []).filter((event) => String(event.status).startsWith('correction_')))
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível carregar as cartas de correção deste documento.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadDocument() }, [documentId])

    const hasPendingLetter = events.some((event) => ['correction_queued', 'correction_processing'].includes(event.status))
    const trimmedLength = text.trim().length
    const canSubmit = !submitting && !hasPendingLetter && trimmedLength >= MIN_LENGTH && trimmedLength <= MAX_LENGTH

    async function handleSubmit(event) {
        event.preventDefault()
        if (!canSubmit) return

        setSubmitting(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/api/fiscal/documents/${documentId}/correction`, {
                method: 'post',
                data: { text },
            })
            setFeedback({ type: 'success', text: response.message || 'Carta de correção enviada para processamento.' })
            setText('')
            await loadDocument()
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível enviar a carta de correção.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <CompactModal
            open
            title="Carta de correção"
            description="Corrige dados que não alteram valor, tributo ou destinatário da nota."
            icon="fa-file-pen"
            onClose={onClose}
        >
            <div className="nfe-correction-modal">
                {loading ? (
                    <p className="nfe-hint">Carregando histórico...</p>
                ) : (
                    <>
                        {events.length > 0 ? (
                            <ul className="nfe-correction-history">
                                {events.slice().reverse().map((event, index) => (
                                    <li key={index}>
                                        <div className="nfe-correction-history-header">
                                            <StatusBadge compact label={correctionStatusLabel(event.status)} tone={correctionStatusTone(event.status)} />
                                            <span>{event.created_at ? formatDateTime(event.created_at) : ''}</span>
                                        </div>
                                        {event.payload?.text ? <p>{event.payload.text}</p> : null}
                                        {event.status === 'correction_registered' && event.payload?.sequence ? (
                                            <div className="nfe-correction-history-links">
                                                <a href={`/api/fiscal/documents/${documentId}/correction/${event.payload.sequence}/request-xml`} target="_blank" rel="noreferrer">XML enviado</a>
                                                <a href={`/api/fiscal/documents/${documentId}/correction/${event.payload.sequence}/response-xml`} target="_blank" rel="noreferrer">XML de retorno</a>
                                            </div>
                                        ) : null}
                                        {event.status === 'correction_failed' && event.message ? (
                                            <p className="nfe-correction-history-error">{event.message}</p>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="nfe-hint">Nenhuma carta de correção registrada ainda para este documento.</p>
                        )}

                        <form className="nfe-form" onSubmit={handleSubmit}>
                            <label>
                                <span>Texto da correção</span>
                                <textarea
                                    value={text}
                                    onChange={(event) => setText(event.target.value)}
                                    rows={4}
                                    maxLength={MAX_LENGTH}
                                    disabled={hasPendingLetter}
                                    placeholder="Descreva a correção (mín. 15 caracteres). Não pode alterar valor, tributo, data ou destinatário."
                                />
                                <span className="nfe-correction-counter">{trimmedLength}/{MAX_LENGTH}</span>
                            </label>

                            {hasPendingLetter ? (
                                <p className="nfe-hint">Já existe uma carta em processamento. Aguarde a conclusão antes de enviar outra.</p>
                            ) : null}

                            {feedback ? <div className={`nfe-feedback nfe-feedback--${feedback.type}`}>{feedback.text}</div> : null}

                            <button type="submit" className="nfe-primary-button" disabled={!canSubmit}>
                                {submitting ? 'Enviando...' : 'Enviar carta de correção'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </CompactModal>
    )
}

function correctionStatusLabel(status) {
    return {
        correction_queued: 'Enviada ao agente',
        correction_processing: 'Processando',
        correction_registered: 'Registrada na SEFAZ',
        correction_failed: 'Falhou',
    }[status] || status
}

function correctionStatusTone(status) {
    return {
        correction_queued: 'info',
        correction_processing: 'info',
        correction_registered: 'success',
        correction_failed: 'danger',
    }[status] || 'neutral'
}

function FromSaleTab() {
    const [saleNumber, setSaleNumber] = useState('')
    const [loading, setLoading] = useState(false)
    const [sale, setSale] = useState(null)
    const [recipient, setRecipient] = useState(EMPTY_RECIPIENT)
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState(null)

    async function handleSearch(event) {
        event.preventDefault()
        if (!saleNumber.trim()) return

        setLoading(true)
        setFeedback(null)
        setSale(null)

        try {
            const response = await apiRequest('/api/fiscal/notas/sales/lookup', { params: { sale_number: saleNumber.trim() } })
            setSale(response.sale)
            setRecipient(response.sale.customer ? recipientFromCustomer(response.sale.customer) : { ...EMPTY_RECIPIENT, type: 'document' })
        } catch (error) {
            showErrorPopup(error.message || 'Venda não encontrada.')
        } finally {
            setLoading(false)
        }
    }

    function updateRecipient(field, value) {
        setRecipient((current) => ({ ...current, [field]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (!sale) return

        setSubmitting(true)
        setFeedback(null)

        try {
            await apiRequest(`/api/fiscal/sales/${sale.id}/convert-to-nfe`, {
                method: 'post',
                data: { recipient },
            })
            setFeedback({ type: 'success', text: 'NF-e enviada para processamento. Acompanhe na aba "Notas emitidas".' })
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível gerar a NF-e.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="nfe-panel">
            <form className="nfe-sale-search" onSubmit={handleSearch}>
                <label>
                    <span>Número da venda</span>
                    <input value={saleNumber} onChange={(event) => setSaleNumber(event.target.value)} placeholder="Ex.: VND-20260711-0001" />
                </label>
                <button type="submit" className="nfe-primary-button" disabled={loading}>
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
            </form>

            {sale ? (
                <form className="nfe-form" onSubmit={handleSubmit}>
                    <div className="nfe-sale-summary">
                        <div><span>Venda</span><strong>{sale.sale_number}</strong></div>
                        <div><span>Total</span><strong>{formatMoney(sale.total)}</strong></div>
                        <div><span>Emitida em</span><strong>{formatDateTime(sale.created_at)}</strong></div>
                    </div>

                    {sale.has_nfe ? (
                        <p className="nfe-hint">Essa venda já tem uma NF-e emitida. Reenviar não duplica — vai só reconfirmar o mesmo documento.</p>
                    ) : null}

                    <RecipientFields recipient={recipient} onChange={updateRecipient} />

                    {feedback ? <div className={`nfe-feedback nfe-feedback--${feedback.type}`}>{feedback.text}</div> : null}

                    <button type="submit" className="nfe-primary-button" disabled={submitting}>
                        {submitting ? 'Enviando...' : 'Gerar NF-e'}
                    </button>
                </form>
            ) : null}
        </div>
    )
}

function ManualTab({ customers }) {
    const [items, setItems] = useState([])
    const [productSearch, setProductSearch] = useState('')
    const [productResults, setProductResults] = useState([])
    const [customerSearch, setCustomerSearch] = useState('')
    const [recipient, setRecipient] = useState(EMPTY_RECIPIENT)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [deductStock, setDeductStock] = useState(false)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const total = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0),
        [items],
    )

    const filteredCustomers = useMemo(() => {
        const term = normalizeTextSearch(customerSearch)
        if (term.length < 2) return []
        return customers.filter((customer) => matchesTextSearchAny([customer.name, customer.document], term)).slice(0, 10)
    }, [customers, customerSearch])

    async function handleProductSearch(term) {
        setProductSearch(term)
        if (term.trim().length < 2) {
            setProductResults([])
            return
        }
        try {
            const response = await apiRequest('/pdv/products', { params: { term } })
            setProductResults(response.products || [])
        } catch {
            setProductResults([])
        }
    }

    function addItem(product) {
        setItems((current) => {
            const existing = current.find((item) => item.product_id === product.id)
            if (existing) {
                return current.map((item) => item.product_id === product.id ? { ...item, quantity: Number(item.quantity) + 1 } : item)
            }
            return [...current, { product_id: product.id, name: product.name, quantity: 1, unit_price: product.sale_price }]
        })
        setProductSearch('')
        setProductResults([])
    }

    function updateItem(productId, field, value) {
        setItems((current) => current.map((item) => item.product_id === productId ? { ...item, [field]: value } : item))
    }

    function removeItem(productId) {
        setItems((current) => current.filter((item) => item.product_id !== productId))
    }

    function selectCustomer(customer) {
        setRecipient(recipientFromCustomer(customer))
        setCustomerSearch(customer.name)
    }

    function updateRecipient(field, value) {
        setRecipient((current) => ({ ...current, [field]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (!items.length) {
            showErrorPopup('Adicione ao menos um produto.')
            return
        }

        setSubmitting(true)
        setFeedback(null)

        try {
            await apiRequest('/api/fiscal/notas/manual', {
                method: 'post',
                data: {
                    items: items.map((item) => ({
                        product_id: item.product_id,
                        quantity: Number(item.quantity),
                        unit_price: Number(item.unit_price),
                    })),
                    recipient,
                    payment_method: paymentMethod,
                    deduct_stock: deductStock,
                    notes: notes || null,
                },
            })

            setFeedback({ type: 'success', text: 'Nota fiscal avulsa enviada para processamento. Acompanhe na aba "Notas emitidas".' })
            setItems([])
            setRecipient(EMPTY_RECIPIENT)
            setCustomerSearch('')
            setNotes('')
        } catch (error) {
            showErrorPopup(error.message || 'Não foi possível emitir a nota.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="nfe-panel">
            <form className="nfe-form" onSubmit={handleSubmit}>
                <section className="nfe-form-section">
                    <h3>Itens</h3>
                    <div className="nfe-product-search">
                        <input
                            value={productSearch}
                            onChange={(event) => handleProductSearch(event.target.value)}
                            placeholder="Buscar produto por nome ou código de barras..."
                        />
                        {productResults.length > 0 ? (
                            <div className="nfe-product-dropdown">
                                {productResults.map((product) => (
                                    <button key={product.id} type="button" onClick={() => addItem(product)}>
                                        <strong>{product.name}</strong>
                                        <span>{formatMoney(product.sale_price)}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {items.length ? (
                        <table className="nfe-items-table">
                            <thead>
                                <tr><th>Produto</th><th>Qtd</th><th>Preço unit.</th><th>Subtotal</th><th /></tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.product_id}>
                                        <td>{item.name}</td>
                                        <td><input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.product_id, 'quantity', event.target.value)} /></td>
                                        <td><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(item.product_id, 'unit_price', event.target.value)} /></td>
                                        <td>{formatMoney(Number(item.quantity || 0) * Number(item.unit_price || 0))}</td>
                                        <td><button type="button" onClick={() => removeItem(item.product_id)}><i className="fa-solid fa-xmark" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="nfe-hint">Nenhum item adicionado ainda.</p>
                    )}

                    <div className="nfe-total-row">
                        <span>Total da nota</span>
                        <strong>{formatMoney(total)}</strong>
                    </div>
                </section>

                <section className="nfe-form-section">
                    <h3>Destinatário</h3>
                    <div className="nfe-customer-search">
                        <input
                            value={customerSearch}
                            onChange={(event) => { setCustomerSearch(event.target.value); setRecipient((current) => ({ ...current, type: 'document', customer_id: '' })) }}
                            placeholder="Buscar cliente cadastrado (opcional)..."
                        />
                        {filteredCustomers.length > 0 ? (
                            <div className="nfe-product-dropdown">
                                {filteredCustomers.map((customer) => (
                                    <button key={customer.id} type="button" onClick={() => selectCustomer(customer)}>
                                        <strong>{customer.name}</strong>
                                        <span>{customer.document || 'Sem documento'}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <RecipientFields recipient={recipient} onChange={updateRecipient} />
                </section>

                <section className="nfe-form-section">
                    <h3>Pagamento e estoque</h3>
                    <div className="nfe-form-grid">
                        <label>
                            <span>Forma de pagamento</span>
                            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                                <option value="cash">Dinheiro</option>
                                <option value="pix">Pix</option>
                                <option value="debit_card">Cartão de débito</option>
                                <option value="credit_card">Cartão de crédito</option>
                                <option value="check">Cheque</option>
                                <option value="credit">Fiado</option>
                            </select>
                        </label>
                        <label className="nfe-checkbox-field">
                            <input type="checkbox" checked={deductStock} onChange={(event) => setDeductStock(event.target.checked)} />
                            <span>Baixar do estoque</span>
                        </label>
                        <label className="nfe-field--full">
                            <span>Observações (opcional)</span>
                            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
                        </label>
                    </div>
                </section>

                {feedback ? <div className={`nfe-feedback nfe-feedback--${feedback.type}`}>{feedback.text}</div> : null}

                <button type="submit" className="nfe-primary-button" disabled={submitting}>
                    {submitting ? 'Emitindo...' : 'Emitir NF-e'}
                </button>
            </form>
        </div>
    )
}

function RecipientFields({ recipient, onChange }) {
    return (
        <div className="nfe-form-grid">
            <label>
                <span>Nome / Razão social</span>
                <input value={recipient.name || ''} onChange={(event) => onChange('name', event.target.value)} disabled={Boolean(recipient.customer_id)} />
            </label>
            <label>
                <span>CPF/CNPJ</span>
                <input value={recipient.document || ''} onChange={(event) => onChange('document', event.target.value)} disabled={Boolean(recipient.customer_id)} />
            </label>
            <label>
                <span>Email</span>
                <input value={recipient.email || ''} onChange={(event) => onChange('email', event.target.value)} />
            </label>
            <label>
                <span>Telefone</span>
                <input value={recipient.phone || ''} onChange={(event) => onChange('phone', event.target.value)} />
            </label>
            <label className="nfe-field--full">
                <span>Logradouro</span>
                <input value={recipient.street || ''} onChange={(event) => onChange('street', event.target.value)} />
            </label>
            <label>
                <span>Número</span>
                <input value={recipient.number || ''} onChange={(event) => onChange('number', event.target.value)} />
            </label>
            <label>
                <span>Complemento</span>
                <input value={recipient.complement || ''} onChange={(event) => onChange('complement', event.target.value)} />
            </label>
            <label>
                <span>Bairro</span>
                <input value={recipient.district || ''} onChange={(event) => onChange('district', event.target.value)} />
            </label>
            <label>
                <span>Município</span>
                <input value={recipient.city_name || ''} onChange={(event) => onChange('city_name', event.target.value)} />
            </label>
            <label>
                <span>Código IBGE</span>
                <input value={recipient.city_code || ''} onChange={(event) => onChange('city_code', event.target.value)} />
            </label>
            <label>
                <span>UF</span>
                <input value={recipient.state || ''} onChange={(event) => onChange('state', event.target.value.toUpperCase())} maxLength={2} />
            </label>
            <label>
                <span>CEP</span>
                <input value={recipient.zip_code || ''} onChange={(event) => onChange('zip_code', event.target.value)} />
            </label>
        </div>
    )
}
