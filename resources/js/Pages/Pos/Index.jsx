import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CartPanel from '@/Components/Pos/CartPanel'
import CheckoutPanel from '@/Components/Pos/CheckoutPanel'
import ProductSearchPanel from '@/Components/Pos/ProductSearchPanel'
import { apiRequest } from '@/lib/http'
import { formatDateTime, formatMoney } from '@/lib/format'
import './pos.css'

const closingPaymentFields = [
    { key: 'cash', label: 'Dinheiro' },
    { key: 'pix', label: 'Pix' },
    { key: 'debit_card', label: 'Cartao de debito' },
    { key: 'credit_card', label: 'Cartao de credito' },
    { key: 'credit', label: 'Crediario' },
]

const shortcutHints = [
    { keys: ['Shift', 'P'], label: 'Focar busca de produtos' },
    { keys: ['Shift', 'C'], label: 'Abrir cliente' },
    { keys: ['Shift', 'D'], label: 'Abrir desconto' },
    { keys: ['Shift', 'F'], label: 'Finalizar venda' },
    { keys: ['Shift', 'X'], label: 'Abrir fechamento do caixa' },
    { keys: ['Esc'], label: 'Fechar popup ativo' },
]

function roundCurrency(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function buildDiscountDraft(config, fallbackItemId = '') {
    if (config.type === 'percent') {
        return {
            mode: 'percent',
            percent: String(config.percent ?? ''),
            targetTotal: '',
            itemId: fallbackItemId,
            itemDiscountType: 'value',
            itemValue: '',
            itemPercent: '',
        }
    }

    if (config.type === 'target_total') {
        return {
            mode: 'target_total',
            percent: '',
            targetTotal: String(config.targetTotal ?? ''),
            itemId: fallbackItemId,
            itemDiscountType: 'value',
            itemValue: '',
            itemPercent: '',
        }
    }

    if (config.type === 'item') {
        return {
            mode: 'item',
            percent: '',
            targetTotal: '',
            itemId: String(config.itemId ?? fallbackItemId),
            itemDiscountType: config.itemDiscountType ?? 'value',
            itemValue: config.itemDiscountType === 'value' ? String(config.value ?? '') : '',
            itemPercent: config.itemDiscountType === 'percent' ? String(config.value ?? '') : '',
        }
    }

    return {
        mode: 'percent',
        percent: '',
        targetTotal: '',
        itemId: fallbackItemId,
        itemDiscountType: 'value',
        itemValue: '',
        itemPercent: '',
    }
}

function distributeDiscountAcrossItems(items, totalDiscount) {
    const subtotal = roundCurrency(items.reduce((accumulator, item) => accumulator + item.lineSubtotal, 0))
    let remainingDiscount = Math.min(roundCurrency(totalDiscount), subtotal)
    let remainingBase = subtotal

    return items.map((item, index) => {
        if (remainingDiscount <= 0 || item.lineSubtotal <= 0) {
            remainingBase = roundCurrency(remainingBase - item.lineSubtotal)
            return { ...item, lineDiscount: 0 }
        }

        let lineDiscount

        if (index === items.length - 1 || remainingBase <= 0) {
            lineDiscount = Math.min(item.lineSubtotal, remainingDiscount)
        } else {
            lineDiscount = roundCurrency((remainingDiscount * item.lineSubtotal) / remainingBase)
            lineDiscount = Math.min(item.lineSubtotal, lineDiscount)
        }

        remainingDiscount = roundCurrency(remainingDiscount - lineDiscount)
        remainingBase = roundCurrency(remainingBase - item.lineSubtotal)

        return { ...item, lineDiscount }
    })
}

function resolvePricing(cart, config, selectedCartItem) {
    const baseItems = cart.map((item) => ({
        ...item,
        qty: Number(item.qty),
        lineSubtotal: roundCurrency(Number(item.sale_price) * Number(item.qty)),
        lineDiscount: 0,
    }))

    const subtotal = roundCurrency(baseItems.reduce((accumulator, item) => accumulator + item.lineSubtotal, 0))
    let discountedItems = baseItems
    let summary = {
        title: 'Sem desconto aplicado',
        description: 'Use Shift + D para abrir o popup de desconto.',
        itemHint: selectedCartItem ? `Item em foco: ${selectedCartItem.name}` : null,
    }

    if (config.type === 'percent') {
        const percent = Math.max(0, Math.min(100, Number(config.percent || 0)))
        const totalDiscount = roundCurrency((subtotal * percent) / 100)
        discountedItems = distributeDiscountAcrossItems(baseItems, totalDiscount)
        summary = {
            title: `${percent}% de desconto na venda`,
            description: `Abate total de ${formatMoney(totalDiscount)} distribuido entre os itens.`,
            itemHint: null,
        }
    }

    if (config.type === 'target_total') {
        const targetTotal = Math.max(0, Math.min(subtotal, roundCurrency(config.targetTotal || 0)))
        const totalDiscount = roundCurrency(Math.max(0, subtotal - targetTotal))
        discountedItems = distributeDiscountAcrossItems(baseItems, totalDiscount)
        summary = {
            title: `Venda ajustada para ${formatMoney(targetTotal)}`,
            description: `Desconto calculado automaticamente em ${formatMoney(totalDiscount)}.`,
            itemHint: null,
        }
    }

    if (config.type === 'item') {
        discountedItems = baseItems.map((item) => {
            if (String(item.id) !== String(config.itemId)) {
                return item
            }

            const maxItemDiscount = item.lineSubtotal
            const requestedDiscount =
                config.itemDiscountType === 'percent'
                    ? roundCurrency((item.lineSubtotal * Number(config.value || 0)) / 100)
                    : roundCurrency(config.value || 0)

            return {
                ...item,
                lineDiscount: Math.max(0, Math.min(maxItemDiscount, requestedDiscount)),
            }
        })

        const discountedItem = cart.find((item) => String(item.id) === String(config.itemId))
        summary = {
            title: discountedItem ? `Desconto em ${discountedItem.name}` : 'Desconto por item',
            description:
                config.itemDiscountType === 'percent'
                    ? `${Number(config.value || 0)}% aplicado no item selecionado.`
                    : `${formatMoney(discountedItems.find((item) => String(item.id) === String(config.itemId))?.lineDiscount || 0)} abatido do item selecionado.`,
            itemHint: discountedItem ? `Produto selecionado: ${discountedItem.name}` : null,
        }
    }

    const items = discountedItems.map((item) => {
        const lineDiscount = roundCurrency(item.lineDiscount || 0)
        const lineTotal = roundCurrency(Math.max(0, item.lineSubtotal - lineDiscount))

        return {
            ...item,
            lineDiscount,
            lineTotal,
            effectiveUnitPrice: item.qty > 0 ? roundCurrency(lineTotal / item.qty) : 0,
        }
    })

    const discount = roundCurrency(items.reduce((accumulator, item) => accumulator + item.lineDiscount, 0))
    const total = roundCurrency(Math.max(0, subtotal - discount))

    return {
        items,
        subtotal,
        discount,
        total,
        summary,
    }
}

function buildPreviewConfigFromDraft(draft, subtotal) {
    if (draft.mode === 'percent') {
        return {
            type: 'percent',
            percent: draft.percent === '' ? 0 : roundCurrency(draft.percent),
        }
    }

    if (draft.mode === 'target_total') {
        return {
            type: 'target_total',
            targetTotal: draft.targetTotal === '' ? subtotal : roundCurrency(draft.targetTotal),
        }
    }

    if (draft.mode === 'item') {
        return {
            type: 'item',
            itemId: draft.itemId,
            itemDiscountType: draft.itemDiscountType,
            value:
                draft.itemDiscountType === 'percent'
                    ? draft.itemPercent === ''
                        ? 0
                        : roundCurrency(draft.itemPercent)
                    : draft.itemValue === ''
                      ? 0
                      : roundCurrency(draft.itemValue),
        }
    }

    return { type: 'none' }
}

export default function PosIndex({ categories, customers: initialCustomers, cashRegister }) {
    const [customers, setCustomers] = useState(initialCustomers)
    const [cashRegisterState, setCashRegisterState] = useState(cashRegister)
    const [selectedCategory, setSelectedCategory] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState([])
    const [cart, setCart] = useState([])
    const [selectedCartItemId, setSelectedCartItemId] = useState(null)
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
    const [customerSearch, setCustomerSearch] = useState('')
    const [discountConfig, setDiscountConfig] = useState({ type: 'none' })
    const [discountModalOpen, setDiscountModalOpen] = useState(false)
    const [discountDraft, setDiscountDraft] = useState(buildDiscountDraft({ type: 'none' }))
    const [cashReceived, setCashReceived] = useState('')
    const [notes, setNotes] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [mixedPayments, setMixedPayments] = useState([])
    const [mixedDraft, setMixedDraft] = useState({ method: 'cash', amount: '' })
    const [creditStatus, setCreditStatus] = useState(null)
    const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
    const [quickCustomerForm, setQuickCustomerForm] = useState({ name: '', phone: '' })
    const [submitting, setSubmitting] = useState(false)
    const [openingCashRegister, setOpeningCashRegister] = useState(false)
    const [loadingClosePreview, setLoadingClosePreview] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [closeCashRegisterModal, setCloseCashRegisterModal] = useState(null)
    const [cashReportModal, setCashReportModal] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const [loadingProducts, setLoadingProducts] = useState(false)
    const deferredCustomerSearch = useDeferredValue(customerSearch)
    const productSearchInputRef = useRef(null)

    useEffect(() => {
        setCashRegisterState(cashRegister)
    }, [cashRegister])

    useEffect(() => {
        if (searchTerm == null || String(searchTerm).toLowerCase() === 'null') {
            setSearchTerm('')
        }
    }, [searchTerm])

    useEffect(() => {
        const trimmedSearchTerm = searchTerm.trim()
        let ignore = false

        if (trimmedSearchTerm === '') {
            setProducts([])
            setLoadingProducts(false)
            return () => {
                ignore = true
            }
        }

        const timeout = setTimeout(() => {
            startTransition(async () => {
                if (ignore) {
                    return
                }

                setLoadingProducts(true)

                try {
                    const response = await apiRequest('/api/pdv/products', {
                        params: { term: trimmedSearchTerm, category_id: selectedCategory || undefined },
                    })

                    if (!ignore) {
                        setProducts(response.products)
                    }
                } finally {
                    if (!ignore) {
                        setLoadingProducts(false)
                    }
                }
            })
        }, 250)

        return () => {
            ignore = true
            clearTimeout(timeout)
        }
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

    useEffect(() => {
        if (!cart.length) {
            setSelectedCartItemId(null)
            return
        }

        if (!cart.some((item) => item.id === selectedCartItemId)) {
            setSelectedCartItemId(cart[0].id)
        }
    }, [cart, selectedCartItemId])

    useEffect(() => {
        if (discountConfig.type !== 'item') {
            return
        }

        if (!cart.some((item) => String(item.id) === String(discountConfig.itemId))) {
            setDiscountConfig({ type: 'none' })
        }
    }, [cart, discountConfig])

    const selectedCartItem = useMemo(
        () => cart.find((item) => item.id === selectedCartItemId) ?? null,
        [cart, selectedCartItemId],
    )

    const pricing = useMemo(() => resolvePricing(cart, discountConfig, selectedCartItem), [cart, discountConfig, selectedCartItem])

    const discountPreview = useMemo(() => {
        const previewConfig = buildPreviewConfigFromDraft(discountDraft, pricing.subtotal)
        return resolvePricing(cart, previewConfig, selectedCartItem)
    }, [cart, discountDraft, pricing.subtotal, selectedCartItem])

    const totals = useMemo(
        () => ({
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            total: pricing.total,
        }),
        [pricing],
    )

    const cashReceivedAmount = useMemo(
        () => (cashReceived === '' ? 0 : roundCurrency(cashReceived)),
        [cashReceived],
    )

    const cashChange = useMemo(
        () => Math.max(0, roundCurrency(cashReceivedAmount - totals.total)),
        [cashReceivedAmount, totals.total],
    )

    const cashShortfall = useMemo(
        () => (cashReceived === '' ? 0 : Math.max(0, roundCurrency(totals.total - cashReceivedAmount))),
        [cashReceived, cashReceivedAmount, totals.total],
    )

    const mixedTotal = useMemo(
        () => mixedPayments.reduce((accumulator, payment) => accumulator + Number(payment.amount || 0), 0),
        [mixedPayments],
    )

    const mixedRemaining = useMemo(() => Math.max(0, totals.total - mixedTotal), [mixedTotal, totals.total])

    const selectedCustomerData = useMemo(
        () => customers.find((customer) => String(customer.id) === selectedCustomer) ?? null,
        [customers, selectedCustomer],
    )

    const closeCashRegisterRows = useMemo(() => {
        if (!closeCashRegisterModal?.report) {
            return []
        }

        const paymentTotals = Object.fromEntries(
            closeCashRegisterModal.report.payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]),
        )

        return closingPaymentFields.map((field) => {
            const expected =
                field.key === 'cash'
                    ? Number(closeCashRegisterModal.report.expected_cash || 0)
                    : Number(paymentTotals[field.key] || 0)
            const rawInformed = closeCashRegisterModal.form.amounts[field.key]
            const informed = rawInformed === '' ? null : Number(rawInformed || 0)

            return {
                ...field,
                expected,
                informed,
                difference: informed === null ? null : informed - expected,
            }
        })
    }, [closeCashRegisterModal])

    const filteredCustomers = useMemo(() => {
        const normalizedTerm = deferredCustomerSearch.trim().toLowerCase()

        if (!normalizedTerm) {
            return []
        }

        return customers.filter((customer) =>
            [customer.name, customer.phone]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedTerm)),
        )
    }, [customers, deferredCustomerSearch])

    function showFeedback(type, text) {
        setFeedback({ type, text })
    }

    function closeCustomerPicker() {
        setCustomerPickerOpen(false)
        setCustomerSearch('')
    }

    function resetSale() {
        setCart([])
        setSelectedCartItemId(null)
        setSelectedCustomer('')
        setDiscountConfig({ type: 'none' })
        setDiscountDraft(buildDiscountDraft({ type: 'none' }))
        setDiscountModalOpen(false)
        setCashReceived('')
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

        if (value !== 'cash') {
            setCashReceived('')
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

    function handleCustomerSelect(customerId) {
        setSelectedCustomer(String(customerId))
        closeCustomerPicker()
        setFeedback(null)
    }

    function handleClearCustomer() {
        setSelectedCustomer('')
        closeCustomerPicker()
        setFeedback(null)
    }

    function handleOpenQuickCustomer() {
        closeCustomerPicker()
        setQuickCustomerOpen(true)
    }

    function openDiscountModal() {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de aplicar desconto.')
            return
        }

        setFeedback(null)
        setDiscountDraft(buildDiscountDraft(discountConfig, String(selectedCartItemId ?? cart[0]?.id ?? '')))
        setDiscountModalOpen(true)
    }

    function closeDiscountModal() {
        setDiscountModalOpen(false)
    }

    function handleDiscountDraftChange(field, value) {
        setDiscountDraft((current) => ({ ...current, [field]: value }))
    }

    function handleClearDiscount() {
        setDiscountConfig({ type: 'none' })
        setDiscountDraft(buildDiscountDraft({ type: 'none' }, String(selectedCartItemId ?? cart[0]?.id ?? '')))
        setFeedback(null)
    }

    function handleApplyDiscount(event) {
        event.preventDefault()

        if (!cart.length) {
            setDiscountModalOpen(false)
            return
        }

        if (discountDraft.mode === 'percent') {
            const percent = Number(discountDraft.percent || 0)

            if (percent <= 0 || percent > 100) {
                showFeedback('error', 'Informe um percentual valido entre 0,01 e 100.')
                return
            }

            setDiscountConfig({ type: 'percent', percent: roundCurrency(percent) })
            setDiscountModalOpen(false)
            setFeedback({ type: 'success', text: 'Desconto percentual aplicado na venda.' })
            return
        }

        if (discountDraft.mode === 'target_total') {
            const targetTotal = roundCurrency(discountDraft.targetTotal)

            if (targetTotal < 0 || targetTotal >= pricing.subtotal) {
                showFeedback('error', 'Informe um valor final menor que o subtotal atual da venda.')
                return
            }

            setDiscountConfig({ type: 'target_total', targetTotal })
            setDiscountModalOpen(false)
            setFeedback({ type: 'success', text: 'Desconto por valor final aplicado na venda.' })
            return
        }

        if (discountDraft.mode === 'item') {
            const item = cart.find((entry) => String(entry.id) === String(discountDraft.itemId))

            if (!item) {
                showFeedback('error', 'Selecione um item valido para aplicar o desconto.')
                return
            }

            const itemSubtotal = roundCurrency(Number(item.sale_price) * Number(item.qty))

            if (discountDraft.itemDiscountType === 'percent') {
                const percent = Number(discountDraft.itemPercent || 0)

                if (percent <= 0 || percent > 100) {
                    showFeedback('error', 'Informe um percentual valido para o desconto do item.')
                    return
                }

                setDiscountConfig({
                    type: 'item',
                    itemId: String(item.id),
                    itemDiscountType: 'percent',
                    value: roundCurrency(percent),
                })
                setDiscountModalOpen(false)
                setFeedback({ type: 'success', text: `Desconto aplicado ao item ${item.name}.` })
                return
            }

            const amount = roundCurrency(discountDraft.itemValue)

            if (amount <= 0 || amount > itemSubtotal) {
                showFeedback('error', 'Informe um desconto menor ou igual ao total do item selecionado.')
                return
            }

            setDiscountConfig({
                type: 'item',
                itemId: String(item.id),
                itemDiscountType: 'value',
                value: amount,
            })
            setDiscountModalOpen(false)
            setFeedback({ type: 'success', text: `Desconto aplicado ao item ${item.name}.` })
        }
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

    function closeCashReportModal() {
        setCashReportModal(null)
    }

    function closeCloseCashRegisterModal() {
        setCloseCashRegisterModal(null)
    }

    function buildCloseCashRegisterModal(report) {
        const paymentTotals = Object.fromEntries(report.payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]))

        return {
            report,
            form: {
                notes: '',
                amounts: {
                    cash: '',
                    pix: String(Number(paymentTotals.pix || 0).toFixed(2)),
                    debit_card: String(Number(paymentTotals.debit_card || 0).toFixed(2)),
                    credit_card: String(Number(paymentTotals.credit_card || 0).toFixed(2)),
                    credit: String(Number(paymentTotals.credit || 0).toFixed(2)),
                },
            },
        }
    }

    function buildCloseCashRegisterNotes(report, form) {
        const paymentTotals = Object.fromEntries(report.payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]))
        const lines = ['Conferencia de fechamento do caixa:']

        closingPaymentFields.forEach((field) => {
            const expected = field.key === 'cash' ? Number(report.expected_cash || 0) : Number(paymentTotals[field.key] || 0)
            const informed = Number(form.amounts[field.key] || 0)
            lines.push(
                `${field.label}: informado ${informed.toFixed(2)} | diferenca ${(informed - expected).toFixed(2)}`,
            )
        })

        if (form.notes.trim()) {
            lines.push(`Obs: ${form.notes.trim()}`)
        }

        return lines.join('\n')
    }

    async function handleOpenCashRegister(event) {
        event.preventDefault()
        setOpeningCashRegister(true)
        setFeedback(null)

        const formData = new FormData(event.currentTarget)
        const openingAmount = Number(formData.get('opening_amount') || 0)

        try {
            const response = await apiRequest('/api/cash-registers', {
                method: 'post',
                data: {
                    opening_amount: openingAmount,
                    opening_notes: formData.get('opening_notes') || null,
                },
            })

            setCashRegisterState({
                id: response.cash_register_id,
                status: 'open',
                opened_at: new Date().toISOString(),
                opening_amount: openingAmount,
            })
            event.currentTarget.reset()
            showFeedback('success', response.message || 'Caixa aberto com sucesso.')
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setOpeningCashRegister(false)
        }
    }

    async function handleOpenCloseCashRegister() {
        if (!cashRegisterState) {
            return
        }

        setLoadingClosePreview(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/api/cash-registers/${cashRegisterState.id}/report`)
            setCloseCashRegisterModal(buildCloseCashRegisterModal(response.report))
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setLoadingClosePreview(false)
        }
    }

    function handleCloseCashRegisterAmountChange(field, value) {
        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    form: {
                        ...current.form,
                        amounts: {
                            ...current.form.amounts,
                            [field]: value,
                        },
                    },
                }
                : current
        ))
    }

    function handleCloseCashRegisterNotesChange(value) {
        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    form: {
                        ...current.form,
                        notes: value,
                    },
                }
                : current
        ))
    }

    async function handleConfirmCloseCashRegister(event) {
        event.preventDefault()

        if (!cashRegisterState || !closeCashRegisterModal) {
            return
        }

        if (closeCashRegisterModal.form.amounts.cash === '') {
            showFeedback('error', 'Informe o valor contado em dinheiro antes de fechar o caixa.')
            return
        }

        setClosingCashRegister(true)
        setFeedback(null)

        try {
            const response = await apiRequest(`/api/cash-registers/${cashRegisterState.id}/close`, {
                method: 'post',
                data: {
                    closing_amount: Number(closeCashRegisterModal.form.amounts.cash || 0),
                    closing_notes: buildCloseCashRegisterNotes(closeCashRegisterModal.report, closeCashRegisterModal.form),
                },
            })

            setCloseCashRegisterModal(null)
            setCashRegisterState(null)
            setCashReportModal(response.report)
            showFeedback('success', response.message || 'Caixa fechado com sucesso.')
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setClosingCashRegister(false)
        }
    }

    async function handleFinalize() {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de finalizar a venda.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('error', 'Abra o caixa antes de tentar finalizar a venda.')
            return
        }

        if (paymentMethod === 'credit' && !selectedCustomer) {
            showFeedback('error', 'Selecione um cliente para registrar a venda no crediario.')
            return
        }

        if (paymentMethod === 'cash' && cashReceived !== '' && cashShortfall > 0.009) {
            showFeedback('error', 'O valor entregue em dinheiro precisa cobrir o total da venda.')
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
                showFeedback('error', 'Selecione um cliente para usar crediario no pagamento misto.')
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
                    discount: totals.discount,
                    notes,
                    items: pricing.items.map((item) => ({
                        id: item.id,
                        qty: Number(item.qty),
                        discount: Number(item.lineDiscount || 0),
                    })),
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

    useEffect(() => {
        function handleShortcuts(event) {
            const hasModalOpen = Boolean(
                cashReportModal || closeCashRegisterModal || quickCustomerOpen || customerPickerOpen || discountModalOpen,
            )
            const isReservedShiftShortcut =
                event.shiftKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                ['P', 'C', 'D', 'F', 'X'].includes(event.key.toUpperCase())

            if (event.key === 'Escape') {
                if (cashReportModal) {
                    event.preventDefault()
                    closeCashReportModal()
                    return
                }

                if (closeCashRegisterModal) {
                    event.preventDefault()
                    closeCloseCashRegisterModal()
                    return
                }

                if (quickCustomerOpen) {
                    event.preventDefault()
                    setQuickCustomerOpen(false)
                    return
                }

                if (discountModalOpen) {
                    event.preventDefault()
                    closeDiscountModal()
                    return
                }

                if (customerPickerOpen) {
                    event.preventDefault()
                    closeCustomerPicker()
                }

                return
            }

            if (hasModalOpen && !isReservedShiftShortcut) {
                return
            }

            if (!isReservedShiftShortcut) {
                return
            }

            const key = event.key.toUpperCase()

            if (key === 'P') {
                event.preventDefault()
                requestAnimationFrame(() => {
                    productSearchInputRef.current?.focus()
                    productSearchInputRef.current?.select?.()
                })
                return
            }

            if (key === 'C') {
                event.preventDefault()
                setCustomerPickerOpen(true)
                return
            }

            if (key === 'D' && cart.length) {
                event.preventDefault()
                openDiscountModal()
                return
            }

            if (key === 'F' && cashRegisterState && cart.length && !submitting) {
                event.preventDefault()
                handleFinalize()
                return
            }

            if (key === 'X' && cashRegisterState && !loadingClosePreview && !closingCashRegister) {
                event.preventDefault()
                handleOpenCloseCashRegister()
            }
        }

        window.addEventListener('keydown', handleShortcuts)

        return () => window.removeEventListener('keydown', handleShortcuts)
    }, [
        cashReportModal,
        closeCashRegisterModal,
        quickCustomerOpen,
        customerPickerOpen,
        discountModalOpen,
        handleFinalize,
        handleOpenCloseCashRegister,
        cashRegisterState,
        cart.length,
        submitting,
        loadingClosePreview,
        closingCashRegister,
        openDiscountModal,
    ])

    return (
        <AppLayout title="Caixa">
            <div className="pos-page">
                <div className="pos-column">
                    <section className="pos-hero ui-card">
                        <div className="ui-card-body">
                            <div className="pos-hero-grid">
                                <div>
                                    <span className={`ui-badge ${cashRegisterState ? 'success' : 'danger'}`}>
                                        {cashRegisterState ? 'Caixa ativo' : 'Caixa fechado'}
                                    </span>
                                    <h1>Ponto de venda</h1>
                                    <div className="pos-hero-shortcuts">
                                        <span className="pos-hero-shortcuts-title">Atalhos rapidos do caixa e da venda</span>
                                        <div className="pos-shortcut-list">
                                            {shortcutHints.map((shortcut) => (
                                                <div key={shortcut.label} className="pos-shortcut-chip">
                                                    <span className="pos-shortcut-keys">
                                                        {shortcut.keys.map((keyPart, index) => (
                                                            <span key={`${shortcut.label}-${keyPart}`} className="pos-shortcut-keypart">
                                                                {index ? <span>+</span> : null}
                                                                <kbd>{keyPart}</kbd>
                                                            </span>
                                                        ))}
                                                    </span>
                                                    <small>{shortcut.label}</small>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {feedback ? <div className={`pos-feedback ${feedback.type}`}>{feedback.text}</div> : null}

                    <ProductSearchPanel
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        searchInputRef={productSearchInputRef}
                        hasSearchTerm={searchTerm.trim() !== ''}
                        products={products}
                        loading={loadingProducts}
                        onAddProduct={handleAddProduct}
                    />

                    <CartPanel
                        cart={pricing.items}
                        selectedItemId={selectedCartItemId}
                        onSelectItem={setSelectedCartItemId}
                        onQuantityChange={handleQuantityChange}
                        onRemove={handleRemove}
                    />
                </div>

                <CheckoutPanel
                    selectedCustomer={selectedCustomer}
                    selectedCustomerData={selectedCustomerData}
                    onOpenCustomerPicker={() => setCustomerPickerOpen(true)}
                    onClearCustomer={handleClearCustomer}
                    discountSummary={pricing.summary}
                    onOpenDiscountModal={openDiscountModal}
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
                    onQuickCustomer={handleOpenQuickCustomer}
                    creditStatus={creditStatus}
                    totals={totals}
                    cashReceived={cashReceived}
                    onCashReceivedChange={setCashReceived}
                    cashChange={cashChange}
                    cashShortfall={cashShortfall}
                    cashRegister={cashRegisterState}
                    openingCashRegister={openingCashRegister}
                    loadingClosePreview={loadingClosePreview}
                    closingCashRegister={closingCashRegister}
                    onOpenCashRegister={handleOpenCashRegister}
                    onOpenCloseCashRegister={handleOpenCloseCashRegister}
                    disabled={!cashRegisterState || !cart.length || submitting}
                    onFinalize={handleFinalize}
                />
            </div>

            {discountModalOpen ? (
                <div className="pos-quick-customer" onClick={closeDiscountModal}>
                    <form className="pos-quick-customer-card pos-discount-modal-card" onSubmit={handleApplyDiscount} onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Aplicar desconto</h2>
                                <p>Escolha como quer conceder o desconto para esta venda.</p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={closeDiscountModal}>
                                Fechar
                            </button>
                        </div>

                        <div className="pos-discount-mode-grid">
                            <button
                                type="button"
                                className={`pos-discount-mode ${discountDraft.mode === 'percent' ? 'active' : ''}`}
                                onClick={() => handleDiscountDraftChange('mode', 'percent')}
                            >
                                <strong>Percentual</strong>
                                <span>Aplica uma porcentagem sobre a venda inteira.</span>
                            </button>
                            <button
                                type="button"
                                className={`pos-discount-mode ${discountDraft.mode === 'target_total' ? 'active' : ''}`}
                                onClick={() => handleDiscountDraftChange('mode', 'target_total')}
                            >
                                <strong>Valor final</strong>
                                <span>Define o total final desejado para a venda.</span>
                            </button>
                            <button
                                type="button"
                                className={`pos-discount-mode ${discountDraft.mode === 'item' ? 'active' : ''}`}
                                onClick={() => handleDiscountDraftChange('mode', 'item')}
                            >
                                <strong>Produto especifico</strong>
                                <span>Desconta apenas o item selecionado no carrinho.</span>
                            </button>
                        </div>

                        {discountDraft.mode === 'percent' ? (
                            <label className="pos-discount-form-field">
                                Percentual de desconto
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0.01"
                                    max="100"
                                    step="0.01"
                                    value={discountDraft.percent}
                                    onChange={(event) => handleDiscountDraftChange('percent', event.target.value)}
                                />
                                <small>Subtotal atual: {formatMoney(pricing.subtotal)}</small>
                            </label>
                        ) : null}

                        {discountDraft.mode === 'target_total' ? (
                            <label className="pos-discount-form-field">
                                Valor final da venda
                                <input
                                    className="ui-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={discountDraft.targetTotal}
                                    onChange={(event) => handleDiscountDraftChange('targetTotal', event.target.value)}
                                />
                                <small>Subtotal atual: {formatMoney(pricing.subtotal)}</small>
                            </label>
                        ) : null}

                        {discountDraft.mode === 'item' ? (
                            <div className="pos-discount-item-grid">
                                <label className="pos-discount-form-field">
                                    Produto
                                    <select
                                        className="ui-select"
                                        value={discountDraft.itemId}
                                        onChange={(event) => handleDiscountDraftChange('itemId', event.target.value)}
                                    >
                                        {pricing.items.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} - {formatMoney(item.lineSubtotal)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="pos-discount-type-toggle">
                                    <button
                                        type="button"
                                        className={discountDraft.itemDiscountType === 'value' ? 'active' : ''}
                                        onClick={() => handleDiscountDraftChange('itemDiscountType', 'value')}
                                    >
                                        Valor
                                    </button>
                                    <button
                                        type="button"
                                        className={discountDraft.itemDiscountType === 'percent' ? 'active' : ''}
                                        onClick={() => handleDiscountDraftChange('itemDiscountType', 'percent')}
                                    >
                                        Percentual
                                    </button>
                                </div>

                                {discountDraft.itemDiscountType === 'value' ? (
                                    <label className="pos-discount-form-field">
                                        Valor do desconto no item
                                        <input
                                            className="ui-input"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={discountDraft.itemValue}
                                            onChange={(event) => handleDiscountDraftChange('itemValue', event.target.value)}
                                        />
                                    </label>
                                ) : (
                                    <label className="pos-discount-form-field">
                                        Percentual no item
                                        <input
                                            className="ui-input"
                                            type="number"
                                            min="0.01"
                                            max="100"
                                            step="0.01"
                                            value={discountDraft.itemPercent}
                                            onChange={(event) => handleDiscountDraftChange('itemPercent', event.target.value)}
                                        />
                                    </label>
                                )}
                            </div>
                        ) : null}

                        <div className="pos-discount-preview">
                            <div>
                                <span>Subtotal atual</span>
                                <strong>{formatMoney(pricing.subtotal)}</strong>
                            </div>
                            <div>
                                <span>Desconto atual</span>
                                <strong>{formatMoney(pricing.discount)}</strong>
                            </div>
                            <div>
                                <span>Total atual</span>
                                <strong>{formatMoney(pricing.total)}</strong>
                            </div>
                            <div>
                                <span>Desconto da previa</span>
                                <strong>{formatMoney(discountPreview.discount)}</strong>
                            </div>
                            <div>
                                <span>Total apos aplicar</span>
                                <strong>{formatMoney(discountPreview.total)}</strong>
                            </div>
                        </div>

                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={handleClearDiscount}>
                                Remover desconto
                            </button>
                            <button className="pos-finalize-button" type="submit">
                                Aplicar desconto
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            {closeCashRegisterModal ? (
                <div className="pos-quick-customer" onClick={closeCloseCashRegisterModal}>
                    <form
                        className="pos-quick-customer-card pos-cash-close-card"
                        onSubmit={handleConfirmCloseCashRegister}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Fechar caixa</h2>
                                <p>Confira os valores por forma de pagamento antes de concluir o fechamento.</p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={closeCloseCashRegisterModal}>
                                Cancelar
                            </button>
                        </div>

                        <div className="pos-cash-close-grid">
                            {closeCashRegisterRows.map((row) => (
                                <div key={row.key} className="pos-cash-close-item">
                                    <div className="pos-cash-close-item-header">
                                        <strong>{row.label}</strong>
                                        <span>{row.key === 'cash' ? 'Com abertura, sangrias e suprimentos' : 'Total da forma de pagamento'}</span>
                                    </div>
                                    <div className="pos-cash-close-item-values">
                                        <label>
                                            <small>Valor informado</small>
                                            <input
                                                className="ui-input"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={closeCashRegisterModal.form.amounts[row.key]}
                                                onChange={(event) => handleCloseCashRegisterAmountChange(row.key, event.target.value)}
                                            />
                                        </label>
                                        <div className={`pos-cash-close-diff ${Math.abs(row.difference) > 0.009 ? 'alert' : ''}`}>
                                            <small>Diferenca</small>
                                            <strong>{row.difference === null ? 'A conferir' : formatMoney(row.difference)}</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <label className="pos-cash-close-notes">
                            Observacao do fechamento
                            <textarea
                                className="ui-textarea"
                                rows="3"
                                value={closeCashRegisterModal.form.notes}
                                onChange={(event) => handleCloseCashRegisterNotesChange(event.target.value)}
                            />
                        </label>

                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={closeCloseCashRegisterModal}>
                                Voltar
                            </button>
                            <button className="pos-cash-register-button danger" type="submit" disabled={closingCashRegister}>
                                <i className="fa-solid fa-lock" />
                                {closingCashRegister ? 'Fechando...' : 'Confirmar fechamento'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            {cashReportModal ? (
                <div className="pos-quick-customer" onClick={closeCashReportModal}>
                    <div className="pos-quick-customer-card pos-cash-report-card" onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Relatorio do caixa</h2>
                                <p>
                                    Aberto em {formatDateTime(cashReportModal.cashRegister.opened_at)} e fechado em{' '}
                                    {formatDateTime(cashReportModal.cashRegister.closed_at)}
                                </p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={closeCashReportModal}>
                                Fechar
                            </button>
                        </div>

                        <div className="pos-cash-report-grid">
                            <div className="pos-cash-report-box">
                                <span>Total vendido</span>
                                <strong>{formatMoney(cashReportModal.total_sales)}</strong>
                            </div>
                            <div className="pos-cash-report-box">
                                <span>Base de caixa</span>
                                <strong>{formatMoney(cashReportModal.expected_cash)}</strong>
                            </div>
                            <div className="pos-cash-report-box">
                                <span>Contado</span>
                                <strong>{formatMoney(cashReportModal.cashRegister.closing_amount)}</strong>
                            </div>
                            <div className="pos-cash-report-box">
                                <span>Diferenca</span>
                                <strong>{formatMoney(cashReportModal.difference)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {customerPickerOpen ? (
                <div className="pos-quick-customer" onClick={closeCustomerPicker}>
                    <div className="pos-quick-customer-card pos-customer-picker-card" onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header pos-customer-picker-header">
                            <div>
                                <h2>Selecionar cliente</h2>
                                <p>Pesquise por nome ou telefone e vincule a venda rapidamente.</p>
                            </div>

                            <div className="pos-customer-picker-top-actions">
                                <button className="ui-button-ghost" type="button" onClick={handleOpenQuickCustomer}>
                                    <i className="fa-solid fa-user-plus" />
                                    Novo cliente
                                </button>
                                <button className="ui-button-ghost" type="button" onClick={closeCustomerPicker}>
                                    Fechar
                                </button>
                            </div>
                        </div>

                        <div className="pos-customer-picker-search">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input
                                className="ui-input pos-customer-picker-input"
                                placeholder="Buscar cliente por nome ou telefone"
                                value={customerSearch}
                                onChange={(event) => setCustomerSearch(event.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="pos-customer-picker-toolbar">
                            <button
                                type="button"
                                className={`pos-customer-picker-ghost ${selectedCustomer ? '' : 'active'}`}
                                onClick={handleClearCustomer}
                            >
                                <i className="fa-solid fa-user-slash" />
                                Nao identificado
                            </button>
                            <span>
                                {customerSearch.trim()
                                    ? `${filteredCustomers.length} cliente(s) encontrado(s)`
                                    : 'Digite para pesquisar clientes'}
                            </span>
                        </div>

                        <div className="pos-customer-picker-list">
                            {customerSearch.trim() ? (
                                filteredCustomers.length ? (
                                    filteredCustomers.map((customer) => {
                                        const isActive = String(customer.id) === selectedCustomer

                                        return (
                                            <button
                                                key={customer.id}
                                                type="button"
                                                className={`pos-customer-picker-item ${isActive ? 'active' : ''}`}
                                                onClick={() => handleCustomerSelect(customer.id)}
                                            >
                                                <span className="pos-customer-picker-item-icon">
                                                    <i className={`fa-solid ${isActive ? 'fa-circle-check' : 'fa-user'}`} />
                                                </span>
                                                <span className="pos-customer-picker-item-copy">
                                                    <strong>{customer.name}</strong>
                                                    <small>{customer.phone || 'Sem telefone informado'}</small>
                                                </span>
                                                <span className="pos-customer-picker-item-action">
                                                    {isActive ? 'Selecionado' : 'Selecionar'}
                                                </span>
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="pos-empty-state">Nenhum cliente encontrado para essa busca.</div>
                                )
                            ) : (
                                <div className="pos-empty-state">Digite nome ou telefone para buscar um cliente.</div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {quickCustomerOpen ? (
                <div className="pos-quick-customer" onClick={() => setQuickCustomerOpen(false)}>
                    <form className="pos-quick-customer-card" onSubmit={handleQuickCustomerSubmit} onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Novo cliente</h2>
                                <p>Cadastre rapidamente e selecione na venda.</p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={() => setQuickCustomerOpen(false)}>
                                Fechar
                            </button>
                        </div>
                        <input
                            className="ui-input"
                            placeholder="Nome do cliente"
                            value={quickCustomerForm.name}
                            onChange={(event) =>
                                setQuickCustomerForm((current) => ({ ...current, name: event.target.value }))
                            }
                        />
                        <input
                            className="ui-input"
                            placeholder="Telefone"
                            value={quickCustomerForm.phone}
                            onChange={(event) =>
                                setQuickCustomerForm((current) => ({ ...current, phone: event.target.value }))
                            }
                        />
                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={() => setQuickCustomerOpen(false)}>
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
