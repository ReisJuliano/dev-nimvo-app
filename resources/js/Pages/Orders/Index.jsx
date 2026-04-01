import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import useModules from '@/hooks/useModules'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import SidebarToolButton from './SidebarToolButton'
import OrderDetailModal from './OrderDetailModal'
import OrderProductModal from './OrderProductModal'
import OrderDraftFormModal from './OrderDraftFormModal'
import OrderSearchModal from './OrderSearchModal'
import OrderTransferModal from './OrderTransferModal'
import OrderQuantityModal from './OrderQuantityModal'
import OrderDiscountModal from './OrderDiscountModal'
import OrderCheckoutModal from './OrderCheckoutModal'
import OrderPartialCheckoutModal from './OrderPartialCheckoutModal'
import OrderDeliveryModal from './OrderDeliveryModal'
import OrderDeliveriesModal from './OrderDeliveriesModal'
import {
    buildDiscountDraft,
    buildDraftPayload,
    buildPreviewConfigFromDraft,
    buildPrintMarkup,
    filterMetaByStatus,
    formatElapsedTime,
    getDraftNumberLabel,
    getInitialNewDraftForm,
    getOrderStatusMeta,
    getOrderTypeLabel,
    mapOrderToDraft,
    normalizeQuantity,
    resolvePricing,
    roundCurrency,
    sortDrafts,
} from './orderUtils'
import './orders.css'

function sortCustomerOptions(currentCustomers) {
    return [...currentCustomers].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR'),
    )
}

export default function OrdersIndex({ categories, customers, drafts: initialDrafts, initialDraft }) {
    const { auth } = usePage().props
    const moduleState = useModules()
    const initialDraftState = initialDraft ? mapOrderToDraft(initialDraft) : null

    const [customerOptions, setCustomerOptions] = useState(customers)
    const [drafts, setDrafts] = useState(sortDrafts(initialDrafts))
    const [currentDraft, setCurrentDraft] = useState(initialDraftState)
    const [selectedItemId, setSelectedItemId] = useState(initialDraft?.items?.[0]?.id ?? null)
    const [selectedCategory, setSelectedCategory] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [loadingDraft, setLoadingDraft] = useState(false)
    const [creatingDraft, setCreatingDraft] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [sendingDraft, setSendingDraft] = useState(false)
    const [deletingDraft, setDeletingDraft] = useState(false)
    const [printingDraft, setPrintingDraft] = useState(false)
    const [submittingCheckout, setSubmittingCheckout] = useState(false)
    const [submittingDelivery, setSubmittingDelivery] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [listFilter, setListFilter] = useState(initialDraft?.status === 'sent_to_cashier' ? 'sent_to_cashier' : 'draft')
    const [draftModalOpen, setDraftModalOpen] = useState(false)
    const [productsModalOpen, setProductsModalOpen] = useState(false)
    const [newDraftModalOpen, setNewDraftModalOpen] = useState(false)
    const [searchModalOpen, setSearchModalOpen] = useState(false)
    const [transferModalOpen, setTransferModalOpen] = useState(false)
    const [discountModalOpen, setDiscountModalOpen] = useState(false)
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false)
    const [quantityModalOpen, setQuantityModalOpen] = useState(false)
    const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
    const [deliveriesModalOpen, setDeliveriesModalOpen] = useState(false)
    const [newDraftForm, setNewDraftForm] = useState(getInitialNewDraftForm())
    const [searchDraftTerm, setSearchDraftTerm] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [productQuickQty, setProductQuickQty] = useState('1')
    const [transferForm, setTransferForm] = useState({
        type: initialDraftState?.type || 'comanda',
        reference: initialDraftState?.reference || '',
        customerId: initialDraftState?.customerId || '',
        notes: initialDraftState?.notes || '',
    })
    const [discountConfig, setDiscountConfig] = useState({ type: 'none' })
    const [discountDraft, setDiscountDraft] = useState(buildDiscountDraft({ type: 'none' }, String(initialDraftState?.items?.[0]?.id ?? '')))
    const [paymentTab, setPaymentTab] = useState('cash')
    const [cardType, setCardType] = useState('credit_card')
    const [cashReceived, setCashReceived] = useState('')
    const [partialCheckoutModalOpen, setPartialCheckoutModalOpen] = useState(false)
    const [submittingPartialCheckout, setSubmittingPartialCheckout] = useState(false)
    const [creditStatus, setCreditStatus] = useState(null)
    const [quantityDraft, setQuantityDraft] = useState(String(initialDraftState?.items?.[0]?.qty ?? '1'))
    const [clock, setClock] = useState(Date.now())
    useErrorFeedbackPopup(feedback)
    const saveTimeoutRef = useRef(null)
    const searchInputRef = useRef(null)
    const searchDraftInputRef = useRef(null)
    const newDraftCustomerInputRef = useRef(null)
    const quantityInputRef = useRef(null)
    const lastSavedSignatureRef = useRef(initialDraftState ? JSON.stringify(buildDraftPayload(initialDraftState)) : null)

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
                } catch (error) {
                    if (!ignore) {
                        setFeedback({ type: 'error', text: error.message })
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

    const isAnyModalOpen =
        draftModalOpen ||
        productsModalOpen ||
        newDraftModalOpen ||
        searchModalOpen ||
        transferModalOpen ||
        discountModalOpen ||
        checkoutModalOpen ||
        partialCheckoutModalOpen ||
        deliveryModalOpen ||
        deliveriesModalOpen ||
        quantityModalOpen

    useEffect(() => {
        if (!currentDraft?.items?.length) {
            setSelectedItemId(null)
            return
        }

        if (!currentDraft.items.some((item) => item.id === selectedItemId)) {
            setSelectedItemId(currentDraft.items[0].id)
        }
    }, [currentDraft, selectedItemId])

    useEffect(() => {
        if (discountConfig.type !== 'item') {
            return
        }

        if (!currentDraft?.items?.some((item) => String(item.id) === String(discountConfig.itemId))) {
            setDiscountConfig({ type: 'none' })
        }
    }, [currentDraft, discountConfig])

    useEffect(() => () => clearTimeout(saveTimeoutRef.current), [])

    useEffect(() => {
        const interval = setInterval(() => setClock(Date.now()), 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!currentDraft?.customerId) {
            setCreditStatus(null)
            return
        }

        apiRequest(`/api/pdv/customers/${currentDraft.customerId}/credit`)
            .then(setCreditStatus)
            .catch(() => setCreditStatus(null))
    }, [currentDraft?.customerId])

    useEffect(() => {
        const modalFocusMap = [
            [productsModalOpen, searchInputRef],
            [searchModalOpen, searchDraftInputRef],
            [newDraftModalOpen, newDraftCustomerInputRef],
            [quantityModalOpen, quantityInputRef],
        ]
        const [open, ref] = modalFocusMap.find(([isOpen]) => isOpen) || []

        if (!open || !ref) {
            return undefined
        }

        const timeout = setTimeout(() => {
            ref.current?.focus()
            ref.current?.select?.()
        }, 80)

        return () => clearTimeout(timeout)
    }, [productsModalOpen, searchModalOpen, newDraftModalOpen, quantityModalOpen])

    // (duplicated further above) kept for history; remove to avoid conflicting definitions

    useEffect(() => {
        if (!isAnyModalOpen) {
            return undefined
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [isAnyModalOpen])

    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key !== 'Escape') {
                return
            }

            if (deliveriesModalOpen) return void setDeliveriesModalOpen(false)
            if (deliveryModalOpen) return void setDeliveryModalOpen(false)
            if (partialCheckoutModalOpen) return void setPartialCheckoutModalOpen(false)
            if (checkoutModalOpen) return void setCheckoutModalOpen(false)
            if (discountModalOpen) return void setDiscountModalOpen(false)
            if (quantityModalOpen) return void setQuantityModalOpen(false)
            if (transferModalOpen) return void setTransferModalOpen(false)
            if (productsModalOpen) return void setProductsModalOpen(false)
            if (searchModalOpen) return void setSearchModalOpen(false)
            if (newDraftModalOpen) return void setNewDraftModalOpen(false)
            if (draftModalOpen) return void setDraftModalOpen(false)
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        draftModalOpen,
        productsModalOpen,
        newDraftModalOpen,
        searchModalOpen,
        transferModalOpen,
        discountModalOpen,
        checkoutModalOpen,
        partialCheckoutModalOpen,
        deliveryModalOpen,
        deliveriesModalOpen,
        quantityModalOpen,
    ])

    const selectedCustomer = useMemo(
        () => customerOptions.find((customer) => String(customer.id) === currentDraft?.customerId) ?? null,
        [customerOptions, currentDraft?.customerId],
    )
    const selectedItem = useMemo(
        () => currentDraft?.items?.find((item) => item.id === selectedItemId) ?? null,
        [currentDraft, selectedItemId],
    )
    const pricing = useMemo(() => resolvePricing(currentDraft?.items || [], discountConfig, selectedItem), [currentDraft, discountConfig, selectedItem])
    const discountPreview = useMemo(() => {
        const previewConfig = buildPreviewConfigFromDraft(discountDraft, pricing.subtotal)
        return resolvePricing(currentDraft?.items || [], previewConfig, selectedItem)
    }, [currentDraft, discountDraft, pricing.subtotal, selectedItem])
    const currentDraftStatus = currentDraft ? getOrderStatusMeta(currentDraft.status) : null
    const draftOnlyCount = drafts.filter((draft) => draft.status !== 'sent_to_cashier').length
    const cashierCount = drafts.length - draftOnlyCount
    const identifiedCustomersCount = drafts.filter((draft) => draft.customer?.name).length
    const activeFilterMeta = filterMetaByStatus[listFilter] || filterMetaByStatus.draft
    const filteredDrafts = useMemo(() => drafts.filter((draft) => draft.status === listFilter), [drafts, listFilter])
    const searchResults = useMemo(() => {
        const normalizedTerm = searchDraftTerm.trim().toLowerCase()
        if (!normalizedTerm) return drafts.slice(0, 8)
        return drafts.filter((draft) =>
            [draft.label, draft.reference, draft.customer?.name, draft.created_by, getOrderTypeLabel(draft.type), getDraftNumberLabel(draft)]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedTerm)),
        )
    }, [drafts, searchDraftTerm])
    const newDraftCustomerSuggestions = useMemo(() => {
        const normalizedTerm = newDraftForm.customerName.trim().toLowerCase()
        if (!normalizedTerm) return []
        return customerOptions
            .filter((customer) => [customer.name, customer.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedTerm)))
            .slice(0, 6)
    }, [customerOptions, newDraftForm.customerName])
    const resolvedPaymentMethod = paymentTab === 'card' ? cardType : paymentTab
    const cashReceivedAmount = useMemo(() => (cashReceived === '' ? 0 : roundCurrency(cashReceived)), [cashReceived])
    const cashChange = useMemo(() => Math.max(0, roundCurrency(cashReceivedAmount - pricing.total)), [cashReceivedAmount, pricing.total])
    const cashShortfall = useMemo(() => (cashReceived === '' ? 0 : Math.max(0, roundCurrency(pricing.total - cashReceivedAmount))), [cashReceived, cashReceivedAmount, pricing.total])
    const currentDraftSaveText = currentDraft
        ? (savingDraft
            ? 'Salvando alteracoes...'
            : currentDraft.updatedAt
                ? `Ultima atualizacao em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(currentDraft.updatedAt))}`
                : currentDraftStatus?.description || 'Atendimento pronto para editar')
        : 'Selecione ou crie um atendimento para comecar.'
    const canOpenReports =
        moduleState.isCapabilityEnabled('relatorios')
        || moduleState.isCapabilityEnabled('vendas')
        || moduleState.isCapabilityEnabled('demanda')

    function showFeedback(type, text) {
        setFeedback({ type, text })
    }

    function updateDraftUrl(draftId) {
        window.history.replaceState({}, '', draftId ? `/pedidos?draft=${draftId}` : '/pedidos')
    }

    function resetCheckoutState(fallbackItemId = '') {
        setDiscountConfig({ type: 'none' })
        setDiscountDraft(buildDiscountDraft({ type: 'none' }, fallbackItemId))
        setPaymentTab('cash')
        setCardType('credit_card')
        setCashReceived('')
    }

    function syncDraftSummary(order) {
        const nextSummary = {
            id: order.id,
            type: order.type,
            reference: order.reference,
            label: order.label,
            status: order.status,
            subtotal: Number(order.subtotal || 0),
            total: Number(order.total || 0),
            items_count: order.items?.length ?? order.items_count ?? 0,
            customer: order.customer,
            created_by: order.created_by,
            sent_to_cashier_at: order.sent_to_cashier_at,
            updated_at: order.updated_at || new Date().toISOString(),
        }

        setDrafts((current) => sortDrafts(current.some((draft) => Number(draft.id) === Number(order.id))
            ? current.map((draft) => (Number(draft.id) === Number(order.id) ? nextSummary : draft))
            : [nextSummary, ...current]))
    }

    function hydrateDraft(order) {
        const mappedDraft = mapOrderToDraft(order)
        const fallbackItemId = String(mappedDraft.items[0]?.id ?? '')

        clearTimeout(saveTimeoutRef.current)
        lastSavedSignatureRef.current = JSON.stringify(buildDraftPayload(mappedDraft))
        setCurrentDraft(mappedDraft)
        setSelectedItemId(mappedDraft.items[0]?.id ?? null)
        setTransferForm({ type: mappedDraft.type, reference: mappedDraft.reference, customerId: mappedDraft.customerId, notes: mappedDraft.notes })
        setQuantityDraft(String(mappedDraft.items[0]?.qty ?? 1))
        setProductQuickQty('1')
        setCreditStatus(null)
        resetCheckoutState(fallbackItemId)
        setProductsModalOpen(false)
        setTransferModalOpen(false)
        setDiscountModalOpen(false)
        setCheckoutModalOpen(false)
        setQuantityModalOpen(false)
        updateDraftUrl(mappedDraft.id)
        syncDraftSummary(order)
    }

    async function saveDraftNow(nextDraft) {
        if (!nextDraft?.id) return
        const payload = buildDraftPayload(nextDraft)
        const payloadSignature = JSON.stringify(payload)
        if (payloadSignature === lastSavedSignatureRef.current) return

        clearTimeout(saveTimeoutRef.current)
        setSavingDraft(true)

        try {
            const response = await apiRequest(`/api/orders/${nextDraft.id}`, { method: 'put', data: payload })
            lastSavedSignatureRef.current = payloadSignature
            setCurrentDraft((current) => (
                current && Number(current.id) === Number(response.order.id)
                    ? { ...current, status: response.order.status, label: response.order.label, subtotal: Number(response.order.subtotal || 0), total: Number(response.order.total || 0), updatedAt: response.order.updated_at || null }
                    : current
            ))
            syncDraftSummary(response.order)
        } catch (error) {
            showFeedback('error', error.message)
            throw error
        } finally {
            setSavingDraft(false)
        }
    }

    function scheduleDraftSave(nextDraft) {
        if (!nextDraft?.id) return
        const payload = buildDraftPayload(nextDraft)
        const payloadSignature = JSON.stringify(payload)
        if (payloadSignature === lastSavedSignatureRef.current) return

        clearTimeout(saveTimeoutRef.current)
        setSavingDraft(true)
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await apiRequest(`/api/orders/${nextDraft.id}`, { method: 'put', data: payload })
                lastSavedSignatureRef.current = payloadSignature
                setCurrentDraft((current) => (
                    current && Number(current.id) === Number(response.order.id)
                        ? { ...current, status: response.order.status, label: response.order.label, subtotal: Number(response.order.subtotal || 0), total: Number(response.order.total || 0), updatedAt: response.order.updated_at || null }
                        : current
                ))
                syncDraftSummary(response.order)
            } catch (error) {
                showFeedback('error', error.message)
            } finally {
                setSavingDraft(false)
            }
        }, 500)
    }

    function updateDraft(updater) {
        setCurrentDraft((current) => {
            if (!current) return current
            const nextDraft = updater(current)
            scheduleDraftSave(nextDraft)
            return nextDraft
        })
    }

    async function openDraft(draftId) {
        if (!draftId) return
        if (Number(currentDraft?.id) === Number(draftId)) return void setDraftModalOpen(true)

        setLoadingDraft(true)
        try {
            if (currentDraft) await saveDraftNow(currentDraft)
            const response = await apiRequest(`/api/orders/${draftId}`)
            hydrateDraft(response.order)
            setDraftModalOpen(true)
            setFeedback(null)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setLoadingDraft(false)
        }
    }

    async function resolveNewDraftCustomer() {
        const typedName = newDraftForm.customerName.trim()
        if (!typedName) return null
        if (newDraftForm.customerId) return Number(newDraftForm.customerId)

        const existing = customerOptions.find((customer) => String(customer.name).trim().toLowerCase() === typedName.toLowerCase())
        if (existing) return Number(existing.id)

        const response = await apiRequest('/api/pdv/customers/quick', { method: 'post', data: { name: typedName, phone: null } })
        setCustomerOptions((current) => sortCustomerOptions([...current, response.customer]))
        return Number(response.customer.id)
    }

    async function handleCreateDraft(event, options = {}) {
        event?.preventDefault?.()
        const openProductsAfter = Boolean(options.openProductsAfter)
        setCreatingDraft(true)
        try {
            if (currentDraft) await saveDraftNow(currentDraft)
            const response = await apiRequest('/api/orders', { method: 'post' })
            let nextOrder = response.order
            const customerId = await resolveNewDraftCustomer()
            const hasInitialData = newDraftForm.type !== 'comanda' || newDraftForm.reference.trim() !== '' || Boolean(customerId) || newDraftForm.notes.trim() !== ''

            if (hasInitialData) {
                const payload = buildDraftPayload({ ...mapOrderToDraft(response.order), type: newDraftForm.type, reference: newDraftForm.reference.trim(), customerId: customerId ? String(customerId) : '', notes: newDraftForm.notes, items: [] })
                const savedResponse = await apiRequest(`/api/orders/${response.order.id}`, { method: 'put', data: payload })
                nextOrder = savedResponse.order
            }

            hydrateDraft(nextOrder)
            setDraftModalOpen(true)
            setNewDraftModalOpen(false)
            setListFilter('draft')
            setNewDraftForm(getInitialNewDraftForm())
            showFeedback('success', response.message)

            if (openProductsAfter) {
                setProductsModalOpen(true)
            }
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setCreatingDraft(false)
        }
    }

    function handleAddProduct(product, quantity = 1) {
        if (!currentDraft) return showFeedback('error', 'Crie ou selecione um atendimento antes de adicionar produtos.')
        const normalizedQty = normalizeQuantity(quantity, 1)
        setFeedback(null)
        setSelectedItemId(product.id)

        updateDraft((current) => {
            const existing = current.items.find((item) => item.id === product.id)
            const nextItems = existing
                ? current.items.map((item) => item.id === product.id ? { ...item, qty: Number(item.qty) + normalizedQty, stock_quantity: Number(product.stock_quantity || item.stock_quantity || 0), sale_price: Number(product.sale_price || item.sale_price || 0), lineTotal: Number(product.sale_price || item.sale_price || 0) * (Number(item.qty) + normalizedQty) } : item)
                : [...current.items, { ...product, qty: normalizedQty, lineTotal: Number(product.sale_price || 0) * normalizedQty }]

            return { ...current, items: nextItems, subtotal: nextItems.reduce((sum, item) => sum + Number(item.sale_price) * Number(item.qty), 0), total: nextItems.reduce((sum, item) => sum + Number(item.sale_price) * Number(item.qty), 0) }
        })
    }

    function handleQuantityChange(productId, value) {
        updateDraft((current) => {
            const quantity = normalizeQuantity(value, 1)
            const nextItems = current.items.map((item) => item.id === productId ? { ...item, qty: quantity, lineTotal: Number(item.sale_price) * quantity } : item)
            return { ...current, items: nextItems, subtotal: nextItems.reduce((sum, item) => sum + Number(item.sale_price) * Number(item.qty), 0), total: nextItems.reduce((sum, item) => sum + Number(item.sale_price) * Number(item.qty), 0) }
        })
    }

    function handleRemove(productId) {
        updateDraft((current) => {
            const nextItems = current.items.filter((item) => item.id !== productId)
            return { ...current, items: nextItems, subtotal: nextItems.reduce((sum, item) => sum + Number(item.sale_price) * Number(item.qty), 0), total: nextItems.reduce((sum, item) => sum + Number(item.sale_price) * Number(item.qty), 0) }
        })
    }

    async function handleSendToCashier() {
        if (!currentDraft) return
        setSendingDraft(true)
        setFeedback(null)
        try {
            await saveDraftNow(currentDraft)
            const response = await apiRequest(`/api/orders/${currentDraft.id}/send-to-cashier`, { method: 'post' })
            hydrateDraft(response.order)
            setListFilter('sent_to_cashier')
            setDraftModalOpen(false)
            showFeedback('success', response.message)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSendingDraft(false)
        }
    }

    async function handleDeleteDraft() {
        if (!currentDraft?.id) return
        if (!window.confirm(`Remover o atendimento "${currentDraft.label}"?`)) return

        const draftId = Number(currentDraft.id)
        setDeletingDraft(true)
        setFeedback(null)

        try {
            clearTimeout(saveTimeoutRef.current)
            await apiRequest(`/api/orders/${draftId}`, { method: 'delete' })

            setDrafts((current) => current.filter((draft) => Number(draft.id) !== draftId))
            lastSavedSignatureRef.current = null
            setCurrentDraft(null)
            setSelectedItemId(null)
            setDraftModalOpen(false)
            setProductsModalOpen(false)
            setTransferModalOpen(false)
            setDiscountModalOpen(false)
            setCheckoutModalOpen(false)
            setQuantityModalOpen(false)
            setPartialCheckoutModalOpen(false)
            setDeliveryModalOpen(false)
            updateDraftUrl(null)
            resetCheckoutState('')
            showFeedback('success', 'Atendimento removido com sucesso.')
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setDeletingDraft(false)
        }
    }

    async function handlePrintDraft() {
        if (!currentDraft) return
        const printWindow = window.open('', '_blank', 'width=760,height=900')
        if (!printWindow) return showFeedback('error', 'O navegador bloqueou a janela de impressao.')

        setPrintingDraft(true)
        try {
            await saveDraftNow(currentDraft)
            printWindow.document.open()
            printWindow.document.write(buildPrintMarkup({ draft: currentDraft, customer: selectedCustomer, statusLabel: currentDraftStatus?.label || 'Em aberto' }))
            printWindow.document.close()
            printWindow.focus()
            printWindow.onafterprint = () => printWindow.close()
            setTimeout(() => printWindow.print(), 150)
        } catch (error) {
            printWindow.close()
            showFeedback('error', error.message)
        } finally {
            setPrintingDraft(false)
        }
    }

    function handleNewDraftCustomerInput(value) {
        const normalized = value.trim().toLowerCase()
        const exactMatch = customerOptions.find((customer) => String(customer.name).trim().toLowerCase() === normalized)
        setNewDraftForm((current) => ({ ...current, customerName: value, customerId: exactMatch ? String(exactMatch.id) : '' }))
    }

    async function handleSidebarNavigate(path) {
        try {
            if (currentDraft) await saveDraftNow(currentDraft)
        } catch {
            return
        }
        router.get(path)
    }

    async function handleFinalizeCheckout() {
        if (!currentDraft?.items.length) return showFeedback('error', 'Adicione ao menos um produto antes de finalizar o pedido.')
        if (resolvedPaymentMethod === 'credit' && !selectedCustomer) return showFeedback('error', 'Selecione um cliente para registrar o atendimento a prazo.')
        if (resolvedPaymentMethod === 'cash' && cashReceived !== '' && cashShortfall > 0.009) return showFeedback('error', 'O valor em dinheiro precisa cobrir o total do atendimento.')

        setSubmittingCheckout(true)
        setFeedback(null)
        try {
            await saveDraftNow(currentDraft)
            const response = await apiRequest('/api/pdv/sales', {
                method: 'post',
                data: {
                    order_draft_id: currentDraft.id,
                    customer_id: currentDraft.customerId ? Number(currentDraft.customerId) : null,
                    discount: pricing.discount,
                    notes: currentDraft.notes || null,
                    items: pricing.items.map((item) => ({ id: item.id, qty: Number(item.qty), discount: Number(item.lineDiscount || 0) })),
                    payments: [{ method: resolvedPaymentMethod, amount: pricing.total }],
                },
            })

            setDrafts((current) => current.filter((draft) => Number(draft.id) !== Number(currentDraft.id)))
            clearTimeout(saveTimeoutRef.current)
            setCurrentDraft(null)
            setSelectedItemId(null)
            setDraftModalOpen(false)
            setCheckoutModalOpen(false)
            setDiscountModalOpen(false)
            updateDraftUrl(null)
            resetCheckoutState('')
            showFeedback('success', `Venda ${response.sale.sale_number} finalizada com sucesso.`)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmittingCheckout(false)
        }
    }

    async function handleFinalizePartialCheckout({ resolvedPaymentMethod: method, cashShortfall: shortfall, cashReceived: received, pricing: partialPricing, items }) {
        if (!currentDraft?.items.length) return showFeedback('error', 'Adicione ao menos um produto antes de finalizar o pedido.')
        if (!items?.length || partialPricing.total <= 0) return showFeedback('error', 'Selecione ao menos um item para cobrar.')
        if (method === 'credit' && !selectedCustomer) return showFeedback('error', 'Selecione um cliente para registrar o atendimento a prazo.')
        if (method === 'cash' && received !== '' && shortfall > 0.009) return showFeedback('error', 'O valor em dinheiro precisa cobrir o total parcial selecionado.')

        setSubmittingPartialCheckout(true)
        setFeedback(null)
        try {
            await saveDraftNow(currentDraft)
            const response = await apiRequest(`/api/orders/${currentDraft.id}/partial-checkout`, {
                method: 'post',
                data: {
                    customer_id: currentDraft.customerId ? Number(currentDraft.customerId) : null,
                    discount: partialPricing.discount,
                    notes: currentDraft.notes || null,
                    items: items.map((item) => ({ id: item.id, qty: Number(item.qty), discount: Number(item.lineDiscount || 0) })),
                    payments: [{ method, amount: partialPricing.total }],
                },
            })

            hydrateDraft(response.order)
            setDraftModalOpen(true)
            setCheckoutModalOpen(false)
            setPartialCheckoutModalOpen(false)
            showFeedback('success', response.message || `Venda ${response.sale?.sale_number || ''} finalizada com sucesso.`)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmittingPartialCheckout(false)
        }
    }

    async function handleCreateDelivery(form) {
        if (!currentDraft) return

        setSubmittingDelivery(true)
        setFeedback(null)
        try {
            await saveDraftNow(currentDraft)
            const response = await apiRequest(`/api/delivery/orders/${currentDraft.id}/from-draft`, {
                method: 'post',
                data: {
                    customer_id: currentDraft.customerId ? Number(currentDraft.customerId) : null,
                    channel: form.channel,
                    reference: form.reference || null,
                    recipient_name: form.recipient_name || null,
                    phone: form.phone || null,
                    courier_name: form.courier_name || null,
                    address: form.address,
                    neighborhood: form.neighborhood || null,
                    delivery_fee: Number(form.delivery_fee || 0),
                    notes: form.notes || null,
                },
            })

            setDeliveryModalOpen(false)
            setDeliveriesModalOpen(true)
            showFeedback('success', response.message)
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmittingDelivery(false)
        }
    }

    function handleApplyDiscount(event) {
        event.preventDefault()
        if (!currentDraft?.items?.length) return void setDiscountModalOpen(false)

        if (discountDraft.mode === 'percent') {
            const percent = Number(discountDraft.percent || 0)
            if (percent <= 0 || percent > 100) return showFeedback('error', 'Informe um percentual valido entre 0,01 e 100.')
            setDiscountConfig({ type: 'percent', percent: roundCurrency(percent) })
            setDiscountModalOpen(false)
            return showFeedback('success', 'Desconto percentual aplicado no atendimento.')
        }

        if (discountDraft.mode === 'target_total') {
            const targetTotal = roundCurrency(discountDraft.targetTotal)
            if (targetTotal < 0 || targetTotal >= pricing.subtotal) return showFeedback('error', 'Informe um valor final menor que o subtotal atual do atendimento.')
            setDiscountConfig({ type: 'target_total', targetTotal })
            setDiscountModalOpen(false)
            return showFeedback('success', 'Desconto por valor final aplicado no atendimento.')
        }

        if (discountDraft.mode === 'item') {
            const item = currentDraft.items.find((entry) => String(entry.id) === String(discountDraft.itemId))
            if (!item) return showFeedback('error', 'Selecione um item valido para aplicar o desconto.')
            const itemSubtotal = roundCurrency(Number(item.sale_price) * Number(item.qty))

            if (discountDraft.itemDiscountType === 'percent') {
                const percent = Number(discountDraft.itemPercent || 0)
                if (percent <= 0 || percent > 100) return showFeedback('error', 'Informe um percentual valido para o desconto do item.')
                setDiscountConfig({ type: 'item', itemId: String(item.id), itemDiscountType: 'percent', value: roundCurrency(percent) })
                setDiscountModalOpen(false)
                return showFeedback('success', `Desconto aplicado ao item ${item.name}.`)
            }

            const amount = roundCurrency(discountDraft.itemValue)
            if (amount <= 0 || amount > itemSubtotal) return showFeedback('error', 'Informe um desconto menor ou igual ao total do item selecionado.')
            setDiscountConfig({ type: 'item', itemId: String(item.id), itemDiscountType: 'value', value: amount })
            setDiscountModalOpen(false)
            showFeedback('success', `Desconto aplicado ao item ${item.name}.`)
        }
    }

    return (
        <AppLayout title="Pedidos">
            <div className="orders-screen">
                {feedback ? (
                    <div className={`ui-alert ${feedback.type}`}>
                        <i className={`fa-solid ${feedback.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}`} />
                        <div>
                            <strong>{feedback.type === 'error' ? 'Nao foi possivel concluir a acao' : 'Atualizacao realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <div className={`orders-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                    <aside className={`orders-tools ${sidebarCollapsed ? 'collapsed' : ''}`}>
                        <div className="orders-tools-head">
                            {!sidebarCollapsed ? (
                                <div>
                                    <span className="orders-page-kicker">Ferramentas</span>
                                    <strong>Atendimentos</strong>
                                    <small>Fluxo rapido e centralizado.</small>
                                </div>
                            ) : null}
                            <button
                                type="button"
                                className="orders-tools-toggle ui-tooltip"
                                data-tooltip={sidebarCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
                                onClick={() => setSidebarCollapsed((current) => !current)}
                            >
                                <i className={`fa-solid ${sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`} />
                            </button>
                        </div>

                        <div className="orders-tools-nav">
                            <SidebarToolButton
                                icon="fa-plus"
                                label="Novo atendimento"
                                hint="Abrir cadastro rapido"
                                active={newDraftModalOpen}
                                collapsed={sidebarCollapsed}
                                tone="primary"
                                onClick={() => {
                                    setNewDraftForm(getInitialNewDraftForm())
                                    setNewDraftModalOpen(true)
                                }}
                            />
                            <SidebarToolButton
                                icon="fa-magnifying-glass"
                                label="Pesquisar atendimento"
                                hint="Buscar entre as ativas"
                                active={searchModalOpen}
                                collapsed={sidebarCollapsed}
                                tone="neutral"
                                onClick={() => setSearchModalOpen(true)}
                            />
                            <SidebarToolButton
                                icon="fa-list-check"
                                label="Abertos"
                                hint={`${draftOnlyCount} em atendimento`}
                                active={listFilter === 'draft'}
                                collapsed={sidebarCollapsed}
                                tone="success"
                                onClick={() => setListFilter('draft')}
                            />
                            <SidebarToolButton
                                icon="fa-receipt"
                                label="Prontos"
                                hint={`${cashierCount} no caixa`}
                                active={listFilter === 'sent_to_cashier'}
                                collapsed={sidebarCollapsed}
                                tone="warning"
                                onClick={() => setListFilter('sent_to_cashier')}
                            />
                            {canOpenReports ? (
                                <SidebarToolButton
                                    icon="fa-chart-line"
                                    label="Relatorios"
                                    hint="Abrir painel analitico"
                                    collapsed={sidebarCollapsed}
                                    tone="info"
                                    onClick={() => handleSidebarNavigate('/relatorios')}
                                />
                            ) : null}
                        </div>

                        {!sidebarCollapsed ? (
                            <div className="orders-tools-foot">
                                <div className="orders-tools-foot-card">
                                    <span>Salvamento</span>
                                    <strong>{savingDraft ? 'Sincronizando...' : 'Automatico'}</strong>
                                    <small>{currentDraft ? currentDraftSaveText : 'Abra um atendimento para editar.'}</small>
                                </div>
                            </div>
                        ) : null}
                    </aside>

                    <section className="orders-stage">
                        <header className="orders-stage-header">
                            <div>
                                <span className="orders-page-kicker">Area principal</span>
                                <h1>{activeFilterMeta.title}</h1>
                            </div>
                            <div className="orders-stage-stats">
                                <div className="orders-stage-stat">
                                    <small>Ativas</small>
                                    <strong>{drafts.length}</strong>
                                    <span>registros em andamento</span>
                                </div>
                                <div className="orders-stage-stat">
                                    <small>Clientes</small>
                                    <strong>{identifiedCustomersCount}</strong>
                                    <span>com cadastro vinculado</span>
                                </div>
                                <div className="orders-stage-stat">
                                    <small>No caixa</small>
                                    <strong>{cashierCount}</strong>
                                    <span>aguardando fechamento</span>
                                </div>
                            </div>
                        </header>

                        {filteredDrafts.length ? (
                            <div className="orders-stage-grid">
                                {filteredDrafts.map((draft) => {
                                    const statusMeta = getOrderStatusMeta(draft.status)
                                    const isCurrent = Number(currentDraft?.id) === Number(draft.id)

                                    return (
                                        <button
                                            key={draft.id}
                                            type="button"
                                            className={`orders-order-card ${isCurrent ? 'active' : ''}`}
                                            onClick={() => openDraft(draft.id)}
                                            disabled={loadingDraft}
                                        >
                                            <div className="orders-order-card-top">
                                                <div>
                                                    <span className="orders-order-card-type">{getOrderTypeLabel(draft.type)}</span>
                                                    <strong className="orders-order-card-number">{getDraftNumberLabel(draft)}</strong>
                                                </div>
                                                <span className={`ui-badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                                            </div>

                                            <div className="orders-order-card-body">
                                                <div className="orders-order-card-main">
                                                    <span className="orders-order-card-label">{draft.label}</span>
                                                    <strong>{draft.customer?.name || 'Cliente nao identificado'}</strong>
                                                    <small>{draft.created_by ? `Lancado por ${draft.created_by}` : 'Sem operador informado'}</small>
                                                </div>

                                                <div className="orders-order-card-metrics">
                                                    <div>
                                                        <span>Valor parcial</span>
                                                        <strong>{formatMoney(draft.total)}</strong>
                                                    </div>
                                                    <div>
                                                        <span>Itens</span>
                                                        <strong>{draft.items_count}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="orders-order-card-footer">
                                                <span>
                                                    <i className="fa-regular fa-clock" />
                                                    {formatElapsedTime(draft.updated_at, clock)}
                                                </span>
                                                <span>
                                                    <i className="fa-solid fa-arrow-up-right-from-square" />
                                                    Abrir popup
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <section className="orders-empty-state ui-card">
                                <div className="ui-card-body">
                                    <span className="orders-page-kicker">Fila vazia</span>
                                    <h2>Nenhum atendimento neste recorte</h2>
                                    <p>
                                        {listFilter === 'draft'
                                            ? 'Abra um novo atendimento ou pesquise um existente.'
                                            : 'Nao ha itens aguardando cobranca agora.'}
                                    </p>
                                    <div className="orders-empty-state-actions">
                                        <button type="button" className="ui-button" onClick={() => setNewDraftModalOpen(true)}>
                                            <i className="fa-solid fa-plus" />
                                            Novo atendimento
                                        </button>
                                        <button type="button" className="ui-button-ghost" onClick={() => setSearchModalOpen(true)}>
                                            <i className="fa-solid fa-magnifying-glass" />
                                            Pesquisar
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}
                    </section>
                </div>

                {draftModalOpen ? (
                    <OrderDetailModal
                        draft={currentDraft}
                        customers={customerOptions}
                        feedback={feedback}
                        selectedCustomer={selectedCustomer}
                        selectedItem={selectedItem}
                        selectedItemId={selectedItemId}
                        setSelectedItemId={setSelectedItemId}
                        pricing={pricing}
                        currentDraftStatus={currentDraftStatus}
                        currentDraftSaveText={currentDraftSaveText}
                        clock={clock}
                        printingDraft={printingDraft}
                        sendingDraft={sendingDraft}
                        deletingDraft={deletingDraft}
                        onClose={() => setDraftModalOpen(false)}
                        onOpenProductsModal={() => currentDraft ? setProductsModalOpen(true) : showFeedback('error', 'Crie ou selecione um atendimento antes de abrir os produtos.')}
                        onOpenQuantityModal={() => selectedItem ? (setQuantityDraft(String(selectedItem.qty)), setQuantityModalOpen(true)) : showFeedback('error', 'Selecione um item do atendimento para ajustar a quantidade.')}
                        onOpenTransferModal={() => currentDraft && (setTransferForm({ type: currentDraft.type, reference: currentDraft.reference, customerId: currentDraft.customerId, notes: currentDraft.notes }), setTransferModalOpen(true))}
                        onOpenDiscountModal={() => currentDraft?.items?.length ? (setDiscountDraft(buildDiscountDraft(discountConfig, String(selectedItemId ?? currentDraft.items[0]?.id ?? ''))), setDiscountModalOpen(true)) : showFeedback('error', 'Adicione ao menos um produto antes de aplicar desconto.')}
                        onOpenCheckoutModal={() => currentDraft?.items?.length ? setCheckoutModalOpen(true) : showFeedback('error', 'Adicione ao menos um produto antes de finalizar o pedido.')}
                        onOpenDeliveryModal={() => setDeliveryModalOpen(true)}
                        onPrintDraft={handlePrintDraft}
                        onSendToCashier={handleSendToCashier}
                        onDeleteDraft={handleDeleteDraft}
                        onQuantityChange={handleQuantityChange}
                        onRemoveItem={handleRemove}
                        onCustomerChange={(value) => updateDraft((current) => ({ ...current, customerId: value }))}
                    />
                ) : null}

                {productsModalOpen ? (
                    <OrderProductModal
                        draft={currentDraft}
                        categories={categories}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        searchInputRef={searchInputRef}
                        productQuickQty={productQuickQty}
                        setProductQuickQty={setProductQuickQty}
                        loadingProducts={loadingProducts}
                        products={products}
                        onResetProductFilters={() => {
                            setSearchTerm('')
                            setSelectedCategory('')
                            setProducts([])
                        }}
                        onAddProduct={(product) => handleAddProduct(product, productQuickQty)}
                        onClose={() => setProductsModalOpen(false)}
                    />
                ) : null}

                {newDraftModalOpen ? (
                    <OrderDraftFormModal
                        form={newDraftForm}
                        setForm={setNewDraftForm}
                        creatingDraft={creatingDraft}
                        customerSuggestions={newDraftCustomerSuggestions}
                        customerInputRef={newDraftCustomerInputRef}
                        onCustomerInput={handleNewDraftCustomerInput}
                        onPickCustomer={(customer) => setNewDraftForm((current) => ({ ...current, customerName: customer.name, customerId: String(customer.id) }))}
                        onClose={() => setNewDraftModalOpen(false)}
                        onSubmit={handleCreateDraft}
                        onSubmitAndAddProducts={() => handleCreateDraft(null, { openProductsAfter: true })}
                    />
                ) : null}

                {searchModalOpen ? (
                    <OrderSearchModal
                        term={searchDraftTerm}
                        setTerm={setSearchDraftTerm}
                        inputRef={searchDraftInputRef}
                        results={searchResults}
                        onClose={() => setSearchModalOpen(false)}
                        onOpenDraft={async (draft) => {
                            setSearchModalOpen(false)
                            setListFilter(draft.status === 'sent_to_cashier' ? 'sent_to_cashier' : 'draft')
                            await openDraft(draft.id)
                        }}
                    />
                ) : null}

                {transferModalOpen ? (
                    <OrderTransferModal
                        form={transferForm}
                        setForm={setTransferForm}
                        customers={customerOptions}
                        onClose={() => setTransferModalOpen(false)}
                        onSubmit={(event) => {
                            event.preventDefault()
                            updateDraft((current) => ({ ...current, type: transferForm.type, reference: transferForm.reference, customerId: transferForm.customerId, notes: transferForm.notes }))
                            setTransferModalOpen(false)
                            showFeedback('success', 'Dados do atendimento atualizados.')
                        }}
                    />
                ) : null}

                {quantityModalOpen ? (
                    <OrderQuantityModal
                        item={selectedItem}
                        quantityDraft={quantityDraft}
                        setQuantityDraft={setQuantityDraft}
                        inputRef={quantityInputRef}
                        onClose={() => setQuantityModalOpen(false)}
                        onSubmit={(event) => {
                            event.preventDefault()
                            if (selectedItem) handleQuantityChange(selectedItem.id, quantityDraft)
                            setQuantityModalOpen(false)
                        }}
                    />
                ) : null}

                {discountModalOpen ? (
                    <OrderDiscountModal
                        draft={currentDraft}
                        discountDraft={discountDraft}
                        setDiscountDraft={setDiscountDraft}
                        discountPreview={discountPreview}
                        onClose={() => setDiscountModalOpen(false)}
                        onClearDiscount={() => {
                            setDiscountConfig({ type: 'none' })
                            setDiscountDraft(buildDiscountDraft({ type: 'none' }, String(selectedItemId ?? currentDraft?.items?.[0]?.id ?? '')))
                            setFeedback(null)
                        }}
                        onApplyDiscount={handleApplyDiscount}
                    />
                ) : null}

                {checkoutModalOpen ? (
                    <OrderCheckoutModal
                        draft={currentDraft}
                        feedback={feedback}
                        selectedCustomer={selectedCustomer}
                        pricing={pricing}
                        paymentTab={paymentTab}
                        setPaymentTab={setPaymentTab}
                        cardType={cardType}
                        setCardType={setCardType}
                        cashReceived={cashReceived}
                        setCashReceived={setCashReceived}
                        cashChange={cashChange}
                        cashShortfall={cashShortfall}
                        creditStatus={creditStatus}
                        submittingCheckout={submittingCheckout}
                        onClose={() => setCheckoutModalOpen(false)}
                        onOpenPartialCheckout={() => setPartialCheckoutModalOpen(true)}
                        onOpenDiscountModal={() => {
                            setDiscountDraft(buildDiscountDraft(discountConfig, String(selectedItemId ?? currentDraft?.items?.[0]?.id ?? '')))
                            setDiscountModalOpen(true)
                        }}
                        onConfirm={handleFinalizeCheckout}
                    />
                ) : null}

                {partialCheckoutModalOpen ? (
                    <OrderPartialCheckoutModal
                        draft={currentDraft}
                        feedback={feedback}
                        selectedCustomer={selectedCustomer}
                        discountConfig={discountConfig}
                        creditStatus={creditStatus}
                        submittingCheckout={submittingPartialCheckout}
                        onClose={() => setPartialCheckoutModalOpen(false)}
                        onConfirm={handleFinalizePartialCheckout}
                    />
                ) : null}

                {deliveryModalOpen ? (
                    <OrderDeliveryModal
                        draft={currentDraft}
                        selectedCustomer={selectedCustomer}
                        submitting={submittingDelivery}
                        onClose={() => setDeliveryModalOpen(false)}
                        onSubmit={handleCreateDelivery}
                    />
                ) : null}

                {deliveriesModalOpen ? (
                    <OrderDeliveriesModal open={deliveriesModalOpen} onClose={() => setDeliveriesModalOpen(false)} />
                ) : null}
            </div>
        </AppLayout>
    )
}
