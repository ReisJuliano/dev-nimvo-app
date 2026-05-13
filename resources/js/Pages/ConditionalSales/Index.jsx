import { router, useForm } from '@inertiajs/react'
import { useEffect, useMemo } from 'react'
import CreateConditionalSaleCard from '@/Components/ConditionalSales/CreateConditionalSaleCard'
import ConditionalSaleDetailCard from '@/Components/ConditionalSales/ConditionalSaleDetailCard'
import MetricCard from '@/Components/ConditionalSales/MetricCard'
import ConditionalSalesTableCard from '@/Components/ConditionalSales/ConditionalSalesTableCard'
import Toolbar from '@/Components/ConditionalSales/Toolbar'
import AppLayout from '@/Layouts/AppLayout'
import { formatMoney, formatNumber } from '@/lib/format'
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
        <section className="products-table-card">
            <div className="products-table-header">
                <div>
                    <h2>Mais levados</h2>
                    <p>{topProducts.length} item(ns)</p>
                </div>
            </div>
            <div className="conditional-table-wrap">
                {topProducts.length ? (
                    <table className="conditional-table">
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
                    <div className="conditional-empty">
                        <i className="fa-solid fa-box-open" />
                        <strong>Sem historico</strong>
                    </div>
                )}
            </div>
        </section>
    )
}

export default function ConditionalSalesPage({
    summary,
    topProducts,
    conditionals,
    selectedConditionalId,
    customers,
    products,
    paymentMethods,
    statusOptions,
    filters,
}) {
    const filterForm = useForm({
        search: filters.search || '',
        status: filters.status || 'open',
    })
    const createForm = useForm(buildCreateDefaults())
    const selectedConditional = useMemo(
        () => conditionals.find((conditionalSale) => conditionalSale.id === selectedConditionalId) || null,
        [conditionals, selectedConditionalId],
    )
    const selectedCustomer = useMemo(
        () => customers.find((customer) => String(customer.id) === String(createForm.data.customer_id)) || null,
        [customers, createForm.data.customer_id],
    )
    const returnForm = useForm(buildReturnDefaults(selectedConditional))
    const finalizeForm = useForm(buildFinalizeDefaults(selectedConditional))

    useEffect(() => {
        returnForm.setData(buildReturnDefaults(selectedConditional))
        returnForm.clearErrors()
        finalizeForm.setData(buildFinalizeDefaults(selectedConditional))
        finalizeForm.clearErrors()
    }, [finalizeForm, returnForm, selectedConditional])

    const createPreview = useMemo(
        () => createForm.data.items.reduce((total, item) => total + (parseNumber(item.quantity) * parseNumber(item.unit_price)), 0),
        [createForm.data.items],
    )

    const finalizePreview = useMemo(() => {
        if (!selectedConditional) {
            return 0
        }

        return finalizeForm.data.items.reduce((total, item) => {
            const source = selectedConditional.items.find((entry) => Number(entry.id) === Number(item.id))
            const billedQuantity = parseNumber(item.kept_quantity) + parseNumber(item.lost_quantity) + parseNumber(item.damaged_quantity)

            return total + (billedQuantity * Number(source?.unit_price || 0))
        }, 0)
    }, [finalizeForm.data.items, selectedConditional])

    const hasCashPayment = finalizeForm.data.payments.some((payment) => payment.method === 'cash')

    function visitWithFilters(extra = {}) {
        router.get('/venda-condicional', {
            search: filterForm.data.search,
            status: filterForm.data.status,
            ...extra,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    function handleToolbarSubmit(event) {
        event.preventDefault()
        visitWithFilters({
            conditional: selectedConditionalId,
        })
    }

    function handleToolbarReset() {
        filterForm.setData({
            search: '',
            status: 'open',
        })

        router.get('/venda-condicional', {
            status: 'open',
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    function handleStatusChange(value) {
        filterForm.setData('status', value)
        router.get('/venda-condicional', {
            search: filterForm.data.search,
            status: value,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        })
    }

    function handleSelectConditional(id) {
        visitWithFilters({
            conditional: id,
        })
    }

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
            onSuccess: () => createForm.setData(buildCreateDefaults()),
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

        if (!selectedConditional) {
            return
        }

        returnForm.post(`/venda-condicional/${selectedConditional.id}/devolver`, {
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

        if (!selectedConditional) {
            return
        }

        finalizeForm.post(`/venda-condicional/${selectedConditional.id}/finalizar`, {
            preserveScroll: true,
        })
    }

    const metricCards = [
        {
            key: 'open',
            title: 'Abertos',
            value: formatNumber(summary.open_count),
            chipLabel: 'Carteira',
            chipTone: 'warning',
            icon: 'fa-right-left',
        },
        {
            key: 'overdue',
            title: 'Atrasados',
            value: formatNumber(summary.overdue_count),
            chipLabel: 'Alerta',
            chipTone: summary.overdue_count > 0 ? 'danger' : 'success',
            icon: 'fa-triangle-exclamation',
        },
        {
            key: 'outstanding',
            title: 'Em aberto',
            value: formatMoney(summary.outstanding_total),
            chipLabel: 'Saldo',
            chipTone: 'warning',
            icon: 'fa-wallet',
        },
        {
            key: 'conversion',
            title: 'Conversao',
            value: `${formatNumber(summary.conversion_rate)}%`,
            chipLabel: formatNumber(summary.loss_quantity),
            chipTone: summary.loss_quantity > 0 ? 'danger' : 'success',
            icon: 'fa-chart-line',
        },
    ]

    return (
        <AppLayout title="Condicional">
            <div className="products-page">
                <section className="products-shell">
                    <header className="products-header">
                        <div className="products-title-block">
                            <span className="products-kicker">Prazo</span>
                            <h1>Venda condicional</h1>
                        </div>
                    </header>

                    <Toolbar filterForm={filterForm} onReset={handleToolbarReset} onSubmit={handleToolbarSubmit} />

                    <div className="products-summary-grid">
                        {metricCards.map((card) => (
                            <MetricCard key={card.key} {...card} />
                        ))}
                    </div>

                    <div className="conditional-workspace">
                        <div className="conditional-stack">
                            <CreateConditionalSaleCard
                                customers={customers}
                                form={createForm}
                                products={products}
                                selectedCustomer={selectedCustomer}
                                totalPreview={createPreview}
                                onAddItem={addCreateItem}
                                onItemChange={updateCreateItem}
                                onRemoveItem={removeCreateItem}
                                onSubmit={handleCreateSubmit}
                            />
                            <TopProductsCard topProducts={topProducts} />
                        </div>

                        <div className="conditional-main">
                            <ConditionalSalesTableCard
                                conditionals={conditionals}
                                filters={filterForm.data}
                                selectedConditionalId={selectedConditionalId}
                                statusOptions={statusOptions}
                                onSelect={handleSelectConditional}
                                onStatusChange={handleStatusChange}
                            />

                            <ConditionalSaleDetailCard
                                conditionalSale={selectedConditional}
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
                        </div>
                    </div>
                </section>
            </div>
        </AppLayout>
    )
}
