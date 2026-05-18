import { useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import StatusBadge from '@/Components/UI/StatusBadge'
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/lib/format'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import { apiRequest } from '@/lib/http'
import { buildRecordsUrl, ensureDate, parseNumber, upsertRecord } from '@/Pages/Operations/workspaces/shared'
import '../Operations/backoffice-workspace.css'

const PERIOD_FILTERS = [
    { key: 'today', label: 'Hoje' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
]

const STEPS = [
    { key: 'origin', label: 'Origem', icon: 'fa-shuffle' },
    { key: 'note', label: 'Nota', icon: 'fa-file-invoice' },
    { key: 'items', label: 'Itens', icon: 'fa-boxes-stacked' },
    { key: 'fiscal', label: 'Fiscal', icon: 'fa-scale-balanced' },
    { key: 'financial', label: 'Financeiro', icon: 'fa-wallet' },
]

const CFOP_OPTIONS = [
    { value: '1102', label: '1102 - Compra para comercializacao (mesmo estado)' },
    { value: '2102', label: '2102 - Compra para comercializacao (outro estado)' },
    { value: '1403', label: '1403 - Compra para comercializacao em zona franca' },
    { value: '1556', label: '1556 - Compra de material para uso/consumo' },
]

const CST_OPTIONS = [
    { value: '102', label: '102 - Sem permissao de credito' },
    { value: '400', label: '400 - Nao tributada' },
    { value: '500', label: '500 - ICMS ST cobrado anteriormente' },
]

const FINANCIAL_MODES = [
    { key: 'cash', label: 'A vista', icon: 'fa-bolt' },
    { key: 'boleto', label: 'Boleto', icon: 'fa-barcode' },
    { key: 'installments', label: 'Prazo parcelado', icon: 'fa-calendar-days' },
    { key: 'paid', label: 'Ja pago', icon: 'fa-circle-check' },
]

function digitsOnly(value) {
    return String(value || '').replace(/\D+/g, '')
}

function todayInput() {
    return new Date().toISOString().slice(0, 10)
}

function createEmptyForm() {
    return {
        id: null,
        code: null,
        source_type: '',
        imported_document_id: null,
        supplier_id: '',
        invoice_number: '',
        invoice_series: '',
        issued_at: '',
        received_at: todayInput(),
        access_key: '',
        cfop: '1102',
        operation_nature: '',
        notes: '',
        freight: '0',
        items: [],
        financial_mode: 'cash',
        boleto_draft: {
            amount: '',
            due_date: todayInput(),
            bank_name: '',
            barcode: '',
        },
        boleto_installments: [],
        installment_total_value: '',
        installment_count: '2',
        installment_first_due: todayInput(),
        auto_update_sale_price: false,
        print_after_confirm: false,
    }
}

function resolveEntryStatusMeta(record) {
    return {
        label: record?.supplier_name || 'Entrada',
        tone: 'info',
    }
}

function matchesPeriod(record, periodKey) {
    if (!periodKey) {
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

function normalizeRecordToForm(record, products) {
    return {
        ...createEmptyForm(),
        id: record.id,
        code: record.code,
        source_type: record.imported_document_id ? 'xml' : 'manual',
        supplier_id: record.supplier_id ? String(record.supplier_id) : '',
        invoice_number: record.invoice_number || record.document || '',
        invoice_series: record.invoice_series || '',
        issued_at: ensureDate(record.invoice_date),
        received_at: ensureDate(record.received_at) || todayInput(),
        access_key: record.invoice_access_key || '',
        cfop: record.cfop || '1102',
        operation_nature: record.operation_nature || '',
        notes: record.notes || '',
        freight: String(record.freight || 0),
        items: (record.items || []).map((item) => {
            const product = products.find((entry) => String(entry.id) === String(item.product_id))
            const lastCost = Number(product?.cost_price || item.unit_cost || 0)
            const salePrice = Number(product?.sale_price || 0)
            const nextCost = Number(item.unit_cost || 0)
            const margin = lastCost > 0 && salePrice > 0 ? ((salePrice / lastCost) - 1) * 100 : 0
            const suggestedSalePrice = lastCost > 0 ? nextCost * (1 + (margin / 100)) : salePrice

            return {
                id: item.id,
                product_id: String(item.product_id),
                product_name: item.product_name,
                code: product?.code || '',
                barcode: product?.barcode || '',
                quantity_nf: String(item.quantity),
                quantity_checked: String(item.quantity),
                unit_cost: String(item.unit_cost),
                total: Number(item.total || 0),
                cst: '',
                last_cost: lastCost,
                current_sale_price: salePrice,
                suggested_sale_price: suggestedSalePrice > 0 ? String(suggestedSalePrice.toFixed(2)) : '',
                apply_sale_price: false,
                entry_unit: product?.unit || 'UN',
                sale_unit: product?.unit || 'UN',
                conversion_factor: '1',
            }
        }),
    }
}

function AutocompleteField({
    label,
    icon,
    query,
    selectedLabel,
    placeholder,
    emptyLabel,
    options,
    disabled = false,
    onQueryChange,
    onSelect,
}) {
    const shouldShow = !disabled && query.trim().length > 0

    return (
        <div className="proc-ui-field full">
            <label>
                <span className="proc-ui-label">
                    <i className={`fa-solid ${icon}`} /> {label}
                </span>
                <div className="proc-ui-autocomplete">
                    <input
                        className="proc-ui-searchbox"
                        disabled={disabled}
                        placeholder={placeholder}
                        type="search"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                    />
                    {selectedLabel ? (
                        <div className="proc-ui-pill">
                            <i className="fa-solid fa-check" />
                            <span className="proc-ui-truncate">{selectedLabel}</span>
                        </div>
                    ) : null}
                    {shouldShow ? (
                        <div className="proc-ui-autocomplete-list">
                            {options.length ? options.map((option) => (
                                <button
                                    key={option.id}
                                    className="proc-ui-autocomplete-item"
                                    type="button"
                                    onClick={() => onSelect(option)}
                                >
                                    <div className="proc-ui-record-card-copy">
                                        <strong>{option.name}</strong>
                                        <span>{option.code || option.barcode || option.document || option.city_name || 'Sem complemento'}</span>
                                    </div>
                                </button>
                            )) : <div className="proc-ui-empty"><strong>{emptyLabel}</strong></div>}
                        </div>
                    ) : null}
                </div>
            </label>
        </div>
    )
}

export default function StockEntryIndex({ moduleTitle = 'Entrada de estoque', payload }) {
    const suppliers = Array.isArray(payload?.suppliers) ? payload.suppliers : []
    const products = Array.isArray(payload?.products) ? payload.products : []
    const [records, setRecords] = useState(Array.isArray(payload?.records) ? payload.records : [])
    const [importedDocuments, setImportedDocuments] = useState(Array.isArray(payload?.incoming_nfe_documents) ? payload.incoming_nfe_documents : [])
    const [step, setStep] = useState(0)
    const [historySearch, setHistorySearch] = useState('')
    const [periodFilter, setPeriodFilter] = useState('today')
    const [form, setForm] = useState(createEmptyForm())
    const [editorMode, setEditorMode] = useState('edit')
    const [supplierQuery, setSupplierQuery] = useState('')
    const [productQuery, setProductQuery] = useState('')
    const [xmlFile, setXmlFile] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const [saving, setSaving] = useState(false)
    const [importing, setImporting] = useState(false)

    const normalizedHistorySearch = normalizeTextSearch(historySearch)
    const selectedSupplier = suppliers.find((entry) => String(entry.id) === String(form.supplier_id)) || null
    const supplierOptions = useMemo(() => {
        const normalized = normalizeTextSearch(supplierQuery)

        if (!normalized) {
            return suppliers.slice(0, 8)
        }

        return suppliers.filter((supplier) => matchesTextSearchAny([
            supplier.name,
            supplier.document,
            supplier.city_name,
        ], normalized)).slice(0, 8)
    }, [supplierQuery, suppliers])

    const productOptions = useMemo(() => {
        const normalized = normalizeTextSearch(productQuery)

        if (!normalized) {
            return []
        }

        return products.filter((product) => matchesTextSearchAny([
            product.name,
            product.code,
            product.barcode,
        ], normalized)).slice(0, 8)
    }, [productQuery, products])

    const filteredRecords = useMemo(() => (
        records.filter((record) => {
            if (!matchesPeriod(record, periodFilter)) {
                return false
            }

            if (!normalizedHistorySearch) {
                return true
            }

            return matchesTextSearchAny([
                record.invoice_number,
                record.document,
                record.supplier_name,
                record.code,
            ], normalizedHistorySearch)
        })
    ), [normalizedHistorySearch, periodFilter, records])

    const subtotal = useMemo(() => (
        form.items.reduce((carry, item) => carry + (parseNumber(item.quantity_checked || item.quantity_nf, 0) * parseNumber(item.unit_cost, 0)), 0)
    ), [form.items])
    const total = subtotal + parseNumber(form.freight, 0)

    const attentionItems = useMemo(() => form.items.filter((item) => !item.cst), [form.items])
    const quantityAlerts = useMemo(() => form.items.filter((item) => parseNumber(item.quantity_checked, 0) !== parseNumber(item.quantity_nf, 0)), [form.items])
    const unmappedItems = useMemo(() => form.items.filter((item) => !item.product_id), [form.items])
    const costAlerts = useMemo(() => form.items
        .map((item) => {
            const previous = Number(item.last_cost || 0)
            const current = Number(item.unit_cost || 0)

            if (previous <= 0 || current <= 0) {
                return null
            }

            const deltaPercent = ((current - previous) / previous) * 100

            if (Math.abs(deltaPercent) <= 5) {
                return null
            }

            const currentSalePrice = Number(item.current_sale_price || 0)
            const margin = previous > 0 && currentSalePrice > 0 ? ((currentSalePrice / previous) - 1) * 100 : 0
            const suggested = previous > 0 && currentSalePrice > 0 ? current * (1 + (margin / 100)) : currentSalePrice

            return {
                item,
                previous,
                current,
                deltaPercent,
                currentSalePrice,
                margin,
                suggested,
            }
        })
        .filter(Boolean), [form.items])

    const criticalReason = step === 1 && (!form.supplier_id || !form.invoice_number.trim())
        ? 'Preencha fornecedor e numero da nota antes de continuar.'
        : step === 2 && !form.items.length
            ? 'Adicione itens a entrada para prosseguir.'
            : step === 2 && unmappedItems.length
                ? 'Vincule todos os itens a produtos do sistema.'
                : step === 2 && attentionItems.length
                    ? 'Preencha o CST de todos os itens para continuar.'
                    : ''

    const canEdit = editorMode === 'edit' && !form.id
    const generatedInstallments = useMemo(() => {
        if (form.financial_mode !== 'installments') {
            return []
        }

        const count = Math.max(1, Number(form.installment_count || 1))
        const firstDue = form.installment_first_due || todayInput()
        const amount = parseNumber(form.installment_total_value || total, 0)

        if (amount <= 0 || !firstDue) {
            return []
        }

        const baseAmount = Math.floor((amount / count) * 100) / 100
        let remainder = Math.round((amount - (baseAmount * count)) * 100)

        return Array.from({ length: count }, (_, index) => {
            const dueDate = new Date(firstDue)
            dueDate.setMonth(dueDate.getMonth() + index)
            const cents = remainder > 0 ? 0.01 : 0
            if (remainder > 0) {
                remainder -= 1
            }

            return {
                description: `Parcela ${index + 1}/${count}`,
                amount: Number((baseAmount + cents).toFixed(2)),
                due_date: dueDate.toISOString().slice(0, 10),
                payment_method: 'transfer',
                bank_name: '',
                installment_label: `Parcela ${index + 1}/${count}`,
                installment_number: index + 1,
                installment_total: count,
                recurrence: 'monthly',
                notes: null,
                mark_paid: false,
                paid_at: null,
            }
        })
    }, [form.financial_mode, form.installment_count, form.installment_first_due, form.installment_total_value, total])

    function resetEditor() {
        setStep(0)
        setEditorMode('edit')
        setForm(createEmptyForm())
        setSupplierQuery('')
        setProductQuery('')
        setXmlFile(null)
    }

    function loadRecord(record) {
        setForm(normalizeRecordToForm(record, products))
        setEditorMode('view')
        setStep(4)
        setSupplierQuery(record.supplier_name || '')
        setProductQuery('')
    }

    function handleSupplierSelect(option) {
        setForm((current) => ({ ...current, supplier_id: String(option.id) }))
        setSupplierQuery(option.name)
    }

    function addManualItem(product) {
        setForm((current) => ({
            ...current,
            items: [
                ...current.items,
                {
                    product_id: String(product.id),
                    product_name: product.name,
                    code: product.code || '',
                    barcode: product.barcode || '',
                    quantity_nf: '1',
                    quantity_checked: '1',
                    unit_cost: String(product.cost_price || 0),
                    total: Number(product.cost_price || 0),
                    cst: '',
                    last_cost: Number(product.cost_price || 0),
                    current_sale_price: Number(product.sale_price || 0),
                    suggested_sale_price: String(product.sale_price || 0),
                    apply_sale_price: false,
                    entry_unit: product.unit || 'UN',
                    sale_unit: product.unit || 'UN',
                    conversion_factor: '1',
                },
            ],
        }))
        setProductQuery('')
    }

    function handleItemChange(index, field, value) {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [field]: value } : item
            )),
        }))
    }

    async function handleImportXml() {
        if (!xmlFile) {
            setFeedback({ type: 'error', text: 'Selecione um arquivo XML para importar.' })
            return
        }

        setImporting(true)
        setFeedback(null)

        try {
            const data = new FormData()
            data.append('file', xmlFile)
            const response = await apiRequest('/api/purchases/incoming-nfe/import-xml', { method: 'post', data })
            const document = response.record

            setImportedDocuments((current) => upsertRecord(current, document))

            const hydratedItems = (document.items || []).map((item) => {
                const product = products.find((entry) => String(entry.id) === String(item.product_id || item.suggested_product_id))
                const previousCost = Number(product?.cost_price || item.unit_price || 0)
                const currentSalePrice = Number(product?.sale_price || 0)
                const margin = previousCost > 0 && currentSalePrice > 0 ? ((currentSalePrice / previousCost) - 1) * 100 : 0
                const suggestedSalePrice = previousCost > 0 && currentSalePrice > 0 ? Number(item.unit_price || 0) * (1 + (margin / 100)) : currentSalePrice

                return {
                    id: item.id,
                    product_id: String(item.product_id || item.suggested_product_id || ''),
                    product_name: item.product_name || item.description,
                    code: item.product_code || item.supplier_code || '',
                    barcode: item.barcode || '',
                    quantity_nf: String(item.quantity || 0),
                    quantity_checked: String(item.quantity || 0),
                    unit_cost: String(item.unit_price || 0),
                    total: Number(item.total_price || 0),
                    cst: item.icms_cst_csosn || '',
                    last_cost: previousCost,
                    current_sale_price: currentSalePrice,
                    suggested_sale_price: suggestedSalePrice > 0 ? String(suggestedSalePrice.toFixed(2)) : '',
                    apply_sale_price: false,
                    entry_unit: item.unit || product?.unit || 'UN',
                    sale_unit: product?.unit || 'UN',
                    conversion_factor: '1',
                }
            })

            const preferredCfop = (document.items || []).find((item) => item.cfop)?.cfop || '1102'

            setForm({
                ...createEmptyForm(),
                source_type: 'xml',
                imported_document_id: document.id,
                supplier_id: document.supplier_id ? String(document.supplier_id) : '',
                invoice_number: document.number || '',
                invoice_series: document.series || '',
                issued_at: ensureDate(document.issued_at),
                received_at: todayInput(),
                access_key: document.access_key || '',
                cfop: preferredCfop,
                operation_nature: document.operation_nature || '',
                notes: '',
                freight: String(document.freight_total || 0),
                items: hydratedItems,
                financial_mode: 'boleto',
                boleto_draft: {
                    amount: String(document.invoice_total || 0),
                    due_date: todayInput(),
                    bank_name: '',
                    barcode: '',
                },
                boleto_installments: [],
                installment_total_value: String(document.invoice_total || 0),
                installment_count: '2',
                installment_first_due: todayInput(),
                auto_update_sale_price: false,
                print_after_confirm: Boolean(document.danfe_available),
            })
            setSupplierQuery(document.supplier_name || '')
            setStep(1)
            setFeedback({ type: 'success', text: response.message })
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setImporting(false)
        }
    }

    function selectedPayables() {
        if (form.financial_mode === 'boleto') {
            return form.boleto_installments.map((entry) => ({
                ...entry,
                payment_method: 'boleto',
            }))
        }

        if (form.financial_mode === 'installments') {
            return generatedInstallments
        }

        if (form.financial_mode === 'paid') {
            return [{
                description: form.invoice_number ? `NF ${form.invoice_number}` : 'Entrada paga',
                amount: Number(total.toFixed(2)),
                due_date: form.received_at || todayInput(),
                payment_method: 'pix',
                bank_name: '',
                barcode: '',
                installment_label: 'Parcela unica',
                installment_number: 1,
                installment_total: 1,
                recurrence: 'once',
                notes: null,
                mark_paid: true,
                paid_at: form.received_at || todayInput(),
            }]
        }

        return [{
            description: form.invoice_number ? `NF ${form.invoice_number}` : 'Entrada a vista',
            amount: Number(total.toFixed(2)),
            due_date: form.received_at || todayInput(),
            payment_method: 'cash',
            bank_name: '',
            barcode: '',
            installment_label: 'Parcela unica',
            installment_number: 1,
            installment_total: 1,
            recurrence: 'once',
            notes: null,
            mark_paid: false,
            paid_at: null,
        }]
    }

    function payablesMatchTotal(payables) {
        const sum = payables.reduce((carry, item) => carry + Number(item.amount || 0), 0)

        return Math.abs(sum - total) <= 0.02
    }

    function addBoletoInstallment() {
        const amount = parseNumber(form.boleto_draft.amount, 0)

        if (amount <= 0 || !form.boleto_draft.due_date) {
            setFeedback({ type: 'error', text: 'Informe valor e vencimento para adicionar o boleto.' })
            return
        }

        setForm((current) => ({
            ...current,
            boleto_installments: [
                ...current.boleto_installments,
                {
                    description: current.invoice_number ? `NF ${current.invoice_number}` : 'Boleto',
                    amount,
                    due_date: current.boleto_draft.due_date,
                    payment_method: 'boleto',
                    bank_name: current.boleto_draft.bank_name,
                    barcode: current.boleto_draft.barcode,
                    installment_label: `Parcela ${current.boleto_installments.length + 1}`,
                    installment_number: current.boleto_installments.length + 1,
                    installment_total: current.boleto_installments.length + 1,
                    recurrence: 'once',
                    notes: null,
                    mark_paid: false,
                    paid_at: null,
                },
            ],
            boleto_draft: {
                amount: '',
                due_date: current.boleto_draft.due_date,
                bank_name: current.boleto_draft.bank_name,
                barcode: '',
            },
        }))
    }

    async function handleConfirmEntry() {
        const payables = selectedPayables()

        if (!form.supplier_id) {
            setFeedback({ type: 'error', text: 'Selecione um fornecedor para confirmar a entrada.' })
            setStep(1)
            return
        }

        if (!form.items.length) {
            setFeedback({ type: 'error', text: 'Adicione itens antes de confirmar a entrada.' })
            setStep(2)
            return
        }

        if (unmappedItems.length) {
            setFeedback({ type: 'error', text: 'Todos os itens precisam estar vinculados a um produto do sistema.' })
            setStep(2)
            return
        }

        if (attentionItems.length) {
            setFeedback({ type: 'error', text: 'Preencha o CST de todos os itens antes de prosseguir.' })
            setStep(2)
            return
        }

        if (!payablesMatchTotal(payables)) {
            setFeedback({ type: 'error', text: 'A soma das parcelas precisa bater com o total da nota.' })
            setStep(4)
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const payloadData = {
                supplier_id: Number(form.supplier_id),
                status: 'received',
                received_at: form.received_at || todayInput(),
                freight: parseNumber(form.freight, 0),
                notes: form.notes || null,
                invoice_number: form.invoice_number || null,
                invoice_date: form.issued_at || null,
                invoice_series: form.invoice_series || null,
                invoice_access_key: digitsOnly(form.access_key) || null,
                billing_amount: Number(total.toFixed(2)),
                billing_due_date: payables[0]?.due_date || null,
                billing_barcode: payables[0]?.barcode || null,
                auto_update_sale_price: form.auto_update_sale_price,
                payables,
                items: form.items.map((item, index) => ({
                    product_id: Number(item.product_id),
                    quantity: parseNumber(item.quantity_checked || item.quantity_nf, 0),
                    unit_cost: parseNumber(item.unit_cost, 0),
                    sale_price: parseNumber(item.suggested_sale_price || item.current_sale_price || 0, 0),
                    apply_sale_price: Boolean(form.auto_update_sale_price && item.apply_sale_price),
                })),
            }

            const response = await apiRequest(buildRecordsUrl('entrada-estoque'), { method: 'post', data: payloadData })
            setRecords((current) => upsertRecord(current, response.record))
            setFeedback({ type: 'success', text: response.message })

            if (form.print_after_confirm && form.imported_document_id) {
                window.open(`/api/purchases/incoming-nfe/${form.imported_document_id}/danfe`, '_blank', 'noopener,noreferrer')
            }

            resetEditor()
        } catch (error) {
            setFeedback({ type: 'error', text: error.message })
        } finally {
            setSaving(false)
        }
    }

    const currentPayables = selectedPayables()
    const paymentSummaryLabel = currentPayables.length
        ? currentPayables.map((entry) => `${formatMoney(entry.amount)} · ${formatDate(entry.due_date)}`).join(' | ')
        : 'Sem parcelas configuradas'

    return (
        <AppLayout title={moduleTitle}>
            <div className="proc-ui-page">
                <section className="proc-ui-hero">
                    <div className="proc-ui-hero-top">
                        <div>
                            <span className="proc-ui-eyebrow">
                                <i className="fa-solid fa-file-invoice" />
                                Entrada em funil
                            </span>
                            <h1>{moduleTitle}</h1>
                            <p>Receba XML ou digite manualmente, confira quantidades com rapidez e feche fiscal + financeiro no mesmo fluxo.</p>
                        </div>

                        <div className="proc-ui-hero-stats">
                            <article className="proc-ui-kpi-card">
                                <span>Entradas</span>
                                <strong>{records.length}</strong>
                            </article>
                            <article className="proc-ui-kpi-card">
                                <span>Itens na etapa</span>
                                <strong>{formatNumber(form.items.length)}</strong>
                            </article>
                            <article className="proc-ui-kpi-card">
                                <span>Total da nota</span>
                                <strong>{formatMoney(total)}</strong>
                            </article>
                        </div>
                    </div>
                </section>

                <div className="proc-ui-shell">
                    <section className="proc-ui-main-card">
                        <div className="proc-ui-main-header">
                            <div>
                                <h2>{form.id ? 'Consulta da entrada' : 'Nova entrada'}</h2>
                                <p>{form.invoice_number ? `NF ${form.invoice_number}${form.invoice_series ? ` / ${form.invoice_series}` : ''}` : 'Wizard operacional de 5 etapas para entrada e validacao.'}</p>
                            </div>

                            <div className="proc-ui-statusline">
                                {form.id ? <StatusBadge compact {...resolveEntryStatusMeta(form)} /> : null}
                                {editorMode === 'view' ? <StatusBadge compact label="Somente leitura" tone="warning" /> : null}
                            </div>
                        </div>

                        <div className="proc-ui-stepper" style={{ '--proc-step-count': STEPS.length }}>
                            {STEPS.map((entry, index) => (
                                <button
                                    key={entry.key}
                                    type="button"
                                    className={`proc-ui-step ${step === index ? 'active' : ''} ${step > index ? 'complete' : ''}`}
                                    onClick={() => {
                                        if (index <= step || !criticalReason) {
                                            setStep(index)
                                        }
                                    }}
                                >
                                    <span className="proc-ui-step-index">{step > index ? <i className="fa-solid fa-check" /> : index + 1}</span>
                                    <strong>{entry.label}</strong>
                                    <span className="proc-ui-step-note"><i className={`fa-solid ${entry.icon}`} /> {entry.label}</span>
                                </button>
                            ))}
                        </div>

                        {feedback ? (
                            <div className={`proc-ui-flash ${feedback.type === 'success' ? 'success' : 'error'}`}>
                                <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                                <span>{feedback.text}</span>
                            </div>
                        ) : null}

                        {step === 0 ? (
                            <div key="stock-step-origin" className="proc-ui-stage">
                                <div className="proc-ui-origin-grid">
                                    <button
                                        type="button"
                                        className={`proc-ui-origin-card ${form.source_type === 'xml' ? 'active' : ''}`}
                                        onClick={() => setForm((current) => ({ ...current, source_type: 'xml' }))}
                                    >
                                        <i className="fa-solid fa-file-arrow-up" />
                                        <h3>Importar XML</h3>
                                        <p>Upload do XML da NF-e para preencher fornecedor, nota e itens automaticamente.</p>
                                    </button>

                                    <button
                                        type="button"
                                        className={`proc-ui-origin-card ${form.source_type === 'manual' ? 'active' : ''}`}
                                        onClick={() => setForm((current) => ({ ...current, source_type: 'manual' }))}
                                    >
                                        <i className="fa-solid fa-pen-to-square" />
                                        <h3>Entrada manual</h3>
                                        <p>Digite os dados da nota, confira o recebimento e gere o financeiro sem depender do XML.</p>
                                    </button>
                                </div>

                                {form.source_type === 'xml' ? (
                                    <section className="proc-ui-section-card">
                                        <div className="proc-ui-section-title">
                                            <h3>Upload do XML</h3>
                                            <p>O arquivo sera importado e as etapas 2, 3 e 4 serao preenchidas automaticamente.</p>
                                        </div>

                                        <div className="proc-ui-field">
                                            <label>
                                                <span>Arquivo XML</span>
                                                <input type="file" accept=".xml,text/xml,application/xml" onChange={(event) => setXmlFile(event.target.files?.[0] || null)} />
                                            </label>
                                        </div>

                                        <div className="proc-ui-step-actions">
                                            <span className="proc-ui-muted">{xmlFile ? xmlFile.name : 'Nenhum arquivo selecionado'}</span>
                                            <button type="button" className="ui-button" disabled={importing} onClick={handleImportXml}>
                                                {importing ? 'Importando...' : 'Importar XML'}
                                            </button>
                                        </div>
                                    </section>
                                ) : null}

                                {form.source_type === 'manual' ? (
                                    <div className="proc-ui-step-actions">
                                        <div className="proc-ui-inline-meta">
                                            <span>Modo manual ativo</span>
                                            <span>Etapas seguintes abertas para digitacao</span>
                                        </div>
                                        <button type="button" className="ui-button" onClick={() => setStep(1)}>
                                            <span>Proximo</span>
                                            <i className="fa-solid fa-arrow-right" />
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {step === 1 ? (
                            <div key="stock-step-note" className="proc-ui-stage">
                                <AutocompleteField
                                    icon="fa-building"
                                    label="Fornecedor"
                                    query={supplierQuery}
                                    selectedLabel={selectedSupplier?.name || null}
                                    placeholder="Buscar fornecedor por nome ou documento"
                                    emptyLabel="Nenhum fornecedor encontrado"
                                    options={supplierOptions}
                                    disabled={!canEdit}
                                    onQueryChange={setSupplierQuery}
                                    onSelect={handleSupplierSelect}
                                />

                                <div className="proc-ui-field-grid">
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Numero NF</span>
                                            <input disabled={!canEdit} value={form.invoice_number} onChange={(event) => setForm((current) => ({ ...current, invoice_number: event.target.value }))} />
                                        </label>
                                    </div>
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Serie</span>
                                            <input disabled={!canEdit} value={form.invoice_series} onChange={(event) => setForm((current) => ({ ...current, invoice_series: event.target.value }))} />
                                        </label>
                                    </div>
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Data de emissao</span>
                                            <input disabled={!canEdit} type="date" value={form.issued_at} onChange={(event) => setForm((current) => ({ ...current, issued_at: event.target.value }))} />
                                        </label>
                                    </div>
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Data de entrada</span>
                                            <input disabled={!canEdit} type="date" value={form.received_at} onChange={(event) => setForm((current) => ({ ...current, received_at: event.target.value }))} />
                                        </label>
                                    </div>
                                    <div className="proc-ui-field full">
                                        <label>
                                            <span>Chave de acesso NF-e</span>
                                            <input disabled={!canEdit} value={form.access_key} onChange={(event) => setForm((current) => ({ ...current, access_key: event.target.value }))} />
                                        </label>
                                    </div>
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>CFOP principal</span>
                                            <select disabled={!canEdit} value={form.cfop} onChange={(event) => setForm((current) => ({ ...current, cfop: event.target.value }))}>
                                                {CFOP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="proc-ui-field">
                                        <label>
                                            <span>Frete</span>
                                            <input disabled={!canEdit} min="0" step="0.01" type="number" value={form.freight} onChange={(event) => setForm((current) => ({ ...current, freight: event.target.value }))} />
                                        </label>
                                    </div>
                                    <div className="proc-ui-field full">
                                        <label>
                                            <span>Natureza da operacao</span>
                                            <input disabled={!canEdit} value={form.operation_nature} onChange={(event) => setForm((current) => ({ ...current, operation_nature: event.target.value }))} />
                                        </label>
                                    </div>
                                </div>

                                <div className="proc-ui-step-actions">
                                    <button type="button" className="ui-button-ghost" onClick={() => setStep(0)}>
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Voltar</span>
                                    </button>
                                    <button type="button" className="ui-button" disabled={Boolean(criticalReason)} title={criticalReason || undefined} onClick={() => setStep(2)}>
                                        <span>Proximo</span>
                                        <i className="fa-solid fa-arrow-right" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {step === 2 ? (
                            <div key="stock-step-items" className="proc-ui-stage">
                                {costAlerts.length ? (
                                    <div className="proc-ui-banner warning">
                                        <i className="fa-solid fa-triangle-exclamation" />
                                        <div>
                                            <strong>Variacoes de custo identificadas</strong>
                                            <div>{costAlerts[0].item.product_name}: custo anterior {formatMoney(costAlerts[0].previous)} → atual {formatMoney(costAlerts[0].current)} ({formatPercent(costAlerts[0].deltaPercent)})</div>
                                        </div>
                                    </div>
                                ) : null}

                                <AutocompleteField
                                    icon="fa-plus"
                                    label="Adicionar item manualmente"
                                    query={productQuery}
                                    selectedLabel={null}
                                    placeholder="Buscar produto por nome, codigo ou barras"
                                    emptyLabel="Nenhum produto encontrado"
                                    options={productOptions}
                                    disabled={!canEdit}
                                    onQueryChange={setProductQuery}
                                    onSelect={addManualItem}
                                />

                                <div className="proc-ui-table-wrap">
                                    <table className="proc-ui-table">
                                        <thead>
                                            <tr>
                                                <th>Cod. barras</th>
                                                <th>Produto</th>
                                                <th>Qtd NF</th>
                                                <th>Qtd conferida</th>
                                                <th>Custo unit.</th>
                                                <th>Total</th>
                                                <th>CST</th>
                                                <th>Acoes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {form.items.length ? form.items.map((item, index) => (
                                                <tr key={`${item.product_id || item.product_name}-${index}`} className={parseNumber(item.quantity_checked, 0) !== parseNumber(item.quantity_nf, 0) ? 'warning-row' : ''}>
                                                    <td>{item.barcode || item.code || '-'}</td>
                                                    <td>
                                                        <div className="proc-ui-record-card-copy">
                                                            <strong>{item.product_name || 'Produto nao vinculado'}</strong>
                                                            <span>{item.product_id ? `Produto #${item.product_id}` : 'Vincule a um produto'}</span>
                                                        </div>
                                                    </td>
                                                    <td>{formatNumber(item.quantity_nf)}</td>
                                                    <td>
                                                        <input disabled={!canEdit} min="0" step="0.001" type="number" value={item.quantity_checked} onChange={(event) => handleItemChange(index, 'quantity_checked', event.target.value)} />
                                                    </td>
                                                    <td>
                                                        <input disabled={!canEdit} min="0" step="0.01" type="number" value={item.unit_cost} onChange={(event) => handleItemChange(index, 'unit_cost', event.target.value)} />
                                                    </td>
                                                    <td><strong>{formatMoney(parseNumber(item.quantity_checked || item.quantity_nf, 0) * parseNumber(item.unit_cost, 0))}</strong></td>
                                                    <td>
                                                        <select disabled={!canEdit} value={item.cst} onChange={(event) => handleItemChange(index, 'cst', event.target.value)}>
                                                            <option value="">Selecionar</option>
                                                            {CST_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <div className="proc-ui-table-actions">
                                                            <button type="button" className="ui-button-ghost" disabled={!canEdit} onClick={() => handleItemChange(index, 'quantity_checked', String(parseNumber(item.quantity_checked, 0) + 1))}>
                                                                <i className="fa-solid fa-barcode" />
                                                            </button>
                                                            <button type="button" className="ui-button-ghost danger" disabled={!canEdit} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>
                                                                <i className="fa-solid fa-trash" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="8">
                                                        <div className="proc-ui-empty">
                                                            <strong>Sem itens na entrada</strong>
                                                            <p>Importe um XML ou adicione produtos manualmente.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    <div className="proc-ui-table-totalbar">
                                        <span>Qtd total: <strong>{formatNumber(form.items.reduce((carry, item) => carry + parseNumber(item.quantity_checked || item.quantity_nf, 0), 0))}</strong></span>
                                        <span>Itens: <strong>{formatNumber(form.items.length)}</strong></span>
                                        <span>Subtotal: <strong>{formatMoney(subtotal)}</strong></span>
                                        <span>Frete: <strong>{formatMoney(form.freight)}</strong></span>
                                        <span>Total NF: <strong>{formatMoney(total)}</strong></span>
                                    </div>
                                </div>

                                <div className="proc-ui-step-actions">
                                    <button type="button" className="ui-button-ghost" onClick={() => setStep(1)}>
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Voltar</span>
                                    </button>
                                    <button type="button" className="ui-button" disabled={Boolean(criticalReason)} title={criticalReason || undefined} onClick={() => setStep(3)}>
                                        <span>Proximo</span>
                                        <i className="fa-solid fa-arrow-right" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {step === 3 ? (
                            <div key="stock-step-fiscal" className="proc-ui-stage">
                                <section className="proc-ui-review-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Dados fiscais da nota</h3>
                                        <p>Resumo rapido para revisar CFOP, fornecedor e pendencias antes do financeiro.</p>
                                    </div>

                                    <div className="proc-ui-surface-list">
                                        <div className="proc-ui-surface-item"><span>CFOP</span><strong>{form.cfop || '-'}</strong></div>
                                        <div className="proc-ui-surface-item"><span>Natureza</span><strong>{form.operation_nature || 'Nao informada'}</strong></div>
                                        <div className="proc-ui-surface-item"><span>Fornecedor</span><strong>{selectedSupplier?.name || 'Nao informado'}</strong></div>
                                    </div>

                                    <div className="proc-ui-list-stack">
                                        <div className={`proc-ui-banner ${attentionItems.length ? 'critical' : 'info'}`}>
                                            <i className={`fa-solid ${attentionItems.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}`} />
                                            <div>{attentionItems.length ? `${attentionItems.length} item(ns) com CST nao preenchido` : 'CST preenchido para todos os itens'}</div>
                                        </div>
                                        <div className={`proc-ui-banner ${costAlerts.length ? 'warning' : 'info'}`}>
                                            <i className={`fa-solid ${costAlerts.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}`} />
                                            <div>{costAlerts.length ? `${costAlerts.length} item(ns) com variacao de custo acima de 5%` : 'Sem variacoes de custo relevantes'}</div>
                                        </div>
                                        <div className={`proc-ui-banner ${quantityAlerts.length ? 'warning' : 'info'}`}>
                                            <i className={`fa-solid ${quantityAlerts.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}`} />
                                            <div>{quantityAlerts.length ? `${quantityAlerts.length} item(ns) com divergencia de conferencia` : `Quantidades conferidas: ${formatNumber(form.items.reduce((carry, item) => carry + parseNumber(item.quantity_checked, 0), 0))}`}</div>
                                        </div>
                                    </div>
                                </section>

                                <section className="proc-ui-section-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Fracionamento manual</h3>
                                        <p>Use quando a unidade de entrada precisa ser convertida para a unidade de venda.</p>
                                    </div>

                                    {form.items.length ? (
                                        <div className="proc-ui-two-grid">
                                            {form.items.map((item, index) => (
                                                <div key={`fraction-${index}`} className="proc-ui-mini-card">
                                                    <strong>{item.product_name}</strong>
                                                    <div className="proc-ui-field-grid">
                                                        <div className="proc-ui-field">
                                                            <label>
                                                                <span>Unidade entrada</span>
                                                                <input disabled={!canEdit} value={item.entry_unit} onChange={(event) => handleItemChange(index, 'entry_unit', event.target.value)} />
                                                            </label>
                                                        </div>
                                                        <div className="proc-ui-field">
                                                            <label>
                                                                <span>Fator conversao</span>
                                                                <input disabled={!canEdit} min="1" step="1" type="number" value={item.conversion_factor} onChange={(event) => handleItemChange(index, 'conversion_factor', event.target.value)} />
                                                            </label>
                                                        </div>
                                                        <div className="proc-ui-field full">
                                                            <label>
                                                                <span>Unidade venda</span>
                                                                <input disabled={!canEdit} value={item.sale_unit} onChange={(event) => handleItemChange(index, 'sale_unit', event.target.value)} />
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="proc-ui-empty">
                                            <strong>Nenhum item para fracionar</strong>
                                        </div>
                                    )}
                                </section>

                                <section className="proc-ui-section-card">
                                    <div className="proc-ui-card-toolbar">
                                        <div className="proc-ui-section-title">
                                            <h3>Ajuste de preco de venda</h3>
                                            <p>Listamos apenas os itens cujo custo mudou de forma relevante.</p>
                                        </div>
                                        <label className="proc-ui-pill">
                                            <input checked={form.auto_update_sale_price} disabled={!canEdit} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, auto_update_sale_price: event.target.checked }))} />
                                            <span>Atualizar preco automaticamente</span>
                                        </label>
                                    </div>

                                    {costAlerts.length ? (
                                        <div className="proc-ui-surface-list">
                                            {costAlerts.map((alert, index) => (
                                                <div key={`cost-alert-${index}`} className="proc-ui-surface-item">
                                                    <div>
                                                        <strong>{alert.item.product_name}</strong>
                                                        <small>{formatMoney(alert.previous)} → {formatMoney(alert.current)} · margem atual {formatPercent(alert.margin)}</small>
                                                    </div>
                                                    <div className="proc-ui-record-card-copy">
                                                        <strong>{formatMoney(alert.suggested)}</strong>
                                                        <label className="proc-ui-pill">
                                                            <input checked={Boolean(alert.item.apply_sale_price)} disabled={!canEdit} type="checkbox" onChange={(event) => handleItemChange(form.items.indexOf(alert.item), 'apply_sale_price', event.target.checked)} />
                                                            <span>Aplicar</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="proc-ui-empty">
                                            <strong>Sem itens com variacao relevante</strong>
                                        </div>
                                    )}
                                </section>

                                <div className="proc-ui-step-actions">
                                    <button type="button" className="ui-button-ghost" onClick={() => setStep(2)}>
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Voltar</span>
                                    </button>
                                    <button type="button" className="ui-button" disabled={attentionItems.length > 0 || unmappedItems.length > 0} title={attentionItems.length > 0 || unmappedItems.length > 0 ? 'Resolva CSTs e mapeamentos pendentes para continuar.' : undefined} onClick={() => setStep(4)}>
                                        <span>Proximo</span>
                                        <i className="fa-solid fa-arrow-right" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {step === 4 ? (
                            <div key="stock-step-financial" className="proc-ui-stage">
                                <section className="proc-ui-section-card">
                                    <div className="proc-ui-section-title">
                                        <h3>Condicoes de pagamento</h3>
                                        <p>Configure os compromissos que alimentarao contas a pagar automaticamente.</p>
                                    </div>

                                    <div className="proc-ui-chip-row">
                                        {FINANCIAL_MODES.map((mode) => (
                                            <button
                                                key={mode.key}
                                                type="button"
                                                className={`proc-ui-chip ${form.financial_mode === mode.key ? 'active' : ''}`}
                                                onClick={() => setForm((current) => ({ ...current, financial_mode: mode.key }))}
                                            >
                                                <i className={`fa-solid ${mode.icon}`} />
                                                <span>{mode.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {form.financial_mode === 'boleto' ? (
                                        <div className="proc-ui-financial-grid">
                                            <div className="proc-ui-field">
                                                <label>
                                                    <span>Valor</span>
                                                    <input min="0" step="0.01" type="number" value={form.boleto_draft.amount} onChange={(event) => setForm((current) => ({ ...current, boleto_draft: { ...current.boleto_draft, amount: event.target.value } }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field">
                                                <label>
                                                    <span>Vencimento</span>
                                                    <input type="date" value={form.boleto_draft.due_date} onChange={(event) => setForm((current) => ({ ...current, boleto_draft: { ...current.boleto_draft, due_date: event.target.value } }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field">
                                                <label>
                                                    <span>Banco</span>
                                                    <input value={form.boleto_draft.bank_name} onChange={(event) => setForm((current) => ({ ...current, boleto_draft: { ...current.boleto_draft, bank_name: event.target.value } }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field">
                                                <label>
                                                    <span>Codigo de barras</span>
                                                    <input value={form.boleto_draft.barcode} onChange={(event) => setForm((current) => ({ ...current, boleto_draft: { ...current.boleto_draft, barcode: event.target.value } }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field full">
                                                <button type="button" className="ui-button-ghost" onClick={addBoletoInstallment}>
                                                    <i className="fa-solid fa-plus" />
                                                    <span>Adicionar parcela</span>
                                                </button>
                                            </div>
                                            <div className="proc-ui-field full">
                                                {form.boleto_installments.length ? (
                                                    <div className="proc-ui-surface-list">
                                                        {form.boleto_installments.map((installment, index) => (
                                                            <div key={`boleto-${index}`} className="proc-ui-surface-item">
                                                                <div>
                                                                    <strong>{installment.installment_label}</strong>
                                                                    <small>{formatMoney(installment.amount)} · {formatDate(installment.due_date)}</small>
                                                                </div>
                                                                <button type="button" className="ui-button-ghost danger" onClick={() => setForm((current) => ({ ...current, boleto_installments: current.boleto_installments.filter((_, installmentIndex) => installmentIndex !== index) }))}>
                                                                    Remover
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <div className="proc-ui-empty"><strong>Nenhum boleto adicionado</strong></div>}
                                            </div>
                                        </div>
                                    ) : null}

                                    {form.financial_mode === 'installments' ? (
                                        <div className="proc-ui-financial-grid">
                                            <div className="proc-ui-field">
                                                <label>
                                                    <span>Valor total</span>
                                                    <input min="0" step="0.01" type="number" value={form.installment_total_value} onChange={(event) => setForm((current) => ({ ...current, installment_total_value: event.target.value }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field">
                                                <label>
                                                    <span>Numero de parcelas</span>
                                                    <input min="2" step="1" type="number" value={form.installment_count} onChange={(event) => setForm((current) => ({ ...current, installment_count: event.target.value }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field full">
                                                <label>
                                                    <span>Primeira parcela</span>
                                                    <input type="date" value={form.installment_first_due} onChange={(event) => setForm((current) => ({ ...current, installment_first_due: event.target.value }))} />
                                                </label>
                                            </div>
                                            <div className="proc-ui-field full">
                                                <div className="proc-ui-surface-list">
                                                    {generatedInstallments.map((installment, index) => (
                                                        <div key={`installment-${index}`} className="proc-ui-surface-item">
                                                            <div>
                                                                <strong>{installment.installment_label}</strong>
                                                                <small>{formatDate(installment.due_date)}</small>
                                                            </div>
                                                            <strong>{formatMoney(installment.amount)}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </section>

                                <section className="proc-ui-review-card">
                                    <div className="proc-ui-card-toolbar">
                                        <div className="proc-ui-section-title">
                                            <h3>Revisao final</h3>
                                            <p>Resumo compacto antes de confirmar a entrada.</p>
                                        </div>
                                        <label className="proc-ui-pill">
                                            <input checked={form.print_after_confirm} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, print_after_confirm: event.target.checked }))} />
                                            <span>Imprimir espelho apos confirmar</span>
                                        </label>
                                    </div>

                                    <div className="proc-ui-summary-grid">
                                        <article className="proc-ui-summary-card">
                                            <span>Fornecedor</span>
                                            <strong>{selectedSupplier?.name || 'Nao informado'}</strong>
                                        </article>
                                        <article className="proc-ui-summary-card">
                                            <span>NF</span>
                                            <strong>{form.invoice_number || '-'}</strong>
                                        </article>
                                        <article className="proc-ui-summary-card">
                                            <span>Total</span>
                                            <strong>{formatMoney(total)}</strong>
                                        </article>
                                        <article className="proc-ui-summary-card">
                                            <span>Parcelas</span>
                                            <strong>{currentPayables.length}</strong>
                                        </article>
                                    </div>

                                    <div className="proc-ui-banner info">
                                        <i className="fa-solid fa-receipt" />
                                        <div>{paymentSummaryLabel}</div>
                                    </div>
                                </section>

                                <div className="proc-ui-step-actions">
                                    <button type="button" className="ui-button-ghost" onClick={() => setStep(3)}>
                                        <i className="fa-solid fa-arrow-left" />
                                        <span>Voltar</span>
                                    </button>
                                    <button type="button" className="ui-button" disabled={saving} onClick={handleConfirmEntry}>
                                        <i className="fa-solid fa-check" />
                                        <span>{saving ? 'Confirmando...' : 'Confirmar entrada'}</span>
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </section>

                    <aside className="proc-ui-sidebar">
                        <div className="proc-ui-sidebar-section">
                            <div className="proc-ui-sidebar-header">
                                <div>
                                    <h2>Historico</h2>
                                    <p>Lista compacta das entradas recebidas.</p>
                                </div>
                                <button type="button" className="ui-button" onClick={resetEditor}>
                                    <i className="fa-solid fa-plus" />
                                    <span>Nova entrada</span>
                                </button>
                            </div>
                        </div>

                        <div className="proc-ui-sidebar-section">
                            <input className="proc-ui-searchbox" type="search" placeholder="Buscar NF ou fornecedor" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} />
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
                            {filteredRecords.length ? filteredRecords.map((record) => {
                                const linkedDocument = importedDocuments.find((document) => String(document.purchase_id || '') === String(record.id) || String(document.access_key || '') === String(record.invoice_access_key || ''))

                                return (
                                    <button key={record.id} type="button" className={`proc-ui-record-card ${String(form.id || '') === String(record.id) ? 'active' : ''}`} onClick={() => loadRecord(record)}>
                                        <div className="proc-ui-record-card-top">
                                            <strong>{record.invoice_number || record.code}</strong>
                                            <StatusBadge compact label={record.supplier_name || 'Entrada'} tone="info" />
                                        </div>

                                        <div className="proc-ui-record-card-copy">
                                            <strong>{formatMoney(record.total || 0)}</strong>
                                            <span>{`${formatNumber(record.quantity_total || 0)} un · ${record.received_at ? formatDate(record.received_at) : 'Sem data'}`}</span>
                                        </div>

                                        <div className="proc-ui-record-card-actions">
                                            <button type="button" className="proc-ui-ghost-icon" title="Ver" onClick={(event) => { event.stopPropagation(); loadRecord(record) }}>
                                                <i className="fa-solid fa-eye" />
                                            </button>
                                            <button type="button" className="proc-ui-ghost-icon" title="Espelho NF" disabled={!linkedDocument?.danfe_available} onClick={(event) => {
                                                event.stopPropagation()
                                                if (linkedDocument?.id) {
                                                    window.open(`/api/purchases/incoming-nfe/${linkedDocument.id}/danfe`, '_blank', 'noopener,noreferrer')
                                                }
                                            }}>
                                                <i className="fa-solid fa-print" />
                                            </button>
                                            <button type="button" className="proc-ui-ghost-icon" title="Cancelar indisponivel por rastreabilidade" disabled>
                                                <i className="fa-solid fa-xmark" />
                                            </button>
                                        </div>
                                    </button>
                                )
                            }) : (
                                <div className="proc-ui-empty">
                                    <strong>Sem entradas no periodo</strong>
                                    <p>Ajuste a busca ou inicie uma nova entrada.</p>
                                </div>
                            )}
                        </div>

                        <div className="proc-ui-footer-totals">
                            <span>Total no filtro: <strong>{formatMoney(filteredRecords.reduce((carry, record) => carry + Number(record.total || 0), 0))}</strong></span>
                            <span>Volumes: <strong>{formatNumber(filteredRecords.reduce((carry, record) => carry + Number(record.quantity_total || 0), 0))}</strong></span>
                        </div>
                    </aside>
                </div>
            </div>
        </AppLayout>
    )
}
