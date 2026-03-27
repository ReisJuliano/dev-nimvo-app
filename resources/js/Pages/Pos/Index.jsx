import { startTransition, useEffect, useMemo, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CartPanel from '@/Components/Pos/CartPanel'
import CheckoutPanel from '@/Components/Pos/CheckoutPanel'
import ProductSearchPanel from '@/Components/Pos/ProductSearchPanel'
import { apiRequest } from '@/lib/http'
import './pos.css'

export default function PosIndex({ categories, customers: initialCustomers, cashRegister }) {
    const [customers, setCustomers] = useState(initialCustomers)
    const [selectedCategory, setSelectedCategory] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState([])
    const [cart, setCart] = useState([])
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [discount, setDiscount] = useState('0')
    const [notes, setNotes] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [mixedPayments, setMixedPayments] = useState([])
    const [mixedDraft, setMixedDraft] = useState({ method: 'cash', amount: '' })
    const [creditStatus, setCreditStatus] = useState(null)
    const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
    const [quickCustomerForm, setQuickCustomerForm] = useState({ name: '', phone: '' })
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        const timeout = setTimeout(() => {
            startTransition(async () => {
                const response = await apiRequest('/api/pdv/products', {
                    params: { term: searchTerm, category_id: selectedCategory || undefined },
                })

                setProducts(response.products)
            })
        }, 250)

        return () => clearTimeout(timeout)
    }, [searchTerm, selectedCategory])

    useEffect(() => {
        if (!selectedCustomer) {
            setCreditStatus(null)
            return
        }

        apiRequest(`/api/pdv/customers/${selectedCustomer}/credit`)
            .then(setCreditStatus)
            .catch(() => setCreditStatus(null))
    }, [selectedCustomer])

    const totals = useMemo(() => {
        const subtotal = cart.reduce((accumulator, item) => accumulator + item.sale_price * item.qty, 0)
        const parsedDiscount = Number(discount || 0)

        return {
            subtotal,
            discount: parsedDiscount,
            total: Math.max(0, subtotal - parsedDiscount),
        }
    }, [cart, discount])

    function handleAddProduct(product) {
        setCart((current) => {
            const existing = current.find((item) => item.id === product.id)

            if (existing) {
                return current.map((item) =>
                    item.id === product.id ? { ...item, qty: Number(item.qty) + 1 } : item,
                )
            }

            return [...current, { ...product, qty: 1 }]
        })
    }

    function handleQuantityChange(productId, value) {
        const qty = Math.max(0.001, Number(value || 0.001))

        setCart((current) => current.map((item) => (item.id === productId ? { ...item, qty } : item)))
    }

    function handleRemove(productId) {
        setCart((current) => current.filter((item) => item.id !== productId))
    }

    function handleMixedDraftChange(field, value) {
        setMixedDraft((current) => ({ ...current, [field]: value }))
    }

    function handleAddMixedPayment() {
        if (!mixedDraft.amount) {
            return
        }

        setMixedPayments((current) => [...current, { method: mixedDraft.method, amount: mixedDraft.amount }])
        setMixedDraft((current) => ({ ...current, amount: '' }))
    }

    function handleMixedPaymentChange(index, value) {
        setMixedPayments((current) =>
            current.map((payment, currentIndex) =>
                currentIndex === index ? { ...payment, amount: value } : payment,
            ),
        )
    }

    async function handleQuickCustomerSubmit(event) {
        event.preventDefault()

        const response = await apiRequest('/api/pdv/customers/quick', {
            method: 'post',
            data: quickCustomerForm,
        })

        setCustomers((current) => [...current, response.customer])
        setSelectedCustomer(String(response.customer.id))
        setQuickCustomerForm({ name: '', phone: '' })
        setQuickCustomerOpen(false)
    }

    async function handleFinalize() {
        if (!cart.length) {
            return
        }

        setSubmitting(true)

        try {
            const payments =
                paymentMethod === 'mixed'
                    ? mixedPayments.map((payment) => ({
                          method: payment.method,
                          amount: Number(payment.amount),
                      }))
                    : [{ method: paymentMethod, amount: totals.total }]

            const response = await apiRequest('/api/pdv/sales', {
                method: 'post',
                data: {
                    customer_id: selectedCustomer || null,
                    discount: Number(discount || 0),
                    notes,
                    items: cart.map((item) => ({ id: item.id, qty: Number(item.qty) })),
                    payments,
                },
            })

            window.alert(`Venda ${response.sale.sale_number} finalizada com sucesso.`)
            setCart([])
            setDiscount('0')
            setNotes('')
            setPaymentMethod('cash')
            setMixedPayments([])
            setMixedDraft({ method: 'cash', amount: '' })
        } catch (error) {
            window.alert(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AppLayout title="PDV">
            <div className="pos-page">
                <div className="pos-column">
                    <ProductSearchPanel
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        products={products}
                        onAddProduct={handleAddProduct}
                    />

                    <CartPanel cart={cart} onQuantityChange={handleQuantityChange} onRemove={handleRemove} />
                </div>

                <CheckoutPanel
                    customers={customers}
                    selectedCustomer={selectedCustomer}
                    onCustomerChange={setSelectedCustomer}
                    discount={discount}
                    onDiscountChange={setDiscount}
                    notes={notes}
                    onNotesChange={setNotes}
                    paymentMethod={paymentMethod}
                    onPaymentChange={setPaymentMethod}
                    mixedPayments={mixedPayments}
                    mixedDraft={mixedDraft}
                    onMixedDraftChange={handleMixedDraftChange}
                    onMixedPaymentChange={handleMixedPaymentChange}
                    onAddMixedPayment={handleAddMixedPayment}
                    onQuickCustomer={() => setQuickCustomerOpen(true)}
                    creditStatus={creditStatus}
                    totals={totals}
                    disabled={!cashRegister || !cart.length || submitting}
                    onFinalize={handleFinalize}
                    cashRegister={cashRegister}
                />
            </div>

            {quickCustomerOpen ? (
                <div className="pos-quick-customer">
                    <form className="pos-quick-customer-card" onSubmit={handleQuickCustomerSubmit}>
                        <h2>Novo cliente rapido</h2>
                        <input
                            placeholder="Nome do cliente"
                            value={quickCustomerForm.name}
                            onChange={(event) =>
                                setQuickCustomerForm((current) => ({ ...current, name: event.target.value }))
                            }
                        />
                        <input
                            placeholder="Telefone"
                            value={quickCustomerForm.phone}
                            onChange={(event) =>
                                setQuickCustomerForm((current) => ({ ...current, phone: event.target.value }))
                            }
                        />
                        <div className="pos-quick-customer-actions">
                            <button type="button" onClick={() => setQuickCustomerOpen(false)}>
                                Cancelar
                            </button>
                            <button className="pos-finalize-button" type="submit">
                                Salvar cliente
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </AppLayout>
    )
}
