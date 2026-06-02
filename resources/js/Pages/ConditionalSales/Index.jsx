import { router, useForm } from '@inertiajs/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import CreateConditionalSaleCard from '@/Components/ConditionalSales/CreateConditionalSaleCard'
import ConditionalSaleDetailCard from '@/Components/ConditionalSales/ConditionalSaleDetailCard'
import ActionDrawer from '@/Components/UI/ActionDrawer'
import ActionSidebar from '@/Components/UI/ActionSidebar'
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

    return (
        <AppLayout title="Venda Condicional">
            <div className="ui-list-page-shell">
                <div className="ui-list-page-main">
                    <PageHeader
                        title="Venda Condicional"
                        subtitle="Gestão de vendas condicionais"
                        search={{
                            placeholder: 'Buscar cliente por nome',
                            value: search,
                            onChange: setSearch,
                        }}
                        filters={[
                            { key: 'all', value: 'all', label: 'Todos', count: visibleConditionals.length },
                            { key: 'owing', value: 'owing', label: 'Devendo', count: visibleConditionals.filter((entry) => Number(entry.outstanding_total || 0) > 0).length },
                            { key: 'alert', value: 'alert', label: 'Em alerta', count: visibleConditionals.filter((entry) => Number(entry.days_overdue || 0) > 0).length },
                            {
                                key: 'over_limit',
                                value: 'over_limit',
                                label: 'Acima do limite',
                                count: visibleConditionals.filter((entry) => {
                                    const customerMeta = customerMetaById.get(String(entry.customer?.id || '')) || {}
                                    return Number(customerMeta.credit_limit || 0) > 0 && Number(entry.outstanding_total || 0) > Number(customerMeta.credit_limit || 0)
                                }).length,
                            },
                        ]}
                        activeFilter={activeFilter}
                        onFilterChange={setActiveFilter}
                        dateRange={{
                            from: range.from,
                            to: range.to,
                            onChange: setRange,
                        }}
                        quickDates
                        onApply={applyFilters}
                        onReset={() => {
                            setSearch('')
                            setRange(defaultRange)
                            setActiveFilter('all')
                            setAppliedSearch('')
                            setAppliedFilter('all')
                            setAppliedRange(defaultRange)
                            setHasAppliedFilters(false)
                            setSelectedRecordId(null)
                            setOpenedRecordId(null)
                            router.get('/venda-condicional', {}, {
                                preserveScroll: true,
                                preserveState: true,
                                replace: true,
                            })
                        }}
                    />

                    <section className="ui-list-page-table-card">
                        <DataTable
                            columns={[
                                {
                                    key: 'customer',
                                    label: 'Cliente',
                                    render: (conditionalSale) => conditionalSale.customer?.name || 'Cliente não informado',
                                },
                                {
                                    key: 'purchase',
                                    label: 'Compras',
                                    render: (conditionalSale) => conditionalSale.sale?.sale_number ? `Venda ${conditionalSale.sale.sale_number}` : conditionalSale.code,
                                },
                                {
                                    key: 'open',
                                    label: 'Total em aberto',
                                    align: 'right',
                                    render: (conditionalSale) => <strong>{formatMoney(conditionalSale.outstanding_total || 0)}</strong>,
                                },
                                {
                                    key: 'last_payment',
                                    label: 'Ultimo pagamento',
                                    render: (conditionalSale) => conditionalSale.resolved_at
                                        ? formatDateTime(conditionalSale.resolved_at)
                                        : '--',
                                },
                                {
                                    key: 'limit',
                                    label: 'Limite',
                                    align: 'right',
                                    render: (conditionalSale) => {
                                        const customerMeta = customerMetaById.get(String(conditionalSale.customer?.id || '')) || {}
                                        return formatMoney(customerMeta.credit_limit || 0)
                                    },
                                },
                                {
                                    key: 'status',
                                    label: 'Status',
                                    render: (conditionalSale) => (
                                        <StatusBadge compact label={conditionalSale.status_label} tone={conditionalSale.status_tone} />
                                    ),
                                },
                            ]}
                            rows={filteredRows}
                            rowKey="id"
                            selectedRowKey={selectedRecordId}
                            onRowClick={(conditionalSale) => setSelectedRecordId(conditionalSale.id)}
                            onRowDoubleClick={(conditionalSale) => {
                                setSelectedRecordId(conditionalSale.id)
                                setDetailPanel('overview')
                                setOpenedRecordId(conditionalSale.id)
                            }}
                            emptyMessage="Nenhum resultado encontrado. Ajuste os filtros e clique em Filtrar."
                            actions={(conditionalSale) => [
                                {
                                    key: 'view',
                                    icon: 'fa-eye',
                                    label: 'Ver cliente',
                                    tone: 'primary',
                                    onClick: () => {
                                        setSelectedRecordId(conditionalSale.id)
                                        setDetailPanel('overview')
                                        setOpenedRecordId(conditionalSale.id)
                                    },
                                },
                            ]}
                        />
                    </section>
                </div>

                <ActionSidebar
                    storageKey="conditional-sales-index"
                    actions={[
                        {
                            key: 'view',
                            icon: 'fa-eye',
                            label: 'Ver cliente',
                            disabled: !selectedRow,
                            onClick: () => openSelected('overview'),
                        },
                        {
                            key: 'payment',
                            icon: 'fa-money-bill-wave',
                            label: 'Registrar pagamento',
                            disabled: !selectedRow || selectedRow.status === 'closed',
                            onClick: () => openSelected('finalize'),
                        },
                        {
                            key: 'entries',
                            icon: 'fa-clipboard-list',
                            label: 'Ver lancamentos',
                            disabled: !selectedRow,
                            onClick: () => openSelected('return'),
                        },
                    ]}
                />
            </div>

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
