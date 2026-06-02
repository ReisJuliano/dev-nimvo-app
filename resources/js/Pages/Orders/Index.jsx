import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AppLayout from '@/Layouts/AppLayout'
import StatusBadge from '@/Components/UI/StatusBadge'
import ActionSidebar from '@/Components/UI/ActionSidebar'
import DataTable from '@/Components/UI/DataTable'
import PageHeader from '@/Components/UI/PageHeader'
import useResetPageHistoryOnLeave from '@/hooks/useResetPageHistoryOnLeave'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import useModules from '@/hooks/useModules'
import { confirmPopup, useErrorFeedbackPopup } from '@/lib/errorPopup'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { replaceCurrentInertiaHistoryPage } from '@/lib/inertiaHistory'
import { formatMoney } from '@/lib/format'
import { hasTextSearchWildcard, matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
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

const ORDER_LIST_FILTERS = [
    { key: 'open', label: 'Abertos' },
    { key: 'preparing', label: 'Em preparo' },
    { key: 'ready', label: 'Prontos' },
    { key: 'delivered', label: 'Entregues' },
    { key: 'cancelled', label: 'Cancelados' },
]

function resolveOrdersFilter(status) {
    if (status === 'sent_to_cashier' || status === 'ready') {
        return 'ready'
    }

    if (status === 'preparing' || status === 'in_progress') {
        return 'preparing'
    }

    if (status === 'delivered') {
        return 'delivered'
    }

    if (status === 'cancelled' || status === 'canceled') {
        return 'cancelled'
    }

    return 'open'
}

function matchesOrdersDateRange(draft, range) {
    const value = String(draft.updated_at || draft.sent_to_cashier_at || draft.created_at || '').slice(0, 10)

    if (!value) {
        return true
    }

    if (range.from && value < range.from) {
        return false
    }

    if (range.to && value > range.to) {
        return false
    }

    return true
}

function resolveOrdersVisitApplied(rawUrl) {
    const fallbackSearch = typeof window !== 'undefined' ? window.location.search : ''
    const searchFragment = String(rawUrl || '').includes('?')
        ? String(rawUrl).slice(String(rawUrl).indexOf('?'))
        : fallbackSearch
    const params = new URLSearchParams(searchFragment)

    return params.has('applied') || params.has('draft')
}

function dateInput(value = new Date()) {
    return new Date(value).toISOString().slice(0, 10)
}

function currentMonthRange() {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

    return { from: dateInput(firstDay), to: dateInput(today) }
}

export default function OrdersIndex({
    categories = [],
    customers = [],
    drafts: initialDrafts = [],
    draftDetails = [],
    initialDraft,
    filters = {},
    statusCounts = null,
    productCatalog = [],
    cashRegister = null,
}) {
    const page = usePage()
    const { auth, tenant, localAgentBridge } = page.props
    const moduleState = useModules()
    const hasAppliedFilters = resolveOrdersVisitApplied(page.url)
    const defaultListRange = useMemo(() => currentMonthRange(), [])
    const initialDraftState = hasAppliedFilters && initialDraft ? mapOrderToDraft(initialDraft) : null
    const tenantId = tenant?.id
    const resolvedListSearch = hasAppliedFilters ? (filters?.search || '') : ''
    const resolvedListFrom = hasAppliedFilters ? (filters?.from || '') : defaultListRange.from
    const resolvedListTo = hasAppliedFilters ? (filters?.to || '') : defaultListRange.to
    const resolvedListRange = useMemo(
        () => ({ from: resolvedListFrom, to: resolvedListTo }),
        [resolvedListFrom, resolvedListTo],
    )

    const [customerOptions, setCustomerOptions] = useState(customers)
    const [drafts, setDrafts] = useState(sortDrafts(hasAppliedFilters ? initialDrafts : []))
    const [currentDraft, setCurrentDraft] = useState(initialDraftState)
    const [selectedItemId, setSelectedItemId] = useState(initialDraftState?.items?.[0]?.id ?? null)
    const [selectedCategory, setSelectedCategory] = useState('')
    const productSearchControl = useConfirmedSearch('')
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
    const initialListFilter = hasAppliedFilters
        ? (filters?.status || resolveOrdersFilter(initialDraft?.status))
        : 'open'
    const [listFilter, setListFilter] = useState(initialListFilter)
    const [appliedListFilter, setAppliedListFilter] = useState(hasAppliedFilters ? initialListFilter : 'open')
    const listSearchControl = useConfirmedSearch(resolvedListSearch)
    const [listRange, setListRange] = useState(resolvedListRange)
    const [appliedListRange, setAppliedListRange] = useState(
        resolvedListRange,
    )
    const [hasLoadedList, setHasLoadedList] = useState(hasAppliedFilters)
    const [selectedListDraftId, setSelectedListDraftId] = useState(null)
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
    const searchDraftControl = useConfirmedSearch('')
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
    const listSearchTerm = listSearchControl.draftValue
    const appliedListSearchTerm = listSearchControl.value
    const searchTerm = productSearchControl.draftValue
    const appliedSearchTerm = productSearchControl.value
    const searchDraftTerm = searchDraftControl.draftValue
    const appliedSearchDraftTerm = searchDraftControl.value
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })
    const saveTimeoutRef = useRef(null)
    const searchInputRef = useRef(null)
    const searchDraftInputRef = useRef(null)
    const newDraftCustomerInputRef = useRef(null)
    const quantityInputRef = useRef(null)
    const lastSavedSignatureRef = useRef(initialDraftState ? JSON.stringify(buildDraftPayload(initialDraftState)) : null)
    const deletedDraftIdsRef = useRef(new Set())

    const visibleListDrafts = useMemo(
        () => (hasLoadedList ? drafts : []),
        [drafts, hasLoadedList],
    )

    const resetHistoryEntry = useCallback(() => {
        if (typeof window === 'undefined') {
            return
        }

        const currentState = window.history.state
        const currentPage = currentState?.page
        const isEncryptedPage = typeof ArrayBuffer !== 'undefined' && currentPage instanceof ArrayBuffer

        replaceCurrentInertiaHistoryPage((page) => ({
            ...page,
            url: '/pedidos',
            props: {
                ...page.props,
                drafts: [],
                draftDetails: [],
                initialDraft: null,
                filters: {
                    applied: false,
                    search: '',
                    status: 'open',
                    from: defaultListRange.from,
                    to: defaultListRange.to,
                },
            },
        }), '/pedidos')

        if (!currentPage || isEncryptedPage) {
            window.history.replaceState(currentState, '', '/pedidos')
        }
    }, [defaultListRange.from, defaultListRange.to])

    useResetPageHistoryOnLeave(resetHistoryEntry)

    useEffect(() => {
        setDrafts(sortDrafts(hasAppliedFilters ? initialDrafts : []))
    }, [hasAppliedFilters, initialDrafts])

    useEffect(() => {
        setHasLoadedList(hasAppliedFilters)
        setListFilter(initialListFilter)
        setAppliedListFilter(hasAppliedFilters ? initialListFilter : 'open')
        setListRange(resolvedListRange)
        setAppliedListRange(resolvedListRange)

        if (!hasAppliedFilters) {
            setSelectedListDraftId(null)
            setCurrentDraft(null)
            setSelectedItemId(null)
            setDraftModalOpen(false)
        }
    }, [hasAppliedFilters, initialListFilter, resolvedListRange])

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
                    orders: hasAppliedFilters ? draftDetails : [],
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
    }, [cashRegister, categories, customers, draftDetails, hasAppliedFilters, localAgentBridge, productCatalog, tenantId])

    useEffect(() => {
        const trimmedSearchTerm = appliedSearchTerm.trim()
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
    }, [appliedSearchTerm, selectedCategory, tenantId])

    function applyProductSearch(nextValue = searchTerm) {
        return productSearchControl.apply(nextValue)
    }

    function clearProductSearch() {
        productSearchControl.clear()
        setProducts([])
        setLoadingProducts(false)
    }

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
    const normalizedListSearch = normalizeTextSearch(appliedListSearchTerm)
    const filterCounts = useMemo(
        () => ORDER_LIST_FILTERS.reduce((carry, filter) => ({
            ...carry,
            [filter.key]: statusCounts?.[filter.key] ?? visibleListDrafts.filter((draft) => resolveOrdersFilter(draft.status) === filter.key).length,
        }), {}),
        [statusCounts, visibleListDrafts],
    )
    const filteredDrafts = useMemo(() => drafts.filter((draft) => {
        if (!hasLoadedList) {
            return false
        }

        if (resolveOrdersFilter(draft.status) !== appliedListFilter) {
            return false
        }

        if (!matchesOrdersDateRange(draft, appliedListRange)) {
            return false
        }

        if (!normalizedListSearch) {
            return true
        }

        return matchesTextSearchAny([
            draft.label,
            draft.reference,
            draft.customer?.name,
            draft.created_by,
            getOrderTypeLabel(draft.type),
            getDraftNumberLabel(draft),
        ], normalizedListSearch)
    }), [appliedListFilter, appliedListRange, drafts, hasLoadedList, normalizedListSearch])
    useEffect(() => {
        if (!filteredDrafts.length) {
            setSelectedListDraftId(null)
            return
        }

        if (!filteredDrafts.some((draft) => Number(draft.id) === Number(selectedListDraftId))) {
            setSelectedListDraftId(null)
        }
    }, [filteredDrafts, selectedListDraftId])
    const filteredDraftsValue = useMemo(
        () => roundCurrency(filteredDrafts.reduce((total, draft) => total + Number(draft.total || draft.subtotal || 0), 0)),
        [filteredDrafts],
    )
    const filteredDraftsItems = useMemo(
        () => filteredDrafts.reduce((total, draft) => total + Number(draft.items_count || 0), 0),
        [filteredDrafts],
    )
    const selectedListDraft = useMemo(
        () => filteredDrafts.find((draft) => Number(draft.id) === Number(selectedListDraftId))
            || drafts.find((draft) => Number(draft.id) === Number(selectedListDraftId))
            || null,
        [drafts, filteredDrafts, selectedListDraftId],
    )
    const canAdvanceSelectedListDraft = Boolean(
        selectedListDraft
        && !['sent_to_cashier', 'ready', 'delivered', 'cancelled', 'canceled'].includes(selectedListDraft.status)
        && Number(selectedListDraft.items_count || 0) > 0,
    )
    const canCancelSelectedListDraft = Boolean(
        selectedListDraft
        && !['delivered', 'cancelled', 'canceled'].includes(selectedListDraft.status),
    )
    const searchResults = useMemo(() => {
        const normalizedTerm = normalizeTextSearch(appliedSearchDraftTerm)
        if (!normalizedTerm) return drafts.slice(0, 8)
        return drafts.filter((draft) =>
            matchesTextSearchAny(
                [draft.label, draft.reference, draft.customer?.name, draft.created_by, getOrderTypeLabel(draft.type), getDraftNumberLabel(draft)],
                normalizedTerm,
            ),
        )
    }, [appliedSearchDraftTerm, drafts])
    const newDraftCustomerSuggestions = useMemo(() => {
        const normalizedTerm = normalizeTextSearch(newDraftForm.customerName)
        if (!normalizedTerm) return []
        return customerOptions
            .filter((customer) => matchesTextSearchAny([customer.name, customer.phone], normalizedTerm))
            .slice(0, 6)
    }, [customerOptions, newDraftForm.customerName])
    const resolvedPaymentMethod = paymentTab === 'card' ? cardType : paymentTab
    const cashReceivedAmount = useMemo(() => (cashReceived === '' ? 0 : roundCurrency(cashReceived)), [cashReceived])
    const cashChange = useMemo(() => Math.max(0, roundCurrency(cashReceivedAmount - pricing.total)), [cashReceivedAmount, pricing.total])
    const cashShortfall = useMemo(() => (cashReceived === '' ? 0 : Math.max(0, roundCurrency(pricing.total - cashReceivedAmount))), [cashReceived, cashReceivedAmount, pricing.total])
    const currentDraftSaveText = currentDraft
        ? (savingDraft
            ? 'Salvando alterações...'
            : currentDraft.updatedAt
                ? `Última atualização em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(currentDraft.updatedAt))}`
                : currentDraftStatus?.description || 'Atendimento pronto para editar')
        : 'Selecione ou crie um atendimento para começar.'
    const canOpenReports =
        moduleState.isCapabilityEnabled('relatórios')
        || moduleState.isCapabilityEnabled('vendas')
        || moduleState.isCapabilityEnabled('demanda')

    function showFeedback(type, text) {
        setFeedback({ type, text })
    }

    function isDraftMarkedDeleted(draftId) {
        return draftId != null && deletedDraftIdsRef.current.has(String(draftId))
    }

    function markDraftDeleted(draftId) {
        if (draftId == null) return
        deletedDraftIdsRef.current.add(String(draftId))
    }

    function clearDraftDeletedMark(draftId) {
        if (draftId == null) return
        deletedDraftIdsRef.current.delete(String(draftId))
    }

    function updateDraftUrl(draftId) {
        if (typeof window === 'undefined') {
            return
        }

        const nextUrl = draftId ? `/pedidos?draft=${draftId}` : '/pedidos'
        const currentState = window.history.state
        const currentPage = currentState?.page
        const isEncryptedPage = typeof ArrayBuffer !== 'undefined' && currentPage instanceof ArrayBuffer

        if (currentPage && !isEncryptedPage) {
            replaceCurrentInertiaHistoryPage((page) => ({
                ...page,
                url: nextUrl,
            }), nextUrl)
            return
        }

        window.history.replaceState(currentState, '', nextUrl)
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
        if (!nextDraft?.id || isDraftMarkedDeleted(nextDraft.id)) return
        const payload = buildDraftPayload(nextDraft)
        const payloadSignature = JSON.stringify(payload)
        if (payloadSignature === lastSavedSignatureRef.current) return

        clearTimeout(saveTimeoutRef.current)
        setSavingDraft(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                if (isDraftMarkedDeleted(nextDraft.id)) return
                const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                if (isDraftMarkedDeleted(nextDraft.id)) return
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
            if (isDraftMarkedDeleted(nextDraft.id) || isDraftMarkedDeleted(response.order.id)) {
                return
            }
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
                if (isDraftMarkedDeleted(nextDraft.id)) return
                const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                if (isDraftMarkedDeleted(nextDraft.id)) return
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
        if (!nextDraft?.id || isDraftMarkedDeleted(nextDraft.id)) return
        const payload = buildDraftPayload(nextDraft)
        const payloadSignature = JSON.stringify(payload)
        if (payloadSignature === lastSavedSignatureRef.current) return

        clearTimeout(saveTimeoutRef.current)
        setSavingDraft(true)
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                if (isDraftMarkedDeleted(nextDraft.id)) return
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                    if (isDraftMarkedDeleted(nextDraft.id)) return
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
                if (isDraftMarkedDeleted(nextDraft.id) || isDraftMarkedDeleted(response.order.id)) {
                    return
                }
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
                    if (isDraftMarkedDeleted(nextDraft.id)) return
                    const offlineOrder = saveOfflineOrderDraft(tenantId, nextDraft, { userName: auth?.user?.name })
                    if (isDraftMarkedDeleted(nextDraft.id)) return
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
                if (!offlineOrder) throw new Error('Atendimento não encontrado no cache offline.')
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
        if (hasTextSearchWildcard(typedName)) return null

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
        if (hasTextSearchWildcard(typedName)) {
            showFeedback('warning', 'Use % apenas para pesquisar. Para criar cliente, digite o nome sem curinga.')
            return
        }

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
                setListFilter(resolveOrdersFilter('draft'))
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
            setListFilter(resolveOrdersFilter('draft'))
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
                setListFilter(resolveOrdersFilter('draft'))
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
        if (!currentDraft) return showFeedback('warning', 'Crie ou selecione um atendimento antes de adicionar produtos.')
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
                setListFilter(resolveOrdersFilter('sent_to_cashier'))
                setDraftModalOpen(false)
                showFeedback('warning', 'Atendimento enviado para o caixa no modo offline.')
                return
            }

            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', currentDraft.id)}/send-to-cashier`, { method: 'post' })
            upsertOrderInWorkspace(response.order)
            hydrateDraft(response.order)
            setListFilter(resolveOrdersFilter('sent_to_cashier'))
            setDraftModalOpen(false)
            showFeedback('success', response.message)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineOrder = sendOfflineOrderToCashier(tenantId, currentDraft.id)
                hydrateDraft(offlineOrder)
                setListFilter(resolveOrdersFilter('sent_to_cashier'))
                setDraftModalOpen(false)
                showFeedback('warning', 'Atendimento enviado para o caixa no modo offline.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setSendingDraft(false)
        }
    }

    async function handleAdvanceListDraft(draft = selectedListDraft) {
        if (!draft) return

        if (Number(currentDraft?.id) === Number(draft.id)) {
            await handleSendToCashier()
            return
        }

        if (['sent_to_cashier', 'ready', 'delivered', 'cancelled', 'canceled'].includes(draft.status)) {
            showFeedback('warning', 'Esse pedido ja esta na etapa mais avancada disponível nesta tela.')
            return
        }

        if (Number(draft.items_count || 0) <= 0) {
            showFeedback('warning', 'Adicione ao menos um produto antes de avancar o status do pedido.')
            return
        }

        setSendingDraft(true)
        setFeedback(null)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = sendOfflineOrderToCashier(tenantId, draft.id)
                syncDraftSummary(offlineOrder)
                setListFilter(resolveOrdersFilter(offlineOrder.status))
                showFeedback('warning', 'Pedido enviado para a proxima etapa no modo offline.')
                return
            }

            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', draft.id)}/send-to-cashier`, { method: 'post' })
            upsertOrderInWorkspace(response.order)
            syncDraftSummary(response.order)
            setListFilter(resolveOrdersFilter(response.order.status))
            showFeedback('success', response.message)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineOrder = sendOfflineOrderToCashier(tenantId, draft.id)
                syncDraftSummary(offlineOrder)
                setListFilter(resolveOrdersFilter(offlineOrder.status))
                showFeedback('warning', 'Pedido enviado para a proxima etapa no modo offline.')
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
        markDraftDeleted(draftId)

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
                clearDraftDeletedMark(draftId)
                showFeedback('error', error.message)
            }
        } finally {
            setDeletingDraft(false)
        }
    }

    async function handleCancelListDraft(draft = selectedListDraft) {
        if (!draft) return

        if (Number(currentDraft?.id) === Number(draft.id)) {
            await handleDeleteDraft()
            return
        }

        const confirmed = await confirmPopup({
            type: 'warning',
            title: 'Cancelar pedido',
            message: `O cancelamento será tratado como exclusão para o pedido "${draft.label}". Deseja continuar?`,
            confirmLabel: 'Cancelar pedido',
            cancelLabel: 'Voltar',
        })

        if (!confirmed) return

        const draftId = Number(draft.id)
        setDeletingDraft(true)
        setFeedback(null)
        markDraftDeleted(draftId)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                removeOfflineOrderDraft(tenantId, draftId)
            } else {
                await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', draftId)}`, { method: 'delete' })
                removeOrderFromWorkspace(draftId)
            }

            setDrafts((current) => current.filter((entry) => Number(entry.id) !== draftId))
            if (String(selectedListDraftId) === String(draftId)) {
                setSelectedListDraftId(null)
            }
            showFeedback(typeof navigator !== 'undefined' && navigator.onLine === false ? 'warning' : 'success', 'Pedido cancelado com sucesso.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                removeOfflineOrderDraft(tenantId, draftId)
                setDrafts((current) => current.filter((entry) => Number(entry.id) !== draftId))
                if (String(selectedListDraftId) === String(draftId)) {
                    setSelectedListDraftId(null)
                }
                showFeedback('warning', 'Pedido cancelado no modo offline.')
            } else {
                clearDraftDeletedMark(draftId)
                showFeedback('error', error.message)
            }
        } finally {
            setDeletingDraft(false)
        }
    }

    async function handlePrintDraft() {
        if (!currentDraft) return
        const printWindow = window.open('', '_blank', 'width=760,height=900')
        if (!printWindow) return showFeedback('warning', 'O navegador bloqueou a janela de impressão.')

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
        const normalized = normalizeTextSearch(value)
        const exactMatch = normalized && !hasTextSearchWildcard(normalized)
            ? customerOptions.find((customer) => String(customer.name).trim().toLowerCase() === normalized)
            : null
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

    async function handleApplyListFilters() {
        try {
            if (currentDraft) {
                await saveDraftNow(currentDraft)
            }
        } catch {
            return
        }

        const nextSearch = listSearchControl.apply()
        const params = {
            applied: 1,
            status: listFilter || 'open',
        }

        if (String(nextSearch || '').trim()) {
            params.search = String(nextSearch).trim()
        }

        if (listRange.from) {
            params.from = listRange.from
        }

        if (listRange.to) {
            params.to = listRange.to
        }

        setHasLoadedList(true)
        setAppliedListFilter(listFilter || 'open')
        setAppliedListRange({ ...listRange })
        setSelectedListDraftId(null)

        router.get('/pedidos', params, {
            preserveScroll: true,
            replace: true,
        })
    }

    async function handleResetListFilters() {
        try {
            if (currentDraft) {
                await saveDraftNow(currentDraft)
            }
        } catch {
            return
        }

        listSearchControl.clear()
        setListFilter('open')
        setAppliedListFilter('open')
        setListRange(defaultListRange)
        setAppliedListRange(defaultListRange)
        setHasLoadedList(false)
        setSelectedListDraftId(null)

        router.get('/pedidos', {}, {
            preserveScroll: true,
            replace: true,
        })
    }

    async function handleFinalizeCheckout() {
        if (!currentDraft?.items.length) return showFeedback('warning', 'Adicione ao menos um produto antes de finalizar o pedido.')
        if (resolvedPaymentMethod === 'credit' && !selectedCustomer) return showFeedback('warning', 'Selecione um cliente para registrar o atendimento a prazo.')
        if (resolvedPaymentMethod === 'cash' && cashReceived !== '' && cashShortfall > 0.009) return showFeedback('warning', 'O valor em dinheiro precisa cobrir o total do atendimento.')

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
        if (!currentDraft?.items.length) return showFeedback('warning', 'Adicione ao menos um produto antes de finalizar o pedido.')
        if (!items?.length || partialPricing.total <= 0) return showFeedback('warning', 'Selecione ao menos um item para cobrar.')
        if (method === 'credit' && !selectedCustomer) return showFeedback('warning', 'Selecione um cliente para registrar o atendimento a prazo.')
        if (method === 'cash' && received !== '' && shortfall > 0.009) return showFeedback('warning', 'O valor em dinheiro precisa cobrir o total parcial selecionado.')

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return showFeedback('warning', 'Pagamento parcial exige conexão para manter o atendimento consistente.')
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
            return showFeedback('warning', 'Delivery a partir da comanda exige conexão ativa.')
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
            if (percent <= 0 || percent > 100) return showFeedback('warning', 'Informe um percentual válido entre 0,01 e 100.')
            setDiscountConfig({ type: 'percent', percent: roundCurrency(percent) })
            setDiscountModalOpen(false)
            return showFeedback('success', 'Desconto percentual aplicado no atendimento.')
        }

        if (discountDraft.mode === 'target_total') {
            const targetTotal = roundCurrency(discountDraft.targetTotal)
            if (targetTotal < 0 || targetTotal >= pricing.subtotal) return showFeedback('warning', 'Informe um valor final menor que o subtotal atual do atendimento.')
            setDiscountConfig({ type: 'target_total', targetTotal })
            setDiscountModalOpen(false)
            return showFeedback('success', 'Desconto por valor final aplicado no atendimento.')
        }

        if (discountDraft.mode === 'item') {
            const item = currentDraft.items.find((entry) => String(entry.id) === String(discountDraft.itemId))
            if (!item) return showFeedback('warning', 'Selecione um item válido para aplicar o desconto.')
            const itemSubtotal = roundCurrency(Number(item.sale_price) * Number(item.qty))

            if (discountDraft.itemDiscountType === 'percent') {
                const percent = Number(discountDraft.itemPercent || 0)
                if (percent <= 0 || percent > 100) return showFeedback('warning', 'Informe um percentual válido para o desconto do item.')
                setDiscountConfig({ type: 'item', itemId: String(item.id), itemDiscountType: 'percent', value: roundCurrency(percent) })
                setDiscountModalOpen(false)
                return showFeedback('success', `Desconto aplicado ao item ${item.name}.`)
            }

            const amount = roundCurrency(discountDraft.itemValue)
            if (amount <= 0 || amount > itemSubtotal) return showFeedback('warning', 'Informe um desconto menor ou igual ao total do item selecionado.')
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
                            <strong>{feedback.type === 'error' ? 'Não foi possível concluir a ação' : 'Atualização realizada'}</strong>
                            <p>{feedback.text}</p>
                        </div>
                    </div>
                ) : null}

                <div className="ui-list-page-shell">
                    <div className="ui-list-page-main">
                        <PageHeader
                            title="Pedidos"
                            search={{
                                placeholder: 'Buscar por numero ou cliente',
                                value: listSearchTerm,
                                onChange: listSearchControl.setDraftValue,
                            }}
                            filters={ORDER_LIST_FILTERS.map((filter) => ({
                                ...filter,
                                value: filter.key,
                                count: filterCounts[filter.key] || 0,
                            }))}
                            activeFilter={listFilter}
                            onFilterChange={setListFilter}
                            dateRange={{
                                from: listRange.from,
                                to: listRange.to,
                                onChange: setListRange,
                            }}
                            quickDates
                            onApply={handleApplyListFilters}
                            onReset={handleResetListFilters}
                        />

                        <section className="ui-list-page-table-card">
                            <DataTable
                                columns={[
                                    {
                                        key: 'number',
                                        label: 'Numero',
                                        render: (draft) => <strong>{getDraftNumberLabel(draft)}</strong>,
                                    },
                                    {
                                        key: 'customer',
                                        label: 'Cliente',
                                        render: (draft) => draft.customer?.name || 'Cliente avulso',
                                    },
                                    {
                                        key: 'items_count',
                                        label: 'Itens',
                                        align: 'center',
                                        render: (draft) => draft.items_count || 0,
                                    },
                                    {
                                        key: 'total',
                                        label: 'Total',
                                        align: 'right',
                                        render: (draft) => <strong>{formatMoney(draft.total)}</strong>,
                                    },
                                    {
                                        key: 'type',
                                        label: 'Canal',
                                        render: (draft) => getOrderTypeLabel(draft.type),
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (draft) => {
                                            const statusMeta = getOrderStatusMeta(draft.status)
                                            return <StatusBadge compact label={statusMeta.label} tone={statusMeta.badge} />
                                        },
                                    },
                                ]}
                                rows={filteredDrafts}
                                rowKey="id"
                                selectedRowKey={selectedListDraftId}
                                onRowClick={(draft) => setSelectedListDraftId(draft.id)}
                                onRowDoubleClick={(draft) => {
                                    setSelectedListDraftId(draft.id)
                                    openDraft(draft.id)
                                }}
                                emptyMessage="Nenhum resultado encontrado. Ajuste os filtros e clique em Filtrar."
                                actions={(draft) => [
                                    {
                                        key: 'view',
                                        icon: 'fa-eye',
                                        label: 'Ver detalhes',
                                        tone: 'primary',
                                        onClick: () => openDraft(draft.id),
                                    },
                                ]}
                            />
                        </section>

                        <footer className="purchases-table-footer">
                            <span>{filteredDrafts.length} pedido(s)</span>
                            <span>{filteredDraftsItems} item(ns)</span>
                            <span>Total: <strong>{formatMoney(filteredDraftsValue)}</strong></span>
                        </footer>
                    </div>

                    <ActionSidebar
                        storageKey="orders-index"
                        actions={[
                            {
                                key: 'create',
                                icon: 'fa-plus',
                                label: 'Novo pedido',
                                tone: 'primary',
                                onClick: () => {
                                    setNewDraftForm(getInitialNewDraftForm())
                                    setNewDraftModalOpen(true)
                                },
                            },
                            {
                                key: 'view',
                                icon: 'fa-eye',
                                label: 'Ver detalhes',
                                disabled: !selectedListDraft,
                                onClick: () => selectedListDraft && openDraft(selectedListDraft.id),
                            },
                            {
                                key: 'advance',
                                icon: 'fa-play',
                                label: 'Avancar status',
                                disabled: !canAdvanceSelectedListDraft || sendingDraft,
                                onClick: () => selectedListDraft && void handleAdvanceListDraft(selectedListDraft),
                            },
                            {
                                key: 'cancel',
                                icon: 'fa-xmark',
                                label: 'Cancelar',
                                tone: 'danger',
                                dividerBefore: true,
                                disabled: !canCancelSelectedListDraft || deletingDraft,
                                onClick: () => selectedListDraft && void handleCancelListDraft(selectedListDraft),
                            },
                        ]}
                    />
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
                        onOpenProductsModal={() => currentDraft ? setProductsModalOpen(true) : showFeedback('warning', 'Crie ou selecione um atendimento antes de abrir os produtos.')}
                        onOpenQuantityModal={() => selectedItem ? (setQuantityDraft(String(selectedItem.qty)), setQuantityModalOpen(true)) : showFeedback('warning', 'Selecione um item do atendimento para ajustar a quantidade.')}
                        onOpenTransferModal={() => currentDraft && (setTransferForm({ type: currentDraft.type, reference: currentDraft.reference, customerId: currentDraft.customerId, notes: currentDraft.notes }), setTransferModalOpen(true))}
                        onOpenDiscountModal={() => currentDraft?.items?.length ? (setDiscountDraft(buildDiscountDraft(discountConfig, String(selectedItemId ?? currentDraft.items[0]?.id ?? ''))), setDiscountModalOpen(true)) : showFeedback('warning', 'Adicione ao menos um produto antes de aplicar desconto.')}
                        onOpenCheckoutModal={() => currentDraft?.items?.length ? setCheckoutModalOpen(true) : showFeedback('warning', 'Adicione ao menos um produto antes de finalizar o pedido.')}
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
                        appliedSearchTerm={appliedSearchTerm}
                        setSearchTerm={(value) => productSearchControl.setDraftValue(value)}
                        onSearchSubmit={applyProductSearch}
                        searchInputRef={searchInputRef}
                        productQuickQty={productQuickQty}
                        setProductQuickQty={setProductQuickQty}
                        loadingProducts={loadingProducts}
                        products={products}
                        onResetProductFilters={() => {
                            clearProductSearch()
                            setSelectedCategory('')
                            setProductQuickQty('1')
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
                        setTerm={(value) => searchDraftControl.setDraftValue(value)}
                        onSearchSubmit={() => searchDraftControl.apply()}
                        inputRef={searchDraftInputRef}
                        results={searchResults}
                        onClose={() => setSearchModalOpen(false)}
                        onOpenDraft={async (draft) => {
                            setSearchModalOpen(false)
                            setListFilter(resolveOrdersFilter(draft.status))
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
