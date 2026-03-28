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
    const [feedback, setFeedback] = useState(null)

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

    const mixedTotal = useMemo(
        () => mixedPayments.reduce((accumulator, payment) => accumulator + Number(payment.amount || 0), 0),
        [mixedPayments],
    )

    const mixedRemaining = useMemo(() => Math.max(0, totals.total - mixedTotal), [mixedTotal, totals.total])

    function showFeedback(type, text) {
        setFeedback({ type, text })
    }

    function resetSale() {
        setCart([])
        setSelectedCustomer('')
        setDiscount('0')
        setNotes('')
        setPaymentMethod('cash')
        setMixedPayments([])
        setMixedDraft({ method: 'cash', amount: '' })
        setCreditStatus(null)
    }

    function handleAddProduct(product) {
        setFeedback(null)
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

    function handlePaymentMethodChange(value) {
        setPaymentMethod(value)
        setFeedback(null)

        if (value !== 'mixed') {
            setMixedPayments([])
            setMixedDraft({ method: value === 'credit' ? 'credit' : 'cash', amount: '' })
        }
    }

    function handleMixedDraftChange(field, value) {
        setMixedDraft((current) => ({ ...current, [field]: value }))
    }

    function handleAddMixedPayment() {
        const amount = Number(mixedDraft.amount || 0)

        if (amount <= 0) {
            showFeedback('error', 'Informe um valor valido para adicionar ao pagamento misto.')
            return
        }

        if (amount > mixedRemaining + 0.001) {
            showFeedback('error', 'A soma das parcelas nao pode ultrapassar o total da venda.')
            return
        }

        setFeedback(null)
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

    function handleRemoveMixedPayment(index) {
        setMixedPayments((current) => current.filter((_, currentIndex) => currentIndex !== index))
    }

    async function handleQuickCustomerSubmit(event) {
        event.preventDefault()
        setFeedback(null)

        const response = await apiRequest('/api/pdv/customers/quick', {
            method: 'post',
            data: quickCustomerForm,
        })

        setCustomers((current) => [...current, response.customer])
        setSelectedCustomer(String(response.customer.id))
        setQuickCustomerForm({ name: '', phone: '' })
        setQuickCustomerOpen(false)
        showFeedback('success', 'Cliente cadastrado e selecionado para esta venda.')
    }

    async function handleFinalize() {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de finalizar a venda.')
            return
        }

        if (!cashRegister) {
            showFeedback('error', 'Abra o caixa antes de tentar finalizar a venda.')
            return
        }

        if (paymentMethod === 'credit' && !selectedCustomer) {
            showFeedback('error', 'Selecione um cliente para registrar a venda no fiado.')
            return
        }

        if (paymentMethod === 'mixed') {
            if (mixedPayments.length < 2) {
                showFeedback('error', 'Adicione pelo menos duas parcelas para o pagamento misto.')
                return
            }

            if (mixedPayments.some((payment) => Number(payment.amount || 0) <= 0)) {
                showFeedback('error', 'Revise os valores do pagamento misto antes de finalizar.')
                return
            }

            if (mixedPayments.some((payment) => payment.method === 'credit') && !selectedCustomer) {
                showFeedback('error', 'Selecione um cliente para usar fiado no pagamento misto.')
                return
            }

            if (Math.abs(mixedTotal - totals.total) > 0.009) {
                showFeedback('error', 'A soma das parcelas precisa bater exatamente com o total da venda.')
                return
            }
        }

        setSubmitting(true)
        setFeedback(null)

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

            resetSale()
            showFeedback('success', `Venda ${response.sale.sale_number} finalizada com sucesso.`)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AppLayout title="PDV">
            <div className="pos-page">
                <div className="pos-column">
                    {feedback ? <div className={`pos-feedback ${feedback.type}`}>{feedback.text}</div> : null}

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
                    onPaymentChange={handlePaymentMethodChange}
                    mixedPayments={mixedPayments}
                    mixedDraft={mixedDraft}
                    mixedRemaining={mixedRemaining}
                    onMixedDraftChange={handleMixedDraftChange}
                    onMixedPaymentChange={handleMixedPaymentChange}
                    onMixedPaymentRemove={handleRemoveMixedPayment}
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
