import { Head, router, usePage } from '@inertiajs/react'
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import ClosingReportModal from '@/Components/CashRegister/ClosingReportModal'
import CashierDraftPullModal from '@/Components/Pos/CashierDraftPullModal'
import PendingSaleRestoreModal from '@/Components/Pos/PendingSaleRestoreModal'
import RecommendationRail from '@/Components/Pos/RecommendationRail'
import ActionDrawer from '@/Components/UI/ActionDrawer'
import CompactModal from '@/Components/UI/CompactModal'
import StatusBadge from '@/Components/UI/StatusBadge'
import AppLayout from '@/Layouts/AppLayout'
import { useErrorFeedbackPopup } from '@/lib/errorPopup'
import useConfirmedSearch from '@/hooks/useConfirmedSearch'
import useModules from '@/hooks/useModules'
import { buildCloseCashRegisterModal, buildCloseCashRegisterRows, createOpenCashRegisterForm } from '@/lib/cashRegister'
import { formatMoney, formatNumber } from '@/lib/format'
import { apiRequest, isNetworkApiError } from '@/lib/http'
import { matchesTextSearchAny, normalizeTextSearch } from '@/lib/textSearch'
import {
    cacheOfflineCashRegisterReport,
    closeOfflineCashRegister,
    configureOfflineWorkspaceBridge,
    createOfflineCashRegister,
    createOfflineCompany,
    createOfflineCustomer,
    discardOfflinePendingSale,
    getOfflineCashRegisterHistory,
    getOfflineCashRegisterReport,
    hasOfflineWorkspaceData,
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
    registerOfflineCashMovement,
    subscribeOfflineWorkspace,
    syncOfflineWorkspace,
} from '@/lib/offline/workspace'
import { buildDiscountDraft, buildPreviewConfigFromDraft, resolvePricing, roundCurrency } from '@/Pages/Orders/orderUtils'
import './pos.css'

const shortcutHints = [
    { key: 'products', keys: ['Shift', 'P'], label: 'Focar busca de produtos' },
    { key: 'customer', keys: ['Shift', 'C'], label: 'Selecionar cliente' },
    { key: 'discount', keys: ['Shift', 'D'], label: 'Abrir desconto' },
    { key: 'payment', keys: ['Shift', 'F'], label: 'Abrir pagamento' },
    { key: 'cash', keys: ['Shift', 'X'], label: 'Abrir ou fechar caixa' },
    { key: 'withdrawal', keys: ['Shift', 'S'], label: 'Abrir sangria' },
    { key: 'supply', keys: ['Shift', 'U'], label: 'Abrir suprimento' },
    { key: 'finalize', keys: ['Shift', 'V'], label: 'Finalizar venda' },
    { key: 'escape', keys: ['Esc'], label: 'Fechar popup ativo' },
]

const footerShortcutHints = [
    { key: 'products', keys: ['Shift', 'P'], label: 'Produtos' },
    { key: 'customer', keys: ['Shift', 'C'], label: 'Cliente' },
    { key: 'discount', keys: ['Shift', 'D'], label: 'Desconto' },
    { key: 'payment', keys: ['Shift', 'F'], label: 'Pagamento' },
    { key: 'cash', keys: ['Shift', 'X'], label: 'Caixa' },
    { key: 'withdrawal', keys: ['Shift', 'S'], label: 'Sangria', icon: 'fa-circle-minus' },
    { key: 'supply', keys: ['Shift', 'U'], label: 'Suprimento', icon: 'fa-circle-plus' },
    { key: 'finalize', keys: ['Shift', 'V'], label: 'Finalizar' },
]

const shortcutActionByCode = {
    KeyP: 'products',
    KeyC: 'customer',
    KeyD: 'discount',
    KeyF: 'payment',
    KeyX: 'cash',
    KeyS: 'withdrawal',
    KeyU: 'supply',
    KeyV: 'finalize',
}

const emptyDiscountAuthorizer = null
const initialAuthorizationForm = { authorizer_user_id: '', authorizer_password: '' }
const initialQuickCustomerForm = { name: '', phone: '', document: '', email: '' }
const initialQuickCompanyForm = {
    name: '',
    trade_name: '',
    document: '',
    email: '',
    phone: '',
    state_registration: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city_name: '',
    city_code: '',
    state: '',
    zip_code: '',
}
const initialManualRecipient = {
    name: '',
    document: '',
    email: '',
    phone: '',
    state_registration: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city_name: '',
    city_code: '',
    state: '',
    zip_code: '',
}
const initialCustomerLinkForm = { name: '', document: '', email: '' }
const pendingSaleDismissStoragePrefix = 'nimvo:pos-pending-sale:dismissed'
const cashPanelCollapseStoragePrefix = 'nimvo:pos:cash-panel:collapsed'
const conditionalPaymentMethod = 'conditional'

function formatDateInputValue(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function defaultConditionalDueDate() {
    const date = new Date()
    date.setDate(date.getDate() + 7)

    return formatDateInputValue(date)
}

function buildCashPanelCollapseStorageKey(tenantId) {
    if (!tenantId) {
        return null
    }

    return `${cashPanelCollapseStoragePrefix}:${tenantId}`
}

function readCashPanelCollapsedPreference(tenantId) {
    const storageKey = buildCashPanelCollapseStorageKey(tenantId)

    if (!storageKey || typeof window === 'undefined') {
        return null
    }

    try {
        const storedValue = window.localStorage.getItem(storageKey)

        if (storedValue === '1') {
            return true
        }

        if (storedValue === '0') {
            return false
        }
    } catch {
        return null
    }

    return null
}

function writeCashPanelCollapsedPreference(tenantId, collapsed) {
    const storageKey = buildCashPanelCollapseStorageKey(tenantId)

    if (!storageKey || typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.setItem(storageKey, collapsed ? '1' : '0')
    } catch {
        return
    }
}

function formatShortDateTime(value) {
    if (!value) {
        return 'Sem horario'
    }

    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function formatShortTime(value) {
    if (!value) {
        return '--:--'
    }

    return new Date(value).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

function buildCashActivityRows(report) {
    if (!report) {
        return []
    }

    const movementRows = (report.movements || []).map((movement, index) => ({
        id: `movement-${movement.id ?? movement.created_at ?? index}`,
        type: movement.type,
        label: movement.type === 'supply' ? 'Suprimento' : 'Sangria',
        amount: Number(movement.amount || 0),
        detail: movement.reason || movement.user_name || 'Movimento manual',
        created_at: movement.created_at || null,
    }))
    const salesRows = (report.sales_rows || []).map((sale, index) => ({
        id: `sale-${sale.id ?? sale.sale_number ?? sale.created_at ?? index}`,
        type: 'sale',
        label: sale.sale_number ? `Venda ${sale.sale_number}` : 'Venda',
        amount: Number(sale.total || 0),
        detail: 'Venda finalizada',
        created_at: sale.created_at || null,
    }))

    return [...movementRows, ...salesRows].sort((left, right) =>
        new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime(),
    )
}

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

function normalizeDraftSearchValue(value) {
    return normalizeSearchValue(value)
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

function buildPendingSaleDismissStorageKey(tenantId, userId) {
    if (!tenantId || userId == null) {
        return null
    }

    return `${pendingSaleDismissStoragePrefix}:${tenantId}:${userId}`
}

function getPendingSaleSignature(pendingSale) {
    if (!pendingSale) {
        return null
    }

    if (pendingSale.id) {
        return String(pendingSale.id)
    }

    const cartSignature = (pendingSale.cart || [])
        .map((item) => [
            item.id ?? item.product_id ?? item.code ?? '',
            item.qty ?? item.quantity ?? '',
            item.sale_price ?? item.price ?? '',
        ].join('@'))
        .join('|')

    return [
        'offline',
        pendingSale.updated_at || pendingSale.saved_at || '',
        pendingSale.customer_id || '',
        pendingSale.order_draft_id || '',
        cartSignature,
    ].join(':')
}

function readDismissedPendingSaleSignature(tenantId, userId) {
    const storageKey = buildPendingSaleDismissStorageKey(tenantId, userId)

    if (!storageKey || typeof window === 'undefined') {
        return null
    }

    try {
        return window.localStorage.getItem(storageKey)
    } catch {
        return null
    }
}

function writeDismissedPendingSaleSignature(tenantId, userId, pendingSale) {
    const storageKey = buildPendingSaleDismissStorageKey(tenantId, userId)
    const signature = getPendingSaleSignature(pendingSale)

    if (!storageKey || !signature || typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.setItem(storageKey, signature)
    } catch {
        return
    }
}

function clearDismissedPendingSaleSignature(tenantId, userId) {
    const storageKey = buildPendingSaleDismissStorageKey(tenantId, userId)

    if (!storageKey || typeof window === 'undefined') {
        return
    }

    try {
        window.localStorage.removeItem(storageKey)
    } catch {
        return
    }
}

function resolveVisiblePendingSale(tenantId, userId, pendingSale) {
    if (!pendingSale || (Array.isArray(pendingSale.cart) && pendingSale.cart.length === 0)) {
        return null
    }

    const signature = getPendingSaleSignature(pendingSale)
    const dismissedSignature = readDismissedPendingSaleSignature(tenantId, userId)

    if (signature && dismissedSignature === signature) {
        return null
    }

    return pendingSale || null
}

export default function PosIndex({
    categories,
    productCatalog = [],
    customers: initialCustomers,
    companies: initialCompanies,
    managers,
    supervisors = [],
    cashRegister,
    openRegister = null,
    cashRegisterHistory: initialCashRegisterHistory = [],
    cashRegisterSettings = {},
    pendingOrderDrafts: initialPendingOrderDrafts,
    pendingOrderDraftDetails = [],
    preloadedOrderDraft,
    pendingSale: initialPendingSale,
    pendingNfces: initialPendingNfces = [],
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
    const allowOversell = Boolean(
        moduleState.settings?.allow_oversell
        ?? moduleState.settings?.pos?.allow_oversell
        ?? moduleState.capabilities?.allow_oversell
        ?? false,
    )
    const requireCashClosingConference = (
        cashRegisterSettings?.cash_closing?.require_conference
        ?? moduleState.settings?.cash_closing?.require_conference
    ) !== false
    const visibleInitialPendingSale = supportsPendingSales
        ? resolveVisiblePendingSale(tenantId, auth?.user?.id, initialPendingSale)
        : null

    const [feedback, setFeedback] = useState(null)
    useErrorFeedbackPopup(feedback, { onConsumed: () => setFeedback(null) })

    const [customers, setCustomers] = useState(initialCustomers || [])
    const [companies, setCompanies] = useState(initialCompanies || [])
    const [cashRegisterState, setCashRegisterState] = useState(openRegister?.cashRegister || cashRegister)
    const [cashRegisterReport, setCashRegisterReport] = useState(openRegister || null)
    const [cashRegisterHistory, setCashRegisterHistory] = useState(initialCashRegisterHistory || [])
    const [pendingOrderDrafts, setPendingOrderDrafts] = useState(initialPendingOrderDrafts || [])
    const [pendingNfces, setPendingNfces] = useState(initialPendingNfces || [])
    const [pendingNfcesModalOpen, setPendingNfcesModalOpen] = useState(false)
    const [pendingNfceBusyId, setPendingNfceBusyId] = useState(null)
    const [activeOrderDraftId, setActiveOrderDraftId] = useState(preloadedOrderDraft?.id ?? visibleInitialPendingSale?.order_draft_id ?? null)
    const [loadingOrderDraftId, setLoadingOrderDraftId] = useState(null)
    const [refreshingPendingOrders, setRefreshingPendingOrders] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState('')
    const productSearchControl = useConfirmedSearch('')
    const [products, setProducts] = useState([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [recommendations, setRecommendations] = useState(normalizeRecommendations(initialRecommendations))
    const [loadingRecommendations, setLoadingRecommendations] = useState(false)
    const [cart, setCart] = useState([])
    const [selectedCartItemId, setSelectedCartItemId] = useState(null)
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [selectedCompany, setSelectedCompany] = useState('')
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
    const customerSearchControl = useConfirmedSearch('')
    const [discountConfig, setDiscountConfig] = useState({ type: 'none' })
    const [discountModalOpen, setDiscountModalOpen] = useState(false)
    const [discountDraft, setDiscountDraft] = useState(buildDiscountDraft({ type: 'none' }))
    const [discountAuthorizer, setDiscountAuthorizer] = useState(emptyDiscountAuthorizer)
    const [discountAuthorizationForm, setDiscountAuthorizationForm] = useState(initialAuthorizationForm)
    const [authorizingDiscount, setAuthorizingDiscount] = useState(false)
    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [cashReceived, setCashReceived] = useState('')
    const [conditionalDueAt, setConditionalDueAt] = useState(defaultConditionalDueDate)
    const [mixedPayments, setMixedPayments] = useState([])
    const [mixedDraft, setMixedDraft] = useState({ method: 'cash', amount: '' })
    const [paymentReady, setPaymentReady] = useState(false)
    const [fiscalDecisionOpen, setFiscalDecisionOpen] = useState(false)
    const [recipientModalOpen, setRecipientModalOpen] = useState(false)
    const [recipientDocumentModel, setRecipientDocumentModel] = useState('65')
    const [recipientSelectionMode, setRecipientSelectionMode] = useState('document')
    const recipientSearchControl = useConfirmedSearch('')
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
    const [pendingSaleServerState, setPendingSaleServerState] = useState(visibleInitialPendingSale)
    const [pendingSalePromptOpen, setPendingSalePromptOpen] = useState(supportsPendingSales ? Boolean(visibleInitialPendingSale && !preloadedOrderDraft) : false)
    const [pendingSaleResolved, setPendingSaleResolved] = useState(supportsPendingSales ? (!visibleInitialPendingSale || Boolean(preloadedOrderDraft)) : true)
    const [pendingSaleActionBusy, setPendingSaleActionBusy] = useState(false)
    const [customerModalOpen, setCustomerModalOpen] = useState(false)
    const [cashierDraftsModalOpen, setCashierDraftsModalOpen] = useState(false)
    const [customerLinkForm, setCustomerLinkForm] = useState(initialCustomerLinkForm)
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
    const [invoiceChoice, setInvoiceChoice] = useState('65')
    const [cancelModalOpen, setCancelModalOpen] = useState(false)
    const [discountReason, setDiscountReason] = useState('')
    const [cashMovementModalType, setCashMovementModalType] = useState(null)
    const [cashMovementForm, setCashMovementForm] = useState({ amount: '', reason: '' })
    const [submittingCashMovement, setSubmittingCashMovement] = useState(false)
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
    const [mobileCashPanelOpen, setMobileCashPanelOpen] = useState(false)
    const [isMobileCashPanel, setIsMobileCashPanel] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024)
    const [cashPanelCollapsed, setCashPanelCollapsed] = useState(() => {
        const storedValue = readCashPanelCollapsedPreference(tenantId)

        if (storedValue != null) {
            return storedValue
        }

        if (typeof window !== 'undefined') {
            return window.innerWidth < 1280
        }

        return false
    })

    const productSearchInputRef = useRef(null)
    const cashRegisterReportRef = useRef(openRegister || null)
    const isResettingRef = useRef(false)
    const searchTerm = productSearchControl.draftValue
    const appliedSearchTerm = productSearchControl.value
    const customerSearch = customerSearchControl.draftValue
    const recipientSearch = recipientSearchControl.draftValue
    const deferredCustomerSearch = useDeferredValue(customerSearchControl.value)
    const deferredRecipientSearch = useDeferredValue(recipientSearchControl.value)

    useEffect(() => {
        setPendingNfces(initialPendingNfces || [])
    }, [initialPendingNfces])

    const paymentOptions = useMemo(
        () =>
            [
                { value: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave' },
                { value: 'pix', label: 'Pix', icon: 'fa-qrcode' },
                { value: 'debit_card', label: 'Debito', icon: 'fa-credit-card' },
                { value: 'credit_card', label: 'Credito', icon: 'fa-credit-card' },
                { value: 'credit', label: 'A Prazo', icon: 'fa-handshake' },
                { value: conditionalPaymentMethod, label: 'Condicional', icon: 'fa-tags' },
                { value: 'mixed', label: 'Misto', icon: 'fa-layer-group' },
            ].filter((option) => supportsDeferredPayment || !['credit', conditionalPaymentMethod].includes(option.value)),
        [supportsDeferredPayment],
    )
    const currentUserCanAuthorizeDiscountOffline = ['admin', 'manager'].includes(auth?.user?.role || '')
    const currentUserCanAuthorizeCloseCashOffline = supervisors.some((supervisor) => String(supervisor.id) === String(auth?.user?.id))

    function rememberDismissedPendingSale(pendingSale) {
        writeDismissedPendingSaleSignature(tenantId, auth?.user?.id, pendingSale)
    }

    function clearPendingSaleDismissal() {
        clearDismissedPendingSaleSignature(tenantId, auth?.user?.id)
    }

    function syncPendingSaleVisibility(nextPendingSale) {
        const nextSignature = getPendingSaleSignature(nextPendingSale)
        const dismissedSignature = readDismissedPendingSaleSignature(tenantId, auth?.user?.id)

        if (nextSignature && dismissedSignature && nextSignature !== dismissedSignature) {
            clearPendingSaleDismissal()
        }

        return resolveVisiblePendingSale(tenantId, auth?.user?.id, nextPendingSale)
    }

    function toggleCashPanelCollapsed() {
        setCashPanelCollapsed((current) => {
            const nextValue = !current
            writeCashPanelCollapsedPreference(tenantId, nextValue)
            return nextValue
        })
    }

    function syncCashRegisterPanelFromOffline(nextCashRegister = null, fallbackReport = null) {
        if (!tenantId) {
            return null
        }

        const offlineHistory = getOfflineCashRegisterHistory(tenantId)
        const activeRegister = nextCashRegister
        setCashRegisterState(activeRegister || null)
        setCashRegisterHistory(offlineHistory)

        if (!activeRegister?.id) {
            setCashRegisterReport(null)
            return null
        }

        const offlineReport = getOfflineCashRegisterReport(tenantId, activeRegister.id, {
            userName: auth?.user?.name,
            fallbackReport: fallbackReport || cashRegisterReport || openRegister,
        })

        setCashRegisterReport(offlineReport || null)

        return offlineReport || null
    }

    async function refreshCashRegisterPanel(registerId = cashRegisterState?.id, fallbackReport = null) {
        if (!tenantId) {
            return null
        }

        if (!registerId) {
            setCashRegisterState(null)
            setCashRegisterReport(null)
            setCashRegisterHistory(getOfflineCashRegisterHistory(tenantId))
            return null
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            const snapshot = getOfflineWorkspaceSnapshot(tenantId)
            return syncCashRegisterPanelFromOffline(snapshot.cashRegister, fallbackReport)
        }

        try {
            const response = await apiRequest(`/api/cash-registers/${registerId}/report`)
            const nextReport = cacheOfflineCashRegisterReport(tenantId, response.report) || response.report

            setCashRegisterState(nextReport?.cashRegister || null)
            setCashRegisterReport(nextReport || null)
            setCashRegisterHistory(getOfflineCashRegisterHistory(tenantId))

            return nextReport || null
        } catch (error) {
            if (isNetworkApiError(error)) {
                const snapshot = getOfflineWorkspaceSnapshot(tenantId)
                return syncCashRegisterPanelFromOffline(snapshot.cashRegister, fallbackReport)
            }

            throw error
        }
    }

    function openCashMovementModal(type) {
        if (!cashRegisterState) {
            showFeedback('warning', 'Abra o caixa antes de registrar uma movimentação.')
            return
        }

        setMobileCashPanelOpen(false)
        setCashMovementForm({ amount: '', reason: '' })
        setCashMovementModalType(type)
    }

    function closeCashMovementModal() {
        setCashMovementModalType(null)
        setCashMovementForm({ amount: '', reason: '' })
    }

    function openCashHistoryDrawer() {
        setMobileCashPanelOpen(false)
        setHistoryDrawerOpen(true)
    }

    function closeCashHistoryDrawer() {
        setHistoryDrawerOpen(false)
    }

    function handleCashMovementFieldChange(field, value) {
        setCashMovementForm((current) => ({
            ...current,
            [field]: value,
        }))
    }

    useEffect(() => {
        cashRegisterReportRef.current = cashRegisterReport || null
    }, [cashRegisterReport])

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
            setCashRegisterHistory(getOfflineCashRegisterHistory(tenantId))

            if (snapshot.cashRegister?.id) {
                const offlineReport = getOfflineCashRegisterReport(tenantId, snapshot.cashRegister.id, {
                    userName: auth?.user?.name,
                    fallbackReport: cashRegisterReportRef.current || openRegister,
                })
                setCashRegisterReport(offlineReport || null)
            } else {
                setCashRegisterReport(null)
            }

            if (!supportsPendingSales) {
                return
            }

            const offlinePendingSale = getOfflinePendingSale(tenantId, auth?.user?.id)
            const visibleOfflinePendingSale = syncPendingSaleVisibility(offlinePendingSale)

            if (visibleOfflinePendingSale) {
                setPendingSaleServerState(visibleOfflinePendingSale)
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

            const shouldSeedSnapshot =
                typeof navigator === 'undefined'
                || navigator.onLine !== false
                || !hasOfflineWorkspaceData(tenantId)

            if (shouldSeedSnapshot) {
                seedOfflineWorkspace(tenantId, {
                    categories,
                    products: productCatalog,
                    customers: initialCustomers,
                    companies: initialCompanies,
                    orders: pendingOrderDraftDetails,
                    cashRegister: openRegister?.cashRegister || cashRegister,
                    cashRegisterHistory: initialCashRegisterHistory,
                    pendingSaleUserId: auth?.user?.id,
                    pendingSale: visibleInitialPendingSale,
                })

                if (openRegister) {
                    cacheOfflineCashRegisterReport(tenantId, openRegister)
                }
            }

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
        initialCashRegisterHistory,
        openRegister,
        visibleInitialPendingSale,
        localAgentBridge,
        pendingOrderDraftDetails,
        preloadedOrderDraft,
        productCatalog,
        supportsPendingSales,
        tenantId,
    ])

    useEffect(() => {
        setCashRegisterState(openRegister?.cashRegister || cashRegister || null)
        setCashRegisterReport(openRegister || null)
        setCashRegisterHistory(initialCashRegisterHistory || [])

        if (tenantId && openRegister) {
            cacheOfflineCashRegisterReport(tenantId, openRegister)
        }
    }, [cashRegister, initialCashRegisterHistory, openRegister, tenantId])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined
        }

        const syncViewportState = () => {
            const mobile = window.innerWidth < 1024
            const storedValue = readCashPanelCollapsedPreference(tenantId)

            setIsMobileCashPanel(mobile)

            if (!mobile && storedValue == null) {
                setCashPanelCollapsed(window.innerWidth < 1280)
            } else if (storedValue != null) {
                setCashPanelCollapsed(storedValue)
            }

            if (!mobile) {
                setMobileCashPanelOpen(false)
            }
        }

        syncViewportState()
        window.addEventListener('resize', syncViewportState)

        return () => window.removeEventListener('resize', syncViewportState)
    }, [tenantId])

    useEffect(() => {
        const hasBlockingModal = Boolean(
            paymentModalOpen
            || discountModalOpen
            || customerPickerOpen
            || quickCustomerOpen
            || customerModalOpen
            || cashierDraftsModalOpen
            || invoiceModalOpen
            || cancelModalOpen
            || openCashRegisterModal
            || closeCashRegisterModal
            || cashReportModal
            || cashMovementModalType
            || historyDrawerOpen
            || mobileCashPanelOpen
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
        customerPickerOpen,
        quickCustomerOpen,
        customerModalOpen,
        cashierDraftsModalOpen,
        invoiceModalOpen,
        cancelModalOpen,
        openCashRegisterModal,
        closeCashRegisterModal,
        cashReportModal,
        cashMovementModalType,
        historyDrawerOpen,
        mobileCashPanelOpen,
        pendingSalePromptOpen,
    ])

    useEffect(() => {
        setPendingOrderDrafts(initialPendingOrderDrafts || [])
    }, [initialPendingOrderDrafts])

    useEffect(() => {
        setRecommendations(normalizeRecommendations(initialRecommendations))
    }, [initialRecommendations])

    useEffect(() => {
        if (preloadedOrderDraft) {
            applyOrderDraftToSale(preloadedOrderDraft, false)
            setPendingSalePromptOpen(false)
            setPendingSaleResolved(true)
        }
    }, [preloadedOrderDraft])

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
    }, [appliedSearchTerm, selectedCategory, tenantId])

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

        if (paymentMethod === 'credit' || paymentMethod === conditionalPaymentMethod) {
            setPaymentMethod('cash')
        }

        setMixedPayments((current) => current.filter((payment) => payment.method !== 'credit' && payment.method !== conditionalPaymentMethod))
        setMixedDraft((current) => ({
            ...current,
            method: ['credit', conditionalPaymentMethod].includes(current.method) ? 'cash' : current.method,
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
    }, [paymentMethod, cashReceived, conditionalDueAt, mixedPayments, mixedDraft, totalsKey(cart, selectedCustomer, notes, discountConfig)])

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
    const cashActivityRows = useMemo(() => buildCashActivityRows(cashRegisterReport), [cashRegisterReport])
    const cashMovementModalConfig = cashMovementModalType === 'withdrawal'
        ? {
            title: 'Sangria',
            icon: 'fa-circle-minus',
            badge: 'Saida manual',
            confirmLabel: 'Confirmar retirada',
            description: 'Retire um valor do turno atual e registre o motivo para auditoria.',
        }
        : cashMovementModalType === 'supply'
            ? {
                title: 'Suprimento',
                icon: 'fa-circle-plus',
                badge: 'Entrada manual',
                confirmLabel: 'Confirmar entrada',
                description: 'Adicione dinheiro ao caixa e descreva rapidamente o motivo.',
            }
            : null

    const filteredCustomers = useMemo(() => {
        const normalizedTerm = normalizeTextSearch(deferredCustomerSearch)
        if (!normalizedTerm) return customers.slice(0, 20)

        return customers.filter((customer) =>
            matchesTextSearchAny([customer.name, customer.phone, customer.document], normalizedTerm),
        )
    }, [customers, deferredCustomerSearch])

    const filteredRecipientCustomers = useMemo(() => {
        const normalizedTerm = normalizeTextSearch(deferredRecipientSearch)
        if (!normalizedTerm) return customers.slice(0, 20)

        return customers.filter((customer) =>
            matchesTextSearchAny([customer.name, customer.document], normalizedTerm),
        )
    }, [customers, deferredRecipientSearch])

    const filteredRecipientCompanies = useMemo(() => {
        const normalizedTerm = normalizeTextSearch(deferredRecipientSearch)
        if (!normalizedTerm) return companies.slice(0, 20)

        return companies.filter((company) =>
            matchesTextSearchAny([company.name, company.trade_name, company.document], normalizedTerm),
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
    }, [paymentMethod, paymentOptions, mixedPayments, totals.total, conditionalDueAt, selectedCustomer])

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
        if (manualRecipient.name || manualRecipient.document) {
            return {
                name: manualRecipient.name || 'Consumidor final',
                document: manualRecipient.document || '',
                email: manualRecipient.email || '',
                source: 'manual',
            }
        }

        if (selectedCustomerData) {
            return {
                name: selectedCustomerData.name,
                document: selectedCustomerData.document || '',
                email: selectedCustomerData.email || '',
                source: 'customer',
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
            return 'Pressione Pesquisar ou Enter para consultar o produto digitado.'
        }

        return 'Bipe o código de barras ou digite o nome do produto e pressione Enter.'
    }, [loadingProducts, products, searchTerm])

    const paymentGridOptions = useMemo(
        () => [
            { value: 'debit_card', label: 'Cartao Debito', icon: 'card' },
            { value: 'credit_card', label: 'Cartao Credito', icon: 'card' },
            { value: 'cash', label: 'Dinheiro', icon: 'cash' },
            { value: 'pix', label: 'Pix', icon: 'pix' },
            supportsDeferredPayment ? { value: 'credit', label: 'A Prazo', icon: 'wallet' } : null,
            supportsDeferredPayment ? { value: conditionalPaymentMethod, label: 'Condicional', icon: 'wallet' } : null,
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
            { key: 'fiscal', label: 'Decisão fiscal', done: false, active: fiscalDecisionOpen },
            { key: 'issue', label: recipientDocumentModel === '55' ? 'NF-e / DANFE' : 'Emissao', done: false, active: recipientModalOpen },
        ],
        [cart.length, paymentReady, paymentModalOpen, fiscalDecisionOpen, recipientModalOpen, recipientDocumentModel],
    )

    useEffect(() => {
        if (!supportsPendingSales) return undefined
        if (!pendingSaleResolved || submitting) return undefined
        if (isResettingRef.current && cart.length) return undefined

        const timeout = setTimeout(async () => {
            const offlinePayload = {
                cash_register_id: cashRegisterState?.id || null,
                order_draft_id: activeOrderDraftId || null,
                customer_id: selectedCustomer || null,
                company_id: selectedCompany || null,
                notes: notes || null,
                status: 'draft',
                cart: pricing.items.map((item) => ({
                    ...item,
                    qty: Number(item.qty),
                    lineTotal: (Number(item.sale_price) * Number(item.qty)) - Number(item.lineDiscount || 0),
                })),
                discount: { config: discountConfig, authorizer: discountAuthorizer },
                payment: {
                    payment_method: paymentMethod,
                    cash_received: cashReceived === '' ? null : Number(cashReceived),
                    conditional_due_at: paymentMethod === conditionalPaymentMethod ? conditionalDueAt : null,
                    mixed_payments: mixedPayments,
                    mixed_draft: mixedDraft,
                },
            }

            if (!cart.length) {
                isResettingRef.current = false

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
                    setPendingSaleServerState(syncPendingSaleVisibility(offlinePendingSale))
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

                setPendingSaleServerState(syncPendingSaleVisibility(response.pending_sale))
            } catch {
                const offlinePendingSale = saveOfflinePendingSale(tenantId, auth?.user?.id, offlinePayload)
                setPendingSaleServerState(syncPendingSaleVisibility(offlinePendingSale))
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
        conditionalDueAt,
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

    function buildOfflineDiscountAuthorizer() {
        if (!auth?.user?.id || !currentUserCanAuthorizeDiscountOffline) {
            throw new Error('No modo offline, apenas o gerente logado nesta máquina pode autorizar descontos.')
        }

        const selectedAuthorizerId = discountAuthorizationForm.authorizer_user_id || String(auth.user.id)

        if (String(selectedAuthorizerId) !== String(auth.user.id)) {
            throw new Error('No modo offline, selecione o próprio gerente logado para autorizar o desconto.')
        }

        return {
            id: Number(auth.user.id),
            name: auth.user.name || 'Gerente',
            role: auth.user.role || 'manager',
            authorized_at: new Date().toISOString(),
            offline: true,
        }
    }

    function applyOfflineDiscountAuthorization(previewConfig) {
        const offlineAuthorizer = buildOfflineDiscountAuthorizer()

        setDiscountConfig(previewConfig)
        setDiscountAuthorizer(offlineAuthorizer)
        setDiscountModalOpen(false)
        setDiscountAuthorizationForm(initialAuthorizationForm)
        showFeedback('warning', 'Desconto autorizado no modo offline pelo gerente logado nesta máquina.')
    }

    function authorizeCloseCashSupervisorOffline() {
        if (!closeCashRegisterModal) {
            return false
        }

        if (!auth?.user?.id || !currentUserCanAuthorizeCloseCashOffline) {
            setCloseCashRegisterModal((current) => (
                current
                    ? { ...current, supervisorError: 'No modo offline, a liberação depende do supervisor logado nesta máquina.' }
                    : current
            ))
            return false
        }

        const selectedSupervisorId = closeCashRegisterModal.supervisorUserId || String(auth.user.id)

        if (String(selectedSupervisorId) !== String(auth.user.id)) {
            setCloseCashRegisterModal((current) => (
                current
                    ? { ...current, supervisorError: 'No modo offline, selecione o próprio supervisor logado para liberar a edição.' }
                    : current
            ))
            return false
        }

        setCloseCashRegisterModal((current) => (
            current
                ? {
                    ...current,
                    step: 'informing',
                    supervisorPromptOpen: false,
                    supervisorUserId: String(auth.user.id),
                    supervisorPassword: '',
                    supervisorError: '',
                    supervisorAuthorizing: false,
                    supervisorName: auth.user.name || '',
                }
                : current
        ))
        showFeedback('warning', 'Edição liberada no modo offline pelo supervisor logado nesta máquina.')
        return true
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

    function applyProductSearch(nextValue = searchTerm) {
        return productSearchControl.apply(normalizeDraftSearchValue(nextValue))
    }

    function clearProductSearch() {
        productSearchControl.clear()
        setProducts([])
        setLoadingProducts(false)
    }

    function applyCustomerSearch(nextValue = customerSearch) {
        return customerSearchControl.apply(normalizeDraftSearchValue(nextValue))
    }

    function clearCustomerSearch() {
        customerSearchControl.clear()
    }

    function applyRecipientSearch(nextValue = recipientSearch) {
        return recipientSearchControl.apply(normalizeDraftSearchValue(nextValue))
    }

    function clearRecipientSearch() {
        recipientSearchControl.clear()
    }

    function closeCustomerPicker() {
        setCustomerPickerOpen(false)
        clearCustomerSearch()
    }

    function openCustomerPicker() {
        clearCustomerSearch()
        setFeedback(null)
        setCustomerPickerOpen(true)
    }

    function resetSale() {
        isResettingRef.current = true
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
        setConditionalDueAt(defaultConditionalDueDate())
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
        setConditionalDueAt(defaultConditionalDueDate())
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

        clearPendingSaleDismissal()
        setCart(pendingItems)
        setSelectedCartItemId(pendingItems[0]?.id ?? null)
        setSelectedCustomer(pendingSale?.customer_id ? String(pendingSale.customer_id) : '')
        setSelectedCompany(pendingSale?.company_id ? String(pendingSale.company_id) : '')
        setDiscountConfig(pendingSale?.discount?.config || { type: 'none' })
        setDiscountAuthorizer(pendingSale?.discount?.authorizer || emptyDiscountAuthorizer)
        setDiscountDraft(buildDiscountDraft(pendingSale?.discount?.config || { type: 'none' }, String(pendingItems[0]?.id ?? '')))
        setPaymentMethod(pendingSale?.payment?.payment_method || 'cash')
        setCashReceived(pendingSale?.payment?.cash_received == null ? '' : String(pendingSale.payment.cash_received))
        setConditionalDueAt(pendingSale?.payment?.conditional_due_at || defaultConditionalDueDate())
        setMixedPayments(pendingSale?.payment?.mixed_payments || [])
        setMixedDraft(pendingSale?.payment?.mixed_draft || { method: 'cash', amount: '' })
        setNotes(pendingSale?.notes || '')
        setActiveOrderDraftId(pendingSale?.order_draft_id || null)
        setPendingSaleServerState(syncPendingSaleVisibility(pendingSale))
        setPendingSaleResolved(true)
        setPendingSalePromptOpen(false)

        if (pendingSale?.has_dropped_items) {
            showFeedback('warning', 'Venda restaurada. Alguns produtos foram removidos por não estarem mais disponíveis.')
        } else {
            showFeedback('success', 'Venda pendente restaurada com sucesso.')
        }
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
            showFeedback('warning', 'Pedidos estao desativados nesta conta.')
            return
        }

        if (cart.length && Number(activeOrderDraftId) !== Number(orderDraftId)) {
            showFeedback('warning', 'Finalize ou limpe a venda atual antes de carregar outro pedido.')
            return
        }

        setLoadingOrderDraftId(orderDraftId)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineOrder = getOfflineOrderDetail(tenantId, orderDraftId)
                if (!offlineOrder) throw new Error('Pedido não encontrado no cache offline.')
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
            showFeedback('warning', 'Pedidos estao desativados nesta conta.')
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
                return current.map((item) => {
                    if (item.id !== product.id) {
                        return item
                    }

                    const nextQty = Number(item.qty) + 1
                    const stockLimit = Number(item.stock_quantity ?? 0)

                    if (!allowOversell && stockLimit > 0 && nextQty > stockLimit) {
                        showFeedback('warning', `Estoque insuficiente. Disponível: ${formatNumber(stockLimit)} unidade(s).`)
                        return item
                    }

                    return { ...item, qty: nextQty }
                })
            }

            return [...current, normalizeCartItem({ ...product, qty: 1 })]
        })
    }

    function handleQuantityChange(productId, value) {
        setCart((current) => current.map((item) => {
            if (item.id !== productId) {
                return item
            }

            const stockLimit = Number(item.stock_quantity ?? 0)
            const typedQty = Number(value || 0.001)
            const qty = allowOversell
                ? Math.max(0.001, typedQty)
                : Math.max(0.001, Math.min(typedQty, stockLimit > 0 ? stockLimit : Infinity))

            if (!allowOversell && stockLimit > 0 && typedQty > stockLimit) {
                showFeedback('warning', `Estoque insuficiente. Disponível: ${formatNumber(stockLimit)} unidade(s).`)
            }

            return { ...item, qty }
        }))
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

            const stockLimit = Number(item.stock_quantity ?? 0)

            if (!allowOversell && stockLimit > 0 && nextQty > stockLimit) {
                showFeedback('warning', `Estoque insuficiente. Disponível: ${formatNumber(stockLimit)} unidade(s).`)
                return [item]
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
        if (!supportsDeferredPayment && (value === 'credit' || value === conditionalPaymentMethod)) {
            showFeedback('warning', 'O modulo de prazo/condicional esta desativado nesta conta.')
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
            showFeedback('warning', 'Informe um valor válido para adicionar ao pagamento misto.')
            return
        }

        if (resolvedAmount > mixedRemaining + 0.001) {
            showFeedback('warning', 'A soma das parcelas não pode ultrapassar o total da venda.')
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
            showFeedback('warning', 'Adicione ao menos um produto antes de aplicar desconto.')
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
            showFeedback('warning', 'Informe um desconto válido antes de autorizar.')
            return
        }

        setAuthorizingDiscount(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                applyOfflineDiscountAuthorization(previewConfig)
                return
            }

            if (!discountAuthorizationForm.authorizer_user_id || !discountAuthorizationForm.authorizer_password) {
                showFeedback('warning', 'Selecione um gerente e informe a senha de autorização.')
                return
            }

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
            if (tenantId && isNetworkApiError(error)) {
                try {
                    applyOfflineDiscountAuthorization(previewConfig)
                    return
                } catch (offlineError) {
                    showFeedback('error', offlineError.message)
                    return
                }
            }

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

        const term = normalizeDraftSearchValue(searchTerm).trim()

        if (!term) {
            showFeedback('warning', 'Informe um código ou nome de produto antes de adicionar.')
            return
        }

        applyProductSearch(term)

        const localMatch = resolveProductMatch(products, term)

        if (localMatch) {
            handleAddProduct(localMatch)
            setSelectedCartItemId(localMatch.id)
            clearProductSearch()
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
                    showFeedback('info', 'Nenhum produto encontrado para esse código ou descrição.')
                    return
                }

                handleAddProduct(fallbackMatch)
                setSelectedCartItemId(fallbackMatch.id)
                clearProductSearch()
                return
            }

            const response = await apiRequest('/api/pdv/products', {
                params: { term, category_id: selectedCategory || undefined },
            })
            const match = resolveProductMatch(response.products || [], term)

            if (!match) {
                showFeedback('info', 'Nenhum produto encontrado para esse código ou descrição.')
                return
            }

            handleAddProduct(match)
            setSelectedCartItemId(match.id)
            clearProductSearch()
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
                    showFeedback('info', 'Nenhum produto encontrado para esse código ou descrição.')
                } else {
                    handleAddProduct(fallbackMatch)
                    setSelectedCartItemId(fallbackMatch.id)
                    clearProductSearch()
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
        clearProductSearch()
        requestAnimationFrame(() => {
            productSearchInputRef.current?.focus()
        })
    }

    function openConsumerModal() {
        setCustomerLinkForm({
            name: manualRecipient.name || selectedCustomerData?.name || '',
            document: manualRecipient.document || selectedCustomerData?.document || '',
            email: manualRecipient.email || selectedCustomerData?.email || '',
        })
        setCustomerModalOpen(true)
    }

    function handleCustomerLinkFieldChange(field, value) {
        setCustomerLinkForm((current) => ({ ...current, [field]: value }))
    }

    function handleSaveConsumer(event) {
        event.preventDefault()

        const name = customerLinkForm.name.trim()
        const document = customerLinkForm.document.trim()
        const email = customerLinkForm.email.trim()
        const normalizedDocument = normalizeDocument(document)

        if (!name && !normalizedDocument && !email) {
            setManualRecipient(initialManualRecipient)
            setCustomerLinkForm(initialCustomerLinkForm)
            setCustomerModalOpen(false)
            showFeedback('success', 'Consumidor fiscal removido desta venda.')
            return
        }

        if (!name || !normalizedDocument) {
            showFeedback('warning', 'Informe nome e CPF/CNPJ do consumidor antes de salvar.')
            return
        }

        setManualRecipient({
            name,
            document: normalizedDocument,
            email,
        })
        setCustomerLinkForm(initialCustomerLinkForm)
        setCustomerModalOpen(false)
        showFeedback('success', 'Consumidor definido para a emissão fiscal.')
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
        setMobileCashPanelOpen(false)

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

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                createOfflineCashRegister(tenantId, {
                    opening_amount: openingAmount,
                    opening_notes: openCashRegisterModal.openingNotes.trim() || null,
                }, {
                    userName: auth?.user?.name,
                })
                syncCashRegisterPanelFromOffline(getOfflineWorkspaceSnapshot(tenantId).cashRegister)
                setOpenCashRegisterModal(null)
                showFeedback('warning', 'Caixa aberto no modo offline. A sincronização será feita quando a internet voltar.')
                return
            }

            const response = await apiRequest('/api/cash-registers', {
                method: 'post',
                data: {
                    opening_amount: openingAmount,
                    opening_notes: openCashRegisterModal.openingNotes.trim() || null,
                },
            })

            setCashRegisterState({
                id: response.cash_register_id,
                user_name: auth?.user?.name || null,
                status: 'open',
                opened_at: new Date().toISOString(),
                opening_amount: openingAmount,
                opening_notes: openCashRegisterModal.openingNotes.trim() || null,
            })
            seedOfflineWorkspace(tenantId, {
                cashRegister: {
                    id: response.cash_register_id,
                    user_name: auth?.user?.name || null,
                    status: 'open',
                    opened_at: new Date().toISOString(),
                    opening_amount: openingAmount,
                    opening_notes: openCashRegisterModal.openingNotes.trim() || null,
                },
            })
            await refreshCashRegisterPanel(response.cash_register_id)
            setOpenCashRegisterModal(null)
            showFeedback('success', response.message || 'Caixa aberto com sucesso.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const openingAmount = Number(openCashRegisterModal.openingAmount || 0)

                createOfflineCashRegister(tenantId, {
                    opening_amount: openingAmount,
                    opening_notes: openCashRegisterModal.openingNotes.trim() || null,
                }, {
                    userName: auth?.user?.name,
                })
                syncCashRegisterPanelFromOffline(getOfflineWorkspaceSnapshot(tenantId).cashRegister)
                setOpenCashRegisterModal(null)
                showFeedback('warning', 'Caixa aberto no modo offline. A sincronização será feita quando a internet voltar.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setOpeningCashRegister(false)
        }
    }

    async function handleSubmitCashMovement(event) {
        event.preventDefault()

        if (!cashRegisterState || !cashMovementModalType) {
            return
        }

        const amount = Number(cashMovementForm.amount || 0)
        const reason = cashMovementForm.reason.trim()
        const isWithdrawal = cashMovementModalType === 'withdrawal'

        if (amount <= 0) {
            showFeedback('warning', 'Informe um valor maior que zero para continuar.')
            return
        }

        if (!reason) {
            showFeedback('warning', 'Informe o motivo desta movimentação antes de confirmar.')
            return
        }

        setSubmittingCashMovement(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                registerOfflineCashMovement(tenantId, cashRegisterState.id, {
                    type: cashMovementModalType,
                    amount,
                    reason,
                }, {
                    userName: auth?.user?.name,
                })
                syncCashRegisterPanelFromOffline(getOfflineWorkspaceSnapshot(tenantId).cashRegister, cashRegisterReport)
                closeCashMovementModal()
                showFeedback(
                    'warning',
                    isWithdrawal
                        ? 'Sangria registrada no modo offline. A sincronização será feita quando a internet voltar.'
                        : 'Suprimento registrado no modo offline. A sincronização será feita quando a internet voltar.',
                )
                return
            }

            const response = await apiRequest(`/api/cash-registers/${cashRegisterState.id}/movements`, {
                method: 'post',
                data: {
                    type: cashMovementModalType,
                    amount,
                    reason,
                },
            })

            await refreshCashRegisterPanel(cashRegisterState.id, cashRegisterReport)
            closeCashMovementModal()
            showFeedback('success', response.message || 'Movimentação registrada com sucesso.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                registerOfflineCashMovement(tenantId, cashRegisterState.id, {
                    type: cashMovementModalType,
                    amount,
                    reason,
                }, {
                    userName: auth?.user?.name,
                })
                syncCashRegisterPanelFromOffline(getOfflineWorkspaceSnapshot(tenantId).cashRegister, cashRegisterReport)
                closeCashMovementModal()
                showFeedback(
                    'warning',
                    isWithdrawal
                        ? 'Sangria registrada no modo offline. A sincronização será feita quando a internet voltar.'
                        : 'Suprimento registrado no modo offline. A sincronização será feita quando a internet voltar.',
                )
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setSubmittingCashMovement(false)
        }
    }

    async function handleOpenCloseCashRegister() {
        if (!cashRegisterState) return

        setMobileCashPanelOpen(false)
        setLoadingClosePreview(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineReport = getOfflineCashRegisterReport(tenantId, cashRegisterState.id, {
                    userName: auth?.user?.name,
                })

                if (!offlineReport) {
                    throw new Error('Não foi possível montar o resumo offline deste caixa.')
                }

                setCloseCashRegisterModal(buildCloseCashRegisterModal(offlineReport))
                return
            }

            const response = await apiRequest(`/api/cash-registers/${cashRegisterState.id}/report`)
            cacheOfflineCashRegisterReport(tenantId, response.report)
            setCloseCashRegisterModal(buildCloseCashRegisterModal(response.report))
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineReport = getOfflineCashRegisterReport(tenantId, cashRegisterState.id, {
                    userName: auth?.user?.name,
                })

                if (offlineReport) {
                    setCloseCashRegisterModal(buildCloseCashRegisterModal(offlineReport))
                    return
                }
            }

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
            showFeedback('warning', 'Preencha todos os valores informados antes de revelar o sistema.')
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
            showFeedback('warning', 'Cadastre ao menos um usuario como supervisor para liberar a edição apos a conferência.')
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

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            authorizeCloseCashSupervisorOffline()
            return
        }

        if (!closeCashRegisterModal.supervisorUserId || !closeCashRegisterModal.supervisorPassword) {
            setCloseCashRegisterModal((current) => (
                current
                    ? { ...current, supervisorError: 'Selecione o supervisor e informe a senha para liberar a edição.' }
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
            showFeedback('success', response.message || 'Edição liberada pelo supervisor.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error) && authorizeCloseCashSupervisorOffline()) {
                return
            }

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
            showFeedback('warning', 'Informe o valor contado em dinheiro antes de fechar o caixa.')
            return
        }

        setClosingCashRegister(true)

        try {
            const payload = {
                closing_amount: Number(closeCashRegisterModal.form.amounts.cash || 0),
                closing_notes: closeCashRegisterModal.form.notes || null,
                closing_totals: Object.fromEntries(
                    Object.entries(closeCashRegisterModal.form.amounts)
                        .filter(([key]) => requireCashClosingConference || key === 'cash')
                        .map(([key, value]) => [key, Number(value || 0)]),
                ),
            }

            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const result = closeOfflineCashRegister(tenantId, cashRegisterState.id, payload, {
                    userName: auth?.user?.name,
                    fallbackReport: closeCashRegisterModal.report,
                })
                setCloseCashRegisterModal(null)
                setCashRegisterState(null)
                setCashRegisterReport(null)
                setCashRegisterHistory(getOfflineCashRegisterHistory(tenantId))
                setCashReportModal(result.report)
                showFeedback('warning', result.message)
                return
            }

            const response = await apiRequest(`/api/cash-registers/${cashRegisterState.id}/close`, {
                method: 'post',
                data: payload,
            })

            cacheOfflineCashRegisterReport(tenantId, response.report)
            setCloseCashRegisterModal(null)
            setCashRegisterState(null)
            setCashRegisterReport(null)
            setCashRegisterHistory(getOfflineCashRegisterHistory(tenantId))
            seedOfflineWorkspace(tenantId, {
                cashRegister: null,
            })
            setCashReportModal(response.report)
            showFeedback('success', response.message || 'Caixa fechado com sucesso.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const payload = {
                    closing_amount: Number(closeCashRegisterModal.form.amounts.cash || 0),
                    closing_notes: closeCashRegisterModal.form.notes || null,
                    closing_totals: Object.fromEntries(
                        Object.entries(closeCashRegisterModal.form.amounts)
                            .filter(([key]) => requireCashClosingConference || key === 'cash')
                            .map(([key, value]) => [key, Number(value || 0)]),
                    ),
                }
                const result = closeOfflineCashRegister(tenantId, cashRegisterState.id, payload, {
                    userName: auth?.user?.name,
                    fallbackReport: closeCashRegisterModal.report,
                })
                setCloseCashRegisterModal(null)
                setCashRegisterState(null)
                setCashRegisterReport(null)
                setCashRegisterHistory(getOfflineCashRegisterHistory(tenantId))
                setCashReportModal(result.report)
                showFeedback('warning', result.message)
            } else {
                showFeedback('error', error.message)
            }
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
            discardOfflinePendingSale(tenantId, auth?.user?.id)
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

    async function discardPersistedPendingSale() {
        if (!supportsPendingSales) {
            discardOfflinePendingSale(tenantId, auth?.user?.id)
            return 'disabled'
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            discardOfflinePendingSale(tenantId, auth?.user?.id)
            return 'offline'
        }

        try {
            await apiRequest('/api/pdv/pending-sale', { method: 'delete' })
            discardOfflinePendingSale(tenantId, auth?.user?.id)
            return 'online'
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                discardOfflinePendingSale(tenantId, auth?.user?.id)
                return 'offline'
            }

            throw error
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
            const discardMode = await discardPersistedPendingSale()
            rememberDismissedPendingSale(pendingSaleServerState)
            setPendingSaleServerState(null)
            setPendingSaleResolved(true)
            setPendingSalePromptOpen(false)
            showFeedback(
                discardMode === 'offline' ? 'warning' : 'success',
                discardMode === 'offline'
                    ? 'Venda pendente descartada no modo offline.'
                    : 'Venda pendente descartada com segurança.',
            )
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setPendingSaleActionBusy(false)
        }
    }

    async function handleClearSale() {
        setSubmitting(true)

        try {
            const discardMode = await discardPersistedPendingSale()
            rememberDismissedPendingSale(pendingSaleServerState)
            resetSale()

            if (discardMode === 'offline') {
                showFeedback('warning', 'Venda limpa no modo offline.')
            }
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
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

            if (mixedPayments.some((payment) => payment.method === conditionalPaymentMethod)) {
                throw new Error('Venda condicional nao pode ser usada dentro de pagamento misto.')
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

        if (paymentMethod === conditionalPaymentMethod) {
            if (!selectedCustomer) {
                throw new Error('Selecione um cliente para registrar a venda condicional.')
            }

            if (!conditionalDueAt) {
                throw new Error('Informe a data limite da condicional.')
            }
        }

        if (paymentMethod === 'cash' && cashReceived !== '' && cashShortfall > 0.009) {
            throw new Error('O valor entregue em dinheiro precisa cobrir o total da venda.')
        }

        return [{ method: paymentMethod, amount: totals.total }]
    }

    function openPaymentStep() {
        if (!cart.length) {
            showFeedback('warning', 'Adicione ao menos um produto antes de seguir para o pagamento.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('warning', 'Abra o caixa antes de tentar vender.')
            return
        }

        setPaymentModalOpen(true)
    }

    function openInvoiceStep() {
        if (!cart.length) {
            showFeedback('warning', 'Adicione ao menos um produto antes de definir a emissão.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('warning', 'Abra o caixa antes de tentar vender.')
            return
        }

        if (!paymentReady) {
            showFeedback('warning', 'Confirme o pagamento antes de emitir ou finalizar a venda.')
            setPaymentModalOpen(true)
            return
        }

        if (paymentMethod === conditionalPaymentMethod) {
            showFeedback('warning', 'Venda condicional nao gera documento fiscal agora. Finalize para registrar na tela de Condicionais.')
            return
        }

        setInvoiceModalOpen(true)
    }

    function handleConfirmPaymentStep() {
        try {
            buildPaymentsPayload()
            setPaymentReady(true)
            setPaymentModalOpen(false)
            showFeedback(
                'success',
                paymentMethod === conditionalPaymentMethod
                    ? 'Condicional validada. Finalize para registrar a retirada.'
                    : 'Pagamento validado. Voce ja pode finalizar ou emitir o documento.',
            )
        } catch (error) {
            showFeedback('warning', error.message)
        }
    }

    function openFinalizeStep() {
        if (!cart.length) {
            showFeedback('warning', 'Adicione ao menos um produto antes de finalizar a venda.')
            return
        }

        if (!cashRegisterState) {
            showFeedback('warning', 'Abra o caixa antes de finalizar a venda.')
            return
        }

        if (!paymentReady) {
            openPaymentStep()
            return
        }

        if (paymentMethod === conditionalPaymentMethod) {
            void handleCloseSaleWithoutFiscal()
            return
        }

        openInvoiceStep()
    }

    async function handleRetryPendingNfce(document) {
        if (!document?.id || pendingNfceBusyId) {
            return
        }

        setPendingNfceBusyId(document.id)

        try {
            await apiRequest(`/api/fiscal/documents/${document.id}/retry`, { method: 'post' })
            setPendingNfces((current) => current.filter((entry) => entry.id !== document.id))
            showFeedback('success', 'NFC-e reenviada para processamento.')
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setPendingNfceBusyId(null)
        }
    }

    function handleCancelPendingNfceSale(document) {
        if (!document?.sale_id || pendingNfceBusyId) {
            return
        }

        const reason = window.prompt('Informe o motivo do cancelamento da venda')

        if (!reason) {
            return
        }

        setPendingNfceBusyId(document.id)

        router.post(`/consultas-cancelamentos/vendas/${document.sale_id}/cancelar`, { reason }, {
            preserveScroll: true,
            onSuccess: () => {
                setPendingNfces((current) => current.filter((entry) => entry.id !== document.id))
                showFeedback('success', 'Cancelamento solicitado com sucesso.')
            },
            onError: (errors) => {
                showFeedback('warning', Object.values(errors || {})[0] || 'Não foi possível cancelar a venda.')
            },
            onFinish: () => setPendingNfceBusyId(null),
        })
    }

    function openPendingNfceFile(url) {
        if (!url || typeof window === 'undefined') {
            showFeedback('warning', 'Arquivo fiscal indisponível para esta NFC-e.')
            return
        }

        window.open(url, '_blank', 'noopener,noreferrer')
    }

    function buildManualRecipientPayload(source) {
        return {
            type: 'document',
            name: source.name.trim(),
            document: normalizeDocument(source.document),
            email: source.email.trim() || null,
            phone: String(source.phone || '').replace(/\D/g, '') || null,
            state_registration: String(source.state_registration || '').trim() || null,
            street: String(source.street || '').trim() || null,
            number: String(source.number || '').trim() || null,
            complement: String(source.complement || '').trim() || null,
            district: String(source.district || '').trim() || null,
            city_name: String(source.city_name || '').trim() || null,
            city_code: String(source.city_code || '').replace(/\D/g, '') || null,
            state: String(source.state || '').trim().toUpperCase() || null,
            zip_code: String(source.zip_code || '').replace(/\D/g, '') || null,
        }
    }

    function buildInlineRecipientPayload(requireEmail = false, documentModel = '65') {
        const manualName = manualRecipient.name.trim()
        const manualDocument = normalizeDocument(manualRecipient.document)
        const manualEmail = manualRecipient.email.trim()

        if (manualName && manualDocument) {
            if (requireEmail && !manualEmail) {
                throw new Error('Informe um e-mail do consumidor antes de usar essa opção.')
            }

            const payload = buildManualRecipientPayload(manualRecipient)

            if (documentModel === '55') {
                const requiredFields = ['street', 'number', 'district', 'city_name', 'city_code', 'state', 'zip_code']
                const hasAllFields = requiredFields.every((field) => Boolean(payload[field]))

                if (!hasAllFields) {
                    throw new Error('Informe o endereco completo do destinatário antes de emitir NF-e.')
                }
            }

            return documentModel === '65'
                ? { ...payload, consumer_final: true }
                : payload
        }

        if (selectedCustomerData?.document) {
            const fallbackEmail = customerLinkForm.email.trim()

            if (requireEmail && !selectedCustomerData.email && !fallbackEmail) {
                throw new Error('Informe um e-mail do cliente antes de enviar o comprovante por e-mail.')
            }

            if (!selectedCustomerData.email && fallbackEmail) {
                return {
                    type: 'document',
                    name: selectedCustomerData.name,
                    document: normalizeDocument(selectedCustomerData.document),
                    email: fallbackEmail,
                    ...(documentModel === '65' ? { consumer_final: true } : {}),
                }
            }

            return {
                type: 'customer',
                customer_id: selectedCustomerData.id,
                ...(documentModel === '65' ? { consumer_final: true } : {}),
            }
        }

        const name = customerLinkForm.name.trim()
        const document = normalizeDocument(customerLinkForm.document)
        const email = customerLinkForm.email.trim()

        if (documentModel === '65' && !name && !document) {
            return {
                type: 'consumer_final',
                consumer_final: true,
            }
        }

        if (!name || !document) {
            throw new Error('Identifique o consumidor com nome e CPF/CNPJ antes de emitir o documento fiscal.')
        }

        if (documentModel === '55') {
            throw new Error('Use a etapa de destinatário da NF-e para informar endereco completo do recebedor.')
        }

        if (requireEmail && !email) {
            throw new Error('Informe um e-mail do consumidor antes de usar essa opção.')
        }

        return {
            ...buildManualRecipientPayload(customerLinkForm),
            name,
            document,
            email: email || null,
            ...(documentModel === '65' ? { consumer_final: true } : {}),
        }
    }

    function buildSaleItemsPayload() {
        return pricing.items.map((item) => ({
            id: item.id,
            qty: Number(item.qty),
            unit_price: Number(item.sale_price || 0),
            discount: Number(item.lineDiscount || 0),
            discount_percent: Number(item.lineSubtotal || 0) > 0
                ? roundCurrency((Number(item.lineDiscount || 0) / Number(item.lineSubtotal || 0)) * 100)
                : 0,
            discount_scope: discountConfig.type === 'item' ? 'item' : (discountConfig.type === 'none' ? null : 'sale'),
            discount_authorized_by: Number(item.lineDiscount || 0) > 0 ? discountAuthorizer?.id || null : null,
            discount_authorized_at: Number(item.lineDiscount || 0) > 0 ? discountAuthorizer?.authorized_at || null : null,
            discount_authorized_offline: Number(item.lineDiscount || 0) > 0 ? Boolean(discountAuthorizer?.offline) : false,
        }))
    }

    async function finalizeSale({ fiscalDecision, requestedDocumentModel = '65', recipientPayload = null }) {
        const payments = buildPaymentsPayload()
        const salePayload = {
            cash_register_id: cashRegisterState?.id || null,
            order_draft_id: activeOrderDraftId || null,
            customer_id: selectedCustomer || recipientPayload?.customer_id || null,
            company_id: selectedCompany || recipientPayload?.company_id || null,
            discount: totals.discount,
            notes: notes || null,
            cash_received: paymentMethod === 'cash' && cashReceived !== '' ? Number(cashReceived) : null,
            conditional_due_at: paymentMethod === conditionalPaymentMethod ? conditionalDueAt : null,
            fiscal_decision: fiscalDecision,
            requested_document_model: requestedDocumentModel,
            recipient_payload: recipientPayload,
            items: buildSaleItemsPayload(),
            payments,
            total: totals.total,
        }

        if (paymentMethod === conditionalPaymentMethod && typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('Venda condicional precisa de conexao para registrar a retirada e baixar estoque em tempo real.')
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return queueOfflineSaleFinalize(tenantId, salePayload, { userId: auth?.user?.id })
        }

        try {
            return await apiRequest('/api/pdv/sales', {
                method: 'post',
                data: {
                    ...salePayload,
                    cash_register_id: salePayload.cash_register_id,
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

            await concludeFinalizedSale(finalizedOrderDraftId, async () => {
                if (response.sale?.sale_id > 0 && cashRegisterState?.id) {
                    await refreshCashRegisterPanel(cashRegisterState.id, cashRegisterReport)
                }
            })

            if (response.sale?.type === 'conditional') {
                showFeedback('success', `Condicional ${response.sale.conditional_code} registrada e enviada para a tela de Condicionais.`)
                return
            }

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
            const recipientPayload = buildInlineRecipientPayload(requireEmail, requestedDocumentModel)
            const finalizedOrderDraftId = activeOrderDraftId
            const response = await finalizeSale({
                fiscalDecision: 'emit',
                requestedDocumentModel,
                recipientPayload,
            })

            if (response.sale?.sale_id < 0) {
                await concludeFinalizedSale(finalizedOrderDraftId)
                showFeedback('warning', `Venda ${response.sale.sale_number} registrada no modo offline. A emissão fiscal será tentada quando a conexão voltar.`)
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

            await concludeFinalizedSale(finalizedOrderDraftId, async () => {
                if (cashRegisterState?.id) {
                    await refreshCashRegisterPanel(cashRegisterState.id, cashRegisterReport)
                }
            })
            showFeedback(
                'success',
                requestedDocumentModel === '55'
                    ? `Venda ${response.sale.sale_number} enviada para emissão de NF-e / DANFE.`
                    : invoiceChoice === 'email'
                        ? `Venda ${response.sale.sale_number} enviada para emissão com contato por e-mail.`
                        : `Venda ${response.sale.sale_number} enviada para emissão fiscal.`,
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

        if (manualRecipient.name || manualRecipient.document) {
            setRecipientSelectionMode('document')
            return
        }

        if (selectedCustomerData?.document) {
            setRecipientSelectionMode('customer')
        } else if (selectedCompanyData?.document) {
            setRecipientSelectionMode('company')
        } else {
            setRecipientSelectionMode('consumer_final')
            setManualRecipient((current) => ({
                name: current.name || selectedCustomerData?.name || '',
                document: current.document || selectedCustomerData?.document || '',
                email: current.email || selectedCustomerData?.email || '',
            }))
        }
    }

    function handleRecipientDocumentModelChange(nextModel) {
        setRecipientDocumentModel(nextModel)

        if (nextModel === '55' && recipientSelectionMode === 'consumer_final') {
            setRecipientSelectionMode('document')
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
            showFeedback('warning', 'O cadastro de empresas ainda não esta disponível neste tenant. Aplique as migrations pendentes para habilitar esse fluxo.')
            return
        }

        if (!quickCompanyForm.name.trim()) {
            showFeedback('warning', 'Informe a razão social da empresa antes de cadastrar.')
            return
        }

        setCreatingCompany(true)

        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                const offlineCompany = createOfflineCompany(tenantId, quickCompanyForm)
                setSelectedCompany(String(offlineCompany.id))
                setQuickCompanyForm(initialQuickCompanyForm)
                showFeedback('warning', 'Empresa salva no modo offline e pronta para reutilização.')
                return
            }

            const response = await apiRequest('/api/pdv/companies/quick', { method: 'post', data: quickCompanyForm })

            persistCompaniesInWorkspace([
                ...getOfflineWorkspaceSnapshot(tenantId).catalogs.companies,
                response.company,
            ])
            setSelectedCompany(String(response.company.id))
            setQuickCompanyForm(initialQuickCompanyForm)
            showFeedback('success', 'Empresa cadastrada e pronta para reutilização.')
        } catch (error) {
            if (tenantId && isNetworkApiError(error)) {
                const offlineCompany = createOfflineCompany(tenantId, quickCompanyForm)
                setSelectedCompany(String(offlineCompany.id))
                setQuickCompanyForm(initialQuickCompanyForm)
                showFeedback('warning', 'Empresa salva no modo offline e pronta para reutilização.')
            } else {
                showFeedback('error', error.message)
            }
        } finally {
            setCreatingCompany(false)
        }
    }

    function buildRecipientPayload() {
        if (recipientSelectionMode === 'consumer_final') {
            if (recipientDocumentModel !== '65') {
                throw new Error('Consumidor final não identificado esta disponível apenas para NFC-e.')
            }

            return {
                type: 'consumer_final',
                consumer_final: true,
            }
        }

        if (recipientSelectionMode === 'customer') {
            const customer = customers.find((entry) => String(entry.id) === String(selectedCustomer))
            if (!customer) throw new Error('Selecione um cliente válido para emitir o documento fiscal.')
            return {
                type: 'customer',
                customer_id: customer.id,
                ...(recipientDocumentModel === '65' ? { consumer_final: true } : {}),
            }
        }

        if (recipientSelectionMode === 'company') {
            if (!supportsCompanies) {
                throw new Error('O cadastro de empresas ainda não esta disponível neste tenant.')
            }

            const company = companies.find((entry) => String(entry.id) === String(selectedCompany))
            if (!company) throw new Error('Selecione uma empresa valida para emitir o documento fiscal.')
            return {
                type: 'company',
                company_id: company.id,
                ...(recipientDocumentModel === '65' ? { consumer_final: true } : {}),
            }
        }

        const name = manualRecipient.name.trim()
        const document = manualRecipient.document.replace(/\D/g, '')
        if (!name || !document) {
            if (recipientDocumentModel === '65') {
                throw new Error('Informe nome e CPF/CNPJ do destinatário ou selecione o consumidor final não identificado.')
            }

            throw new Error('Informe nome e CPF/CNPJ do destinatário antes de continuar.')
        }

        if (recipientDocumentModel === '55') {
            const requiredFields = [
                ['street', 'logradouro'],
                ['number', 'numero'],
                ['district', 'bairro'],
                ['city_name', 'município'],
                ['city_code', 'código IBGE do município'],
                ['state', 'UF'],
                ['zip_code', 'CEP'],
            ]

            const missingField = requiredFields.find(([field]) => !String(manualRecipient[field] || '').trim())

            if (missingField) {
                throw new Error(`Informe ${missingField[1]} do destinatário para emitir NF-e.`)
            }
        }

        const payload = buildManualRecipientPayload(manualRecipient)

        return recipientDocumentModel === '65'
            ? { ...payload, consumer_final: true }
            : payload
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
                showFeedback('warning', `Venda ${response.sale.sale_number} registrada no modo offline. A emissão fiscal será tentada quando a conexão voltar.`)
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

                await concludeFinalizedSale(finalizedOrderDraftId, async () => {
                    if (cashRegisterState?.id) {
                        await refreshCashRegisterPanel(cashRegisterState.id, cashRegisterReport)
                    }
                })
                showFeedback(
                    'success',
                    recipientDocumentModel === '55'
                        ? `Venda ${response.sale.sale_number} enviada para emissão de NF-e / DANFE.`
                        : `Venda ${response.sale.sale_number} enviada para emissão fiscal.`,
                )
            } catch (error) {
                await concludeFinalizedSale(finalizedOrderDraftId, async () => {
                    if (cashRegisterState?.id) {
                        await refreshCashRegisterPanel(cashRegisterState.id, cashRegisterReport)
                    }
                })
                showFeedback('error', `Venda ${response.sale.sale_number} concluída, mas a etapa fiscal falhou: ${error.message}`)
            }
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
            setRecipientModalOpen(false)
        }
    }

    async function handleCancelSale() {
        setSubmitting(true)

        try {
            const discardMode = await discardPersistedPendingSale()
            resetSale()
            showFeedback(
                discardMode === 'offline' ? 'warning' : 'success',
                discardMode === 'offline'
                    ? 'Venda cancelada no modo offline.'
                    : 'Venda cancelada e carrinho limpo.',
            )
        } catch (error) {
            showFeedback('error', error.message)
        } finally {
            setSubmitting(false)
        }
    }

    function closeShortcutDrivenPanels() {
        setCashReportModal(null)
        closeCashMovementModal()
        closeCashHistoryDrawer()
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
        setMobileCashPanelOpen(false)
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

    function openCashMovementShortcut(type) {
        closeShortcutDrivenPanels()

        if (!submittingCashMovement && !closingCashRegister && !openingCashRegister) {
            openCashMovementModal(type)
        }
    }

    function openWithdrawalShortcut() {
        openCashMovementShortcut('withdrawal')
    }

    function openSupplyShortcut() {
        openCashMovementShortcut('supply')
    }

    function openCustomerShortcut() {
        closeShortcutDrivenPanels()
        openCustomerPicker()
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
                || cashMovementModalType
                || historyDrawerOpen
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
                || mobileCashPanelOpen
                || pendingSalePromptOpen,
            )
            const hasBlockingModal = Boolean(pendingSalePromptOpen)
            const shortcutAction = event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey
                ? shortcutActionByCode[event.code]
                : null

            if (event.key === 'Escape') {
                if (historyDrawerOpen) return void (event.preventDefault(), closeCashHistoryDrawer())
                if (cashMovementModalType) return void (event.preventDefault(), closeCashMovementModal())
                if (cashReportModal) return void (event.preventDefault(), closeCashReportModal())
                if (openCashRegisterModal) return void (event.preventDefault(), closeOpenCashRegisterModal())
                if (closeCashRegisterModal?.supervisorPromptOpen) return void (event.preventDefault(), handleCloseCashSupervisorPrompt())
                if (closeCashRegisterModal) return void (event.preventDefault(), closeCloseCashRegisterModal())
                if (mobileCashPanelOpen) return void (event.preventDefault(), setMobileCashPanelOpen(false))
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

            if (shortcutAction === 'withdrawal') {
                if (!submittingCashMovement && !closingCashRegister && !openingCashRegister) {
                    openWithdrawalShortcut()
                }
                return
            }

            if (shortcutAction === 'supply') {
                if (!submittingCashMovement && !closingCashRegister && !openingCashRegister) {
                    openSupplyShortcut()
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
        cashMovementModalType,
        historyDrawerOpen,
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
        mobileCashPanelOpen,
        pendingSalePromptOpen,
        cashRegisterState,
        cart.length,
        selectedCartItemId,
        selectedCustomerData,
        manualRecipient,
        paymentReady,
        submitting,
        submittingCashMovement,
        loadingClosePreview,
        closingCashRegister,
        openingCashRegister,
    ])

    const workspaceProps = {
        tenantName: tenant?.name,
        cashRegisterState,
        cashRegisterReport,
        cashRegisterHistory,
        cashPanelCollapsed,
        isMobileCashPanel,
        mobileCashPanelOpen,
        linkedCustomerSummary,
        productSearchInputRef,
        searchTerm,
        appliedSearchTerm,
        onSearchChange: (value) => productSearchControl.setDraftValue(value),
        onSearchSubmit: applyProductSearch,
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
        allowOversell,
        onRemoveItem: handleRemove,
        totals,
        shortcutButtons: footerShortcutHints,
        onProductsShortcut: focusProductsShortcut,
        onCustomerShortcut: openCustomerShortcut,
        onDiscountShortcut: openDiscountShortcut,
        onPaymentShortcut: openPaymentShortcut,
        onCashShortcut: openCashShortcut,
        onWithdrawalShortcut: openWithdrawalShortcut,
        onSupplyShortcut: openSupplyShortcut,
        onFinalizeShortcut: openFinalizeShortcut,
        cartLength: cart.length,
        submitting,
        submittingCashMovement,
        openPaymentStep,
        openDiscountModal,
        openCustomerPicker,
        openConsumerModal,
        openCashierDraftsModal,
        openInvoiceStep,
        openFinalizeStep,
        onToggleCashPanel: toggleCashPanelCollapsed,
        onOpenMobileCashPanel: () => setMobileCashPanelOpen(true),
        onCloseMobileCashPanel: () => setMobileCashPanelOpen(false),
        onOpenCashRegister: handleOpenCashWorkflow,
        onOpenCashMovement: openCashMovementModal,
        onOpenCashHistory: openCashHistoryDrawer,
        onOpenCloseCashRegister: handleOpenCashWorkflow,
        onOpenPendingNfces: () => setPendingNfcesModalOpen(true),
        pendingNfceCount: pendingNfces.length,
        loadingClosePreview,
        openingCashRegister,
        closingCashRegister,
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
        conditionalDueAt,
        onConditionalDueAtChange: setConditionalDueAt,
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
        onSaveConsumer: handleSaveConsumer,
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
            <Head title="PDV">
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

            <PendingNfceModal
                busyId={pendingNfceBusyId}
                documents={pendingNfces}
                open={pendingNfcesModalOpen}
                onCancelSale={handleCancelPendingNfceSale}
                onClose={() => setPendingNfcesModalOpen(false)}
                onOpenFile={openPendingNfceFile}
                onRetry={handleRetryPendingNfce}
            />

            <CompactModal
                open={Boolean(cashMovementModalType && cashMovementModalConfig)}
                title={cashMovementModalConfig?.title || 'Movimentação'}
                description={cashMovementModalConfig?.description || 'Registrar movimentação manual.'}
                icon={cashMovementModalConfig?.icon || 'fa-arrow-right-arrow-left'}
                badge={cashMovementModalConfig?.badge || null}
                onClose={closeCashMovementModal}
                footer={(
                    <>
                        <button type="button" className="pos-button ghost" onClick={closeCashMovementModal}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="pos-cash-movement-form"
                            className="pos-button confirm"
                            disabled={submittingCashMovement}
                        >
                            {submittingCashMovement ? 'Salvando...' : cashMovementModalConfig?.confirmLabel || 'Confirmar'}
                        </button>
                    </>
                )}
            >
                <form id="pos-cash-movement-form" className="pos-modal-form" onSubmit={handleSubmitCashMovement}>
                    <label className="pos-field">
                        <span>Valor</span>
                        <input
                            className="pos-field-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={cashMovementForm.amount}
                            onChange={(event) => handleCashMovementFieldChange('amount', event.target.value)}
                            placeholder="0,00"
                            autoFocus
                        />
                    </label>

                    <label className="pos-field">
                        <span>Motivo</span>
                        <textarea
                            className="pos-field-input textarea"
                            rows="3"
                            value={cashMovementForm.reason}
                            onChange={(event) => handleCashMovementFieldChange('reason', event.target.value)}
                            placeholder="Descreva rapidamente o motivo da movimentação"
                        />
                    </label>
                </form>
            </CompactModal>

            <PosCashActivityDrawer
                open={historyDrawerOpen}
                cashRegisterState={cashRegisterState}
                report={cashRegisterReport}
                activityRows={cashActivityRows}
                history={cashRegisterHistory}
                onClose={closeCashHistoryDrawer}
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
                            <span>Observação</span>
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
                            <input className="ui-input pos-customer-picker-input" placeholder="Buscar cliente por nome, telefone ou CPF" value={customerSearch} onChange={(event) => customerSearchControl.setDraftValue(event.target.value)} onKeyDown={(event) => {
                                if (event.key !== 'Enter') {
                                    return
                                }

                                event.preventDefault()
                                applyCustomerSearch()
                            }} autoFocus />
                            <button type="button" className="ui-button-ghost" onClick={() => applyCustomerSearch()}>
                                <i className="fa-solid fa-magnifying-glass" />
                                Pesquisar
                            </button>
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
                                    <p>Produtos, revisão, pagamento e fiscal organizados por etapa para reduzir ruido operacional.</p>
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
                                <p>O fluxo agora avanca por revisão, pagamento e decisao fiscal em modais separados.</p>
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
                        onSearchChange={(value) => productSearchControl.setDraftValue(value)}
                        onSearchSubmit={applyProductSearch}
                        searchInputRef={productSearchInputRef}
                        hasSearchTerm={appliedSearchTerm.trim() !== ''}
                        products={products}
                        loading={loadingProducts}
                        onAddProduct={handleAddProduct}
                        title="Selecao de produtos"
                        subtitle="Busque por nome, código ou EAN e adicione direto na venda."
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
                                <strong>{selectedCustomerData?.name || 'Não identificado'}</strong>
                                <small>{selectedCustomerData?.document || selectedCustomerData?.phone || 'Selecione um cliente quando precisar de credito ou identificação.'}</small>
                                <div className="pos-review-actions">
                                    <button type="button" className="pos-inline-button" onClick={openCustomerPicker}>
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
                                <strong>{paymentReady ? 'Pronto para finalizar' : 'Aguardando confirmação'}</strong>
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
                                        ? 'Venda pendente indisponível'
                                        : pendingSaleServerState
                                            ? 'Salvando automaticamente'
                                            : 'Sem pendencia remota'}
                                </strong>
                                <small>
                                    {activeOrderDraftId
                                        ? `Pedido carregado: #${activeOrderDraftId}`
                                        : supportsPendingSales
                                            ? 'A venda atual pode ser restaurada se a pagina recarregar.'
                                            : 'A restauração automatica depende das migrations novas deste tenant.'}
                                </small>
                                <div className="pos-review-actions">
                                    <button type="button" className="pos-inline-button" onClick={() => openDiscountModal()} disabled={!cart.length}>
                                        <i className="fa-solid fa-money-bill-wave" />
                                        Desconto
                                        <kbd>Shift + D</kbd>
                                    </button>
                                    <button type="button" className="pos-inline-button" onClick={handleClearSale} disabled={!cart.length || submitting}>
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
                conditionalDueAt={conditionalDueAt}
                onConditionalDueAtChange={setConditionalDueAt}
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
                onOpenCustomerPicker={openCustomerPicker}
                onQuickCustomer={handleOpenQuickCustomer}
                busy={submitting}
            />

            <FiscalDecisionModal open={fiscalDecisionOpen} onClose={() => setFiscalDecisionOpen(false)} onCloseSale={handleCloseSaleWithoutFiscal} onEmitCoupon={handleEmitCouponChoice} totals={totals} busy={submitting} />

            <FiscalRecipientModal
                open={recipientModalOpen}
                onClose={() => setRecipientModalOpen(false)}
                documentModel={recipientDocumentModel}
                onDocumentModelChange={handleRecipientDocumentModelChange}
                selectionMode={recipientSelectionMode}
                onSelectionModeChange={setRecipientSelectionMode}
                searchTerm={recipientSearch}
                onSearchTermChange={(value) => recipientSearchControl.setDraftValue(value)}
                onSearchTermSubmit={applyRecipientSearch}
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
                            Observação
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
                            Observação do fechamento
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
                            <input className="ui-input pos-customer-picker-input" placeholder="Buscar cliente por nome, telefone ou CPF" value={customerSearch} onChange={(event) => customerSearchControl.setDraftValue(event.target.value)} onKeyDown={(event) => {
                                if (event.key !== 'Enter') {
                                    return
                                }

                                event.preventDefault()
                                applyCustomerSearch()
                            }} autoFocus />
                            <button type="button" className="ui-button-ghost" onClick={() => applyCustomerSearch()}>
                                <i className="fa-solid fa-magnifying-glass" />
                                Pesquisar
                            </button>
                        </div>

                        <div className="pos-customer-picker-toolbar">
                            <button type="button" className={`pos-customer-picker-ghost ${selectedCustomer ? '' : 'active'}`} onClick={handleClearCustomer}>
                                <i className="fa-solid fa-user-slash" />
                                Não identificado
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
    cashRegisterReport,
    cashRegisterHistory,
    cashPanelCollapsed,
    isMobileCashPanel,
    mobileCashPanelOpen,
    linkedCustomerSummary,
    productSearchInputRef,
    searchTerm,
    appliedSearchTerm,
    onSearchChange,
    onSearchSubmit,
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
    allowOversell,
    onRemoveItem,
    totals,
    shortcutButtons,
    onProductsShortcut,
    onCustomerShortcut,
    onDiscountShortcut,
    onPaymentShortcut,
    onCashShortcut,
    onWithdrawalShortcut,
    onSupplyShortcut,
    onFinalizeShortcut,
    cartLength,
    submitting,
    submittingCashMovement,
    openPaymentStep,
    openDiscountModal,
    openCustomerPicker,
    openConsumerModal,
    openCashierDraftsModal,
    openInvoiceStep,
    openFinalizeStep,
    onToggleCashPanel,
    onOpenMobileCashPanel,
    onCloseMobileCashPanel,
    onOpenCashRegister,
    onOpenCashMovement,
    onOpenCashHistory,
    onOpenCloseCashRegister,
    onOpenPendingNfces,
    pendingNfceCount,
    loadingClosePreview,
    openingCashRegister,
    closingCashRegister,
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
    conditionalDueAt,
    onConditionalDueAtChange,
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
    onSaveConsumer,
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
    const checkoutActionItems = [
        { key: 'payment', label: 'Pagamento', icon: 'card', onClick: openPaymentStep, disabled: !cartLength || submitting },
        { key: 'discount', label: 'Desconto', icon: 'discount', onClick: () => openDiscountModal(), disabled: !cartLength || submitting },
        { key: 'customer', label: 'Cliente', icon: 'user', onClick: openCustomerPicker, disabled: submitting },
        ...(supportsOrders ? [{ key: 'drafts', label: 'Comandas', icon: 'cart', onClick: openCashierDraftsModal, disabled: submitting }] : []),
        { key: 'consumer', label: 'Consumidor', icon: 'receipt', onClick: openConsumerModal, disabled: submitting },
        { key: 'invoice', label: 'NF-e', icon: 'document', onClick: openInvoiceStep, disabled: !cartLength || submitting || paymentMethod === conditionalPaymentMethod },
        { key: 'cancel', label: 'Cancelar', icon: 'cancel', onClick: onOpenCancel, disabled: !cartLength || submitting, tone: 'danger' },
        { key: 'finalize', label: submitting ? 'Finalizando...' : paymentMethod === conditionalPaymentMethod ? 'Registrar Condicional' : 'Finalizar Venda', icon: 'check', onClick: openFinalizeStep, disabled: !cartLength || submitting, tone: 'success' },
    ]
    const shortcutHandlers = {
        products: onProductsShortcut,
        customer: onCustomerShortcut,
        discount: onDiscountShortcut,
        payment: onPaymentShortcut,
        cash: onCashShortcut,
        withdrawal: onWithdrawalShortcut,
        supply: onSupplyShortcut,
        finalize: onFinalizeShortcut,
    }
    const resolveShortcutDisabled = (shortcutKey) => {
        if (shortcutKey === 'cash') {
            return loadingClosePreview || openingCashRegister || closingCashRegister
        }

        if (shortcutKey === 'withdrawal' || shortcutKey === 'supply') {
            return !cashRegisterState || submittingCashMovement || openingCashRegister || closingCashRegister
        }

        return false
    }
    const shellClassName = [
        'pos-shell',
        isMobileCashPanel ? 'panel-mobile' : 'panel-visible',
        !isMobileCashPanel && cashPanelCollapsed ? 'panel-collapsed' : 'panel-expanded',
    ].filter(Boolean).join(' ')
    const checkoutBlocked = !cashRegisterState

    return (
        <div className="pos-screen">
            <div className={shellClassName}>
                <section className="pos-main-column">
                    <header className="pos-topbar">
                        <div className="pos-terminal-line">
                            <strong>{tenantName || 'Loja principal'} | {cashRegisterState ? 'Caixa principal' : 'Caixa fechado'}</strong>
                        </div>

                        <div
                            className={`pos-customer-chip summary ${linkedCustomerSummary.source !== 'none' ? 'identified' : ''}`}
                            role="status"
                        >
                            <PosIcon name="user" />
                            <span>{linkedCustomerSummary.name}</span>
                        </div>
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
                            placeholder="Código de barras ou nome do produto"
                            autoFocus
                        />
                        <button type="button" className="ui-button-ghost" onClick={() => onSearchSubmit?.()}>
                            <i className="fa-solid fa-magnifying-glass" />
                            Pesquisar
                        </button>
                    </div>

                    {appliedSearchTerm.trim() ? (
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
                                            <small>{product.barcode || product.code || 'Sem código'}</small>
                                        </span>
                                        <span className="pos-suggestion-price">{formatMoney(product.sale_price)}</span>
                                    </button>
                                ))
                            ) : (
                                <div className="pos-suggestion-empty">Nenhum produto encontrado para essa descrição.</div>
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
                        <span>{paymentReady ? 'Pagamento confirmado. Escolha a emissão para concluir.' : cashRegisterState ? 'Pagamento pendente.' : 'Abra o caixa com Shift + X.'}</span>
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
                                            disabled={!allowOversell && Number(item.stock_quantity ?? 0) > 0 && Number(item.qty ?? 0) >= Number(item.stock_quantity ?? 0)}
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
                                <span>Bipe um código ou digite o nome do produto e pressione Enter para começar.</span>
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
                                    onClick={shortcutHandlers[shortcut.key]}
                                    disabled={resolveShortcutDisabled(shortcut.key)}
                                >
                                    <span className="pos-shortcut-button-label">
                                        {shortcut.icon ? <i className={`fa-solid ${shortcut.icon}`} /> : null}
                                        <span>{shortcut.label}</span>
                                    </span>
                                    <strong>{shortcut.keys.join(' + ')}</strong>
                                </button>
                            ))}
                        </div>
                    </footer>

                    {checkoutBlocked ? (
                        <div className="pos-locked-overlay">
                            <div className="pos-locked-card">
                                <StatusBadge label="CAIXA FECHADO" tone="danger" icon="fa-lock" />
                                <strong>Abra o caixa para liberar o checkout.</strong>
                                <span>O turno precisa ser iniciado antes de registrar itens, pagamentos e fechamento.</span>
                                <button
                                    type="button"
                                    className="pos-button info"
                                    onClick={onOpenCashRegister}
                                    disabled={openingCashRegister}
                                >
                                    {openingCashRegister ? 'Abrindo...' : 'Abrir caixa'}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>

                {!isMobileCashPanel ? (
                    <PosCashTurnPanel
                        cashRegisterState={cashRegisterState}
                        report={cashRegisterReport}
                        history={cashRegisterHistory}
                        collapsed={cashPanelCollapsed}
                        loadingClosePreview={loadingClosePreview}
                        openingCashRegister={openingCashRegister}
                        closingCashRegister={closingCashRegister}
                        checkoutActions={checkoutActionItems}
                        onToggleCollapse={onToggleCashPanel}
                        onOpenCashRegister={onOpenCashRegister}
                        onOpenCashMovement={onOpenCashMovement}
                        onOpenCashHistory={onOpenCashHistory}
                        onOpenCloseCashRegister={onOpenCloseCashRegister}
                        onOpenPendingNfces={onOpenPendingNfces}
                        pendingNfceCount={pendingNfceCount}
                    />
                ) : null}
            </div>

            {isMobileCashPanel ? (
                <>
                    <button type="button" className="pos-turn-panel-fab" onClick={onOpenMobileCashPanel}>
                        <i className="fa-solid fa-vault" />
                        <span>Turno</span>
                    </button>

                    {mobileCashPanelOpen ? (
                        <div className="pos-turn-sheet-backdrop" onClick={onCloseMobileCashPanel}>
                            <PosCashTurnPanel
                                mobile
                                cashRegisterState={cashRegisterState}
                                report={cashRegisterReport}
                                history={cashRegisterHistory}
                                collapsed={false}
                                loadingClosePreview={loadingClosePreview}
                                openingCashRegister={openingCashRegister}
                                closingCashRegister={closingCashRegister}
                                checkoutActions={checkoutActionItems}
                                onToggleCollapse={onCloseMobileCashPanel}
                                onOpenCashRegister={onOpenCashRegister}
                                onOpenCashMovement={onOpenCashMovement}
                                onOpenCashHistory={onOpenCashHistory}
                                onOpenCloseCashRegister={onOpenCloseCashRegister}
                                onOpenPendingNfces={onOpenPendingNfces}
                                pendingNfceCount={pendingNfceCount}
                                onCloseMobilePanel={onCloseMobileCashPanel}
                            />
                        </div>
                    ) : null}
                </>
            ) : null}

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

                {paymentMethod === conditionalPaymentMethod ? (
                    <div className="pos-modal-section">
                        <div className="pos-inline-summary">
                            <span>Registro</span>
                            <strong>{selectedCustomerData ? selectedCustomerData.name : 'Selecione um cliente'}</strong>
                        </div>
                        <label className="pos-field">
                            <span>Data limite para retorno</span>
                            <input
                                className="pos-field-input"
                                type="date"
                                value={conditionalDueAt}
                                onChange={(event) => onConditionalDueAtChange(event.target.value)}
                            />
                        </label>
                        <div className="pos-inline-empty">
                            Ao confirmar, os itens saem do estoque como condicional e aparecem na tela de Condicionais.
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
                                {paymentOptions.filter((option) => option.value !== 'mixed' && option.value !== conditionalPaymentMethod).map((option) => (
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

            <PosModal open={customerModalOpen} title="Consumidor" onClose={onCloseCustomerModal}>
                <form className="pos-modal-form" onSubmit={onSaveConsumer}>
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
                            placeholder="Nome do consumidor"
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
                        <button type="submit" className="pos-button info">
                            Salvar consumidor
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
                        <span>Consumidor</span>
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
                    Todos os itens, descontos e pagamentos preparados nesta venda seráo removidos.
                </div>

                <div className="pos-modal-actions">
                    <button type="button" className="pos-button ghost" onClick={onCloseCancelModal}>
                        Voltar
                    </button>
                    <button type="button" className="pos-button danger" onClick={onCancelSale} disabled={submitting}>
                        Cancelar venda
                    </button>
                </div>
            </PosModal>
        </div>
    )
}

function PendingNfceModal({
    open,
    documents,
    busyId,
    onClose,
    onRetry,
    onCancelSale,
    onOpenFile,
}) {
    if (!open) {
        return null
    }

    return (
        <CompactModal
            open={open}
            title="NFC-e pendentes"
            description="Documentos fiscais que ainda precisam de ação ou regularização."
            icon="fa-file-circle-exclamation"
            size="lg"
            onClose={onClose}
        >
            <div className="pos-pending-nfce-stack">
                {documents.length ? documents.map((document) => {
                    const busy = busyId === document.id
                    const previewUrl = document.files?.preview_url
                    const xmlUrl = document.files?.authorized_xml_url || document.files?.signed_xml_url || document.files?.response_xml_url

                    return (
                        <article key={document.id} className="pos-pending-nfce-card">
                            <div className="pos-pending-nfce-main">
                                <div>
                                    <strong>{document.sale_number}</strong>
                                    <span>{formatShortDateTime(document.created_at)} | {formatMoney(document.total)}</span>
                                </div>
                                <StatusBadge compact label={document.status_label} tone={document.status_tone} />
                            </div>

                            {document.last_error ? (
                                <div className="pos-pending-nfce-error">{document.last_error}</div>
                            ) : null}

                            <div className="pos-pending-nfce-actions">
                                <button type="button" onClick={() => onRetry(document)} disabled={!document.can_retry || busy}>
                                    <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
                                    <span>Reenviar</span>
                                </button>
                                <button type="button" onClick={() => onCancelSale(document)} disabled={!document.can_cancel_sale || busy}>
                                    <i className="fa-solid fa-ban" />
                                    <span>Cancelar</span>
                                </button>
                                <button type="button" onClick={() => onOpenFile(previewUrl)} disabled={!previewUrl}>
                                    <i className="fa-solid fa-receipt" />
                                    <span>Visualizar</span>
                                </button>
                                <button type="button" onClick={() => onOpenFile(previewUrl)} disabled={!previewUrl}>
                                    <i className="fa-solid fa-print" />
                                    <span>Reimprimir</span>
                                </button>
                                <button type="button" onClick={() => onOpenFile(previewUrl)} disabled={!previewUrl}>
                                    <i className="fa-solid fa-file-pdf" />
                                    <span>DANFE</span>
                                </button>
                                <button type="button" onClick={() => onOpenFile(xmlUrl)} disabled={!xmlUrl}>
                                    <i className="fa-solid fa-file-code" />
                                    <span>XML</span>
                                </button>
                            </div>
                        </article>
                    )
                }) : (
                    <div className="pos-pending-nfce-empty">
                        <i className="fa-solid fa-circle-check" />
                        <strong>Nenhuma NFC-e pendente</strong>
                        <span>As pendencias fiscais sao reenviadas automaticamente quando o caixa abre.</span>
                    </div>
                )}
            </div>
        </CompactModal>
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

function PosCashTurnPanel({
    cashRegisterState,
    report,
    history,
    collapsed,
    mobile = false,
    loadingClosePreview,
    openingCashRegister,
    closingCashRegister,
    checkoutActions = [],
    onToggleCollapse,
    onOpenCashRegister,
    onOpenCashMovement,
    onOpenCashHistory,
    onOpenCloseCashRegister,
    onOpenPendingNfces,
    pendingNfceCount = 0,
    onCloseMobilePanel = null,
}) {
    const [cashOptionsOpen, setCashOptionsOpen] = useState(false)
    const cashOptionActions = cashRegisterState
        ? [
            {
                key: 'withdrawal',
                label: 'Sangria',
                icon: 'fa-circle-minus',
                tone: 'danger',
                onClick: () => onOpenCashMovement('withdrawal'),
            },
            {
                key: 'supply',
                label: 'Suprimento',
                icon: 'fa-circle-plus',
                tone: 'info',
                onClick: () => onOpenCashMovement('supply'),
            },
            {
                key: 'history',
                label: 'Histórico',
                icon: 'fa-clock-rotate-left',
                onClick: onOpenCashHistory,
            },
            {
                key: 'pending-nfce',
                label: pendingNfceCount > 0 ? `NFC-e Pend. (${pendingNfceCount})` : 'NFC-e Pend.',
                icon: 'fa-file-circle-exclamation',
                tone: 'info',
                onClick: onOpenPendingNfces,
            },
            {
                key: 'close',
                label: 'Fechar Caixa',
                icon: 'fa-lock',
                tone: 'danger',
                disabled: loadingClosePreview || closingCashRegister,
                onClick: onOpenCloseCashRegister,
            },
        ]
        : [
            {
                key: 'open',
                label: 'Abrir Caixa',
                icon: 'fa-lock-open',
                tone: 'info',
                disabled: openingCashRegister,
                onClick: onOpenCashRegister,
            },
            {
                key: 'history',
                label: 'Histórico',
                icon: 'fa-clock-rotate-left',
                onClick: onOpenCashHistory,
            },
            {
                key: 'pending-nfce',
                label: pendingNfceCount > 0 ? `NFC-e Pend. (${pendingNfceCount})` : 'NFC-e Pend.',
                icon: 'fa-file-circle-exclamation',
                tone: 'info',
                onClick: onOpenPendingNfces,
            },
        ]
    const handleCashOptionClick = (action) => {
        action.onClick?.()
        setCashOptionsOpen(false)
    }
    const cashOptionsMenu = cashOptionsOpen ? (
        <div className="pos-turn-options-menu">
            {cashOptionActions.map((action) => (
                <button
                    key={action.key}
                    type="button"
                    className={`pos-turn-option-action ${action.tone || 'default'}`}
                    onClick={() => handleCashOptionClick(action)}
                    disabled={action.disabled}
                >
                    <i className={`fa-solid ${action.icon}`} />
                    <span>{action.label}</span>
                </button>
            ))}
        </div>
    ) : null
    const asideClassName = [
        'pos-turn-panel',
        collapsed ? 'collapsed' : '',
        mobile ? 'mobile' : '',
    ].filter(Boolean).join(' ')

    return (
        <aside className={asideClassName} onClick={mobile ? (event) => event.stopPropagation() : undefined}>
            <div className="pos-turn-panel-head">
                <StatusBadge
                    label={cashRegisterState ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
                    tone={cashRegisterState ? 'success' : 'danger'}
                    icon={cashRegisterState ? 'fa-lock-open' : 'fa-lock'}
                    compact={collapsed && !mobile}
                />

                {mobile ? (
                    <button type="button" className="pos-turn-panel-toggle ui-tooltip" data-tooltip="Fechar painel" onClick={onCloseMobilePanel}>
                        <i className="fa-solid fa-xmark" />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="pos-turn-panel-toggle ui-tooltip"
                        data-tooltip={collapsed ? 'Expandir painel do turno' : 'Recolher painel do turno'}
                        onClick={onToggleCollapse}
                    >
                        <i className={`fa-solid ${collapsed ? 'fa-angles-left' : 'fa-angles-right'}`} />
                    </button>
                )}
            </div>

            {collapsed && !mobile ? (
                <div className="pos-turn-panel-collapsed-actions">
                    {checkoutActions.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            className={`pos-turn-panel-icon-action sale ${action.tone || 'default'} ui-tooltip`}
                            data-tooltip={action.label}
                            onClick={action.onClick}
                            disabled={action.disabled}
                        >
                            <PosIcon name={action.icon} />
                        </button>
                    ))}

                    <button
                        type="button"
                        className={`pos-turn-panel-icon-action options ui-tooltip ${cashOptionsOpen ? 'active' : ''}`}
                        data-tooltip="Opcoes"
                        onClick={() => setCashOptionsOpen((open) => !open)}
                    >
                        <i className="fa-solid fa-ellipsis" />
                    </button>

                    {cashOptionsMenu}
                </div>
            ) : (
                <>
                    <div className="pos-sale-action-stack" aria-label="Ferramentas de finalização da venda">
                        {checkoutActions.map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                className={`pos-sale-sidebar-action ${action.tone || 'default'}`}
                                onClick={action.onClick}
                                disabled={action.disabled}
                            >
                                <PosIcon name={action.icon} />
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>

                    {!cashRegisterState ? (
                        <section className="pos-turn-panel-section">
                            <button type="button" className="pos-turn-open-button" onClick={onOpenCashRegister} disabled={openingCashRegister}>
                                <i className="fa-solid fa-lock-open" />
                                <span>{openingCashRegister ? 'Abrindo...' : 'Abrir Caixa'}</span>
                            </button>

                            <div className="pos-turn-panel-empty">
                                O checkout fica bloqueado até iniciar o turno com o valor de abertura.
                            </div>
                        </section>
                    ) : null}

                    <div className="pos-turn-options">
                        <button
                            type="button"
                            className={`pos-turn-options-toggle ${cashOptionsOpen ? 'active' : ''}`}
                            onClick={() => setCashOptionsOpen((open) => !open)}
                        >
                            <i className="fa-solid fa-ellipsis" />
                            <span>Opcoes</span>
                        </button>

                        {cashOptionsMenu}
                    </div>
                </>
            )}
        </aside>
    )
}

function PosCashActivityDrawer({
    open,
    cashRegisterState,
    report,
    activityRows,
    history,
    onClose,
}) {
    return (
        <ActionDrawer
            open={open}
            title={cashRegisterState ? 'Histórico do turno' : 'Histórico de caixas'}
            description={
                cashRegisterState
                    ? 'Vendas, sangrias e suprimentos do caixa atual em ordem cronologica.'
                    : 'Resumo dos ultimos turnos encerrados pelo operador.'
            }
            icon="fa-clock-rotate-left"
            size="md"
            onClose={onClose}
        >
            {cashRegisterState ? (
                <div className="pos-turn-drawer-stack">
                    <div className="pos-turn-drawer-summary">
                        <div>
                            <span>Vendas</span>
                            <strong>{report?.sales_count ?? 0}</strong>
                        </div>
                        <div>
                            <span>Total</span>
                            <strong>{formatMoney(report?.total_sales ?? 0)}</strong>
                        </div>
                        <div>
                            <span>Abertura</span>
                            <strong>{formatShortTime(report?.cashRegister?.opened_at)}</strong>
                        </div>
                    </div>

                    <div className="pos-turn-drawer-list">
                        {activityRows.length ? activityRows.map((entry) => (
                            <div key={entry.id} className="pos-turn-drawer-row">
                                <div className="pos-turn-drawer-row-main">
                                    <StatusBadge
                                        label={entry.label}
                                        tone={entry.type === 'sale' ? 'info' : entry.type === 'supply' ? 'success' : 'danger'}
                                        compact
                                    />
                                    <span>{entry.detail}</span>
                                </div>
                                <strong>{formatMoney(entry.amount)}</strong>
                                <small>{formatShortTime(entry.created_at)}</small>
                            </div>
                        )) : (
                            <div className="pos-turn-panel-empty">Nenhum movimento registrado neste turno.</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="pos-turn-drawer-list">
                    {history.length ? history.map((entry) => (
                        <div key={entry.id} className="pos-turn-drawer-row history">
                            <div className="pos-turn-drawer-row-main">
                                <strong>{formatMoney(entry.total_sales)}</strong>
                                <span>{entry.sales_count} vendas | diferenca {formatMoney(entry.difference || 0)}</span>
                            </div>
                            <small>{formatShortDateTime(entry.closed_at || entry.opened_at)}</small>
                        </div>
                    )) : (
                        <div className="pos-turn-panel-empty">Nenhum caixa fechado recentemente.</div>
                    )}
                </div>
            )}
        </ActionDrawer>
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
                            Edição liberada por {closeModal.supervisorName}.
                        </div>
                    ) : null}

                    {!supervisors.length ? (
                        <div className="pos-cash-close-edit-note muted">
                            Cadastre um usuario como supervisor em Usuários para liberar a edição apos a conferência.
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
                                    <span>Pronto para conferência</span>
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
                                Escolha o supervisor e informe a senha para liberar a edição apos a conferência.
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
