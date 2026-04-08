import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import useModules from '@/hooks/useModules'
import { confirmPopup, useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { formatMoney } from '@/lib/format'
import {
    configureOfflineWorkspaceBridge,
    createOfflineCustomer,
    createOfflineOrderDraft,
    discardOfflinePendingSale,
    hasOfflineWorkspaceData,
    getOfflineOrderDetail,
    getOfflineOrderSummaries,
    getOfflinePendingCheckoutSummaries,
    getOfflineWorkspaceSnapshot,
    hydrateOfflineWorkspace,
    queueOfflineSaleFinalize,
    removeOfflineOrderDraft,
    resolveOfflineEntityId,
    saveOfflineOrderDraft,
    searchOfflineProducts,
    seedOfflineWorkspace,
    sendOfflineOrderToCashier,
    subscribeOfflineWorkspace,
    syncOfflineWorkspace,
} from '@/lib/offline/workspace'
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

export default function OrdersIndex({
    categories,
    customers,
    drafts: initialDrafts,
    draftDetails = [],
    initialDraft,
    productCatalog = [],
    cashRegister = null,
}) {
    const { auth, tenant, localAgentBridge } = usePage().props
    const moduleState = useModules()
    const initialDraftState = initialDraft ? mapOrderToDraft(initialDraft) : null
    const tenantId = tenant?.id

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
    const [creatingTransferCustomer, setCreatingTransferCustomer] = useState(false)
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
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })
    const saveTimeoutRef = useRef(null)
    const searchInputRef = useRef(null)
    const searchDraftInputRef = useRef(null)
    const newDraftCustomerInputRef = useRef(null)
    const quantityInputRef = useRef(null)
    const lastSavedSignatureRef = useRef(initialDraftState ? JSON.stringify(buildDraftPayload(initialDraftState)) : null)

    useEffect(() => {
        if (!tenantId) {
            return undefined
        }

        let cancelled = false
        let unsubscribe = () => {}

        const applyWorkspaceState = (state) => {
            setCustomerOptions(sortCustomerOptions(state.catalogs.customers))
            setDrafts(sortDrafts(getOfflineOrderSummaries(tenantId)))
            setCurrentDraft((current) => {
                if (!current) {
                    return current
                }

                const nextDetail =
                    getOfflineOrderDetail(tenantId, current.id)
                    || getOfflineOrderDetail(tenantId, resolveOfflineEntityId(tenantId, 'orders', current.id))

                return nextDetail ? mapOrderToDraft(nextDetail) : null
            })
        }

        const handleOnline = () => {
            syncOfflineWorkspace(tenantId, apiRequest).catch(() => {})
        }

        const bootstrap = async () => {
            configureOfflineWorkspaceBridge(tenantId, localAgentBridge)
            await hydrateOfflineWorkspace(tenantId).catch(() => {})

            if (cancelled) {
                return
            }

            const shouldSeedSnapshot =
                typeof navigator === 'undefined'
                || navigator.onLine !== false
                || !hasOfflineWorkspaceData(tenantId)

            if (shouldSeedSnapshot) {
                seedOfflineWorkspace(tenantId, {
                    categories,
                    customers,
                    products: productCatalog,
                    orders: draftDetails,
                    cashRegister,
                })
            }

            if (cancelled) {
                return
            }

            applyWorkspaceState(getOfflineWorkspaceSnapshot(tenantId))
            unsubscribe = subscribeOfflineWorkspace(tenantId, ({ state }) => {
                applyWorkspaceState(state)
            })
            handleOnline()
        }

        bootstrap()
        window.addEventListener('online', handleOnline)

        return () => {
            cancelled = true
            unsubscribe()
            window.removeEventListener('online', handleOnline)
        }
    }, [cashRegister, categories, customers, draftDetails, localAgentBridge, productCatalog, tenantId])

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
                    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                        setProducts(searchOfflineProducts(tenantId, {
                            term: trimmedSearchTerm,
                            categoryId: selectedCategory || undefined,
                        }))
                        return
                    }

                    const response = await apiRequest('/api/pdv/products', {
                        params: { term: trimmedSearchTerm, category_id: selectedCategory || undefined },
                    })

                    if (!ignore) {
                        setProducts(response.products)
                    }
                } catch (error) {
                    if (!ignore && tenantId && isNetworkApiError(error)) {
                        setProducts(searchOfflineProducts(tenantId, {
                            term: trimmedSearchTerm,
                            categoryId: selectedCategory || undefined,
                        }))
                    } else if (!ignore) {
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
    }, [searchTerm, selectedCategory, tenantId])

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
    const activeFilterMeta = filterMetaByStatus[listFilter] || filterMetaByStatus.draft
    const filteredDrafts = useMemo(() => drafts.filter((draft) => draft.status === listFilter), [drafts, listFilter])
    const filteredDraftsValue = useMemo(
        () => roundCurrency(filteredDrafts.reduce((total, draft) => total + Number(draft.total || draft.subtotal || 0), 0)),
        [filteredDrafts],
    )
    const filteredDraftsItems = useMemo(
        () => filteredDrafts.reduce((total, draft) => total + Number(draft.items_count || 0), 0),
        [filteredDrafts],
    )
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

    function buildResolvedDraftPayload(draft) {
        return {
            type: draft.type,
            reference: draft.reference || null,
            customer_id: draft.customerId
                ? Number(resolveOfflineEntityId(tenantId, 'customers', draft.customerId))
                : null,
            notes: draft.notes || null,
            items: draft.items.map((item) => ({
                id: Number(resolveOfflineEntityId(tenantId, 'products', item.id)),
                qty: Number(item.qty),
            })),
        }
    }

    function upsertOrderInWorkspace(order) {
        if (!tenantId) {
            return
        }

        const snapshot = getOfflineWorkspaceSnapshot(tenantId)
        const nextOrders = [
            order,
            ...snapshot.orders.details.filter((entry) => String(entry.id) !== String(order.id)),
        ]

        seedOfflineWorkspace(tenantId, {
            categories,
            customers: customerOptions,
            products: snapshot.catalogs.products.length ? snapshot.catalogs.products : productCatalog,
            orders: nextOrders,
        })
    }

    function removeOrderFromWorkspace(orderId) {
        if (!tenantId) {
            return
        }

        const snapshot = getOfflineWorkspaceSnapshot(tenantId)

        seedOfflineWorkspace(tenantId, {
            categories,
            customers: customerOptions,
            products: snapshot.catalogs.products.length ? snapshot.catalogs.products : productCatalog,
            orders: snapshot.orders.details.filter((entry) => String(entry.id) !== String(orderId)),
        })
    }

    function persistCustomersInWorkspace(nextCustomers) {
        if (!tenantId) {
            return
        }

        seedOfflineWorkspace(tenantId, {
            customers: nextCustomers,
        })
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
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                lastSavedSignatureRef.current = payloadSignature
                setCurrentDraft((current) => (
                    current && Number(current.id) === Number(nextDraft.id)
                        ? { ...current, status: offlineOrder.status, label: offlineOrder.label, subtotal: Number(offlineOrder.subtotal || 0), total: Number(offlineOrder.total || 0), updatedAt: offlineOrder.updated_at || null }
                        : current
                ))
                syncDraftSummary(offlineOrder)
                return
            }

            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', nextDraft.id)}`, {
                method: 'put',
                data: buildResolvedDraftPayload(nextDraft),
            })
            lastSavedSignatureRef.current = payloadSignature
            setCurrentDraft((current) => (
                current && Number(current.id) === Number(response.order.id)
                    ? { ...current, status: response.order.status, label: response.order.label, subtotal: Number(response.order.subtotal || 0), total: Number(response.order.total || 0), updatedAt: response.order.updated_at || null }
                    : current
            ))
            syncDraftSummary(response.order)
            upsertOrderInWorkspace(response.order)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                lastSavedSignatureRef.current = payloadSignature
                setCurrentDraft((current) => (
                    current && Number(current.id) === Number(nextDraft.id)
                        ? { ...current, status: offlineOrder.status, label: offlineOrder.label, subtotal: Number(offlineOrder.subtotal || 0), total: Number(offlineOrder.total || 0), updatedAt: offlineOrder.updated_at || null }
                        : current
                ))
                syncDraftSummary(offlineOrder)
                return
            }

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
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                    lastSavedSignatureRef.current = payloadSignature
                    setCurrentDraft((current) => (
                        current && Number(current.id) === Number(nextDraft.id)
                            ? { ...current, status: offlineOrder.status, label: offlineOrder.label, subtotal: Number(offlineOrder.subtotal || 0), total: Number(offlineOrder.total || 0), updatedAt: offlineOrder.updated_at || null }
                            : current
                    ))
                    syncDraftSummary(offlineOrder)
                    return
                }

                const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', nextDraft.id)}`, {
                    method: 'put',
                    data: buildResolvedDraftPayload(nextDraft),
                })
                lastSavedSignatureRef.current = payloadSignature
                setCurrentDraft((current) => (
                    current && Number(current.id) === Number(response.order.id)
                        ? { ...current, status: response.order.status, label: response.order.label, subtotal: Number(response.order.subtotal || 0), total: Number(response.order.total || 0), updatedAt: response.order.updated_at || null }
                        : current
                ))
                syncDraftSummary(response.order)
                upsertOrderInWorkspace(response.order)
            } catch (error) {
                if (tenantId && isNetworkApiError(error)) {
                    const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                    lastSavedSignatureRef.current = payloadSignature
                    setCurrentDraft((current) => (
                        current && Number(current.id) === Number(nextDraft.id)
                            ? { ...current, status: offlineOrder.status, label: offlineOrder.label, subtotal: Number(offlineOrder.subtotal || 0), total: Number(offlineOrder.total || 0), updatedAt: offlineOrder.updated_at || null }
                            : current
                    ))
                    syncDraftSummary(offlineOrder)
                } else {
                    showFeedback('error', error.message)
                }
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
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = getOfflineOrderDetail(tenantId, draftId)
                if (!offlineOrder) throw new Error('Atendimento nao encontrado no cache offline.')
                hydrateDraft(offlineOrder)
                setDraftModalOpen(true)
                setFeedback(null)
                return
            }

            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', draftId)}`)
            upsertOrderInWorkspace(response.order)
            hydrateDraft(response.order)
            setDraftModalOpen(true)
            setFeedback(null)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineOrder = getOfflineOrderDetail(tenantId, draftId)
                if (offlineOrder) {
                    hydrateDraft(offlineOrder)
                    setDraftModalOpen(true)
                    setFeedback(null)
                } else {
                    showFeedback('error', error.message)
                }
            } else {
                showFeedback('error', error.message)
            }
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

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            const offlineCustomer = createOfflineCustomer(tenantId, { name: typedName, phone: null })
            return Number(offlineCustomer.id)
        }

        try {
            const response = await apiRequest('/api/pdv/customers/quick', { method: 'post', data: { name: typedName, phone: null } })
            persistCustomersInWorkspace([
                ...getOfflineWorkspaceSnapshot(tenantId).catalogs.customers,
                response.customer,
            ])
            return Number(response.customer.id)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineCustomer = createOfflineCustomer(tenantId, { name: typedName, phone: null })
                return Number(offlineCustomer.id)
            }

            throw error
        }
    }

    async function handleCreateTransferCustomer(name) {
        const typedName = String(name || '').trim()
        if (!typedName) return

        const existing = customerOptions.find((customer) => String(customer.name).trim().toLowerCase() === typedName.toLowerCase())
        if (existing) {
            setTransferForm((current) => ({ ...current, customerId: String(existing.id) }))
            showFeedback('success', 'Cliente selecionado.')
            return existing
        }

        setCreatingTransferCustomer(true)
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineCustomer = createOfflineCustomer(tenantId, { name: typedName, phone: null })
                setTransferForm((current) => ({ ...current, customerId: String(offlineCustomer.id) }))
                showFeedback('warning', 'Cliente salvo no modo offline.')
                return offlineCustomer
            }

            const response = await apiRequest('/api/pdv/customers/quick', { method: 'post', data: { name: typedName, phone: null } })
            persistCustomersInWorkspace([
                ...getOfflineWorkspaceSnapshot(tenantId).catalogs.customers,
                response.customer,
            ])
            setTransferForm((current) => ({ ...current, customerId: String(response.customer.id) }))
            showFeedback('success', 'Cliente criado.')
            return response.customer
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineCustomer = createOfflineCustomer(tenantId, { name: typedName, phone: null })
                setTransferForm((current) => ({ ...current, customerId: String(offlineCustomer.id) }))
                showFeedback('warning', 'Cliente salvo no modo offline.')
                return offlineCustomer
            }

            showFeedback('error', error.message)
            return null
        } finally {
            setCreatingTransferCustomer(false)
        }
    }

    async function handleCreateDraft(event, options = {}) {
        event?.preventDefault?.()
        const openProductsAfter = Boolean(options.openProductsAfter)
        let resolvedCustomerId = null
        let initialAttributes = null
        setCreatingDraft(true)
        try {
            if (currentDraft) await saveDraftNow(currentDraft)
            resolvedCustomerId = await resolveNewDraftCustomer()
            initialAttributes = {
                type: newDraftForm.type,
                reference: newDraftForm.reference.trim(),
                customerId: resolvedCustomerId ? String(resolvedCustomerId) : '',
                notes: newDraftForm.notes,
            }

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = createOfflineOrderDraft(tenantId, initialAttributes, { userName: auth?.user?.name })
                hydrateDraft(offlineOrder)
                setDraftModalOpen(true)
                setNewDraftModalOpen(false)
                setListFilter('draft')
                setNewDraftForm(getInitialNewDraftForm())
                showFeedback('warning', 'Atendimento iniciado no modo offline.')

                if (openProductsAfter) {
                    setProductsModalOpen(true)
                }

                return
            }

            const response = await apiRequest('/api/orders', { method: 'post' })
            let nextOrder = response.order
            const hasInitialData = newDraftForm.type !== 'comanda' || newDraftForm.reference.trim() !== '' || Boolean(resolvedCustomerId) || newDraftForm.notes.trim() !== ''

            if (hasInitialData) {
                const savedResponse = await apiRequest(`/api/orders/${response.order.id}`, {
                    method: 'put',
                    data: {
                        type: initialAttributes.type,
                        reference: initialAttributes.reference || null,
                        customer_id: initialAttributes.customerId ? Number(resolveOfflineEntityId(tenantId, 'customers', initialAttributes.customerId)) : null,
                        notes: initialAttributes.notes || null,
                        items: [],
                    },
                })
                nextOrder = savedResponse.order
            }

            upsertOrderInWorkspace(nextOrder)
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
            if (tenantId && isNetworkApiError(error)) {
                const customerId = resolvedCustomerId ?? await resolveNewDraftCustomer()
                const offlineOrder = createOfflineOrderDraft(
                    tenantId,
                    initialAttributes || {
                        type: newDraftForm.type,
                        reference: newDraftForm.reference.trim(),
                        customerId: customerId ? String(customerId) : '',
                        notes: newDraftForm.notes,
                    },
                    { userName: auth?.user?.name },
                )
                hydrateDraft(offlineOrder)
                setDraftModalOpen(true)
                setNewDraftModalOpen(false)
                setListFilter('draft')
                setNewDraftForm(getInitialNewDraftForm())
                showFeedback('warning', 'Atendimento salvo no modo offline.')

                if (openProductsAfter) {
                    setProductsModalOpen(true)
                }
            } else {
                showFeedback('error', error.message)
            }
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
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = sendOfflineOrderToCashier(tenantId, currentDraft.id)
                hydrateDraft(offlineOrder)
                setListFilter('sent_to_cashier')
                setDraftModalOpen(false)
                showFeedback('warning', 'Atendimento enviado para o caixa no modo offline.')
                return
            }

            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', currentDraft.id)}/send-to-cashier`, { method: 'post' })
            upsertOrderInWorkspace(response.order)
            hydrateDraft(response.order)
            setListFilter('sent_to_cashier')
            setDraftModalOpen(false)
            showFeedback('success', response.message)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineOrder = sendOfflineOrderToCashier(tenantId, currentDraft.id)
                hydrateDraft(offlineOrder)
                setListFilter('sent_to_cashier')
                setDraftModalOpen(false)
                showFeedback('warning', 'Atendimento enviado para o caixa no modo offline.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setSendingDraft(false)
        }
    }

    async function handleDeleteDraft() {
        if (!currentDraft?.id) return

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Remover atendimento',
            message: `Remover o atendimento "${currentDraft.label}"?`,
            confirmLabel: 'Remover',
            cancelLabel: 'Cancelar',
        })

        if (!confirmed) return

        const draftId = Number(currentDraft.id)
        setDeletingDraft(true)
        setFeedback(null)

        try {
            clearTimeout(saveTimeoutRef.current)
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                removeOfflineOrderDraft(tenantId, draftId)
            } else {
                await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', draftId)}`, { method: 'delete' })
                removeOrderFromWorkspace(draftId)
            }

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
            if (tenantId && isNetworkApiError(error)) {
                removeOfflineOrderDraft(tenantId, draftId)
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
                showFeedback('warning', 'Atendimento removido no modo offline.')
            } else {
                showFeedback('error', error.message)
            }
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
            const currentCashRegisterId = getOfflineWorkspaceSnapshot(tenantId).cashRegister?.id || null
            const salePayload = {
                cash_register_id: currentCashRegisterId,
                order_draft_id: currentDraft.id,
                customer_id: currentDraft.customerId ? Number(currentDraft.customerId) : null,
                discount: pricing.discount,
                notes: currentDraft.notes || null,
                items: pricing.items.map((item) => ({
                    id: item.id,
                    qty: Number(item.qty),
                    unit_price: Number(item.sale_price || 0),
                    discount: Number(item.lineDiscount || 0),
                })),
                payments: [{ method: resolvedPaymentMethod, amount: pricing.total }],
                total: pricing.total,
                fiscal_decision: 'close',
                requested_document_model: '65',
            }

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const response = queueOfflineSaleFinalize(tenantId, salePayload, { userId: auth?.user?.id })
                removeOrderFromWorkspace(currentDraft.id)

                setDrafts((current) => current.filter((draft) => Number(draft.id) !== Number(currentDraft.id)))
                clearTimeout(saveTimeoutRef.current)
                setCurrentDraft(null)
                setSelectedItemId(null)
                setDraftModalOpen(false)
                setCheckoutModalOpen(false)
                setDiscountModalOpen(false)
                updateDraftUrl(null)
                resetCheckoutState('')
                showFeedback('warning', `Venda ${response.sale.sale_number} registrada no modo offline.`)
                return
            }

            const response = await apiRequest('/api/pdv/sales', {
                method: 'post',
                data: {
                    ...salePayload,
                    cash_register_id: salePayload.cash_register_id,
                    order_draft_id: resolveOfflineEntityId(tenantId, 'orders', currentDraft.id),
                    customer_id: currentDraft.customerId ? Number(resolveOfflineEntityId(tenantId, 'customers', currentDraft.customerId)) : null,
                    items: pricing.items.map((item) => ({
                        id: Number(resolveOfflineEntityId(tenantId, 'products', item.id)),
                        qty: Number(item.qty),
                        unit_price: Number(item.sale_price || 0),
                        discount: Number(item.lineDiscount || 0),
                    })),
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
            removeOrderFromWorkspace(currentDraft.id)
            showFeedback('success', `Venda ${response.sale.sale_number} finalizada com sucesso.`)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const currentCashRegisterId = getOfflineWorkspaceSnapshot(tenantId).cashRegister?.id || null
                const response = queueOfflineSaleFinalize(tenantId, {
                    cash_register_id: currentCashRegisterId,
                    order_draft_id: currentDraft.id,
                    customer_id: currentDraft.customerId ? Number(currentDraft.customerId) : null,
                    discount: pricing.discount,
                    notes: currentDraft.notes || null,
                    items: pricing.items.map((item) => ({
                        id: item.id,
                        qty: Number(item.qty),
                        unit_price: Number(item.sale_price || 0),
                        discount: Number(item.lineDiscount || 0),
                    })),
                    payments: [{ method: resolvedPaymentMethod, amount: pricing.total }],
                    total: pricing.total,
                    fiscal_decision: 'close',
                    requested_document_model: '65',
                }, { userId: auth?.user?.id })

                setDrafts((current) => current.filter((draft) => Number(draft.id) !== Number(currentDraft.id)))
                clearTimeout(saveTimeoutRef.current)
                setCurrentDraft(null)
                setSelectedItemId(null)
                setDraftModalOpen(false)
                setCheckoutModalOpen(false)
                setDiscountModalOpen(false)
                updateDraftUrl(null)
                resetCheckoutState('')
                removeOrderFromWorkspace(currentDraft.id)
                showFeedback('warning', `Venda ${response.sale.sale_number} registrada no modo offline.`)
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setSubmittingCheckout(false)
        }
    }

    async function handleFinalizePartialCheckout({ resolvedPaymentMethod: method, cashShortfall: shortfall, cashReceived: received, pricing: partialPricing, items }) {
        if (!currentDraft?.items.length) return showFeedback('error', 'Adicione ao menos um produto antes de finalizar o pedido.')
        if (!items?.length || partialPricing.total <= 0) return showFeedback('error', 'Selecione ao menos um item para cobrar.')
        if (method === 'credit' && !selectedCustomer) return showFeedback('error', 'Selecione um cliente para registrar o atendimento a prazo.')
        if (method === 'cash' && received !== '' && shortfall > 0.009) return showFeedback('error', 'O valor em dinheiro precisa cobrir o total parcial selecionado.')

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return showFeedback('error', 'Pagamento parcial exige conexao para manter o atendimento consistente.')
        }

        setSubmittingPartialCheckout(true)
        setFeedback(null)
        try {
            await saveDraftNow(currentDraft)
            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', currentDraft.id)}/partial-checkout`, {
                method: 'post',
                data: {
                    customer_id: currentDraft.customerId ? Number(resolveOfflineEntityId(tenantId, 'customers', currentDraft.customerId)) : null,
                    discount: partialPricing.discount,
                    notes: currentDraft.notes || null,
                    items: items.map((item) => ({ id: Number(resolveOfflineEntityId(tenantId, 'products', item.id)), qty: Number(item.qty), discount: Number(item.lineDiscount || 0) })),
                    payments: [{ method, amount: partialPricing.total }],
                },
            })

            upsertOrderInWorkspace(response.order)
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

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return showFeedback('error', 'Delivery a partir da comanda exige conexao ativa.')
        }

        setSubmittingDelivery(true)
        setFeedback(null)
        try {
            await saveDraftNow(currentDraft)
            const response = await apiRequest(`/api/delivery/orders/${resolveOfflineEntityId(tenantId, 'orders', currentDraft.id)}/from-draft`, {
                method: 'post',
                data: {
                    customer_id: currentDraft.customerId ? Number(resolveOfflineEntityId(tenantId, 'customers', currentDraft.customerId)) : null,
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

                <div className="orders-shell">
                    <section className="orders-stage">
                        <header className="orders-stage-header">
                            <div className="orders-stage-copy">
                                <span className="orders-page-kicker">Pedidos</span>
                                <h1>{activeFilterMeta.title}</h1>
                                <div className="orders-stage-stats">
                                    <div className="orders-stage-stat">
                                        <span>Em aberto</span>
                                        <strong>{draftOnlyCount}</strong>
                                    </div>
                                    <div className="orders-stage-stat">
                                        <span>No caixa</span>
                                        <strong>{cashierCount}</strong>
                                    </div>
                                    <div className="orders-stage-stat">
                                        <span>Volume</span>
                                        <strong>{formatMoney(filteredDraftsValue)}</strong>
                                    </div>
                                </div>
                            </div>
                            <div className="orders-stage-actions">
                                <div className="orders-stage-filters" role="tablist" aria-label="Filtrar pedidos">
                                    <button
                                        type="button"
                                        className={`orders-filter-pill ${listFilter === 'draft' ? 'active' : ''}`}
                                        onClick={() => setListFilter('draft')}
                                    >
                                        <span>Abertos</span>
                                        <strong>{draftOnlyCount}</strong>
                                    </button>
                                    <button
                                        type="button"
                                        className={`orders-filter-pill ${listFilter === 'sent_to_cashier' ? 'active' : ''}`}
                                        onClick={() => setListFilter('sent_to_cashier')}
                                    >
                                        <span>No caixa</span>
                                        <strong>{cashierCount}</strong>
                                    </button>
                                </div>
                                <div className="orders-stage-toolbar">
                                    <button
                                        type="button"
                                        className={`orders-icon-action ${newDraftModalOpen ? 'active' : ''} ui-tooltip`}
                                        data-tooltip="Novo atendimento"
                                        onClick={() => {
                                            setNewDraftForm(getInitialNewDraftForm())
                                            setNewDraftModalOpen(true)
                                        }}
                                    >
                                        <i className="fa-solid fa-plus" />
                                    </button>
                                    <button
                                        type="button"
                                        className={`orders-icon-action ${searchModalOpen ? 'active' : ''} ui-tooltip`}
                                        data-tooltip="Pesquisar atendimento"
                                        onClick={() => setSearchModalOpen(true)}
                                    >
                                        <i className="fa-solid fa-magnifying-glass" />
                                    </button>
                                    {canOpenReports ? (
                                        <button
                                            type="button"
                                            className="orders-icon-action ui-tooltip"
                                            data-tooltip="Relatorios"
                                            onClick={() => handleSidebarNavigate('/relatorios')}
                                        >
                                            <i className="fa-solid fa-chart-line" />
                                        </button>
                                    ) : null}
                                </div>
                                <div className="orders-stage-meta">
                                    <span>{filteredDrafts.length} ativos</span>
                                    <strong>{filteredDraftsItems} itens</strong>
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
                                                <span className="orders-order-card-type">{getOrderTypeLabel(draft.type)}</span>
                                                <span className={`ui-badge ${statusMeta.badge}`}>{statusMeta.label}</span>
                                            </div>

                                            <div className="orders-order-card-body">
                                                <div className="orders-order-card-main">
                                                    <strong className="orders-order-card-number">{getDraftNumberLabel(draft)}</strong>
                                                    <strong>{draft.customer?.name || 'Cliente avulso'}</strong>
                                                    <small>{draft.created_by || 'Sem operador'}</small>
                                                </div>

                                                <div className="orders-order-card-metrics">
                                                    <div>
                                                        <span>Total</span>
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
                                                <i className="fa-solid fa-arrow-up-right-from-square" />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <section className="orders-empty-state ui-card">
                                <div className="ui-card-body">
                                    <i className="fa-solid fa-receipt" />
                                    <h2>Sem pedidos</h2>
                                    <div className="orders-empty-state-actions">
                                        <button type="button" className="ui-button orders-empty-action orders-empty-action-primary" onClick={() => setNewDraftModalOpen(true)}>
                                            <i className="fa-solid fa-plus" />
                                            Novo
                                        </button>
                                        <button type="button" className="ui-button-ghost orders-empty-action" onClick={() => setSearchModalOpen(true)}>
                                            <i className="fa-solid fa-magnifying-glass" />
                                            Buscar
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
                            setProductQuickQty('1')
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
                        onSubmit={(event) => handleCreateDraft(event, { openProductsAfter: true })}
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
                        creatingCustomer={creatingTransferCustomer}
                        onCreateCustomer={handleCreateTransferCustomer}
                        onClose={() => setTransferModalOpen(false)}
                        onSubmit={(event) => {
                            event.preventDefault()
                            updateDraft((current) => ({ ...current, customerId: transferForm.customerId }))
                            setTransferModalOpen(false)
                            showFeedback('success', 'Cliente atualizado.')
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
