import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '@/Layouts/AppLayout'
import CartPanel from '@/Components/Pos/CartPanel'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import CheckoutPanel from '@/Components/Pos/CheckoutPanel'
import PendingOrdersPanel from '@/Components/Pos/PendingOrdersPanel'
import ProductSearchPanel from '@/Components/Pos/ProductSearchPanel'
import useModules from '@/hooks/useModules'
import { buildCloseCashRegisterModal, buildCloseCashRegisterRows, createOpenCashRegisterForm } from '@/lib/cashRegister'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import './pos.css'

const shortcutHints = [
    { keys: ['Shift', 'P'], label: 'Focar busca de produtos' },
    { keys: ['Shift', 'C'], label: 'Abrir cliente' },
    { keys: ['Shift', 'D'], label: 'Abrir desconto' },
    { keys: ['Shift', 'F'], label: 'Finalizar venda' },
    { keys: ['Shift', 'X'], label: 'Abrir ou fechar caixa' },
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

export default function PosIndex({
    categories,
    customers: initialCustomers,
    cashRegister,
    pendingOrderDrafts: initialPendingOrderDrafts,
    preloadedOrderDraft,
}) {
    const moduleState = useModules()
    const [customers, setCustomers] = useState(initialCustomers)
    const [cashRegisterState, setCashRegisterState] = useState(cashRegister)
    const [pendingOrderDrafts, setPendingOrderDrafts] = useState(initialPendingOrderDrafts || [])
    const [activeOrderDraftId, setActiveOrderDraftId] = useState(preloadedOrderDraft?.id ?? null)
    const [loadingOrderDraftId, setLoadingOrderDraftId] = useState(null)
    const [refreshingPendingOrders, setRefreshingPendingOrders] = useState(false)
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
    const [openCashRegisterModal, setOpenCashRegisterModal] = useState(null)
    const [loadingClosePreview, setLoadingClosePreview] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [closeCashRegisterModal, setCloseCashRegisterModal] = useState(null)
    const [cashReportModal, setCashReportModal] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const [loadingProducts, setLoadingProducts] = useState(false)
    const supportsOrders = moduleState.isCapabilityEnabled('pedidos')
    const supportsDeferredPayment = moduleState.isCapabilityEnabled('prazo')
    const requireCashClosingConference = moduleState.settings?.cash_closing?.require_conference !== false
    const deferredCustomerSearch = useDeferredValue(customerSearch)
    const productSearchInputRef = useRef(null)

    const checkoutPaymentOptions = useMemo(
        () =>
            [
                { value: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave', tone: 'success' },
                { value: 'pix', label: 'Pix', icon: 'fa-qrcode', tone: 'info' },
                { value: 'debit_card', label: 'Debito', icon: 'fa-credit-card', tone: 'primary' },
                { value: 'credit_card', label: 'Credito', icon: 'fa-credit-card', tone: 'primary' },
                { value: 'credit', label: 'A Prazo', icon: 'fa-handshake', tone: 'warning' },
                { value: 'mixed', label: 'Misto', icon: 'fa-layer-group', tone: 'danger' },
            ].filter((option) => supportsDeferredPayment || option.value !== 'credit'),
        [supportsDeferredPayment],
    )

    useEffect(() => {
        setCashRegisterState(cashRegister)
    }, [cashRegister])

    useEffect(() => {
        setPendingOrderDrafts(initialPendingOrderDrafts || [])
    }, [initialPendingOrderDrafts])

    useEffect(() => {
        if (searchTerm == null || String(searchTerm).toLowerCase() === 'null') {
            setSearchTerm('')
        }
    }, [searchTerm])

    useEffect(() => {
        if (!preloadedOrderDraft) {
            return
        }

        applyOrderDraftToSale(preloadedOrderDraft, false)
    }, [preloadedOrderDraft])

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
        if (!supportsDeferredPayment || !selectedCustomer) {
            setCreditStatus(null)
            return
        }

        apiRequest(`/api/pdv/customers/${selectedCustomer}/credit`)
            .then(setCreditStatus)
            .catch(() => setCreditStatus(null))
    }, [selectedCustomer, supportsDeferredPayment])

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

    useEffect(() => {
        if (!supportsOrders) {
            return undefined
        }

        const interval = setInterval(() => {
            refreshPendingOrderDrafts({ quiet: true })
        }, 15000)

        return () => clearInterval(interval)
    }, [supportsOrders])

    useEffect(() => {
        if (supportsDeferredPayment) {
            return
        }

        setCreditStatus(null)

        if (paymentMethod === 'credit') {
            setPaymentMethod('cash')
        }

        setMixedPayments((current) => current.filter((payment) => payment.method !== 'credit'))
        setMixedDraft((current) => ({
            ...current,
            method: current.method === 'credit' ? 'cash' : current.method,
        }))
    }, [paymentMethod, supportsDeferredPayment])

    useEffect(() => {
        if (supportsOrders) {
            return
        }

        setPendingOrderDrafts([])
        setActiveOrderDraftId(null)
    }, [supportsOrders])

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

        return buildCloseCashRegisterRows(closeCashRegisterModal, requireCashClosingConference)
    }, [closeCashRegisterModal, requireCashClosingConference])

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
        setActiveOrderDraftId(null)
    }

    function applyOrderDraftToSale(orderDraft, showLoadedFeedback = true) {
        setCart((orderDraft.items || []).map((item) => ({
            ...item,
            qty: Number(item.qty),
            cost_price: Number(item.cost_price || 0),
            sale_price: Number(item.sale_price || 0),
            stock_quantity: Number(item.stock_quantity || 0),
        })))
        setSelectedCartItemId(orderDraft.items?.[0]?.id ?? null)
        setSelectedCustomer(orderDraft.customer?.id ? String(orderDraft.customer.id) : '')
        setDiscountConfig({ type: 'none' })
        setDiscountDraft(buildDiscountDraft({ type: 'none' }, String(orderDraft.items?.[0]?.id ?? '')))
        setDiscountModalOpen(false)
        setCashReceived('')
        setNotes(orderDraft.notes || '')
        setPaymentMethod('cash')
        setMixedPayments([])
        setMixedDraft({ method: 'cash', amount: '' })
        setCreditStatus(null)
        setActiveOrderDraftId(orderDraft.id)
        setFeedback(showLoadedFeedback ? { type: 'success', text: `${orderDraft.label} carregado para cobranca.` } : null)
    }

    async function refreshPendingOrderDrafts({ quiet = false } = {}) {
        if (!supportsOrders) {
            setPendingOrderDrafts([])
            return
        }

        if (!quiet) {
            setRefreshingPendingOrders(true)
        }

        try {
            const response = await apiRequest('/api/orders/pending-checkout')
            setPendingOrderDrafts(response.orders || [])
        } catch (error) {
            if (!quiet) {
                showFeedback('error', error.message)
            }
        } finally {
            if (!quiet) {
                setRefreshingPendingOrders(false)
            }
        }
    }

    async function handleLoadOrderDraft(orderDraftId) {
        if (!supportsOrders) {
            showFeedback('error', 'Pedidos estao desativados nesta conta.')
            return
        }

        if (cart.length && Number(activeOrderDraftId) !== Number(orderDraftId)) {
            showFeedback('error', 'Finalize ou limpe a venda atual antes de carregar outro pedido.')
            return
        }

        setLoadingOrderDraftId(orderDraftId)

        try {
            const response = await apiRequest(`/api/orders/${orderDraftId}`)
            applyOrderDraftToSale(response.order)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setLoadingOrderDraftId(null)
        }
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
        if (!supportsDeferredPayment && value === 'credit') {
            showFeedback('error', 'O pagamento a prazo esta desativado nesta conta.')
            return
        }

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
        const resolvedAmount = amount > 0 ? amount : mixedRemaining

        if (resolvedAmount <= 0) {
            showFeedback('error', 'Informe um valor valido para adicionar ao pagamento misto.')
            return
        }

        if (resolvedAmount > mixedRemaining + 0.001) {
            showFeedback('error', 'A soma das parcelas nao pode ultrapassar o total da venda.')
            return
        }

        setFeedback(null)
        setMixedPayments((current) => [...current, { method: mixedDraft.method, amount: String(resolvedAmount.toFixed(2)) }])
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

    function closeOpenCashRegisterModal() {
        setOpenCashRegisterModal(null)
    }

    function closeCloseCashRegisterModal() {
        setCloseCashRegisterModal(null)
    }

    function handleOpenCashWorkflow() {
        if (cashRegisterState) {
            if (!loadingClosePreview && !closingCashRegister) {
                handleOpenCloseCashRegister()
            }

            return
        }

        setFeedback(null)
        setOpenCashRegisterModal(createOpenCashRegisterForm())
    }

    function handleOpenCashRegisterFieldChange(field, value) {
        setOpenCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    [field]: value,
                }
                : current
        ))
    }

    async function handleOpenCashRegister(event) {
        event.preventDefault()

        if (!openCashRegisterModal) {
            return
        }

        setOpeningCashRegister(true)
        setFeedback(null)

        const openingAmount = Number(openCashRegisterModal.openingAmount || 0)
        const openingNotes = openCashRegisterModal.openingNotes.trim()

        try {
            const response = await apiRequest('/api/cash-registers', {
                method: 'post',
                data: {
                    opening_amount: openingAmount,
                    opening_notes: openingNotes || null,
                },
            })

            setCashRegisterState({
                id: response.cash_register_id,
                status: 'open',
                opened_at: new Date().toISOString(),
                opening_amount: openingAmount,
            })
            setOpenCashRegisterModal(null)
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
                    closing_notes: closeCashRegisterModal.form.notes || null,
                    closing_totals: Object.fromEntries(
                        Object.entries(closeCashRegisterModal.form.amounts)
                            .filter(([key]) => requireCashClosingConference || key === 'cash')
                            .map(([key, value]) => [key, Number(value || 0)]),
                    ),
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
            showFeedback('error', 'Selecione um cliente para registrar a venda a prazo.')
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
                showFeedback('error', 'Selecione um cliente para usar A Prazo no pagamento misto.')
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
            const finalizedOrderDraftId = activeOrderDraftId
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
                    order_draft_id: activeOrderDraftId || null,
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
            if (finalizedOrderDraftId) {
                setPendingOrderDrafts((current) => current.filter((orderDraft) => Number(orderDraft.id) !== Number(finalizedOrderDraftId)))
                refreshPendingOrderDrafts({ quiet: true })
            }
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
                cashReportModal || openCashRegisterModal || closeCashRegisterModal || quickCustomerOpen || customerPickerOpen || discountModalOpen,
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

                if (openCashRegisterModal) {
                    event.preventDefault()
                    closeOpenCashRegisterModal()
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

            if (key === 'X' && !loadingClosePreview && !closingCashRegister && !openingCashRegister) {
                event.preventDefault()
                handleOpenCashWorkflow()
            }
        }

        window.addEventListener('keydown', handleShortcuts)

        return () => window.removeEventListener('keydown', handleShortcuts)
    }, [
        cashReportModal,
        openCashRegisterModal,
        closeCashRegisterModal,
        quickCustomerOpen,
        customerPickerOpen,
        discountModalOpen,
        handleFinalize,
        handleOpenCashWorkflow,
        handleOpenCloseCashRegister,
        cashRegisterState,
        cart.length,
        submitting,
        loadingClosePreview,
        closingCashRegister,
        openingCashRegister,
        openDiscountModal,
    ])

    return (
        <AppLayout title="Checkout">
            <div className="pos-page">
                <div className="pos-column">
                    <section className="pos-hero ui-card">
                        <div className="ui-card-body">
                            <div className="pos-hero-grid">
                                <div>
                                    <span className={`ui-badge ${cashRegisterState ? 'success' : 'danger'}`}>
                                        {cashRegisterState ? 'Caixa ativo' : 'Caixa fechado'}
                                    </span>
                                    <h1>Checkout</h1>
                                    <div className="pos-hero-shortcuts">
                                        <span className="pos-hero-shortcuts-title">Atalhos</span>
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

                    {supportsOrders ? (
                        <PendingOrdersPanel
                            orders={pendingOrderDrafts}
                            activeOrderDraftId={activeOrderDraftId}
                            loadingOrderId={loadingOrderDraftId}
                            refreshing={refreshingPendingOrders}
                            onLoadOrder={handleLoadOrderDraft}
                            onRefresh={refreshPendingOrderDrafts}
                        />
                    ) : null}

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
                        subtitle="Busque por nome, codigo, EAN ou descricao."
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
                    paymentOptions={checkoutPaymentOptions}
                    selectedCustomer={selectedCustomer}
                    selectedCustomerData={selectedCustomerData}
                    onOpenCustomerPicker={() => setCustomerPickerOpen(true)}
                    onClearCustomer={handleClearCustomer}
                    discountSummary={pricing.summary}
                    onOpenDiscountModal={openDiscountModal}
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
                    onOpenCashWorkflow={handleOpenCashWorkflow}
                    onOpenCloseCashRegister={handleOpenCloseCashRegister}
                    requireCashClosingConference={requireCashClosingConference}
                    cashShortcutLabel="Shift + X"
                    activeOrderDraftLabel={pendingOrderDrafts.find((orderDraft) => Number(orderDraft.id) === Number(activeOrderDraftId))?.label || null}
                    canResetSale={Boolean(cart.length || activeOrderDraftId)}
                    onResetSale={resetSale}
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

            {openCashRegisterModal ? (
                <div className="pos-quick-customer" onClick={closeOpenCashRegisterModal}>
                    <form className="pos-quick-customer-card" onSubmit={handleOpenCashRegister} onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Abrir caixa</h2>
                                <p>Defina o valor inicial para iniciar o turno atual.</p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={closeOpenCashRegisterModal}>
                                Cancelar
                            </button>
                        </div>

                        <label className="pos-discount-form-field">
                            Valor de abertura
                            <input
                                className="ui-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={openCashRegisterModal.openingAmount}
                                onChange={(event) => handleOpenCashRegisterFieldChange('openingAmount', event.target.value)}
                                autoFocus
                            />
                        </label>

                        <label className="pos-discount-form-field">
                            Observacao
                            <textarea
                                className="ui-input"
                                rows="3"
                                value={openCashRegisterModal.openingNotes}
                                onChange={(event) => handleOpenCashRegisterFieldChange('openingNotes', event.target.value)}
                            />
                        </label>

                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={closeOpenCashRegisterModal}>
                                Voltar
                            </button>
                            <button className="pos-cash-register-button" type="submit" disabled={openingCashRegister}>
                                <i className="fa-solid fa-lock-open" />
                                {openingCashRegister ? 'Abrindo...' : 'Confirmar abertura'}
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
                                <p>
                                    {requireCashClosingConference
                                        ? 'Confira os totais por forma de pagamento antes de concluir.'
                                        : 'Informe o valor contado em dinheiro para concluir rapidamente.'}
                                </p>
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
                                        <span>{row.key === 'cash' ? 'Com abertura, sangrias e suprimentos' : 'Total registrado nesta forma'}</span>
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

                        <label className="pos-discount-form-field">
                            Observacao do fechamento
                            <textarea
                                className="ui-input pos-cash-close-notes"
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

            <ClosingReportModal report={cashReportModal} onClose={closeCashReportModal} />

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
