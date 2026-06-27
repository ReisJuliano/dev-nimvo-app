import { router, useForm } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import CreateConditionalSaleCard from '@/Components/ConditionalSales/CreateConditionalSaleCard'
import ConditionalSaleDetailCard from '@/Components/ConditionalSales/ConditionalSaleDetailCard'
import ActionDrawer from '@/Components/UI/ActionDrawer'
import DataTable from '@/Components/UI/DataTable'
import ModalForm from '@/Components/UI/ModalForm'
import PageHeader from '@/Components/UI/PageHeader'
import StatusBadge from '@/Components/UI/StatusBadge'
import useResetPageHistoryOnLeave from '@/hooks/useResetPageHistoryOnLeave'
import AppLayout from '@/Layouts/AppLayout'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '@/lib/format'
import { replaceCurrentInertiaHistoryPage } from '@/lib/inertiaHistory'
import '@/Pages/Products/products.css'
import './conditional-sales.css'

function toLocalDateTimeValue(value = new Date()) {
    const date = new Date(value)
    const normalized = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))

    return normalized.toISOString().slice(0, 16)
}

function toLocalDateValue(value = new Date()) {
    const date = new Date(value)
    const normalized = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))

    return normalized.toISOString().slice(0, 10)
}

function currentMonthRange() {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

    return { from: toLocalDateValue(firstDay), to: toLocalDateValue(today) }
}

function buildCreateDefaults() {
    return {
        customer_id: '',
        withdrawn_at: toLocalDateTimeValue(),
        due_at: toLocalDateValue(new Date(Date.now() + (3 * 24 * 60 * 60 * 1000))),
        notes: '',
        items: [
            {
                product_id: '',
                quantity: '1',
                unit_price: '',
            },
        ],
    }
}

function buildReturnDefaults(conditionalSale) {
    return {
        returned_at: toLocalDateTimeValue(),
        notes: '',
        items: (conditionalSale?.items || [])
            .filter((item) => Number(item.remaining_quantity) > 0)
            .map((item) => ({
                id: item.id,
                returned_quantity: '',
            })),
    }
}

function buildFinalizeDefaults(conditionalSale) {
    return {
        resolved_at: toLocalDateTimeValue(),
        notes: '',
        cash_received: '',
        items: (conditionalSale?.items || [])
            .filter((item) => Number(item.remaining_quantity) > 0)
            .map((item) => ({
                id: item.id,
                returned_quantity: '',
                kept_quantity: '',
                lost_quantity: '',
                damaged_quantity: '',
            })),
        payments: [
            {
                method: 'pix',
                amount: '',
            },
        ],
    }
}

function parseNumber(value) {
    const parsed = Number(value || 0)

    return Number.isFinite(parsed) ? parsed : 0
}

function TopProductsCard({ topProducts }) {
    return (
        <section className="products-table-card conditional-side-card">
            <div className="products-table-header conditional-side-head">
                <div>
                    <h2>Top saidas</h2>
                    <p>Resumo rapido da carteira</p>
                </div>
            </div>
            <div className="conditional-table-wrap">
                {topProducts.length ? (
                    <table className="conditional-table conditional-table-dense">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Saida</th>
                                <th>Aberto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProducts.map((product) => (
                                <tr key={product.product_id}>
                                    <td>{product.product_name}</td>
                                    <td>{formatNumber(product.sent_quantity)}</td>
                                    <td>{formatNumber(product.outstanding_quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="conditional-empty conditional-empty-tight">
                        <i className="fa-solid fa-box-open" />
                        <span>Sem historico</span>
                    </div>
                )}
            </div>
        </section>
    )
}

export default function ConditionalSalesPage({
    conditionals = [],
    customers = [],
    products = [],
    paymentMethods = [],
    filters = {},
}) {
    const initialSearch = filters?.search || ''
    const initialApplied = Boolean(filters?.applied)
    const defaultRange = useMemo(() => currentMonthRange(), [])
    const [createOpen, setCreateOpen] = useState(false)
    const [search, setSearch] = useState(initialSearch)
    const [activeFilter, setActiveFilter] = useState('all')
    const [range, setRange] = useState(initialApplied ? { from: filters?.from || '', to: filters?.to || '' } : defaultRange)
    const [appliedSearch, setAppliedSearch] = useState(initialApplied ? initialSearch : '')
    const [appliedFilter, setAppliedFilter] = useState('all')
    const [appliedRange, setAppliedRange] = useState(initialApplied ? { from: filters?.from || '', to: filters?.to || '' } : defaultRange)
    const [hasAppliedFilters, setHasAppliedFilters] = useState(initialApplied)
    const [selectedRecordId, setSelectedRecordId] = useState(null)
    const [openedRecordId, setOpenedRecordId] = useState(null)
    const [detailPanel, setDetailPanel] = useState('overview')
    const createForm = useForm(buildCreateDefaults())
    const visibleConditionals = useMemo(
        () => (hasAppliedFilters ? conditionals : []),
        [conditionals, hasAppliedFilters],
    )
    const customerMetaById = useMemo(
        () => new Map(customers.map((customer) => [String(customer.id), customer])),
        [customers],
    )
    const openedConditional = useMemo(
        () => conditionals.find((conditionalSale) => String(conditionalSale.id) === String(openedRecordId)) || null,
        [conditionals, openedRecordId],
    )
    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer.id) === String(createForm.data.customer_id)) || null,
        [customers, createForm.data.customer_id],
    )
    const returnForm = useForm(buildReturnDefaults(openedConditional))
    const finalizeForm = useForm(buildFinalizeDefaults(openedConditional))
    useEffect(() => {
        returnForm.setData(buildReturnDefaults(openedConditional))
        returnForm.clearErrors()
        finalizeForm.setData(buildFinalizeDefaults(openedConditional))
        finalizeForm.clearErrors()
    }, [finalizeForm, openedConditional, returnForm])

    const resetHistoryEntry = useCallback(() => {
        replaceCurrentInertiaHistoryPage((page) => ({
            ...page,
            url: '/venda-condicional',
            props: {
                ...page.props,
                filters: {
                    applied: false,
                    status: 'open',
                    search: '',
                    from: defaultRange.from,
                    to: defaultRange.to,
                    conditional: null,
                },
            },
        }), '/venda-condicional')
    }, [defaultRange.from, defaultRange.to])

    useResetPageHistoryOnLeave(resetHistoryEntry)

    const createPreview = useMemo(
        () => createForm.data.items.reduce((total, item) => total + (parseNumber(item.quantity) * parseNumber(item.unit_price)), 0),
        [createForm.data.items],
    )

    const finalizePreview = useMemo(() => {
        if (!openedConditional) {
            return 0
        }

        return finalizeForm.data.items.reduce((total, item) => {
            const source = openedConditional.items.find((entry) => Number(entry.id) === Number(item.id))
            const billedQuantity = parseNumber(item.kept_quantity) + parseNumber(item.lost_quantity) + parseNumber(item.damaged_quantity)

            return total + (billedQuantity * Number(source?.unit_price || 0))
        }, 0)
    }, [finalizeForm.data.items, openedConditional])

    const hasCashPayment = finalizeForm.data.payments.some((payment) => payment.method === 'cash')

    const filteredRows = useMemo(() => {
        if (!hasAppliedFilters) {
            return []
        }

        return visibleConditionals.filter((conditionalSale) => {
            const customerMeta = customerMetaById.get(String(conditionalSale.customer?.id || '')) || {}
            const referenceDate = String(conditionalSale.withdrawn_at || conditionalSale.due_at || '').slice(0, 10)

            if (appliedRange.from && referenceDate && referenceDate < appliedRange.from) {
                return false
            }

            if (appliedRange.to && referenceDate && referenceDate > appliedRange.to) {
                return false
            }

            if (appliedFilter === 'owing' && Number(conditionalSale.outstanding_total || 0) <= 0) {
                return false
            }

            if (appliedFilter === 'alert' && Number(conditionalSale.days_overdue || 0) <= 0) {
                return false
            }

            if (appliedFilter === 'over_limit') {
                const limit = Number(customerMeta.credit_limit || 0)

                if (limit <= 0 || Number(conditionalSale.outstanding_total || 0) <= limit) {
                    return false
                }
            }

            if (!appliedSearch.trim()) {
                return true
            }

            return String([
                conditionalSale.customer?.name || '',
                conditionalSale.code || '',
                conditionalSale.sale?.sale_number || '',
                conditionalSale.operator_name || '',
            ].join(' ')).toLowerCase().includes(appliedSearch.trim().toLowerCase())
        })
    }, [appliedFilter, appliedRange.from, appliedRange.to, appliedSearch, customerMetaById, hasAppliedFilters, visibleConditionals])

    const selectedRow = useMemo(
        () => filteredRows.find((conditionalSale) => String(conditionalSale.id) === String(selectedRecordId))
            || null,
        [filteredRows, selectedRecordId],
    )

    useEffect(() => {
        if (!filteredRows.length) {
            setSelectedRecordId(null)
            setOpenedRecordId(null)
            return
        }

        if (selectedRecordId && !filteredRows.some((conditionalSale) => String(conditionalSale.id) === String(selectedRecordId))) {
            setSelectedRecordId(null)
        }

        if (openedRecordId && !filteredRows.some((conditionalSale) => String(conditionalSale.id) === String(openedRecordId))) {
            setOpenedRecordId(null)
        }
    }, [filteredRows, openedRecordId, selectedRecordId])

    function addCreateItem() {
        createForm.setData('items', [
            ...createForm.data.items,
            { product_id: '', quantity: '1', unit_price: '' },
        ])
    }

    function removeCreateItem(index) {
        createForm.setData('items', createForm.data.items.filter((_, itemIndex) => itemIndex !== index))
    }

    function updateCreateItem(index, field, value) {
        const nextItems = createForm.data.items.map((item, itemIndex) => {
            if (itemIndex !== index) {
                return item
            }

            if (field !== 'product_id') {
                return {
                    ...item,
                    [field]: value,
                }
            }

            const product = products.find((entry) => String(entry.id) === String(value))

            return {
                ...item,
                product_id: value,
                unit_price: item.unit_price || String(product?.sale_price || ''),
            }
        })

        createForm.setData('items', nextItems)
    }

    function handleCreateSubmit(event) {
        event.preventDefault()
        createForm.post('/venda-condicional', {
            preserveScroll: true,
            onSuccess: () => {
                createForm.setData(buildCreateDefaults())
                setCreateOpen(false)
            },
        })
    }

    function updateReturnItem(itemId, value) {
        returnForm.setData('items', returnForm.data.items.map((item) => (
            Number(item.id) === Number(itemId)
                ? { ...item, returned_quantity: value }
                : item
        )))
    }

    function applyReturnAll(itemId, remainingQuantity) {
        updateReturnItem(itemId, String(remainingQuantity))
    }

    function handleReturnSubmit(event) {
        event.preventDefault()

        if (!openedConditional) {
            return
        }

        returnForm.post(`/venda-condicional/${openedConditional.id}/devolver`, {
            preserveScroll: true,
        })
    }

    function updateFinalizeItem(itemId, field, value) {
        finalizeForm.setData('items', finalizeForm.data.items.map((item) => (
            Number(item.id) === Number(itemId)
                ? { ...item, [field]: value }
                : item
        )))
    }

    function applyFinalizePreset(itemId, field, remainingQuantity) {
        finalizeForm.setData('items', finalizeForm.data.items.map((item) => (
            Number(item.id) === Number(itemId)
                ? {
                    ...item,
                    returned_quantity: field === 'returned_quantity' ? String(remainingQuantity) : '',
                    kept_quantity: field === 'kept_quantity' ? String(remainingQuantity) : '',
                    lost_quantity: field === 'lost_quantity' ? String(remainingQuantity) : '',
                    damaged_quantity: field === 'damaged_quantity' ? String(remainingQuantity) : '',
                }
                : item
        )))
    }

    function addPaymentRow() {
        finalizeForm.setData('payments', [
            ...finalizeForm.data.payments,
            { method: 'pix', amount: '' },
        ])
    }

    function removePaymentRow(index) {
        finalizeForm.setData('payments', finalizeForm.data.payments.filter((_, paymentIndex) => paymentIndex !== index))
    }

    function updatePaymentRow(index, field, value) {
        finalizeForm.setData('payments', finalizeForm.data.payments.map((payment, paymentIndex) => (
            paymentIndex === index
                ? { ...payment, [field]: value }
                : payment
        )))
    }

    function handleFinalizeSubmit(event) {
        event.preventDefault()

        if (!openedConditional) {
            return
        }

        finalizeForm.post(`/venda-condicional/${openedConditional.id}/finalizar`, {
            preserveScroll: true,
        })
    }

    function applyFilters() {
        setAppliedSearch(search)
        setAppliedFilter(activeFilter)
        setAppliedRange(range)
        setHasAppliedFilters(true)
        setSelectedRecordId(null)
        setOpenedRecordId(null)

        const params = { applied: 1 }

        if (String(search || '').trim()) {
            params.search = String(search).trim()
        }

        if (range.from) {
            params.from = range.from
        }

        if (range.to) {
            params.to = range.to
        }

        router.get('/venda-condicional', params, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    function openSelected(panel = 'overview') {
        if (!selectedRow) {
            return
        }

        setDetailPanel(panel)
        setSelectedRecordId(selectedRow.id)
        setOpenedRecordId(selectedRow.id)
    }

    const totalOutstanding = useMemo(
        () => visibleConditionals.reduce((sum, c) => sum + Number(c.outstanding_total || 0), 0),
        [visibleConditionals],
    )
    const owingCount = visibleConditionals.filter((c) => Number(c.outstanding_total || 0) > 0).length

    return (
        <AppLayout title="Venda Condicional">
            <div className="page-hero page-hero--rose">
                <div className="page-hero-left">
                    <div className="page-hero-icon">
                        <i className="fa-solid fa-handshake" />
                    </div>
                    <div>
                        <h1 className="page-hero-title">Venda Condicional</h1>
                        <p className="page-hero-sub">Clientes com valores pendentes a receber</p>
                    </div>
                </div>
                <div className="page-hero-stats">
                    <div className="page-hero-stat page-hero-stat--danger">
                        <strong>{formatMoney(totalOutstanding)}</strong>
                        <span>A receber</span>
                    </div>
                    <div className="page-hero-stat page-hero-stat--accent">
                        <strong>{owingCount}</strong>
                        <span>Clientes devendo</span>
                    </div>
                </div>
                <button className="page-hero-cta" onClick={() => setCreateOpen(true)} type="button">
                    <i className="fa-solid fa-plus" />
                    Nova venda condicional
                </button>
            </div>

            {/* Barra de busca + filtros */}
            <PageHeader
                search={{
                    placeholder: 'Buscar cliente por nome',
                    value: search,
                    onChange: setSearch,
                }}
                filters={[
                    { key: 'all', value: 'all', label: 'Todos', count: visibleConditionals.length },
                    { key: 'owing', value: 'owing', label: 'Devendo', count: visibleConditionals.filter((e) => Number(e.outstanding_total || 0) > 0).length },
                    { key: 'alert', value: 'alert', label: 'Em alerta', count: visibleConditionals.filter((e) => Number(e.days_overdue || 0) > 0).length },
                ]}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                onApply={applyFilters}
                onReset={() => {
                    setSearch(''); setActiveFilter('all'); setAppliedSearch(''); setAppliedFilter('all')
                    setHasAppliedFilters(false); setSelectedRecordId(null); setOpenedRecordId(null)
                    router.get('/venda-condicional', {}, { preserveScroll: true, preserveState: true, replace: true })
                }}
            />

            {/* Cards de cliente */}
            {filteredRows.length > 0 ? (
                <div className="cs-grid">
                    {filteredRows.map((sale) => {
                        const customerMeta = customerMetaById.get(String(sale.customer?.id || '')) || {}
                        const outstanding = Number(sale.outstanding_total || 0)
                        const overdue = Number(sale.days_overdue || 0)
                        const initials = (sale.customer?.name || '?').slice(0, 2).toUpperCase()
                        const isSelected = selectedRecordId === sale.id

                        return (
                            <div
                                key={sale.id}
                                className={`cs-card ${isSelected ? 'cs-card--selected' : ''} ${overdue > 0 ? 'cs-card--alert' : ''}`}
                                onClick={() => setSelectedRecordId(sale.id)}
                                onDoubleClick={() => { setSelectedRecordId(sale.id); setDetailPanel('overview'); setOpenedRecordId(sale.id) }}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="cs-card-head">
                                    <div className={`cs-avatar ${overdue > 0 ? 'cs-avatar--danger' : outstanding > 0 ? 'cs-avatar--warning' : 'cs-avatar--ok'}`}>
                                        {initials}
                                    </div>
                                    <div className="cs-card-info">
                                        <strong>{sale.customer?.name || 'Cliente não informado'}</strong>
                                        {overdue > 0 && <span className="cs-overdue">{overdue} dia(s) em atraso</span>}
                                    </div>
                                    <StatusBadge compact label={sale.status_label} tone={sale.status_tone} />
                                </div>

                                <div className="cs-card-amounts">
                                    <div className="cs-amount cs-amount--main">
                                        <span>Deve</span>
                                        <strong>{formatMoney(outstanding)}</strong>
                                    </div>
                                    {Number(customerMeta.credit_limit || 0) > 0 && (
                                        <div className="cs-amount">
                                            <span>Limite</span>
                                            <strong>{formatMoney(customerMeta.credit_limit)}</strong>
                                        </div>
                                    )}
                                </div>

                                <div className="cs-card-actions">
                                    <button type="button" className="cs-btn" onClick={(e) => { e.stopPropagation(); setSelectedRecordId(sale.id); setDetailPanel('overview'); setOpenedRecordId(sale.id) }}>
                                        <i className="fa-solid fa-eye" /> Ver
                                    </button>
                                    <button type="button" className="cs-btn cs-btn--pay" onClick={(e) => { e.stopPropagation(); setSelectedRecordId(sale.id); setDetailPanel('finalize'); setOpenedRecordId(sale.id) }}>
                                        <i className="fa-solid fa-money-bill-wave" /> Receber
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="cs-empty">
                    <i className="fa-solid fa-handshake" />
                    <strong>Nenhum resultado encontrado</strong>
                    <p>Ajuste os filtros ou crie uma nova venda condicional.</p>
                </div>
            )}

            <ModalForm
                description="Preencha cliente, datas e itens. O estoque será reservado na abertura."
                icon="fa-shirt"
                open={createOpen}
                size="lg"
                title="Nova condicional"
                onClose={() => setCreateOpen(false)}
            >
                <CreateConditionalSaleCard
                    customers={customers}
                    embedded
                    form={createForm}
                    products={products}
                    selectedCustomer={selectedCustomer}
                    totalPreview={createPreview}
                    onAddItem={addCreateItem}
                    onItemChange={updateCreateItem}
                    onRemoveItem={removeCreateItem}
                    onSubmit={handleCreateSubmit}
                />
            </ModalForm>

            <ActionDrawer
                open={Boolean(openedConditional)}
                title={openedConditional ? openedConditional.code : 'Condicional'}
                description={openedConditional?.customer?.name || 'Detalhes da condicional'}
                icon="fa-right-left"
                size="lg"
                badge={openedConditional?.status_label}
                bodyClassName="conditional-detail-drawer-body"
                onClose={() => setOpenedRecordId(null)}
            >
                <ConditionalSaleDetailCard
                    conditionalSale={openedConditional}
                    embedded
                    defaultPanel={detailPanel}
                    finalizeForm={finalizeForm}
                    finalizePreview={finalizePreview}
                    hasCashPayment={hasCashPayment}
                    paymentMethods={paymentMethods}
                    returnForm={returnForm}
                    onAddPayment={addPaymentRow}
                    onFinalizeItemChange={updateFinalizeItem}
                    onFinalizePreset={applyFinalizePreset}
                    onFinalizeSubmit={handleFinalizeSubmit}
                    onPaymentChange={updatePaymentRow}
                    onRemovePayment={removePaymentRow}
                    onReturnAll={applyReturnAll}
                    onReturnItemChange={updateReturnItem}
                    onReturnSubmit={handleReturnSubmit}
                />
            </ActionDrawer>
        </AppLayout>
    )
}
