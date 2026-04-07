import { Head, usePage } from '@inertiajs/react'
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import CashierDraftPullModal from '@/Components/Pos/CashierDraftPullModal'
import PendingSaleRestoreModal from '@/Components/Pos/PendingSaleRestoreModal'
import RecommendationRail from '@/Components/Pos/RecommendationRail'
import AppLayout from '@/Layouts/AppLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import useModules from '@/hooks/useModules'
import { buildCloseCashRegisterModal, buildCloseCashRegisterRows, createOpenCashRegisterForm } from '@/lib/cashRegister'
import { formatMoney, formatNumber } from '@/lib/format'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import {
    configureOfflineWorkspaceBridge,
    createOfflineCompany,
    createOfflineCustomer,
    discardOfflinePendingSale,
    getOfflineOrderDetail,
    getOfflinePendingCheckoutSummaries,
    getOfflinePendingSale,
    getOfflineWorkspaceSnapshot,
    hydrateOfflineWorkspace,
    queueOfflineSaleFinalize,
    resolveOfflineEntityId,
    saveOfflinePendingSale,
    searchOfflineProducts,
    seedOfflineWorkspace,
    subscribeOfflineWorkspace,
    syncOfflineWorkspace,
} from '@/lib/offline/workspace'
import { buildDiscountDraft, buildPreviewConfigFromDraft, resolvePricing, roundCurrency } from '@/Pages/Orders/orderUtils'
import './pos.css'

const shortcutHints = [
    { key: 'products', keys: ['Shift', 'P'], label: 'Focar busca de produtos' },
    { key: 'customer', keys: ['Shift', 'C'], label: 'Abrir cliente' },
    { key: 'discount', keys: ['Shift', 'D'], label: 'Abrir desconto' },
    { key: 'payment', keys: ['Shift', 'F'], label: 'Abrir pagamento' },
    { key: 'cash', keys: ['Shift', 'X'], label: 'Abrir ou fechar caixa' },
    { key: 'finalize', keys: ['Shift', 'V'], label: 'Finalizar venda' },
    { key: 'escape', keys: ['Esc'], label: 'Fechar popup ativo' },
]

const footerShortcutHints = [
    { key: 'products', keys: ['Shift', 'P'], label: 'Produtos' },
    { key: 'customer', keys: ['Shift', 'C'], label: 'Cliente' },
    { key: 'discount', keys: ['Shift', 'D'], label: 'Desconto' },
    { key: 'payment', keys: ['Shift', 'F'], label: 'Pagamento' },
    { key: 'cash', keys: ['Shift', 'X'], label: 'Caixa' },
    { key: 'finalize', keys: ['Shift', 'V'], label: 'Finalizar' },
]

const shortcutActionByCode = {
    KeyP: 'products',
    KeyC: 'customer',
    KeyD: 'discount',
    KeyF: 'payment',
    KeyX: 'cash',
    KeyV: 'finalize',
}

const emptyDiscountAuthorizer = null
const initialAuthorizationForm = { authorizer_user_id: '', authorizer_password: '' }
const initialQuickCustomerForm = { name: '', phone: '', document: '', email: '' }
const initialQuickCompanyForm = { name: '', trade_name: '', document: '', email: '', state_registration: '' }
const initialManualRecipient = { name: '', document: '', email: '' }
const initialCustomerLinkForm = { name: '', document: '', email: '' }

function createEmptyRecommendations() {
    return {
        generated_at: null,
        top_sellers_context: { mode: 'recent', window_days: 30 },
        top_sellers: [],
        customer_context: null,
        customer_recommendations: [],
        association_context: null,
        associations: [],
    }
}

function normalizeRecommendations(payload) {
    const defaults = createEmptyRecommendations()

    return {
        ...defaults,
        ...payload,
        top_sellers_context: payload?.top_sellers_context || defaults.top_sellers_context,
        top_sellers: Array.isArray(payload?.top_sellers) ? payload.top_sellers : [],
        customer_context: payload?.customer_context || null,
        customer_recommendations: Array.isArray(payload?.customer_recommendations) ? payload.customer_recommendations : [],
        association_context: payload?.association_context || null,
        associations: Array.isArray(payload?.associations) ? payload.associations : [],
    }
}

function normalizeDocument(value) {
    return String(value || '').replace(/\D/g, '')
}

function resolveProductMatch(catalog, term) {
    const normalizedTerm = String(term || '').trim().toLowerCase()

    if (!normalizedTerm) {
        return null
    }

    return (
        catalog.find((product) =>
            [product.barcode, product.code]
                .filter(Boolean)
                .some((value) => String(value).trim().toLowerCase() === normalizedTerm),
        )
        || catalog.find((product) => String(product.name || '').trim().toLowerCase() === normalizedTerm)
        || catalog[0]
        || null
    )
}

function normalizeSearchValue(value) {
    return value == null || String(value).toLowerCase() === 'null' ? '' : String(value)
}

function normalizeCartItem(item) {
    return {
        ...item,
        qty: Number(item.qty ?? 1),
        cost_price: Number(item.cost_price || 0),
        sale_price: Number(item.sale_price || 0),
        stock_quantity: Number(item.stock_quantity || 0),
        lineDiscount: Number(item.lineDiscount || 0),
        lineTotal: Number(item.lineTotal || Number(item.sale_price || 0) * Number(item.qty || 0)),
    }
}

export default function PosIndex({
    categories,
    productCatalog = [],
    customers: initialCustomers,
    companies: initialCompanies,
    managers,
    supervisors = [],
    cashRegister,
    pendingOrderDrafts: initialPendingOrderDrafts,
    pendingOrderDraftDetails = [],
    preloadedOrderDraft,
    pendingSale: initialPendingSale,
    recommendations: initialRecommendations,
    posCapabilities = {},
}) {
    const { tenant, auth, localAgentBridge } = usePage().props
    const tenantId = tenant?.id
    const moduleState = useModules()
    const supportsOrders = moduleState.isCapabilityEnabled('pedidos')
    const supportsDeferredPayment = moduleState.isCapabilityEnabled('prazo')
    const supportsPendingSales = posCapabilities.pending_sales !== false
    const supportsCompanies = posCapabilities.companies !== false
    const requireCashClosingConference = moduleState.settings?.cash_closing?.require_conference !== false

    const [feedback, setFeedback] = useState(null)
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })

    const [customers, setCustomers] = useState(initialCustomers || [])
    const [companies, setCompanies] = useState(initialCompanies || [])
    const [cashRegisterState, setCashRegisterState] = useState(cashRegister)
    const [pendingOrderDrafts, setPendingOrderDrafts] = useState(initialPendingOrderDrafts || [])
    const [activeOrderDraftId, setActiveOrderDraftId] = useState(preloadedOrderDraft?.id ?? initialPendingSale?.order_draft_id ?? null)
    const [loadingOrderDraftId, setLoadingOrderDraftId] = useState(null)
    const [refreshingPendingOrders, setRefreshingPendingOrders] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [recommendations, setRecommendations] = useState(normalizeRecommendations(initialRecommendations))
    const [loadingRecommendations, setLoadingRecommendations] = useState(false)
    const [cart, setCart] = useState([])
    const [selectedCartItemId, setSelectedCartItemId] = useState(null)
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [selectedCompany, setSelectedCompany] = useState('')
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
    const [customerSearch, setCustomerSearch] = useState('')
    const [discountConfig, setDiscountConfig] = useState({ type: 'none' })
    const [discountModalOpen, setDiscountModalOpen] = useState(false)
    const [discountDraft, setDiscountDraft] = useState(buildDiscountDraft({ type: 'none' }))
    const [discountAuthorizer, setDiscountAuthorizer] = useState(emptyDiscountAuthorizer)
    const [discountAuthorizationForm, setDiscountAuthorizationForm] = useState(initialAuthorizationForm)
    const [authorizingDiscount, setAuthorizingDiscount] = useState(false)
    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [cashReceived, setCashReceived] = useState('')
    const [mixedPayments, setMixedPayments] = useState([])
    const [mixedDraft, setMixedDraft] = useState({ method: 'cash', amount: '' })
    const [paymentReady, setPaymentReady] = useState(false)
    const [fiscalDecisionOpen, setFiscalDecisionOpen] = useState(false)
    const [recipientModalOpen, setRecipientModalOpen] = useState(false)
    const [recipientDocumentModel, setRecipientDocumentModel] = useState('65')
    const [recipientSelectionMode, setRecipientSelectionMode] = useState('document')
    const [recipientSearch, setRecipientSearch] = useState('')
    const [manualRecipient, setManualRecipient] = useState(initialManualRecipient)
    const [quickCompanyForm, setQuickCompanyForm] = useState(initialQuickCompanyForm)
    const [creatingCompany, setCreatingCompany] = useState(false)
    const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
    const [quickCustomerForm, setQuickCustomerForm] = useState(initialQuickCustomerForm)
    const [creditStatus, setCreditStatus] = useState(null)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [openingCashRegister, setOpeningCashRegister] = useState(false)
    const [openCashRegisterModal, setOpenCashRegisterModal] = useState(null)
    const [loadingClosePreview, setLoadingClosePreview] = useState(false)
    const [closingCashRegister, setClosingCashRegister] = useState(false)
    const [closeCashRegisterModal, setCloseCashRegisterModal] = useState(null)
    const [cashReportModal, setCashReportModal] = useState(null)
    const [pendingSaleServerState, setPendingSaleServerState] = useState(supportsPendingSales ? (initialPendingSale || null) : null)
    const [pendingSalePromptOpen, setPendingSalePromptOpen] = useState(supportsPendingSales ? Boolean(initialPendingSale && !preloadedOrderDraft) : false)
    const [pendingSaleResolved, setPendingSaleResolved] = useState(supportsPendingSales ? (!initialPendingSale || Boolean(preloadedOrderDraft)) : true)
    const [pendingSaleActionBusy, setPendingSaleActionBusy] = useState(false)
    const [customerModalOpen, setCustomerModalOpen] = useState(false)
    const [cashierDraftsModalOpen, setCashierDraftsModalOpen] = useState(false)
    const [customerLinkForm, setCustomerLinkForm] = useState(initialCustomerLinkForm)
    const [linkingCustomer, setLinkingCustomer] = useState(false)
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
    const [invoiceChoice, setInvoiceChoice] = useState('65')
    const [cancelModalOpen, setCancelModalOpen] = useState(false)
    const [discountReason, setDiscountReason] = useState('')

    const productSearchInputRef = useRef(null)
    const deferredCustomerSearch = useDeferredValue(customerSearch)
    const deferredRecipientSearch = useDeferredValue(recipientSearch)

    const paymentOptions = useMemo(
        () =>
            [
                { value: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave' },
                { value: 'pix', label: 'Pix', icon: 'fa-qrcode' },
                { value: 'debit_card', label: 'Debito', icon: 'fa-credit-card' },
                { value: 'credit_card', label: 'Credito', icon: 'fa-credit-card' },
                { value: 'credit', label: 'A Prazo', icon: 'fa-handshake' },
                { value: 'mixed', label: 'Misto', icon: 'fa-layer-group' },
            ].filter((option) => supportsDeferredPayment || option.value !== 'credit'),
        [supportsDeferredPayment],
    )

    useEffect(() => {
        if (!tenantId) {
            return undefined
        }

        let cancelled = false
        let unsubscribe = () => {}

        const applyWorkspaceState = () => {
            const snapshot = getOfflineWorkspaceSnapshot(tenantId)
            setCustomers(snapshot.catalogs.customers)
            setCompanies(snapshot.catalogs.companies)
            setPendingOrderDrafts(getOfflinePendingCheckoutSummaries(tenantId))
            setCashRegisterState(snapshot.cashRegister)

            if (!supportsPendingSales) {
                return
            }

            const offlinePendingSale = getOfflinePendingSale(tenantId, auth?.user?.id)

            if (offlinePendingSale) {
                setPendingSaleServerState(offlinePendingSale)
                setPendingSalePromptOpen(!preloadedOrderDraft)
                setPendingSaleResolved(false)
            }
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

            seedOfflineWorkspace(tenantId, {
                categories,
                products: productCatalog,
                customers: initialCustomers,
                companies: initialCompanies,
                orders: pendingOrderDraftDetails,
                cashRegister,
                pendingSaleUserId: auth?.user?.id,
                pendingSale: initialPendingSale,
            })

            if (cancelled) {
                return
            }

            applyWorkspaceState()
            unsubscribe = subscribeOfflineWorkspace(tenantId, () => {
                applyWorkspaceState()
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
    }, [
        auth?.user?.id,
        cashRegister,
        categories,
        initialCompanies,
        initialCustomers,
        initialPendingSale,
        localAgentBridge,
        pendingOrderDraftDetails,
        preloadedOrderDraft,
        productCatalog,
        supportsPendingSales,
        tenantId,
    ])

    useEffect(() => {
        setCashRegisterState(cashRegister)
    }, [cashRegister])

    useEffect(() => {
        const hasBlockingModal = Boolean(
            paymentModalOpen
            || discountModalOpen
            || customerModalOpen
            || cashierDraftsModalOpen
            || invoiceModalOpen
            || cancelModalOpen
            || openCashRegisterModal
            || closeCashRegisterModal
            || cashReportModal
            || pendingSalePromptOpen,
        )

        if (hasBlockingModal) {
            return
        }

        const frame = requestAnimationFrame(() => {
            productSearchInputRef.current?.focus()
        })

        return () => cancelAnimationFrame(frame)
    }, [
        paymentModalOpen,
        discountModalOpen,
        customerModalOpen,
        cashierDraftsModalOpen,
        invoiceModalOpen,
        cancelModalOpen,
        openCashRegisterModal,
        closeCashRegisterModal,
        cashReportModal,
        pendingSalePromptOpen,
    ])

    useEffect(() => {
        setPendingOrderDrafts(initialPendingOrderDrafts || [])
    }, [initialPendingOrderDrafts])

    useEffect(() => {
        setRecommendations(normalizeRecommendations(initialRecommendations))
    }, [initialRecommendations])

    useEffect(() => {
        setSearchTerm(normalizeSearchValue(searchTerm))
    }, [searchTerm])

    useEffect(() => {
        if (preloadedOrderDraft) {
            applyOrderDraftToSale(preloadedOrderDraft, false)
            setPendingSalePromptOpen(false)
            setPendingSaleResolved(true)
        }
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
                if (ignore) return

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
                        setProducts(response.products || [])
                    }
                } catch (error) {
                    if (!ignore && tenantId && isNetworkApiError(error)) {
                        setProducts(searchOfflineProducts(tenantId, {
                            term: trimmedSearchTerm,
                            categoryId: selectedCategory || undefined,
                        }))
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
        if (discountConfig.type !== 'item') return

        if (!cart.some((item) => String(item.id) === String(discountConfig.itemId))) {
            setDiscountConfig({ type: 'none' })
            setDiscountAuthorizer(emptyDiscountAuthorizer)
        }
    }, [cart, discountConfig])

    useEffect(() => {
        if (!supportsOrders) return undefined

        const interval = setInterval(() => {
            refreshPendingOrderDrafts({ quiet: true })
        }, 15000)

        return () => clearInterval(interval)
    }, [supportsOrders])

    useEffect(() => {
        if (supportsDeferredPayment) return

        if (paymentMethod === 'credit') {
            setPaymentMethod('cash')
        }

        setMixedPayments((current) => current.filter((payment) => payment.method !== 'credit'))
        setMixedDraft((current) => ({
            ...current,
            method: current.method === 'credit' ? 'cash' : current.method,
        }))
        setCreditStatus(null)
    }, [paymentMethod, supportsDeferredPayment])

    useEffect(() => {
        if (supportsOrders) return

        setPendingOrderDrafts([])
        setActiveOrderDraftId(null)
    }, [supportsOrders])

    useEffect(() => {
        if (!supportsCompanies && recipientSelectionMode === 'company') {
            setRecipientSelectionMode('document')
        }
    }, [supportsCompanies, recipientSelectionMode])

    useEffect(() => {
        setPaymentReady(false)
    }, [paymentMethod, cashReceived, mixedPayments, mixedDraft, totalsKey(cart, selectedCustomer, notes, discountConfig)])

    const selectedCartItem = useMemo(
        () => cart.find((item) => item.id === selectedCartItemId) ?? null,
        [cart, selectedCartItemId],
    )

    const recommendationProductIds = useMemo(
        () => [...new Set(cart.map((item) => Number(item.id)).filter(Boolean))],
        [cart],
    )

    const recommendationSignature = useMemo(
        () => `${selectedCustomer || 'guest'}:${recommendationProductIds.join(',')}`,
        [recommendationProductIds, selectedCustomer],
    )

    const recommendationAnchorProductId = useMemo(() => {
        const selectedId = Number(selectedCartItemId || 0)

        if (selectedId && recommendationProductIds.includes(selectedId)) {
            return selectedId
        }

        return recommendationProductIds.at(-1) ?? null
    }, [selectedCartItemId, recommendationProductIds])

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

    const cashReceivedAmount = useMemo(() => (cashReceived === '' ? 0 : roundCurrency(cashReceived)), [cashReceived])
    const cashChange = useMemo(() => Math.max(0, roundCurrency(cashReceivedAmount - totals.total)), [cashReceivedAmount, totals.total])
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
        () => customers.find((customer) => String(customer.id) === String(selectedCustomer)) ?? null,
        [customers, selectedCustomer],
    )
    const selectedCompanyData = useMemo(
        () => companies.find((company) => String(company.id) === String(selectedCompany)) ?? null,
        [companies, selectedCompany],
    )

    const closeCashRegisterRows = useMemo(() => {
        if (!closeCashRegisterModal?.report) return []
        return buildCloseCashRegisterRows(closeCashRegisterModal, requireCashClosingConference)
    }, [closeCashRegisterModal, requireCashClosingConference])

    const filteredCustomers = useMemo(() => {
        const normalizedTerm = deferredCustomerSearch.trim().toLowerCase()
        if (!normalizedTerm) return customers.slice(0, 20)

        return customers.filter((customer) =>
            [customer.name, customer.phone, customer.document]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedTerm)),
        )
    }, [customers, deferredCustomerSearch])

    const filteredRecipientCustomers = useMemo(() => {
        const normalizedTerm = deferredRecipientSearch.trim().toLowerCase()
        if (!normalizedTerm) return customers.slice(0, 20)

        return customers.filter((customer) =>
            [customer.name, customer.document]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedTerm)),
        )
    }, [customers, deferredRecipientSearch])

    const filteredRecipientCompanies = useMemo(() => {
        const normalizedTerm = deferredRecipientSearch.trim().toLowerCase()
        if (!normalizedTerm) return companies.slice(0, 20)

        return companies.filter((company) =>
            [company.name, company.trade_name, company.document]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedTerm)),
        )
    }, [companies, deferredRecipientSearch])

    const currentPaymentsSummary = useMemo(() => {
        try {
            return buildPaymentsPayload().map((payment) => ({
                ...payment,
                label: paymentOptions.find((option) => option.value === payment.method)?.label || payment.method,
            }))
        } catch {
            return []
        }
    }, [paymentMethod, paymentOptions, mixedPayments, totals.total])

    useEffect(() => {
        let ignore = false

        async function fetchRecommendations({ silent = false } = {}) {
            if (!silent) {
                setLoadingRecommendations(true)
            }

            try {
                const response = await apiRequest('/api/pdv/recommendations', {
                    params: {
                        anchor_product_id: recommendationAnchorProductId || undefined,
                        customer_id: selectedCustomer || undefined,
                        exclude_product_ids: recommendationProductIds,
                    },
                })

                if (!ignore) {
                    setRecommendations(normalizeRecommendations(response.recommendations))
                }
            } catch {
                if (!ignore && !silent) {
                    setRecommendations((current) => normalizeRecommendations(current))
                }
            } finally {
                if (!ignore && !silent) {
                    setLoadingRecommendations(false)
                }
            }
        }

        fetchRecommendations()

        const interval = setInterval(() => {
            fetchRecommendations({ silent: true })
        }, 30000)

        return () => {
            ignore = true
            clearInterval(interval)
        }
    }, [recommendationAnchorProductId, recommendationSignature])

    const linkedCustomerSummary = useMemo(() => {
        if (selectedCustomerData) {
            return {
                name: selectedCustomerData.name,
                document: selectedCustomerData.document || '',
                email: selectedCustomerData.email || '',
                source: 'customer',
            }
        }

        if (manualRecipient.name || manualRecipient.document) {
            return {
                name: manualRecipient.name || 'Consumidor final',
                document: manualRecipient.document || '',
                email: manualRecipient.email || '',
                source: 'manual',
            }
        }

        return {
            name: 'Consumidor final',
            document: '',
            email: '',
            source: 'none',
        }
    }, [manualRecipient, selectedCustomerData])

    const barcodeHelperText = useMemo(() => {
        if (loadingProducts) {
            return 'Buscando produtos no catalogo...'
        }

        if (products.length) {
            return `Enter adiciona ${products[0].name}. ${products.length} resultado(s) pronto(s).`
        }

        if (searchTerm.trim()) {
            return 'Digite mais detalhes ou pressione Enter para tentar localizar o produto.'
        }

        return 'Bipe o codigo de barras ou digite o nome do produto e pressione Enter.'
    }, [loadingProducts, products, searchTerm])

    const paymentGridOptions = useMemo(
        () => [
            { value: 'debit_card', label: 'Cartao Debito', icon: 'card' },
            { value: 'credit_card', label: 'Cartao Credito', icon: 'card' },
            { value: 'cash', label: 'Dinheiro', icon: 'cash' },
            { value: 'pix', label: 'Pix', icon: 'pix' },
            supportsDeferredPayment ? { value: 'credit', label: 'A Prazo', icon: 'wallet' } : null,
            { value: 'mixed', label: 'Dividir', icon: 'split' },
        ].filter(Boolean),
        [supportsDeferredPayment],
    )

    const invoiceGridOptions = useMemo(
        () => [
            { value: '55', label: 'NF-e', icon: 'document' },
            { value: '65', label: 'NFC-e', icon: 'receipt' },
            { value: 'none', label: 'Sem comprovante', icon: 'minus' },
            { value: 'email', label: 'Email', icon: 'mail' },
        ],
        [],
    )

    const simpleDiscountValue = useMemo(() => {
        if (discountDraft.mode === 'percent') {
            return discountDraft.percent
        }

        return String(Math.max(0, roundCurrency(pricing.subtotal - Number(discountDraft.targetTotal || pricing.subtotal))))
    }, [discountDraft.mode, discountDraft.percent, discountDraft.targetTotal, pricing.subtotal])

    const flowSteps = useMemo(
        () => [
            { key: 'products', label: 'Produtos', done: cart.length > 0, active: cart.length > 0 && !paymentModalOpen && !fiscalDecisionOpen && !recipientModalOpen },
            { key: 'review', label: 'Revisao', done: cart.length > 0, active: cart.length > 0 && !paymentModalOpen && !fiscalDecisionOpen && !recipientModalOpen },
            { key: 'payment', label: 'Pagamento', done: paymentReady, active: paymentModalOpen },
            { key: 'fiscal', label: 'Decisao fiscal', done: false, active: fiscalDecisionOpen },
            { key: 'issue', label: recipientDocumentModel === '55' ? 'NF-e / DANFE' : 'Emissao', done: false, active: recipientModalOpen },
        ],
        [cart.length, paymentReady, paymentModalOpen, fiscalDecisionOpen, recipientModalOpen, recipientDocumentModel],
    )

    useEffect(() => {
        if (!supportsPendingSales) return undefined
        if (!pendingSaleResolved || submitting) return undefined

        const timeout = setTimeout(async () => {
            const offlinePayload = {
                cash_register_id: cashRegisterState?.id || null,
                order_draft_id: activeOrderDraftId || null,
                customer_id: selectedCustomer || null,
                company_id: selectedCompany || null,
                notes: notes || null,
                status: 'draft',
                cart: pricing.items.map((item) => ({ ...item, qty: Number(item.qty) })),
                discount: { config: discountConfig, authorizer: discountAuthorizer },
                payment: {
                    payment_method: paymentMethod,
                    cash_received: cashReceived === '' ? null : Number(cashReceived),
                    mixed_payments: mixedPayments,
                    mixed_draft: mixedDraft,
                },
            }

            if (!cart.length) {
                if (pendingSaleServerState) {
                    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                        discardOfflinePendingSale(tenantId, auth?.user?.id)
                        setPendingSaleServerState(null)
                        return
                    }

                    try {
                        await apiRequest('/api/pdv/pending-sale', { method: 'delete' })
                        setPendingSaleServerState(null)
                    } catch {
                        discardOfflinePendingSale(tenantId, auth?.user?.id)
                        setPendingSaleServerState(null)
                    }
                }
                return
            }

            try {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    const offlinePendingSale = saveOfflinePendingSale(tenantId, auth?.user?.id, offlinePayload)
                    setPendingSaleServerState(offlinePendingSale || null)
                    return
                }

                const response = await apiRequest('/api/pdv/pending-sale', {
                    method: 'post',
                    data: {
                        cash_register_id: cashRegisterState?.id || null,
                        order_draft_id: activeOrderDraftId ? resolveOfflineEntityId(tenantId, 'orders', activeOrderDraftId) : null,
                        customer_id: selectedCustomer ? resolveOfflineEntityId(tenantId, 'customers', selectedCustomer) : null,
                        company_id: selectedCompany ? resolveOfflineEntityId(tenantId, 'companies', selectedCompany) : null,
                        notes: offlinePayload.notes,
                        status: 'draft',
                        cart_payload: offlinePayload.cart,
                        discount_payload: offlinePayload.discount,
                        payment_payload: offlinePayload.payment,
                    },
                })

                setPendingSaleServerState(response.pending_sale || null)
            } catch {
                const offlinePendingSale = saveOfflinePendingSale(tenantId, auth?.user?.id, offlinePayload)
                setPendingSaleServerState(offlinePendingSale || null)
            }
        }, 700)

        return () => clearTimeout(timeout)
    }, [
        supportsPendingSales,
        pendingSaleResolved,
        submitting,
        cart,
        pricing.items,
        discountConfig,
        discountAuthorizer,
        paymentMethod,
        cashReceived,
        mixedPayments,
        mixedDraft,
        selectedCustomer,
        selectedCompany,
        notes,
        cashRegisterState?.id,
        activeOrderDraftId,
        auth?.user?.id,
        pendingSaleServerState,
        tenantId,
    ])

    function showFeedback(type, text) {
        setFeedback({ type, text })
    }

    function persistCustomersInWorkspace(nextCustomers) {
        if (!tenantId) {
            return
        }

        seedOfflineWorkspace(tenantId, {
            customers: nextCustomers,
        })
    }

    function persistCompaniesInWorkspace(nextCompanies) {
        if (!tenantId) {
            return
        }

        seedOfflineWorkspace(tenantId, {
            companies: nextCompanies,
        })
    }

    function closeCustomerPicker() {
        setCustomerPickerOpen(false)
        setCustomerSearch('')
    }

    function resetSale() {
        setCart([])
        setSelectedCartItemId(null)
        setSelectedCustomer('')
        setSelectedCompany('')
        setDiscountConfig({ type: 'none' })
        setDiscountDraft(buildDiscountDraft({ type: 'none' }))
        setDiscountAuthorizer(emptyDiscountAuthorizer)
        setDiscountAuthorizationForm(initialAuthorizationForm)
        setPaymentMethod('cash')
        setCashReceived('')
        setMixedPayments([])
        setMixedDraft({ method: 'cash', amount: '' })
        setPaymentReady(false)
        setFiscalDecisionOpen(false)
        setRecipientModalOpen(false)
        setRecipientDocumentModel('65')
        setRecipientSelectionMode('document')
        setManualRecipient(initialManualRecipient)
        setQuickCompanyForm(initialQuickCompanyForm)
        setNotes('')
        setCreditStatus(null)
        setActiveOrderDraftId(null)
        setPendingSaleServerState(null)
        setCustomerLinkForm(initialCustomerLinkForm)
        setCustomerModalOpen(false)
        setCashierDraftsModalOpen(false)
        setInvoiceChoice('65')
        setInvoiceModalOpen(false)
        setCancelModalOpen(false)
        setDiscountReason('')
    }

    function applyOrderDraftToSale(orderDraft, showLoadedFeedback = true) {
        const orderItems = (orderDraft.items || []).map((item) => normalizeCartItem(item))

        setCart(orderItems)
        setSelectedCartItemId(orderItems[0]?.id ?? null)
        setSelectedCustomer(orderDraft.customer?.id ? String(orderDraft.customer.id) : '')
        setSelectedCompany('')
        setDiscountConfig({ type: 'none' })
        setDiscountAuthorizer(emptyDiscountAuthorizer)
        setDiscountDraft(buildDiscountDraft({ type: 'none' }, String(orderItems[0]?.id ?? '')))
        setPaymentMethod('cash')
        setCashReceived('')
        setMixedPayments([])
        setMixedDraft({ method: 'cash', amount: '' })
        setNotes(orderDraft.notes || '')
        setCreditStatus(null)
        setActiveOrderDraftId(orderDraft.id)
        setPendingSaleResolved(true)
        setPendingSalePromptOpen(false)
        setPendingSaleServerState(null)
        setFeedback(showLoadedFeedback ? { type: 'success', text: `${orderDraft.label} carregado para cobranca.` } : null)
    }

    function applyPendingSale(pendingSale) {
        const pendingItems = (pendingSale?.cart || []).map((item) => normalizeCartItem(item))

        setCart(pendingItems)
        setSelectedCartItemId(pendingItems[0]?.id ?? null)
        setSelectedCustomer(pendingSale?.customer_id ? String(pendingSale.customer_id) : '')
        setSelectedCompany(pendingSale?.company_id ? String(pendingSale.company_id) : '')
        setDiscountConfig(pendingSale?.discount?.config || { type: 'none' })
        setDiscountAuthorizer(pendingSale?.discount?.authorizer || emptyDiscountAuthorizer)
        setDiscountDraft(buildDiscountDraft(pendingSale?.discount?.config || { type: 'none' }, String(pendingItems[0]?.id ?? '')))
        setPaymentMethod(pendingSale?.payment?.payment_method || 'cash')
        setCashReceived(pendingSale?.payment?.cash_received == null ? '' : String(pendingSale.payment.cash_received))
        setMixedPayments(pendingSale?.payment?.mixed_payments || [])
        setMixedDraft(pendingSale?.payment?.mixed_draft || { method: 'cash', amount: '' })
        setNotes(pendingSale?.notes || '')
        setActiveOrderDraftId(pendingSale?.order_draft_id || null)
        setPendingSaleServerState(pendingSale || null)
        setPendingSaleResolved(true)
        setPendingSalePromptOpen(false)
        showFeedback('success', 'Venda pendente restaurada com sucesso.')
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
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                setPendingOrderDrafts(getOfflinePendingCheckoutSummaries(tenantId))
                return
            }

            const response = await apiRequest('/api/orders/pending-checkout')
            setPendingOrderDrafts(response.orders || [])
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                setPendingOrderDrafts(getOfflinePendingCheckoutSummaries(tenantId))
            } else if (!quiet) {
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
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = getOfflineOrderDetail(tenantId, orderDraftId)
                if (!offlineOrder) throw new Error('Pedido nao encontrado no cache offline.')
                applyOrderDraftToSale(offlineOrder)
                setCashierDraftsModalOpen(false)
                return
            }

            const response = await apiRequest(`/api/orders/${resolveOfflineEntityId(tenantId, 'orders', orderDraftId)}`)
            applyOrderDraftToSale(response.order)
            setCashierDraftsModalOpen(false)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineOrder = getOfflineOrderDetail(tenantId, orderDraftId)
                if (offlineOrder) {
                    applyOrderDraftToSale(offlineOrder)
                    setCashierDraftsModalOpen(false)
                } else {
                    showFeedback('error', error.message)
                }
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setLoadingOrderDraftId(null)
        }
    }

    function openCashierDraftsModal() {
        if (!supportsOrders) {
            showFeedback('error', 'Pedidos estao desativados nesta conta.')
            return
        }

        setCashierDraftsModalOpen(true)
        refreshPendingOrderDrafts()
    }

    function handleAddProduct(product) {
        setFeedback(null)
        setSelectedCartItemId(product.id)
        setCart((current) => {
            const existing = current.find((item) => item.id === product.id)

            if (existing) {
                return current.map((item) => (
                    item.id === product.id ? { ...item, qty: Number(item.qty) + 1 } : item
                ))
            }

            return [...current, normalizeCartItem({ ...product, qty: 1 })]
        })
    }

    function handleQuantityChange(productId, value) {
        const qty = Math.max(0.001, Number(value || 0.001))
        setCart((current) => current.map((item) => (item.id === productId ? { ...item, qty } : item)))
    }

    function handleStepQuantity(productId, direction) {
        setSelectedCartItemId(productId)
        setCart((current) => current.flatMap((item) => {
            if (item.id !== productId) {
                return [item]
            }

            const nextQty = Number(item.qty || 0) + direction

            if (nextQty <= 0) {
                return []
            }

            return [{
                ...item,
                qty: Number(nextQty.toFixed(3)),
            }]
        }))
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

        setMixedPayments((current) => [...current, { method: mixedDraft.method, amount: String(resolvedAmount.toFixed(2)) }])
        setMixedDraft((current) => ({ ...current, amount: '' }))
    }

    function handleMixedPaymentChange(index, value) {
        setMixedPayments((current) =>
            current.map((payment, currentIndex) => (currentIndex === index ? { ...payment, amount: value } : payment)),
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

    function openDiscountModal(itemId = null) {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de aplicar desconto.')
            return
        }

        const targetItemId = String(itemId ?? selectedCartItemId ?? cart[0]?.id ?? '')
        const nextDraft = buildDiscountDraft(discountConfig, targetItemId)

        if (itemId) {
            nextDraft.mode = 'item'
            nextDraft.itemId = targetItemId
            setSelectedCartItemId(Number(itemId))
        }

        setDiscountDraft(nextDraft)
        setDiscountAuthorizationForm(initialAuthorizationForm)
        setDiscountReason('')
        setDiscountModalOpen(true)
    }

    function closeDiscountModal() {
        setDiscountModalOpen(false)
        setDiscountAuthorizationForm(initialAuthorizationForm)
        setDiscountReason('')
    }

    function handleDiscountDraftChange(field, value) {
        setDiscountDraft((current) => {
            if (field === 'mode' && value === 'item') {
                return {
                    ...current,
                    mode: value,
                    itemId: current.itemId || String(selectedCartItemId ?? cart[0]?.id ?? ''),
                }
            }

            return { ...current, [field]: value }
        })
    }

    function handleSimpleDiscountModeChange(mode) {
        if (mode === 'percent') {
            const currentDiscountAmount = Math.max(0, roundCurrency(pricing.subtotal - Number(discountDraft.targetTotal || pricing.subtotal)))
            const nextPercent = pricing.subtotal > 0 ? roundCurrency((currentDiscountAmount / pricing.subtotal) * 100) : 0

            setDiscountDraft((current) => ({
                ...current,
                mode: 'percent',
                percent: current.mode === 'percent' ? current.percent : String(nextPercent || ''),
            }))
            return
        }

        const currentDiscountAmount = discountDraft.mode === 'percent'
            ? roundCurrency((pricing.subtotal * Number(discountDraft.percent || 0)) / 100)
            : Math.max(0, roundCurrency(pricing.subtotal - Number(discountDraft.targetTotal || pricing.subtotal)))

        setDiscountDraft((current) => ({
            ...current,
            mode: 'target_total',
            targetTotal: String(Math.max(0, roundCurrency(pricing.subtotal - currentDiscountAmount))),
        }))
    }

    function handleSimpleDiscountValueChange(value) {
        if (discountDraft.mode === 'percent') {
            handleDiscountDraftChange('percent', value)
            return
        }

        const discountAmount = Math.max(0, roundCurrency(value || 0))
        const targetTotal = Math.max(0, roundCurrency(pricing.subtotal - discountAmount))
        handleDiscountDraftChange('targetTotal', String(targetTotal))
    }

    function handleDiscountAuthorizationChange(field, value) {
        setDiscountAuthorizationForm((current) => ({ ...current, [field]: value }))
    }

    function handleClearDiscount() {
        setDiscountConfig({ type: 'none' })
        setDiscountAuthorizer(emptyDiscountAuthorizer)
        setDiscountDraft(buildDiscountDraft({ type: 'none' }, String(selectedCartItemId ?? cart[0]?.id ?? '')))
        setDiscountModalOpen(false)
        setDiscountAuthorizationForm(initialAuthorizationForm)
        setDiscountReason('')
    }

    async function handleApplyDiscount(event) {
        event.preventDefault()

        if (!cart.length) {
            setDiscountModalOpen(false)
            return
        }

        const previewConfig = buildPreviewConfigFromDraft(discountDraft, pricing.subtotal)
        const preview = resolvePricing(cart, previewConfig, selectedCartItem)

        if (preview.discount <= 0) {
            showFeedback('error', 'Informe um desconto valido antes de autorizar.')
            return
        }

        if (!discountAuthorizationForm.authorizer_user_id || !discountAuthorizationForm.authorizer_password) {
            showFeedback('error', 'Selecione um gerente e informe a senha de autorizacao.')
            return
        }

        setAuthorizingDiscount(true)

        try {
            const response = await apiRequest('/api/pdv/discounts/authorize', {
                method: 'post',
                data: {
                    authorizer_user_id: Number(discountAuthorizationForm.authorizer_user_id),
                    authorizer_password: discountAuthorizationForm.authorizer_password,
                },
            })

            setDiscountConfig(previewConfig)
            setDiscountAuthorizer(response.authorizer)
            setDiscountModalOpen(false)
            setDiscountAuthorizationForm(initialAuthorizationForm)
            showFeedback('success', 'Desconto autorizado e aplicado com sucesso.')
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setAuthorizingDiscount(false)
        }
    }

    async function handleQuickCustomerSubmit(event) {
        event.preventDefault()

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineCustomer = createOfflineCustomer(tenantId, quickCustomerForm)
                setSelectedCustomer(String(offlineCustomer.id))
                setQuickCustomerForm(initialQuickCustomerForm)
                setQuickCustomerOpen(false)
                showFeedback('warning', 'Cliente salvo no modo offline e vinculado a esta venda.')
                return
            }

            const response = await apiRequest('/api/pdv/customers/quick', { method: 'post', data: quickCustomerForm })

            persistCustomersInWorkspace([
                ...getOfflineWorkspaceSnapshot(tenantId).catalogs.customers,
                response.customer,
            ])
            setSelectedCustomer(String(response.customer.id))
            setQuickCustomerForm(initialQuickCustomerForm)
            setQuickCustomerOpen(false)
            showFeedback('success', 'Cliente cadastrado e selecionado para esta venda.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineCustomer = createOfflineCustomer(tenantId, quickCustomerForm)
                setSelectedCustomer(String(offlineCustomer.id))
                setQuickCustomerForm(initialQuickCustomerForm)
                setQuickCustomerOpen(false)
                showFeedback('warning', 'Cliente salvo no modo offline e vinculado a esta venda.')
            } else {
                showFeedback('error', error.message)
            }
        }
    }

    async function handleBarcodeInputKeyDown(event) {
        if (event.key !== 'Enter') {
            return
        }

        event.preventDefault()

        const term = searchTerm.trim()

        if (!term) {
            showFeedback('error', 'Informe um codigo ou nome de produto antes de adicionar.')
            return
        }

        const localMatch = resolveProductMatch(products, term)

        if (localMatch) {
            handleAddProduct(localMatch)
            setSelectedCartItemId(localMatch.id)
            setSearchTerm('')
            setProducts([])
            return
        }

        setLoadingProducts(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const fallbackMatch = resolveProductMatch(
                    searchOfflineProducts(tenantId, {
                        term,
                        categoryId: selectedCategory || undefined,
                    }),
                    term,
                )

                if (!fallbackMatch) {
                    showFeedback('error', 'Nenhum produto encontrado para esse codigo ou descricao.')
                    return
                }

                handleAddProduct(fallbackMatch)
                setSelectedCartItemId(fallbackMatch.id)
                setSearchTerm('')
                setProducts([])
                return
            }

            const response = await apiRequest('/api/pdv/products', {
                params: { term, category_id: selectedCategory || undefined },
            })
            const match = resolveProductMatch(response.products || [], term)

            if (!match) {
                showFeedback('error', 'Nenhum produto encontrado para esse codigo ou descricao.')
                return
            }

            handleAddProduct(match)
            setSelectedCartItemId(match.id)
            setSearchTerm('')
            setProducts([])
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const fallbackMatch = resolveProductMatch(
                    searchOfflineProducts(tenantId, {
                        term,
                        categoryId: selectedCategory || undefined,
                    }),
                    term,
                )

                if (!fallbackMatch) {
                    showFeedback('error', 'Nenhum produto encontrado para esse codigo ou descricao.')
                } else {
                    handleAddProduct(fallbackMatch)
                    setSelectedCartItemId(fallbackMatch.id)
                    setSearchTerm('')
                    setProducts([])
                }
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setLoadingProducts(false)
        }
    }

    function handleSelectSuggestedProduct(product) {
        if (!product) {
            return
        }

        handleAddProduct(product)
        setSelectedCartItemId(product.id)
        setSearchTerm('')
        setProducts([])
        requestAnimationFrame(() => {
            productSearchInputRef.current?.focus()
        })
    }

    function openCustomerModal() {
        setCustomerLinkForm({
            name: selectedCustomerData?.name || manualRecipient.name || '',
            document: selectedCustomerData?.document || manualRecipient.document || '',
            email: selectedCustomerData?.email || manualRecipient.email || '',
        })
        setCustomerModalOpen(true)
    }

    function handleCustomerLinkFieldChange(field, value) {
        setCustomerLinkForm((current) => ({ ...current, [field]: value }))
    }

    async function handleLinkCustomer(event) {
        event.preventDefault()

        const name = customerLinkForm.name.trim()
        const document = customerLinkForm.document.trim()
        const email = customerLinkForm.email.trim()
        const normalizedDocument = normalizeDocument(document)

        if (!name && !normalizedDocument && !email) {
            setSelectedCustomer('')
            setManualRecipient(initialManualRecipient)
            setCustomerLinkForm(initialCustomerLinkForm)
            setCustomerModalOpen(false)
            showFeedback('success', 'Cliente removido da venda atual.')
            return
        }

        if (!name) {
            showFeedback('error', 'Informe o nome do cliente antes de vincular.')
            return
        }

        const existingCustomer = customers.find((customer) => {
            if (normalizedDocument && normalizeDocument(customer.document) === normalizedDocument) {
                return true
            }

            return String(customer.name || '').trim().toLowerCase() === name.toLowerCase()
        })

        setManualRecipient({
            name,
            document: normalizedDocument,
            email,
        })

        if (existingCustomer) {
            setSelectedCustomer(String(existingCustomer.id))
            setCustomerLinkForm(initialCustomerLinkForm)
            setCustomerModalOpen(false)
            showFeedback('success', 'Cliente vinculado a esta venda.')
            return
        }

        setLinkingCustomer(true)

        try {
            const response = await apiRequest('/api/pdv/customers/quick', {
                method: 'post',
                data: {
                    name,
                    phone: null,
                    document: normalizedDocument || null,
                    email: email || null,
                },
            })

            persistCustomersInWorkspace([
                ...getOfflineWorkspaceSnapshot(tenantId).catalogs.customers,
                response.customer,
            ])
            setSelectedCustomer(String(response.customer.id))
            setCustomerLinkForm(initialCustomerLinkForm)
            setCustomerModalOpen(false)
            showFeedback('success', 'Cliente cadastrado e vinculado com sucesso.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineCustomer = createOfflineCustomer(tenantId, {
                    name,
                    phone: null,
                    document: normalizedDocument || null,
                    email: email || null,
                })
                setSelectedCustomer(String(offlineCustomer.id))
                setCustomerLinkForm(initialCustomerLinkForm)
                setCustomerModalOpen(false)
                showFeedback('warning', 'Cliente salvo no modo offline e vinculado a esta venda.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setLinkingCustomer(false)
        }
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

        if (!openCashRegisterModal) return

        setOpeningCashRegister(true)

        try {
            const openingAmount = Number(openCashRegisterModal.openingAmount || 0)
            const response = await apiRequest('/api/cash-registers', {
                method: 'post',
                data: {
                    opening_amount: openingAmount,
                    opening_notes: openCashRegisterModal.openingNotes.trim() || null,
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
        if (!cashRegisterState) return

        setLoadingClosePreview(true)

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

    function handleRevealCloseCashRegister() {
        if (!closeCashRegisterRows.length || closeCashRegisterRows.some((row) => row.informed === null)) {
            showFeedback('error', 'Preencha todos os valores informados antes de revelar o sistema.')
            return
        }

        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    step: 'revealed',
                    supervisorPromptOpen: false,
                    supervisorPassword: '',
                    supervisorError: '',
                }
                : current
        ))
    }

    function handleOpenCloseCashSupervisorPrompt() {
        if (!closeCashRegisterModal) {
            return
        }

        if (!supervisors.length) {
            showFeedback('error', 'Cadastre ao menos um usuario como supervisor para liberar a edicao apos a conferencia.')
            return
        }

        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    supervisorPromptOpen: true,
                    supervisorUserId: current.supervisorUserId || String(supervisors[0]?.id || ''),
                    supervisorPassword: '',
                    supervisorError: '',
                }
                : current
        ))
    }

    function handleCloseCashSupervisorPrompt() {
        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    supervisorPromptOpen: false,
                    supervisorPassword: '',
                    supervisorError: '',
                }
                : current
        ))
    }

    function handleCloseCashSupervisorFieldChange(field, value) {
        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    [field]: value,
                    supervisorError: '',
                }
                : current
        ))
    }

    async function handleAuthorizeCloseCashSupervisor() {
        if (!closeCashRegisterModal) {
            return
        }

        if (!closeCashRegisterModal.supervisorUserId || !closeCashRegisterModal.supervisorPassword) {
            setCloseCashRegisterModal((current) => (
                current
                    ? { ...current, supervisorError: 'Selecione o supervisor e informe a senha para liberar a edicao.' }
                    : current
            ))
            return
        }

        setCloseCashRegisterModal((current) => (
            current
                ? { ...current, supervisorAuthorizing: true, supervisorError: '' }
                : current
        ))

        try {
            const response = await apiRequest('/api/cash-registers/supervisor-authorize', {
                method: 'post',
                data: {
                    supervisor_user_id: Number(closeCashRegisterModal.supervisorUserId),
                    supervisor_password: closeCashRegisterModal.supervisorPassword,
                },
            })

            setCloseCashRegisterModal((current) => (
                current
                    ? {
                        ...current,
                        step: 'informing',
                        supervisorPromptOpen: false,
                        supervisorPassword: '',
                        supervisorError: '',
                        supervisorAuthorizing: false,
                        supervisorName: response.supervisor?.name || '',
                    }
                    : current
            ))
            showFeedback('success', response.message || 'Edicao liberada pelo supervisor.')
        } catch (error) {
            setCloseCashRegisterModal((current) => (
                current
                    ? {
                        ...current,
                        supervisorAuthorizing: false,
                        supervisorError: error.message,
                    }
                    : current
            ))
        }
    }

    async function handleConfirmCloseCashRegister(event = null) {
        event?.preventDefault?.()

        if (!cashRegisterState || !closeCashRegisterModal) return

        if (closeCashRegisterModal.form.amounts.cash === '') {
            showFeedback('error', 'Informe o valor contado em dinheiro antes de fechar o caixa.')
            return
        }

        setClosingCashRegister(true)

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

    async function handleRestorePendingSale() {
        if (!supportsPendingSales) {
            setPendingSaleResolved(true)
            setPendingSalePromptOpen(false)
            return
        }

        setPendingSaleActionBusy(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlinePendingSale = getOfflinePendingSale(tenantId, auth?.user?.id)

                if (!offlinePendingSale) {
                    throw new Error('Nenhuma venda pendente foi encontrada no cache offline.')
                }

                applyPendingSale(offlinePendingSale)
                return
            }

            const response = await apiRequest('/api/pdv/pending-sale/restore', {
                method: 'post',
            })
            applyPendingSale(response.pending_sale)
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlinePendingSale = getOfflinePendingSale(tenantId, auth?.user?.id)

                if (offlinePendingSale) {
                    applyPendingSale(offlinePendingSale)
                } else {
                    showFeedback('error', error.message)
                    setPendingSaleResolved(true)
                    setPendingSalePromptOpen(false)
                }
            } else {
                showFeedback('error', error.message)
                setPendingSaleResolved(true)
                setPendingSalePromptOpen(false)
            }
        } finally {
            setPendingSaleActionBusy(false)
        }
    }

    async function handleDiscardPendingSale() {
        if (!supportsPendingSales) {
            setPendingSaleServerState(null)
            setPendingSaleResolved(true)
            setPendingSalePromptOpen(false)
            return
        }

        setPendingSaleActionBusy(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                discardOfflinePendingSale(tenantId, auth?.user?.id)
            } else {
                await apiRequest('/api/pdv/pending-sale', { method: 'delete' })
                discardOfflinePendingSale(tenantId, auth?.user?.id)
            }
            setPendingSaleServerState(null)
            setPendingSaleResolved(true)
            setPendingSalePromptOpen(false)
            showFeedback('success', 'Venda pendente descartada com seguranca.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                discardOfflinePendingSale(tenantId, auth?.user?.id)
                setPendingSaleServerState(null)
                setPendingSaleResolved(true)
                setPendingSalePromptOpen(false)
                showFeedback('warning', 'Venda pendente descartada no modo offline.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setPendingSaleActionBusy(false)
        }
    }

    function buildPaymentsPayload() {
        if (paymentMethod === 'mixed') {
            if (mixedPayments.length < 2) {
                throw new Error('Adicione pelo menos duas parcelas para o pagamento misto.')
            }

            if (mixedPayments.some((payment) => Number(payment.amount || 0) <= 0)) {
                throw new Error('Revise os valores do pagamento misto antes de continuar.')
            }

            if (mixedPayments.some((payment) => payment.method === 'credit') && !selectedCustomer) {
                throw new Error('Selecione um cliente para usar A Prazo no pagamento misto.')
            }

            if (Math.abs(mixedTotal - totals.total) > 0.009) {
                throw new Error('A soma das parcelas precisa bater exatamente com o total da venda.')
            }

            return mixedPayments.map((payment) => ({
                method: payment.method,
                amount: Number(payment.amount),
            }))
        }

        if (paymentMethod === 'credit' && !selectedCustomer) {
            throw new Error('Selecione um cliente para registrar a venda a prazo.')
        }

        if (paymentMethod === 'cash' && cashReceived !== '' && cashShortfall > 0.009) {
            throw new Error('O valor entregue em dinheiro precisa cobrir o total da venda.')
        }

        return [{ method: paymentMethod, amount: totals.total }]
    }

    function openPaymentStep() {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de seguir para o pagamento.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('error', 'Abra o caixa antes de tentar vender.')
            return
        }

        setPaymentModalOpen(true)
    }

    function openInvoiceStep() {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de definir a emissao.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('error', 'Abra o caixa antes de tentar vender.')
            return
        }

        if (!paymentReady) {
            showFeedback('error', 'Confirme o pagamento antes de emitir ou finalizar a venda.')
            setPaymentModalOpen(true)
            return
        }

        setInvoiceModalOpen(true)
    }

    function handleConfirmPaymentStep() {
        try {
            buildPaymentsPayload()
            setPaymentReady(true)
            setPaymentModalOpen(false)
            showFeedback('success', 'Pagamento validado. Voce ja pode finalizar ou emitir o documento.')
        } catch (error) {
            showFeedback('error', error.message)
        }
    }

    function openFinalizeStep() {
        if (!cart.length) {
            showFeedback('error', 'Adicione ao menos um produto antes de finalizar a venda.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('error', 'Abra o caixa antes de finalizar a venda.')
            return
        }

        if (!paymentReady) {
            openPaymentStep()
            return
        }

        openInvoiceStep()
    }

    function buildInlineRecipientPayload(requireEmail = false) {
        if (selectedCustomerData?.document) {
            const fallbackEmail = (manualRecipient.email || customerLinkForm.email || '').trim()

            if (requireEmail && !selectedCustomerData.email && !fallbackEmail) {
                throw new Error('Informe um e-mail do cliente antes de enviar o comprovante por e-mail.')
            }

            if (!selectedCustomerData.email && fallbackEmail) {
                return {
                    type: 'document',
                    name: selectedCustomerData.name,
                    document: normalizeDocument(selectedCustomerData.document),
                    email: fallbackEmail,
                }
            }

            return { type: 'customer', customer_id: selectedCustomerData.id }
        }

        const name = (manualRecipient.name || customerLinkForm.name || '').trim()
        const document = normalizeDocument(manualRecipient.document || customerLinkForm.document || '')
        const email = (manualRecipient.email || customerLinkForm.email || '').trim()

        if (!name || !document) {
            throw new Error('Identifique o cliente com nome e CPF/CNPJ antes de emitir o documento fiscal.')
        }

        if (requireEmail && !email) {
            throw new Error('Informe um e-mail do cliente antes de usar essa opcao.')
        }

        return {
            type: 'document',
            name,
            document,
            email: email || null,
        }
    }

    function buildSaleItemsPayload() {
        return pricing.items.map((item) => ({
            id: item.id,
            qty: Number(item.qty),
            discount: Number(item.lineDiscount || 0),
            discount_percent: Number(item.lineSubtotal || 0) > 0
                ? roundCurrency((Number(item.lineDiscount || 0) / Number(item.lineSubtotal || 0)) * 100)
                : 0,
            discount_scope: discountConfig.type === 'item' ? 'item' : (discountConfig.type === 'none' ? null : 'sale'),
            discount_authorized_by: Number(item.lineDiscount || 0) > 0 ? discountAuthorizer?.id || null : null,
        }))
    }

    async function finalizeSale({ fiscalDecision, requestedDocumentModel = '65', recipientPayload = null }) {
        const payments = buildPaymentsPayload()
        const salePayload = {
            order_draft_id: activeOrderDraftId || null,
            customer_id: selectedCustomer || recipientPayload?.customer_id || null,
            company_id: selectedCompany || recipientPayload?.company_id || null,
            discount: totals.discount,
            notes: notes || null,
            fiscal_decision: fiscalDecision,
            requested_document_model: requestedDocumentModel,
            recipient_payload: recipientPayload,
            items: buildSaleItemsPayload(),
            payments,
            total: totals.total,
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return queueOfflineSaleFinalize(tenantId, salePayload, { userId: auth?.user?.id })
        }

        try {
            return await apiRequest('/api/pdv/sales', {
                method: 'post',
                data: {
                    ...salePayload,
                    order_draft_id: activeOrderDraftId ? resolveOfflineEntityId(tenantId, 'orders', activeOrderDraftId) : null,
                    customer_id: salePayload.customer_id ? resolveOfflineEntityId(tenantId, 'customers', salePayload.customer_id) : null,
                    company_id: salePayload.company_id ? resolveOfflineEntityId(tenantId, 'companies', salePayload.company_id) : null,
                    recipient_payload: recipientPayload
                        ? {
                            ...recipientPayload,
                            customer_id: recipientPayload.customer_id ? resolveOfflineEntityId(tenantId, 'customers', recipientPayload.customer_id) : recipientPayload.customer_id,
                            company_id: recipientPayload.company_id ? resolveOfflineEntityId(tenantId, 'companies', recipientPayload.company_id) : recipientPayload.company_id,
                        }
                        : null,
                    items: buildSaleItemsPayload().map((item) => ({
                        ...item,
                        id: Number(resolveOfflineEntityId(tenantId, 'products', item.id)),
                    })),
                },
            })
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                return queueOfflineSaleFinalize(tenantId, salePayload, { userId: auth?.user?.id })
            }

            throw error
        }
    }

    async function concludeFinalizedSale(finalizedOrderDraftId, callback = null) {
        if (typeof callback === 'function') {
            await callback()
        }

        resetSale()

        if (finalizedOrderDraftId) {
            setPendingOrderDrafts((current) => current.filter((orderDraft) => Number(orderDraft.id) !== Number(finalizedOrderDraftId)))
            refreshPendingOrderDrafts({ quiet: true })
        }
    }

    async function handleCloseSaleWithoutFiscal() {
        setSubmitting(true)

        try {
            const finalizedOrderDraftId = activeOrderDraftId
            const response = await finalizeSale({ fiscalDecision: 'close', requestedDocumentModel: '65' })

            await concludeFinalizedSale(finalizedOrderDraftId)

            const printMessage = response.local_agent_print?.message
                ? ` ${response.local_agent_print.message}`
                : ''

            showFeedback(
                response.sale?.sale_id < 0 ? 'warning' : 'success',
                response.sale?.sale_id < 0
                    ? `Venda ${response.sale.sale_number} registrada no modo offline.`
                    : `Venda ${response.sale.sale_number} finalizada.${printMessage}`,
            )
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
            setFiscalDecisionOpen(false)
        }
    }

    async function handleEmitFromInvoiceChoice(event) {
        event.preventDefault()

        if (invoiceChoice === 'none') {
            setInvoiceModalOpen(false)
            await handleCloseSaleWithoutFiscal()
            return
        }

        const requestedDocumentModel = invoiceChoice === '55' ? '55' : '65'
        const requireEmail = invoiceChoice === 'email'

        setSubmitting(true)

        try {
            const recipientPayload = buildInlineRecipientPayload(requireEmail)
            const finalizedOrderDraftId = activeOrderDraftId
            const response = await finalizeSale({
                fiscalDecision: 'emit',
                requestedDocumentModel,
                recipientPayload,
            })

            if (response.sale?.sale_id < 0) {
                await concludeFinalizedSale(finalizedOrderDraftId)
                showFeedback('warning', `Venda ${response.sale.sale_number} registrada no modo offline. A emissao fiscal sera tentada quando a conexao voltar.`)
                return
            }

            await apiRequest(`/api/pdv/sales/${response.sale.sale_id}/issue-fiscal`, {
                method: 'post',
                data: {
                    document_model: requestedDocumentModel,
                    mode: 'auto',
                    recipient: recipientPayload,
                },
            })

            await concludeFinalizedSale(finalizedOrderDraftId)
            showFeedback(
                'success',
                requestedDocumentModel === '55'
                    ? `Venda ${response.sale.sale_number} preparada para NF-e / DANFE.`
                    : invoiceChoice === 'email'
                        ? `Venda ${response.sale.sale_number} enviada para emissao com contato por e-mail.`
                        : `Venda ${response.sale.sale_number} enviada para emissao fiscal.`,
            )
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
            setInvoiceModalOpen(false)
        }
    }

    function handleEmitCouponChoice() {
        setFiscalDecisionOpen(false)
        setRecipientModalOpen(true)

        if (selectedCustomerData?.document) {
            setRecipientSelectionMode('customer')
        } else if (selectedCompanyData?.document) {
            setRecipientSelectionMode('company')
        } else {
            setRecipientSelectionMode('document')
            setManualRecipient({
                name: selectedCustomerData?.name || '',
                document: selectedCustomerData?.document || '',
                email: selectedCustomerData?.email || '',
            })
        }
    }

    function handleManualRecipientChange(field, value) {
        setManualRecipient((current) => ({ ...current, [field]: value }))
    }

    function handleQuickCompanyFormChange(field, value) {
        setQuickCompanyForm((current) => ({ ...current, [field]: value }))
    }

    function handleRecipientCustomerSelect(customer) {
        setSelectedCustomer(String(customer.id))
    }

    function handleRecipientCompanySelect(company) {
        setSelectedCompany(String(company.id))
    }

    async function handleQuickCompanyCreate() {
        if (!supportsCompanies) {
            showFeedback('error', 'O cadastro de empresas ainda nao esta disponivel neste tenant. Aplique as migrations pendentes para habilitar esse fluxo.')
            return
        }

        if (!quickCompanyForm.name.trim()) {
            showFeedback('error', 'Informe a razao social da empresa antes de cadastrar.')
            return
        }

        setCreatingCompany(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineCompany = createOfflineCompany(tenantId, quickCompanyForm)
                setSelectedCompany(String(offlineCompany.id))
                setQuickCompanyForm(initialQuickCompanyForm)
                showFeedback('warning', 'Empresa salva no modo offline e pronta para reutilizacao.')
                return
            }

            const response = await apiRequest('/api/pdv/companies/quick', { method: 'post', data: quickCompanyForm })

            persistCompaniesInWorkspace([
                ...getOfflineWorkspaceSnapshot(tenantId).catalogs.companies,
                response.company,
            ])
            setSelectedCompany(String(response.company.id))
            setQuickCompanyForm(initialQuickCompanyForm)
            showFeedback('success', 'Empresa cadastrada e pronta para reutilizacao.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineCompany = createOfflineCompany(tenantId, quickCompanyForm)
                setSelectedCompany(String(offlineCompany.id))
                setQuickCompanyForm(initialQuickCompanyForm)
                showFeedback('warning', 'Empresa salva no modo offline e pronta para reutilizacao.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setCreatingCompany(false)
        }
    }

    function buildRecipientPayload() {
        if (recipientSelectionMode === 'customer') {
            const customer = customers.find((entry) => String(entry.id) === String(selectedCustomer))
            if (!customer) throw new Error('Selecione um cliente valido para emitir o documento fiscal.')
            return { type: 'customer', customer_id: customer.id }
        }

        if (recipientSelectionMode === 'company') {
            if (!supportsCompanies) {
                throw new Error('O cadastro de empresas ainda nao esta disponivel neste tenant.')
            }

            const company = companies.find((entry) => String(entry.id) === String(selectedCompany))
            if (!company) throw new Error('Selecione uma empresa valida para emitir o documento fiscal.')
            return { type: 'company', company_id: company.id }
        }

        const name = manualRecipient.name.trim()
        const document = manualRecipient.document.replace(/\D/g, '')
        if (!name || !document) throw new Error('Informe nome e CPF/CNPJ do destinatario antes de continuar.')
        return {
            type: 'document',
            name,
            document,
            email: manualRecipient.email.trim() || null,
        }
    }

    async function handleSubmitRecipient(event) {
        event.preventDefault()
        setSubmitting(true)

        try {
            const recipientPayload = buildRecipientPayload()
            const finalizedOrderDraftId = activeOrderDraftId
            const response = await finalizeSale({
                fiscalDecision: 'emit',
                requestedDocumentModel: recipientDocumentModel,
                recipientPayload,
            })

            if (response.sale?.sale_id < 0) {
                await concludeFinalizedSale(finalizedOrderDraftId)
                showFeedback('warning', `Venda ${response.sale.sale_number} registrada no modo offline. A emissao fiscal sera tentada quando a conexao voltar.`)
                return
            }

            try {
                await apiRequest(`/api/pdv/sales/${response.sale.sale_id}/issue-fiscal`, {
                    method: 'post',
                    data: {
                        document_model: recipientDocumentModel,
                        mode: 'auto',
                        recipient: recipientPayload,
                    },
                })

                await concludeFinalizedSale(finalizedOrderDraftId)
                showFeedback(
                    'success',
                    recipientDocumentModel === '55'
                        ? `Venda ${response.sale.sale_number} preparada para NF-e / DANFE.`
                        : `Venda ${response.sale.sale_number} enviada para emissao fiscal.`,
                )
            } catch (error) {
                await concludeFinalizedSale(finalizedOrderDraftId)
                showFeedback('error', `Venda ${response.sale.sale_number} concluida, mas a etapa fiscal falhou: ${error.message}`)
            }
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
            setRecipientModalOpen(false)
        }
    }

    function handleCancelSale() {
        resetSale()
        setCancelModalOpen(false)
        showFeedback('success', 'Venda cancelada e carrinho limpo.')
    }

    function closeShortcutDrivenPanels() {
        setCashReportModal(null)
        setQuickCustomerOpen(false)
        closeCustomerPicker()
        setDiscountModalOpen(false)
        setPaymentModalOpen(false)
        setFiscalDecisionOpen(false)
        setRecipientModalOpen(false)
        setCustomerModalOpen(false)
        setCashierDraftsModalOpen(false)
        setInvoiceModalOpen(false)
        setCancelModalOpen(false)
        setOpenCashRegisterModal(null)
        setCloseCashRegisterModal(null)
    }

    function focusProductsShortcut() {
        closeShortcutDrivenPanels()
        requestAnimationFrame(() => {
            productSearchInputRef.current?.focus()
            productSearchInputRef.current?.select?.()
        })
    }

    function openDiscountShortcut() {
        closeShortcutDrivenPanels()
        openDiscountModal()
    }

    function openPaymentShortcut() {
        closeShortcutDrivenPanels()
        openPaymentStep()
    }

    function openCashShortcut() {
        closeShortcutDrivenPanels()

        if (!loadingClosePreview && !closingCashRegister && !openingCashRegister) {
            handleOpenCashWorkflow()
        }
    }

    function openCustomerShortcut() {
        closeShortcutDrivenPanels()
        openCustomerModal()
    }

    function openFinalizeShortcut() {
        closeShortcutDrivenPanels()
        openFinalizeStep()
    }

    useEffect(() => {
        function handleShortcuts(event) {
            if (event.isComposing) {
                return
            }

            const hasModalOpen = Boolean(
                cashReportModal
                || openCashRegisterModal
                || closeCashRegisterModal
                || quickCustomerOpen
                || customerPickerOpen
                || discountModalOpen
                || paymentModalOpen
                || fiscalDecisionOpen
                || recipientModalOpen
                || customerModalOpen
                || cashierDraftsModalOpen
                || invoiceModalOpen
                || cancelModalOpen
                || pendingSalePromptOpen,
            )
            const hasBlockingModal = Boolean(pendingSalePromptOpen)
            const shortcutAction = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
                ? shortcutActionByCode[event.code]
                : null

            if (event.key === 'Escape') {
                if (cashReportModal) return void (event.preventDefault(), closeCashReportModal())
                if (openCashRegisterModal) return void (event.preventDefault(), closeOpenCashRegisterModal())
                if (closeCashRegisterModal?.supervisorPromptOpen) return void (event.preventDefault(), handleCloseCashSupervisorPrompt())
                if (closeCashRegisterModal) return void (event.preventDefault(), closeCloseCashRegisterModal())
                if (quickCustomerOpen) return void (event.preventDefault(), setQuickCustomerOpen(false))
                if (customerPickerOpen) return void (event.preventDefault(), closeCustomerPicker())
                if (discountModalOpen) return void (event.preventDefault(), closeDiscountModal())
                if (paymentModalOpen) return void (event.preventDefault(), setPaymentModalOpen(false))
                if (fiscalDecisionOpen) return void (event.preventDefault(), setFiscalDecisionOpen(false))
                if (recipientModalOpen) return void (event.preventDefault(), setRecipientModalOpen(false))
                if (customerModalOpen) return void (event.preventDefault(), setCustomerModalOpen(false))
                if (cashierDraftsModalOpen) return void (event.preventDefault(), setCashierDraftsModalOpen(false))
                if (invoiceModalOpen) return void (event.preventDefault(), setInvoiceModalOpen(false))
                if (cancelModalOpen) return void (event.preventDefault(), setCancelModalOpen(false))
                return
            }

            if (hasBlockingModal) return
            if (hasModalOpen && !shortcutAction) return
            if (!shortcutAction || event.repeat) return

            event.preventDefault()

            if (shortcutAction === 'products') {
                focusProductsShortcut()
                return
            }

            if (shortcutAction === 'customer') {
                openCustomerShortcut()
                return
            }

            if (shortcutAction === 'discount') {
                openDiscountShortcut()
                return
            }

            if (shortcutAction === 'payment') {
                if (!submitting) {
                    openPaymentShortcut()
                }
                return
            }

            if (shortcutAction === 'cash') {
                if (!loadingClosePreview && !closingCashRegister && !openingCashRegister) {
                    openCashShortcut()
                }
                return
            }

            if (shortcutAction === 'finalize' && !submitting) {
                openFinalizeShortcut()
            }
        }

        window.addEventListener('keydown', handleShortcuts, true)
        return () => window.removeEventListener('keydown', handleShortcuts, true)
    }, [
        cashReportModal,
        openCashRegisterModal,
        closeCashRegisterModal,
        quickCustomerOpen,
        customerPickerOpen,
        discountModalOpen,
        paymentModalOpen,
        fiscalDecisionOpen,
        recipientModalOpen,
        customerModalOpen,
        cashierDraftsModalOpen,
        invoiceModalOpen,
        cancelModalOpen,
        pendingSalePromptOpen,
        cashRegisterState,
        cart.length,
        selectedCartItemId,
        selectedCustomerData,
        manualRecipient,
        paymentReady,
        submitting,
        loadingClosePreview,
        closingCashRegister,
        openingCashRegister,
    ])

    const workspaceProps = {
        tenantName: tenant?.name,
        cashRegisterState,
        linkedCustomerSummary,
        productSearchInputRef,
        searchTerm,
        onSearchChange: setSearchTerm,
        onSearchKeyDown: handleBarcodeInputKeyDown,
        barcodeHelperText,
        products,
        loadingProducts,
        recommendations,
        loadingRecommendations,
        onSelectSuggestedProduct: handleSelectSuggestedProduct,
        paymentReady,
        pricing,
        selectedCartItemId,
        onSelectItem: setSelectedCartItemId,
        onAdjustItemQuantity: handleStepQuantity,
        onRemoveItem: handleRemove,
        totals,
        shortcutButtons: footerShortcutHints,
        onProductsShortcut: focusProductsShortcut,
        onCustomerShortcut: openCustomerShortcut,
        onDiscountShortcut: openDiscountShortcut,
        onPaymentShortcut: openPaymentShortcut,
        onCashShortcut: openCashShortcut,
        onFinalizeShortcut: openFinalizeShortcut,
        cartLength: cart.length,
        submitting,
        openPaymentStep,
        openDiscountModal,
        openCustomerModal,
        openCashierDraftsModal,
        openInvoiceStep,
        openFinalizeStep,
        onOpenCancel: () => setCancelModalOpen(true),
        supportsOrders,
        pendingOrderDrafts,
        activeOrderDraftId,
        loadingOrderDraftId,
        refreshingPendingOrders,
        cashierDraftsModalOpen,
        onCloseCashierDraftsModal: () => setCashierDraftsModalOpen(false),
        onRefreshCashierDrafts: () => refreshPendingOrderDrafts(),
        onLoadOrderDraft: handleLoadOrderDraft,
        paymentModalOpen,
        onClosePaymentModal: () => setPaymentModalOpen(false),
        paymentGridOptions,
        paymentMethod,
        onPaymentChange: handlePaymentMethodChange,
        cashReceived,
        onCashReceivedChange: setCashReceived,
        cashChange,
        cashShortfall,
        mixedDraft,
        onMixedDraftChange: handleMixedDraftChange,
        mixedPayments,
        onMixedPaymentChange: handleMixedPaymentChange,
        onMixedPaymentRemove: handleRemoveMixedPayment,
        onAddMixedPayment: handleAddMixedPayment,
        mixedRemaining,
        paymentOptions,
        selectedCustomerData,
        creditStatus,
        onConfirmPayment: handleConfirmPaymentStep,
        discountModalOpen,
        onCloseDiscountModal: closeDiscountModal,
        discountDraft,
        onDiscountModeChange: handleSimpleDiscountModeChange,
        simpleDiscountValue,
        onSimpleDiscountValueChange: handleSimpleDiscountValueChange,
        discountReason,
        onDiscountReasonChange: setDiscountReason,
        pricingSummary: pricing,
        discountPreview,
        managers: managers || [],
        discountAuthorizationForm,
        onDiscountAuthorizationChange: handleDiscountAuthorizationChange,
        onClearDiscount: handleClearDiscount,
        onApplyDiscount: handleApplyDiscount,
        authorizingDiscount,
        customerModalOpen,
        onCloseCustomerModal: () => setCustomerModalOpen(false),
        customerLinkForm,
        onCustomerLinkFieldChange: handleCustomerLinkFieldChange,
        onLinkCustomer: handleLinkCustomer,
        linkingCustomer,
        invoiceModalOpen,
        onCloseInvoiceModal: () => setInvoiceModalOpen(false),
        invoiceGridOptions,
        invoiceChoice,
        onInvoiceChoiceChange: setInvoiceChoice,
        onEmitInvoice: handleEmitFromInvoiceChoice,
        cancelModalOpen,
        onCloseCancelModal: () => setCancelModalOpen(false),
        onCancelSale: handleCancelSale,
    }

    return (
        <AppLayout title="" showTopbar={false} contentClassName="app-page-content-flush">
            <Head title="Checkout">
                <link
                    href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </Head>

            <PosWorkspace {...workspaceProps} />

            <PendingSaleRestoreModal
                open={pendingSalePromptOpen}
                pendingSale={pendingSaleServerState}
                busy={pendingSaleActionBusy}
                onRestore={handleRestorePendingSale}
                onDiscard={handleDiscardPendingSale}
            />

            {openCashRegisterModal ? (
                <div className="pos-quick-customer" onClick={closeOpenCashRegisterModal}>
                    <form className="pos-quick-customer-card" onSubmit={handleOpenCashRegister} onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Abrir caixa</h2>
                                <p>Defina o valor inicial para iniciar o turno atual.</p>
                            </div>
                            <button className="pos-button ghost small" type="button" onClick={closeOpenCashRegisterModal}>Cancelar</button>
                        </div>

                        <label className="pos-field">
                            <span>Valor de abertura</span>
                            <input className="pos-field-input" type="number" min="0" step="0.01" value={openCashRegisterModal.openingAmount} onChange={(event) => handleOpenCashRegisterFieldChange('openingAmount', event.target.value)} autoFocus />
                        </label>

                        <label className="pos-field">
                            <span>Observacao</span>
                            <textarea className="pos-field-input textarea" rows="3" value={openCashRegisterModal.openingNotes} onChange={(event) => handleOpenCashRegisterFieldChange('openingNotes', event.target.value)} />
                        </label>

                        <div className="pos-modal-actions">
                            <button className="pos-button ghost" type="button" onClick={closeOpenCashRegisterModal}>Voltar</button>
                            <button className="pos-button info" type="submit" disabled={openingCashRegister}>
                                {openingCashRegister ? 'Abrindo...' : 'Confirmar abertura'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}

            <PosCashCloseModal
                closeModal={closeCashRegisterModal}
                rows={closeCashRegisterRows}
                supervisors={supervisors}
                closingCashRegister={closingCashRegister}
                onClose={closeCloseCashRegisterModal}
                onAmountChange={handleCloseCashRegisterAmountChange}
                onNotesChange={handleCloseCashRegisterNotesChange}
                onReveal={handleRevealCloseCashRegister}
                onConfirmClose={handleConfirmCloseCashRegister}
                onOpenSupervisorPrompt={handleOpenCloseCashSupervisorPrompt}
                onCloseSupervisorPrompt={handleCloseCashSupervisorPrompt}
                onSupervisorFieldChange={handleCloseCashSupervisorFieldChange}
                onAuthorizeSupervisor={handleAuthorizeCloseCashSupervisor}
            />

            <ClosingReportModal report={cashReportModal} onClose={closeCashReportModal} />
        </AppLayout>
    )

    return (
        <AppLayout title="PDV">
            <div className="pos-page pos-modular-page">
                <div className="pos-column">
                    <section className="pos-hero ui-card">
                        <div className="ui-card-body">
                            <div className="pos-hero-grid">
                                <div>
                                    <span className={`ui-badge ${cashRegisterState ? 'success' : 'danger'}`}>
                                        {cashRegisterState ? 'Caixa ativo' : 'Caixa fechado'}
                                    </span>
                                    <h1>Caixa modular</h1>
                                    <p>Produtos, revisao, pagamento e fiscal organizados por etapa para reduzir ruido operacional.</p>
                                    <div className="pos-hero-shortcuts">
                                        <span className="pos-hero-shortcuts-title">Atalhos</span>
                                        <div className="pos-shortcut-list">
                                            {shortcutHints.map((shortcut) => (
                                                <div key={shortcut.label} className="pos-shortcut-chip">
                                                    <span className="pos-shortcut-keys">
                                                        {shortcut.keys.map((keyPart, index) => (
                                                            <span key={`${shortcut.label}-${keyPart}`} className="pos-shortcut-keypart">
                                                                {index > 0 ? <span>+</span> : null}
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

                    <section className="pos-card pos-stage-board">
                        <div className="pos-card-header">
                            <div>
                                <h2>Etapas do caixa</h2>
                                <p>O fluxo agora avanca por revisao, pagamento e decisao fiscal em modais separados.</p>
                            </div>
                        </div>
                        <div className="pos-stage-list">
                            {flowSteps.map((step) => (
                                <article key={step.key} className={`pos-stage-chip ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}>
                                    <span>{step.label}</span>
                                    <strong>{step.done ? 'Concluida' : step.active ? 'Em andamento' : 'Pendente'}</strong>
                                </article>
                            ))}
                        </div>
                    </section>

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
                        title="Selecao de produtos"
                        subtitle="Busque por nome, codigo ou EAN e adicione direto na venda."
                        actions={
                            <button type="button" className="ui-button-ghost" onClick={openPaymentStep}>
                                <i className="fa-solid fa-credit-card" />
                                Ir para pagamento
                            </button>
                        }
                    />

                    <section className="pos-card pos-review-card">
                        <div className="pos-card-header">
                            <div>
                                <h2>Revisao da venda</h2>
                                <p>Pagamentos sairam da tela principal. Aqui ficam dados da venda, cliente e proxima etapa.</p>
                            </div>
                        </div>

                        <div className="pos-review-grid">
                            <article className="pos-review-highlight">
                                <span>Cliente da venda</span>
                                <strong>{selectedCustomerData?.name || 'Nao identificado'}</strong>
                                <small>{selectedCustomerData?.document || selectedCustomerData?.phone || 'Selecione um cliente quando precisar de credito ou identificacao.'}</small>
                                <div className="pos-review-actions">
                                    <button type="button" className="pos-inline-button" onClick={() => setCustomerPickerOpen(true)}>
                                        <i className="fa-solid fa-user-magnifying-glass" />
                                        Selecionar cliente
                                    </button>
                                    <button type="button" className="pos-inline-button" onClick={handleOpenQuickCustomer}>
                                        <i className="fa-solid fa-user-plus" />
                                        Novo cliente
                                    </button>
                                </div>
                            </article>

                            <article className="pos-review-highlight">
                                <span>Pagamento</span>
                                <strong>{paymentReady ? 'Pronto para finalizar' : 'Aguardando confirmacao'}</strong>
                                <small>
                                    {paymentMethod === 'mixed'
                                        ? `${mixedPayments.length} parcela(s) configurada(s)`
                                        : `Forma selecionada: ${paymentOptions.find((option) => option.value === paymentMethod)?.label || 'Dinheiro'}`}
                                </small>
                                <div className="pos-review-actions">
                                    <button type="button" className="pos-finalize-button" onClick={openPaymentStep} disabled={!cart.length || !cashRegisterState}>
                                        <i className="fa-solid fa-credit-card" />
                                        Abrir pagamento
                                    </button>
                                </div>
                            </article>

                            <article className="pos-review-highlight">
                                <span>Rascunho da venda</span>
                                <strong>
                                    {!supportsPendingSales
                                        ? 'Venda pendente indisponivel'
                                        : pendingSaleServerState
                                            ? 'Salvando automaticamente'
                                            : 'Sem pendencia remota'}
                                </strong>
                                <small>
                                    {activeOrderDraftId
                                        ? `Pedido carregado: #${activeOrderDraftId}`
                                        : supportsPendingSales
                                            ? 'A venda atual pode ser restaurada se a pagina recarregar.'
                                            : 'A restauracao automatica depende das migrations novas deste tenant.'}
                                </small>
                                <div className="pos-review-actions">
                                    <button type="button" className="pos-inline-button" onClick={() => openDiscountModal()} disabled={!cart.length}>
                                        <i className="fa-solid fa-money-bill-wave" />
                                        Desconto
                                        <kbd>Shift + D</kbd>
                                    </button>
                                    <button type="button" className="pos-inline-button" onClick={resetSale} disabled={!cart.length}>
                                        <i className="fa-solid fa-broom-wide" />
                                        Limpar venda
                                    </button>
                                </div>
                            </article>
                        </div>

                        {creditStatus && selectedCustomer ? (
                            <div className="pos-credit-card">
                                <div><span>Limite</span><strong>{formatMoney(creditStatus.credit_limit)}</strong></div>
                                <div><span>Em aberto</span><strong>{formatMoney(creditStatus.open_credit)}</strong></div>
                                <div><span>Disponivel</span><strong>{formatMoney(creditStatus.available_credit)}</strong></div>
                            </div>
                        ) : null}

                        <label className="pos-discount-form-field pos-notes-field">
                            Observacoes da venda
                            <textarea className="ui-input" rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anotacoes internas para a venda" />
                        </label>
                    </section>

                    {supportsOrders ? (
                        <PendingOrdersPanel
                            orders={pendingOrderDrafts}
                            activeOrderDraftId={activeOrderDraftId}
                            loadingOrderId={loadingOrderDraftId}
                            refreshing={refreshingPendingOrders}
                            onLoadOrder={handleLoadOrderDraft}
                            onRefresh={() => refreshPendingOrderDrafts()}
                        />
                    ) : null}
                </div>

                <div className="pos-column pos-side-stack">
                    <CartPanel
                        cart={pricing.items}
                        selectedItemId={selectedCartItemId}
                        onSelectItem={setSelectedCartItemId}
                        onQuantityChange={handleQuantityChange}
                        onRemove={handleRemove}
                        onDiscountItem={openDiscountModal}
                        title="Produtos da venda"
                        subtitle="A lateral do caixa agora mostra os itens, quantidades, descontos e totais."
                        headerActions={
                            <div className="pos-card-header-actions">
                                <span className={`ui-badge ${discountAuthorizer ? 'success' : 'warning'}`}>
                                    {discountAuthorizer ? `Autorizado por ${discountAuthorizer.name}` : 'Sem desconto autorizado'}
                                </span>
                            </div>
                        }
                    />

                    <section className="pos-card pos-sale-summary-card">
                        <div className="pos-card-header">
                            <div>
                                <h2>Resumo financeiro</h2>
                                <p>Subtotal, desconto e total consolidado antes de abrir o modal de pagamento.</p>
                            </div>
                        </div>
                        <div className="pos-total-panel">
                            <div><span>Subtotal</span><strong>{formatMoney(totals.subtotal)}</strong></div>
                            <div><span>Desconto</span><strong>{formatMoney(totals.discount)}</strong></div>
                            <div className="pos-total-row"><span>Total</span><strong>{formatMoney(totals.total)}</strong></div>
                        </div>
                        <div className="pos-sale-summary-meta">
                            <span>{pricing.summary.title}</span>
                            <strong>{pricing.summary.description}</strong>
                            {pricing.summary.itemHint ? <small>{pricing.summary.itemHint}</small> : null}
                        </div>
                    </section>
                </div>
            </div>

            <PaymentModal
                open={paymentModalOpen}
                onClose={() => setPaymentModalOpen(false)}
                onConfirm={handleConfirmPaymentStep}
                paymentOptions={paymentOptions}
                paymentMethod={paymentMethod}
                onPaymentChange={handlePaymentMethodChange}
                mixedPayments={mixedPayments}
                mixedDraft={mixedDraft}
                mixedRemaining={mixedRemaining}
                onMixedDraftChange={handleMixedDraftChange}
                onMixedPaymentChange={handleMixedPaymentChange}
                onMixedPaymentRemove={handleRemoveMixedPayment}
                onAddMixedPayment={handleAddMixedPayment}
                totals={totals}
                cashReceived={cashReceived}
                onCashReceivedChange={setCashReceived}
                cashChange={cashChange}
                cashShortfall={cashShortfall}
                selectedCustomerData={selectedCustomerData}
                creditStatus={creditStatus}
                busy={submitting}
            />

            <FiscalDecisionModal open={fiscalDecisionOpen} onClose={() => setFiscalDecisionOpen(false)} onCloseSale={handleCloseSaleWithoutFiscal} onEmitCoupon={handleEmitCouponChoice} totals={totals} busy={submitting} />

            <FiscalRecipientModal
                open={recipientModalOpen}
                onClose={() => setRecipientModalOpen(false)}
                documentModel={recipientDocumentModel}
                onDocumentModelChange={setRecipientDocumentModel}
                selectionMode={recipientSelectionMode}
                onSelectionModeChange={setRecipientSelectionMode}
                searchTerm={recipientSearch}
                onSearchTermChange={setRecipientSearch}
                filteredCustomers={filteredRecipientCustomers}
                filteredCompanies={filteredRecipientCompanies}
                selectedCustomerId={selectedCustomer}
                selectedCompanyId={selectedCompany}
                onSelectCustomer={handleRecipientCustomerSelect}
                onSelectCompany={handleRecipientCompanySelect}
                manualRecipient={manualRecipient}
                onManualRecipientChange={handleManualRecipientChange}
                quickCompanyForm={quickCompanyForm}
                onQuickCompanyFormChange={handleQuickCompanyFormChange}
                onQuickCompanyCreate={handleQuickCompanyCreate}
                allowCompanySelection={supportsCompanies}
                creatingCompany={creatingCompany}
                submitting={submitting}
                onSubmit={handleSubmitRecipient}
            />

            <PendingSaleRestoreModal open={pendingSalePromptOpen} pendingSale={pendingSaleServerState} busy={pendingSaleActionBusy} onRestore={handleRestorePendingSale} onDiscard={handleDiscardPendingSale} />

            <DiscountModal
                open={discountModalOpen}
                onClose={closeDiscountModal}
                managers={managers || []}
                pricing={pricing}
                selectedCartItem={selectedCartItem}
                discountDraft={discountDraft}
                onDraftChange={handleDiscountDraftChange}
                discountPreview={discountPreview}
                authorizationForm={discountAuthorizationForm}
                onAuthorizationChange={handleDiscountAuthorizationChange}
                onClear={handleClearDiscount}
                onSubmit={handleApplyDiscount}
                busy={authorizingDiscount}
            />

            {openCashRegisterModal ? (
                <div className="pos-quick-customer" onClick={closeOpenCashRegisterModal}>
                    <form className="pos-quick-customer-card" onSubmit={handleOpenCashRegister} onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Abrir caixa</h2>
                                <p>Defina o valor inicial para iniciar o turno atual.</p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={closeOpenCashRegisterModal}>Cancelar</button>
                        </div>

                        <label className="pos-discount-form-field">
                            Valor de abertura
                            <input className="ui-input" type="number" min="0" step="0.01" value={openCashRegisterModal.openingAmount} onChange={(event) => handleOpenCashRegisterFieldChange('openingAmount', event.target.value)} autoFocus />
                        </label>

                        <label className="pos-discount-form-field">
                            Observacao
                            <textarea className="ui-input" rows="3" value={openCashRegisterModal.openingNotes} onChange={(event) => handleOpenCashRegisterFieldChange('openingNotes', event.target.value)} />
                        </label>

                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={closeOpenCashRegisterModal}>Voltar</button>
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
                    <form className="pos-quick-customer-card pos-cash-close-card" onSubmit={handleConfirmCloseCashRegister} onClick={(event) => event.stopPropagation()}>
                        <div className="pos-quick-customer-header">
                            <div>
                                <h2>Fechar caixa</h2>
                                <p>{requireCashClosingConference ? 'Confira os totais por forma de pagamento antes de concluir.' : 'Informe o valor contado em dinheiro para concluir rapidamente.'}</p>
                            </div>
                            <button className="ui-button-ghost" type="button" onClick={closeCloseCashRegisterModal}>Cancelar</button>
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
                                            <input className="ui-input" type="number" step="0.01" min="0" value={closeCashRegisterModal.form.amounts[row.key]} onChange={(event) => handleCloseCashRegisterAmountChange(row.key, event.target.value)} />
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
                            <textarea className="ui-input pos-cash-close-notes" rows="3" value={closeCashRegisterModal.form.notes} onChange={(event) => handleCloseCashRegisterNotesChange(event.target.value)} />
                        </label>

                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={closeCloseCashRegisterModal}>Voltar</button>
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
                                <p>Pesquise por nome, telefone ou CPF e vincule a venda rapidamente.</p>
                            </div>
                            <div className="pos-customer-picker-top-actions">
                                <button className="ui-button-ghost" type="button" onClick={handleOpenQuickCustomer}>
                                    <i className="fa-solid fa-user-plus" />
                                    Novo cliente
                                </button>
                                <button className="ui-button-ghost" type="button" onClick={closeCustomerPicker}>Fechar</button>
                            </div>
                        </div>

                        <div className="pos-customer-picker-search">
                            <i className="fa-solid fa-magnifying-glass" />
                            <input className="ui-input pos-customer-picker-input" placeholder="Buscar cliente por nome, telefone ou CPF" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} autoFocus />
                        </div>

                        <div className="pos-customer-picker-toolbar">
                            <button type="button" className={`pos-customer-picker-ghost ${selectedCustomer ? '' : 'active'}`} onClick={handleClearCustomer}>
                                <i className="fa-solid fa-user-slash" />
                                Nao identificado
                            </button>
                            <span>{filteredCustomers.length} cliente(s) encontrado(s)</span>
                        </div>

                        <div className="pos-customer-picker-list">
                            {filteredCustomers.length ? filteredCustomers.map((customer) => {
                                const isActive = String(customer.id) === String(selectedCustomer)
                                return (
                                    <button key={customer.id} type="button" className={`pos-customer-picker-item ${isActive ? 'active' : ''}`} onClick={() => handleCustomerSelect(customer.id)}>
                                        <span className="pos-customer-picker-item-icon"><i className={`fa-solid ${isActive ? 'fa-circle-check' : 'fa-user'}`} /></span>
                                        <span className="pos-customer-picker-item-copy">
                                            <strong>{customer.name}</strong>
                                            <small>{customer.document || customer.phone || 'Sem documento informado'}</small>
                                        </span>
                                        <span className="pos-customer-picker-item-action">{isActive ? 'Selecionado' : 'Selecionar'}</span>
                                    </button>
                                )
                            }) : <div className="pos-empty-state">Nenhum cliente encontrado para essa busca.</div>}
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
                            <button className="ui-button-ghost" type="button" onClick={() => setQuickCustomerOpen(false)}>Fechar</button>
                        </div>
                        <input className="ui-input" placeholder="Nome do cliente" value={quickCustomerForm.name} onChange={(event) => setQuickCustomerForm((current) => ({ ...current, name: event.target.value }))} />
                        <input className="ui-input" placeholder="Telefone" value={quickCustomerForm.phone} onChange={(event) => setQuickCustomerForm((current) => ({ ...current, phone: event.target.value }))} />
                        <input className="ui-input" placeholder="CPF" value={quickCustomerForm.document} onChange={(event) => setQuickCustomerForm((current) => ({ ...current, document: event.target.value }))} />
                        <input className="ui-input" placeholder="E-mail" type="email" value={quickCustomerForm.email} onChange={(event) => setQuickCustomerForm((current) => ({ ...current, email: event.target.value }))} />
                        <div className="pos-quick-customer-actions">
                            <button className="ui-button-ghost" type="button" onClick={() => setQuickCustomerOpen(false)}>Cancelar</button>
                            <button className="pos-finalize-button" type="submit">Salvar cliente</button>
                        </div>
                    </form>
                </div>
            ) : null}
        </AppLayout>
    )
}

function totalsKey(cart, selectedCustomer, notes, discountConfig) {
    return JSON.stringify({
        cart: cart.map((item) => [item.id, item.qty]),
        selectedCustomer,
        notes,
        discountConfig,
    })
}

function PosWorkspace({
    tenantName,
    cashRegisterState,
    linkedCustomerSummary,
    productSearchInputRef,
    searchTerm,
    onSearchChange,
    onSearchKeyDown,
    barcodeHelperText,
    products,
    loadingProducts,
    recommendations,
    loadingRecommendations,
    onSelectSuggestedProduct,
    paymentReady,
    pricing,
    selectedCartItemId,
    onSelectItem,
    onAdjustItemQuantity,
    onRemoveItem,
    totals,
    shortcutButtons,
    onProductsShortcut,
    onCustomerShortcut,
    onDiscountShortcut,
    onPaymentShortcut,
    onCashShortcut,
    onFinalizeShortcut,
    cartLength,
    submitting,
    openPaymentStep,
    openDiscountModal,
    openCustomerModal,
    openCashierDraftsModal,
    openInvoiceStep,
    openFinalizeStep,
    onOpenCancel,
    supportsOrders,
    pendingOrderDrafts,
    activeOrderDraftId,
    loadingOrderDraftId,
    refreshingPendingOrders,
    cashierDraftsModalOpen,
    onCloseCashierDraftsModal,
    onRefreshCashierDrafts,
    onLoadOrderDraft,
    paymentModalOpen,
    onClosePaymentModal,
    paymentGridOptions,
    paymentMethod,
    onPaymentChange,
    cashReceived,
    onCashReceivedChange,
    cashChange,
    cashShortfall,
    mixedDraft,
    onMixedDraftChange,
    mixedPayments,
    onMixedPaymentChange,
    onMixedPaymentRemove,
    onAddMixedPayment,
    mixedRemaining,
    paymentOptions,
    selectedCustomerData,
    creditStatus,
    onConfirmPayment,
    discountModalOpen,
    onCloseDiscountModal,
    discountDraft,
    onDiscountModeChange,
    simpleDiscountValue,
    onSimpleDiscountValueChange,
    discountReason,
    onDiscountReasonChange,
    pricingSummary,
    discountPreview,
    managers,
    discountAuthorizationForm,
    onDiscountAuthorizationChange,
    onClearDiscount,
    onApplyDiscount,
    authorizingDiscount,
    customerModalOpen,
    onCloseCustomerModal,
    customerLinkForm,
    onCustomerLinkFieldChange,
    onLinkCustomer,
    linkingCustomer,
    invoiceModalOpen,
    onCloseInvoiceModal,
    invoiceGridOptions,
    invoiceChoice,
    onInvoiceChoiceChange,
    onEmitInvoice,
    cancelModalOpen,
    onCloseCancelModal,
    onCancelSale,
}) {
    return (
        <div className="pos-screen">
            <div className="pos-shell">
                <section className="pos-main-column">
                    <header className="pos-topbar">
                        <div className="pos-terminal-line">
                            <strong>{tenantName || 'Loja principal'} | {cashRegisterState ? 'Caixa principal' : 'Caixa fechado'}</strong>
                        </div>

                        <button
                            type="button"
                            className={`pos-customer-chip ${linkedCustomerSummary.source !== 'none' ? 'identified' : ''}`}
                            onClick={openCustomerModal}
                        >
                            <PosIcon name="user" />
                            <span>{linkedCustomerSummary.name}</span>
                        </button>
                    </header>

                    <div className="pos-barcode-row">
                        <span className="pos-barcode-icon">
                            <PosIcon name="scan" />
                        </span>
                        <input
                            ref={productSearchInputRef}
                            className="pos-barcode-input"
                            type="text"
                            value={searchTerm}
                            onChange={(event) => onSearchChange(event.target.value)}
                            onKeyDown={onSearchKeyDown}
                            placeholder="Codigo de barras ou nome do produto"
                            autoFocus
                        />
                    </div>

                    {searchTerm.trim() ? (
                        <div className="pos-suggestions-panel">
                            {loadingProducts ? (
                                <div className="pos-suggestion-empty">Buscando produtos...</div>
                            ) : products.length ? (
                                products.slice(0, 6).map((product) => (
                                    <button
                                        key={product.id}
                                        type="button"
                                        className="pos-suggestion-item"
                                        onClick={() => onSelectSuggestedProduct(product)}
                                    >
                                        <span className="pos-suggestion-main">
                                            <strong>{product.name}</strong>
                                            <small>{product.barcode || product.code || 'Sem codigo'}</small>
                                        </span>
                                        <span className="pos-suggestion-price">{formatMoney(product.sale_price)}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="pos-suggestion-empty">Nenhum produto encontrado para essa descricao.</div>
                            )}
                        </div>
                    ) : null}

                    <RecommendationRail
                        topSellers={recommendations.top_sellers}
                        topSellersContext={recommendations.top_sellers_context}
                        customerRecommendations={recommendations.customer_recommendations}
                        customerContext={recommendations.customer_context}
                        associations={recommendations.associations}
                        associationContext={recommendations.association_context}
                        loading={loadingRecommendations}
                        onAddProduct={onSelectSuggestedProduct}
                    />

                    <div className="pos-toolbar-status">
                        <span>{barcodeHelperText}</span>
                        <span>{paymentReady ? 'Pagamento confirmado. Escolha a emissao para concluir.' : cashRegisterState ? 'Pagamento pendente.' : 'Abra o caixa com Shift + X.'}</span>
                    </div>

                    <div className="pos-item-list" role="list">
                        {pricing.items.length ? pricing.items.map((item, index) => {
                            const discountPercent = Number(item.lineSubtotal || 0) > 0
                                ? roundCurrency((Number(item.lineDiscount || 0) / Number(item.lineSubtotal || 0)) * 100)
                                : 0
                            const badge = discountPercent > 0
                                ? { tone: 'discount', label: `-${formatNumber(discountPercent, { maximumFractionDigits: 1 })}%` }
                                : item.promo
                                    ? { tone: 'promo', label: 'PROMO' }
                                    : null

                            return (
                                <div
                                    key={`${item.id}-${index}`}
                                    role="button"
                                    tabIndex={0}
                                    className={`pos-item-row ${selectedCartItemId === item.id ? 'selected' : ''}`}
                                    onClick={() => onSelectItem(item.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            onSelectItem(item.id)
                                        }
                                    }}
                                >
                                    <span className="pos-item-index">{index + 1}</span>
                                    <span className="pos-item-name">{item.name}</span>
                                    <span className="pos-item-divider" aria-hidden="true" />
                                    <div className="pos-item-qty-controls">
                                        <button
                                            type="button"
                                            className="pos-item-qty-button"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                onAdjustItemQuantity(item.id, -1)
                                            }}
                                            aria-label={`Diminuir quantidade de ${item.name}`}
                                            title="Diminuir quantidade"
                                        >
                                            <PosIcon name="minus" />
                                        </button>
                                        <span className="pos-item-qty">{formatNumber(item.qty, { maximumFractionDigits: 3 })}x</span>
                                        <button
                                            type="button"
                                            className="pos-item-qty-button"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                onAdjustItemQuantity(item.id, 1)
                                            }}
                                            aria-label={`Aumentar quantidade de ${item.name}`}
                                            title="Aumentar quantidade"
                                        >
                                            <PosIcon name="plus" />
                                        </button>
                                    </div>
                                    <span className="pos-item-divider" aria-hidden="true" />
                                    <span className="pos-item-badge-cell">
                                        {badge ? <span className={`pos-item-badge ${badge.tone}`}>{badge.label}</span> : <span className="pos-item-badge empty">Sem ajuste</span>}
                                    </span>
                                    <span className="pos-item-divider" aria-hidden="true" />
                                    <span className="pos-item-price">{formatMoney(item.lineTotal ?? item.sale_price * item.qty)}</span>
                                    <button
                                        type="button"
                                        className="pos-item-remove"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onRemoveItem(item.id)
                                        }}
                                        aria-label={`Remover ${item.name}`}
                                        title="Remover item"
                                    >
                                        <PosIcon name="trash" />
                                    </button>
                                </div>
                            )
                        }) : (
                            <div className="pos-empty-sale">
                                <PosIcon name="basket" />
                                <strong>Nenhum item na venda</strong>
                                <span>Bipe um codigo ou digite o nome do produto e pressione Enter para comecar.</span>
                            </div>
                        )}
                    </div>

                    <footer className="pos-totals-footer">
                        <div className="pos-total-line">
                            <span>Subtotal</span>
                            <strong>{formatMoney(totals.subtotal)}</strong>
                        </div>
                        <div className="pos-total-line discount">
                            <span>Desconto</span>
                            <strong>{formatMoney(totals.discount)}</strong>
                        </div>
                        <div className="pos-total-line grand">
                            <span>Total</span>
                            <strong>{formatMoney(totals.total)}</strong>
                        </div>

                        <div className="pos-shortcut-strip">
                            {shortcutButtons.map((shortcut) => (
                                <button
                                    key={shortcut.key}
                                    type="button"
                                    className="pos-shortcut-button"
                                    onClick={() => {
                                        if (shortcut.key === 'products') return onProductsShortcut()
                                        if (shortcut.key === 'customer') return onCustomerShortcut()
                                        if (shortcut.key === 'discount') return onDiscountShortcut()
                                        if (shortcut.key === 'payment') return onPaymentShortcut()
                                        if (shortcut.key === 'cash') return onCashShortcut()
                                        if (shortcut.key === 'finalize') return onFinalizeShortcut()
                                    }}
                                >
                                    <span>{shortcut.label}</span>
                                    <strong>{shortcut.keys.join(' + ')}</strong>
                                </button>
                            ))}
                        </div>
                    </footer>
                </section>

                <aside className="pos-sidebar">
                    <PosSidebarAction label="Pagamento" icon="card" onClick={openPaymentStep} />
                    <PosSidebarAction label="Desconto" icon="discount" onClick={() => openDiscountModal()} />
                    <PosSidebarAction label="Cliente" icon="user" onClick={openCustomerModal} />
                    {supportsOrders ? <PosSidebarAction label="Comandas" icon="cart" onClick={openCashierDraftsModal} /> : null}
                    <div className="pos-sidebar-separator" />
                    <PosSidebarAction label="NF-e" icon="document" onClick={openInvoiceStep} />
                    <PosSidebarAction label="Cancelar" icon="cancel" tone="danger" onClick={onOpenCancel} />
                    <div className="pos-sidebar-spacer" />
                    <button
                        type="button"
                        className="pos-sidebar-finalize"
                        onClick={openFinalizeStep}
                        disabled={!cartLength || submitting}
                    >
                        <PosIcon name="check" />
                        <span>Finalizar</span>
                    </button>
                </aside>
            </div>

            <CashierDraftPullModal
                open={cashierDraftsModalOpen}
                orders={pendingOrderDrafts}
                activeOrderDraftId={activeOrderDraftId}
                loadingOrderId={loadingOrderDraftId}
                refreshing={refreshingPendingOrders}
                cartHasItems={cartLength > 0}
                onClose={onCloseCashierDraftsModal}
                onRefresh={onRefreshCashierDrafts}
                onLoadOrder={onLoadOrderDraft}
            />

            <PosModal open={paymentModalOpen} title="Pagamento" onClose={onClosePaymentModal}>
                <div className="pos-modal-total">{formatMoney(totals.total)}</div>

                <div className="pos-choice-grid payment">
                    {paymentGridOptions.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`pos-choice-card ${paymentMethod === option.value ? 'active' : ''}`}
                            onClick={() => onPaymentChange(option.value)}
                        >
                            <PosIcon name={option.icon} />
                            <span>{option.label}</span>
                        </button>
                    ))}
                </div>

                {paymentMethod === 'cash' ? (
                    <div className="pos-modal-section">
                        <label className="pos-field">
                            <span>Valor recebido</span>
                            <input
                                className="pos-field-input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={cashReceived}
                                onChange={(event) => onCashReceivedChange(event.target.value)}
                                placeholder="0,00"
                            />
                        </label>
                        <div className={`pos-inline-summary ${cashShortfall > 0 ? 'alert' : ''}`}>
                            <span>{cashShortfall > 0 ? 'Faltando' : 'Troco'}</span>
                            <strong>{formatMoney(cashShortfall > 0 ? cashShortfall : cashChange)}</strong>
                        </div>
                    </div>
                ) : null}

                {paymentMethod === 'mixed' ? (
                    <div className="pos-modal-section">
                        <div className="pos-inline-summary">
                            <span>Restante para distribuir</span>
                            <strong>{formatMoney(mixedRemaining)}</strong>
                        </div>
                        <div className="pos-mixed-entry">
                            <select
                                className="pos-field-input"
                                value={mixedDraft.method}
                                onChange={(event) => onMixedDraftChange('method', event.target.value)}
                            >
                                {paymentOptions.filter((option) => option.value !== 'mixed').map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                className="pos-field-input"
                                type="number"
                                step="0.01"
                                value={mixedDraft.amount}
                                onChange={(event) => onMixedDraftChange('amount', event.target.value)}
                                placeholder="Valor"
                            />
                            <button type="button" className="pos-inline-button compact" onClick={onAddMixedPayment}>
                                Adicionar
                            </button>
                        </div>

                        <div className="pos-mixed-list">
                            {mixedPayments.length ? mixedPayments.map((payment, index) => (
                                <div key={`${payment.method}-${index}`} className="pos-mixed-row">
                                    <span>{paymentOptions.find((option) => option.value === payment.method)?.label || payment.method}</span>
                                    <input
                                        className="pos-field-input"
                                        type="number"
                                        step="0.01"
                                        value={payment.amount}
                                        onChange={(event) => onMixedPaymentChange(index, event.target.value)}
                                    />
                                    <button type="button" className="pos-inline-button compact" onClick={() => onMixedPaymentRemove(index)}>
                                        Remover
                                    </button>
                                </div>
                            )) : (
                                <div className="pos-inline-empty">Adicione ao menos duas formas para dividir o pagamento.</div>
                            )}
                        </div>
                    </div>
                ) : null}

                {paymentMethod === 'credit' && selectedCustomerData && creditStatus ? (
                    <div className="pos-credit-strip">
                        <div><span>Cliente</span><strong>{selectedCustomerData.name}</strong></div>
                        <div><span>Limite</span><strong>{formatMoney(creditStatus.credit_limit)}</strong></div>
                        <div><span>Disponivel</span><strong>{formatMoney(creditStatus.available_credit)}</strong></div>
                    </div>
                ) : null}

                <div className="pos-modal-actions">
                    <button type="button" className="pos-button ghost" onClick={onClosePaymentModal}>
                        Voltar
                    </button>
                    <button type="button" className="pos-button confirm" onClick={onConfirmPayment}>
                        Confirmar {formatMoney(totals.total)}
                    </button>
                </div>
            </PosModal>

            <PosModal open={discountModalOpen} title="Desconto" onClose={onCloseDiscountModal}>
                <form className="pos-modal-form" onSubmit={onApplyDiscount}>
                    <div className="pos-discount-toggle">
                        <button
                            type="button"
                            className={discountDraft.mode === 'percent' ? 'active' : ''}
                            onClick={() => onDiscountModeChange('percent')}
                        >
                            %
                        </button>
                        <button
                            type="button"
                            className={discountDraft.mode === 'target_total' ? 'active' : ''}
                            onClick={() => onDiscountModeChange('value')}
                        >
                            R$
                        </button>
                    </div>

                    <label className="pos-field">
                        <span>{discountDraft.mode === 'percent' ? 'Percentual do desconto' : 'Valor do desconto'}</span>
                        <input
                            className="pos-field-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={simpleDiscountValue}
                            onChange={(event) => onSimpleDiscountValueChange(event.target.value)}
                            placeholder={discountDraft.mode === 'percent' ? '0' : '0,00'}
                        />
                    </label>

                    <label className="pos-field">
                        <span>Motivo (opcional)</span>
                        <input
                            className="pos-field-input"
                            type="text"
                            value={discountReason}
                            onChange={(event) => onDiscountReasonChange(event.target.value)}
                            placeholder="Ex: cliente fidelidade"
                        />
                    </label>

                    <div className="pos-discount-preview-strip">
                        <span>Subtotal {formatMoney(pricingSummary.subtotal)}</span>
                        <span>Desconto {formatMoney(discountPreview.discount)}</span>
                        <strong>Total {formatMoney(discountPreview.total)}</strong>
                    </div>

                    <div className="pos-inline-grid">
                        <label className="pos-field">
                            <span>Gerente</span>
                            <select
                                className="pos-field-input"
                                value={discountAuthorizationForm.authorizer_user_id}
                                onChange={(event) => onDiscountAuthorizationChange('authorizer_user_id', event.target.value)}
                            >
                                <option value="">Selecione</option>
                                {managers.map((manager) => (
                                    <option key={manager.id} value={manager.id}>
                                        {manager.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="pos-field">
                            <span>Senha</span>
                            <input
                                className="pos-field-input"
                                type="password"
                                value={discountAuthorizationForm.authorizer_password}
                                onChange={(event) => onDiscountAuthorizationChange('authorizer_password', event.target.value)}
                                placeholder="Senha gerencial"
                            />
                        </label>
                    </div>

                    <div className="pos-modal-actions">
                        <button type="button" className="pos-button ghost" onClick={onClearDiscount}>
                            Limpar
                        </button>
                        <button type="submit" className="pos-button confirm" disabled={authorizingDiscount}>
                            {authorizingDiscount ? 'Aplicando...' : 'Aplicar desconto'}
                        </button>
                    </div>
                </form>
            </PosModal>

            <PosModal open={customerModalOpen} title="Cliente" onClose={onCloseCustomerModal}>
                <form className="pos-modal-form" onSubmit={onLinkCustomer}>
                    <label className="pos-field">
                        <span>CPF / CNPJ</span>
                        <input
                            className="pos-field-input"
                            type="text"
                            value={customerLinkForm.document}
                            onChange={(event) => onCustomerLinkFieldChange('document', event.target.value)}
                            placeholder="Somente numeros"
                        />
                    </label>

                    <label className="pos-field">
                        <span>Nome</span>
                        <input
                            className="pos-field-input"
                            type="text"
                            value={customerLinkForm.name}
                            onChange={(event) => onCustomerLinkFieldChange('name', event.target.value)}
                            placeholder="Nome do cliente"
                        />
                    </label>

                    <label className="pos-field">
                        <span>Email (opcional)</span>
                        <input
                            className="pos-field-input"
                            type="email"
                            value={customerLinkForm.email}
                            onChange={(event) => onCustomerLinkFieldChange('email', event.target.value)}
                            placeholder="cliente@exemplo.com"
                        />
                    </label>

                    <div className="pos-modal-actions">
                        <button type="button" className="pos-button ghost" onClick={onCloseCustomerModal}>
                            Fechar
                        </button>
                        <button type="submit" className="pos-button info" disabled={linkingCustomer}>
                            {linkingCustomer ? 'Vinculando...' : 'Vincular'}
                        </button>
                    </div>
                </form>
            </PosModal>

            <PosModal open={invoiceModalOpen} title="Emissao" onClose={onCloseInvoiceModal}>
                <form className="pos-modal-form" onSubmit={onEmitInvoice}>
                    <div className="pos-choice-grid invoice">
                        {invoiceGridOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`pos-choice-card ${invoiceChoice === option.value ? 'active' : ''}`}
                                onClick={() => onInvoiceChoiceChange(option.value)}
                            >
                                <PosIcon name={option.icon} />
                                <span>{option.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="pos-inline-summary">
                        <span>Cliente</span>
                        <strong>{linkedCustomerSummary.name}</strong>
                    </div>

                    <div className="pos-modal-actions">
                        <button type="button" className="pos-button ghost" onClick={onCloseInvoiceModal}>
                            Voltar
                        </button>
                        <button type="submit" className="pos-button confirm" disabled={submitting}>
                            {submitting ? 'Emitindo...' : 'Emitir'}
                        </button>
                    </div>
                </form>
            </PosModal>

            <PosModal open={cancelModalOpen} title="Cancelar venda" onClose={onCloseCancelModal} tone="danger">
                <div className="pos-cancel-copy">
                    Todos os itens, descontos e pagamentos preparados nesta venda serao removidos.
                </div>

                <div className="pos-modal-actions">
                    <button type="button" className="pos-button ghost" onClick={onCloseCancelModal}>
                        Voltar
                    </button>
                    <button type="button" className="pos-button danger" onClick={onCancelSale}>
                        Cancelar venda
                    </button>
                </div>
            </PosModal>
        </div>
    )
}

function PosSidebarAction({ label, icon, tone = 'default', onClick }) {
    return (
        <button type="button" className={`pos-sidebar-action ${tone}`} onClick={onClick}>
            <PosIcon name={icon} />
            <span>{label}</span>
        </button>
    )
}

function PosCashCloseModal({
    closeModal,
    rows,
    supervisors,
    closingCashRegister,
    onClose,
    onAmountChange,
    onNotesChange,
    onReveal,
    onConfirmClose,
    onOpenSupervisorPrompt,
    onCloseSupervisorPrompt,
    onSupervisorFieldChange,
    onAuthorizeSupervisor,
}) {
    if (!closeModal) {
        return null
    }

    const step = closeModal.step === 'revealed' ? 'revealed' : 'informing'
    const systemVisible = step === 'revealed'
    const allFilled = rows.length > 0 && rows.every((row) => row.informed !== null)
    const totalExpected = rows.reduce((accumulator, row) => accumulator + Number(row.expected || 0), 0)
    const totalInformed = rows.reduce((accumulator, row) => accumulator + Number(row.informed || 0), 0)
    const totalDifference = totalInformed - totalExpected
    const registerId = closeModal.report?.cashRegister?.id
    const operatorName = closeModal.report?.cashRegister?.user_name || 'Operador'
    const openedAt = closeModal.report?.cashRegister?.opened_at
        ? new Date(closeModal.report.cashRegister.opened_at)
        : null
    const openedDateLabel = openedAt ? openedAt.toLocaleDateString('pt-BR') : null
    const openedTimeLabel = openedAt
        ? openedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : null
    const headerMeta = [
        registerId ? 'Caixa principal' : null,
        `Operador: ${operatorName}`,
        openedDateLabel,
        openedTimeLabel ? `abertura ${openedTimeLabel}` : null,
    ].filter(Boolean).join(' | ')
    const differenceTone = Math.abs(totalDifference) < 0.009 ? 'ok' : totalDifference > 0 ? 'ok' : 'neg'
    const differenceText = Math.abs(totalDifference) < 0.009
        ? 'Sem diferenca'
        : `${totalDifference > 0 ? '+' : '-'}${formatMoney(Math.abs(totalDifference))}`

    function resolveRowDifferenceLabel(row) {
        if (!systemVisible || row.difference === null) {
            return '-'
        }

        if (Math.abs(row.difference) < 0.009) {
            return 'ok'
        }

        return `${row.difference > 0 ? '+' : '-'}${formatMoney(Math.abs(row.difference))}`
    }

    function resolveRowDifferenceTone(row) {
        if (!systemVisible || row.difference === null) {
            return 'muted'
        }

        if (Math.abs(row.difference) < 0.009) {
            return 'ok'
        }

        return row.difference > 0 ? 'ok' : 'neg'
    }

    return (
        <div className="pos-quick-customer" onClick={onClose}>
            <div className="pos-quick-customer-card pos-cash-close-card" onClick={(event) => event.stopPropagation()}>
                <div className="pos-cash-close-header">
                    <div>
                        <h2>Fechamento de caixa</h2>
                        <p>{headerMeta}</p>
                    </div>
                    <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Fechar modal">
                        <PosIcon name="close" />
                    </button>
                </div>

                <div className="pos-cash-close-body">
                    <div className="pos-cash-close-head">
                        <span aria-hidden="true" />
                        <span>Forma</span>
                        <span className="right">Informado</span>
                        <span className={`right ${systemVisible ? '' : 'hidden'}`}>Sistema</span>
                        <span className="right">Diferenca</span>
                    </div>

                    <div className="pos-cash-close-rows">
                        {rows.map((row) => (
                            <div key={row.key} className="pos-cash-close-row">
                                <span className={`pos-cash-close-icon ${row.tone}`}>
                                    <PosIcon name={row.icon} />
                                </span>
                                <span className="pos-cash-close-name">{row.label}</span>
                                <input
                                    className="pos-field-input pos-cash-close-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={closeModal.form.amounts[row.key]}
                                    onChange={(event) => onAmountChange(row.key, event.target.value)}
                                    disabled={systemVisible}
                                    placeholder="0,00"
                                />
                                <span className={`pos-cash-close-system ${systemVisible ? '' : 'hidden'}`}>
                                    {formatMoney(row.expected)}
                                </span>
                                <span className={`pos-cash-close-row-diff ${resolveRowDifferenceTone(row)}`}>
                                    {resolveRowDifferenceLabel(row)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {systemVisible ? (
                        <button type="button" className="pos-cash-close-edit-link" onClick={onOpenSupervisorPrompt}>
                            Editar valores informados
                        </button>
                    ) : null}

                    {!systemVisible && closeModal.supervisorName ? (
                        <div className="pos-cash-close-edit-note">
                            Edicao liberada por {closeModal.supervisorName}.
                        </div>
                    ) : null}

                    {!supervisors.length ? (
                        <div className="pos-cash-close-edit-note muted">
                            Cadastre um usuario como supervisor em Usuarios para liberar a edicao apos a conferencia.
                        </div>
                    ) : null}

                    <div className="pos-cash-close-summary">
                        {!allFilled ? (
                            <div className="pos-cash-close-summary-empty">
                                Preencha todos os valores informados para continuar.
                            </div>
                        ) : systemVisible ? (
                            <>
                                <div className="pos-cash-close-summary-row">
                                    <span>Total sistema</span>
                                    <strong>{formatMoney(totalExpected)}</strong>
                                </div>
                                <div className="pos-cash-close-summary-row">
                                    <span>Total informado</span>
                                    <strong>{formatMoney(totalInformed)}</strong>
                                </div>
                                <div className="pos-cash-close-summary-row total">
                                    <span>Diferenca</span>
                                    <strong className={differenceTone}>{differenceText}</strong>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="pos-cash-close-summary-row">
                                    <span>Total informado</span>
                                    <strong>{formatMoney(totalInformed)}</strong>
                                </div>
                                <div className="pos-cash-close-summary-row total">
                                    <span>Pronto para conferencia</span>
                                    <small>Clique em revelar sistema</small>
                                </div>
                            </>
                        )}
                    </div>

                    <input
                        className="pos-field-input pos-cash-close-notes"
                        type="text"
                        value={closeModal.form.notes}
                        onChange={(event) => onNotesChange(event.target.value)}
                        placeholder="Observacoes (opcional)"
                    />
                </div>

                <div className="pos-cash-close-footer">
                    <button type="button" className="pos-button ghost" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`pos-button ${systemVisible ? 'confirm' : 'info'}`}
                        onClick={systemVisible ? onConfirmClose : onReveal}
                        disabled={!allFilled || closingCashRegister}
                    >
                        {systemVisible
                            ? (closingCashRegister ? 'Fechando...' : 'Fechar caixa')
                            : 'Revelar sistema'}
                    </button>
                </div>

                {closeModal.supervisorPromptOpen ? (
                    <div className="pos-cash-close-prompt" onClick={onCloseSupervisorPrompt}>
                        <div className="pos-cash-close-prompt-card" onClick={(event) => event.stopPropagation()}>
                            <div className="pos-cash-close-prompt-title">Senha de supervisor</div>
                            <div className="pos-cash-close-prompt-subtitle">
                                Escolha o supervisor e informe a senha para liberar a edicao apos a conferencia.
                            </div>

                            <label className="pos-field">
                                <span>Supervisor</span>
                                <select
                                    className="pos-field-input"
                                    value={closeModal.supervisorUserId}
                                    onChange={(event) => onSupervisorFieldChange('supervisorUserId', event.target.value)}
                                >
                                    <option value="">Selecione</option>
                                    {supervisors.map((supervisor) => (
                                        <option key={supervisor.id} value={supervisor.id}>
                                            {supervisor.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="pos-field">
                                <span>Senha</span>
                                <input
                                    className="pos-field-input"
                                    type="password"
                                    value={closeModal.supervisorPassword}
                                    onChange={(event) => onSupervisorFieldChange('supervisorPassword', event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            onAuthorizeSupervisor()
                                        }
                                    }}
                                    placeholder="Senha do supervisor"
                                />
                            </label>

                            <div className="pos-cash-close-prompt-error">
                                {closeModal.supervisorError || ' '}
                            </div>

                            <div className="pos-cash-close-prompt-actions">
                                <button type="button" className="pos-button ghost" onClick={onCloseSupervisorPrompt}>
                                    Cancelar
                                </button>
                                <button type="button" className="pos-button info" onClick={onAuthorizeSupervisor} disabled={closeModal.supervisorAuthorizing}>
                                    {closeModal.supervisorAuthorizing ? 'Validando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

function PosModal({ open, title, onClose, children, tone = 'default' }) {
    if (!open) {
        return null
    }

    return (
        <div className="pos-overlay" onClick={onClose}>
            <div className={`pos-modal-card ${tone}`} onClick={(event) => event.stopPropagation()}>
                <div className={`pos-modal-header ${tone}`}>
                    <h2>{title}</h2>
                    <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Fechar modal">
                        <PosIcon name="close" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

function PosIcon({ name }) {
    switch (name) {
        case 'scan':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7V5h2" />
                    <path d="M18 5h2v2" />
                    <path d="M20 17v2h-2" />
                    <path d="M6 19H4v-2" />
                    <path d="M7 8v8" />
                    <path d="M10 8v8" />
                    <path d="M13 8v8" />
                    <path d="M16 8v8" />
                </svg>
            )
        case 'card':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                    <path d="M2.5 10h19" />
                </svg>
            )
        case 'cash':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="6" width="18" height="12" rx="2" />
                    <circle cx="12" cy="12" r="2.5" />
                    <path d="M7 9h.01" />
                    <path d="M17 15h.01" />
                </svg>
            )
        case 'pix':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7.5 7.5 12 12l-4.5 4.5" />
                    <path d="M12 12 16.5 7.5" />
                    <path d="M12 12 16.5 16.5" />
                    <path d="M4.5 12 7.5 9" />
                    <path d="M19.5 12 16.5 9" />
                </svg>
            )
        case 'wallet':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 15.5v-7Z" />
                    <path d="M3 9h18" />
                    <path d="M16 13h3" />
                </svg>
            )
        case 'split':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v16" />
                    <path d="M6 8 12 4l6 4" />
                    <path d="m6 16 6 4 6-4" />
                </svg>
            )
        case 'discount':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 17 10-10" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="16" cy="16" r="1.5" />
                    <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z" />
                </svg>
            )
        case 'user':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 19a7 7 0 0 1 14 0" />
                </svg>
            )
        case 'cart':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="9" cy="19" r="1.5" />
                    <circle cx="17" cy="19" r="1.5" />
                    <path d="M4 5h2l2.2 9.5h9.9L20 8H7.2" />
                </svg>
            )
        case 'document':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 13h6" />
                    <path d="M9 17h6" />
                </svg>
            )
        case 'receipt':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 3h10v18l-2-1.5L13 21l-2-1.5L9 21l-2-1.5L5 21V5a2 2 0 0 1 2-2Z" />
                    <path d="M9 8h6" />
                    <path d="M9 12h6" />
                </svg>
            )
        case 'mail':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m4 7 8 6 8-6" />
                </svg>
            )
        case 'minus':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8" />
                </svg>
            )
        case 'plus':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12h8" />
                    <path d="M12 8v8" />
                </svg>
            )
        case 'cancel':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 9 6 6" />
                    <path d="m15 9-6 6" />
                </svg>
            )
        case 'check':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                </svg>
            )
        case 'basket':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 9 2 10h10l2-10H5Z" />
                    <path d="m9 9 3-5 3 5" />
                </svg>
            )
        case 'close':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 7 10 10" />
                    <path d="m17 7-10 10" />
                </svg>
            )
        case 'trash':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16" />
                    <path d="M9 7V5h6v2" />
                    <path d="M7 7l1 12h8l1-12" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                </svg>
            )
        default:
            return null
    }
}
