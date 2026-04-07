import {
    loadIndexedDbWorkspaceSnapshot,
    loadLocalAgentWorkspaceSnapshot,
    saveIndexedDbWorkspaceSnapshot,
    saveLocalAgentWorkspaceSnapshot,
} from './persistence'

const STORAGE_PREFIX = 'nimvo:offline-workspace'
const CHANGE_EVENT = 'nimvo:offline-workspace:change'
const SCHEMA_VERSION = 1
const bridgeByTenant = new Map()
const hydrationLocks = new Map()
const persistenceTimers = new Map()
const memoryStateByTenant = new Map()

function nowIso() {
    return new Date().toISOString()
}

function buildStorageKey(tenantId) {
    return `${STORAGE_PREFIX}:${tenantId}:v${SCHEMA_VERSION}`
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value)
    }

    return JSON.parse(JSON.stringify(value))
}

function createEmptyState(tenantId) {
    return {
        version: SCHEMA_VERSION,
        tenantId,
        meta: {
            nextTempId: -1,
            nextLocalSaleSequence: 1,
            lastSeededAt: null,
            lastSyncAttemptAt: null,
            lastSyncAt: null,
            lastSyncError: null,
            lastUpdatedAt: null,
        },
        cashRegister: null,
        catalogs: {
            products: [],
            categories: [],
            customers: [],
            companies: [],
            suppliers: [],
        },
        orders: {
            details: [],
        },
        pendingSalesByUser: {},
        mappings: {
            products: {},
            customers: {},
            companies: {},
            orders: {},
        },
        queue: {
            products: [],
            customers: [],
            companies: [],
            orders: [],
            sales: [],
        },
    }
}

function hasWindowStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isTemporaryId(value) {
    return Number(value) < 0
}

function normalizeNumber(value, fallback = 0) {
    const numeric = Number(value)

    if (!Number.isFinite(numeric)) {
        return fallback
    }

    return numeric
}

function sortNamedRecords(records) {
    return [...records].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR'),
    )
}

function sortProducts(records) {
    return [...records].sort((left, right) =>
        String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR'),
    )
}

function sortOrders(details) {
    return [...details].sort((left, right) => {
        if (left.status !== right.status) {
            return left.status === 'draft' ? -1 : 1
        }

        return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
    })
}

function normalizeCategoryRecord(category) {
    return {
        id: Number(category.id),
        name: String(category.name || '').trim(),
    }
}

function normalizeSupplierRecord(supplier) {
    return {
        id: Number(supplier.id),
        name: String(supplier.name || '').trim(),
    }
}

function normalizeCustomerRecord(customer) {
    return {
        id: Number(customer.id),
        name: String(customer.name || '').trim(),
        phone: customer.phone || null,
        document: customer.document || null,
        document_type: customer.document_type || null,
        email: customer.email || null,
        credit_limit: normalizeNumber(customer.credit_limit, 0),
        active: customer.active !== false,
    }
}

function normalizeCompanyRecord(company) {
    return {
        id: Number(company.id),
        name: String(company.name || '').trim(),
        trade_name: company.trade_name || null,
        document: company.document || null,
        document_type: company.document_type || null,
        email: company.email || null,
        phone: company.phone || null,
        state_registration: company.state_registration || null,
        active: company.active !== false,
    }
}

function normalizeProductRecord(product) {
    return {
        ...product,
        id: Number(product.id),
        code: product.code || '',
        barcode: product.barcode || '',
        name: String(product.name || '').trim(),
        description: product.description || '',
        unit: product.unit || 'UN',
        commercial_unit: product.commercial_unit || product.unit || 'UN',
        taxable_unit: product.taxable_unit || product.unit || 'UN',
        cost_price: normalizeNumber(product.cost_price, 0),
        sale_price: normalizeNumber(product.sale_price, 0),
        stock_quantity: normalizeNumber(product.stock_quantity, 0),
        min_stock: normalizeNumber(product.min_stock, 0),
        icms_rate: product.icms_rate === '' || product.icms_rate == null ? null : normalizeNumber(product.icms_rate, 0),
        pis_rate: product.pis_rate === '' || product.pis_rate == null ? null : normalizeNumber(product.pis_rate, 0),
        cofins_rate: product.cofins_rate === '' || product.cofins_rate == null ? null : normalizeNumber(product.cofins_rate, 0),
        ipi_rate: product.ipi_rate === '' || product.ipi_rate == null ? null : normalizeNumber(product.ipi_rate, 0),
        category_id: product.category_id == null || product.category_id === '' ? null : Number(product.category_id),
        supplier_id: product.supplier_id == null || product.supplier_id === '' ? null : Number(product.supplier_id),
        category_name: product.category_name || product.category?.name || null,
        supplier_name: product.supplier_name || product.supplier?.name || null,
        fiscal_enabled: product.fiscal_enabled !== false,
        catalog_visible: Boolean(product.catalog_visible),
        active: product.active !== false,
    }
}

function buildOrderLabel(type, reference, id) {
    const prefix = type === 'mesa'
        ? 'Referencia'
        : type === 'pedido'
            ? 'Pedido'
            : 'Atendimento'

    return reference ? `${prefix} ${reference}` : `${prefix} #${id}`
}

function findRecordById(records, id) {
    const normalizedId = String(id)
    return records.find((record) => String(record.id) === normalizedId) || null
}

function resolveMappedId(state, entityType, entityId) {
    if (entityId == null || entityId === '') {
        return null
    }

    const mapping = state.mappings?.[entityType] || {}
    return mapping[String(entityId)] ?? entityId
}

function normalizeOrderItem(state, item) {
    const productId = Number(item.product_id ?? item.id)
    const mappedProductId = resolveMappedId(state, 'products', productId)
    const productRecord =
        findRecordById(state.catalogs.products, mappedProductId)
        || findRecordById(state.catalogs.products, productId)

    const quantity = normalizeNumber(item.qty ?? item.quantity, 1)
    const salePrice = normalizeNumber(
        item.sale_price ?? item.unit_price ?? productRecord?.sale_price,
        0,
    )

    return {
        id: productId,
        product_id: productId,
        name: item.name || item.product_name || productRecord?.name || 'Produto',
        code: item.code || item.product_code || productRecord?.code || '',
        barcode: item.barcode || item.product_barcode || productRecord?.barcode || '',
        unit: item.unit || productRecord?.unit || 'UN',
        qty: quantity,
        cost_price: normalizeNumber(item.cost_price ?? item.unit_cost ?? productRecord?.cost_price, 0),
        sale_price: salePrice,
        stock_quantity: normalizeNumber(item.stock_quantity ?? productRecord?.stock_quantity, 0),
        lineTotal: normalizeNumber(item.lineTotal ?? item.total, salePrice * quantity),
    }
}

function normalizeOrderDetail(state, order, options = {}) {
    const id = Number(order.id ?? options.id)
    const type = order.type ?? options.type ?? 'comanda'
    const status = order.status ?? options.status ?? 'draft'
    const reference = String(order.reference ?? options.reference ?? '').trim()
    const customerId = order.customer?.id ?? order.customer_id ?? order.customerId ?? options.customer_id ?? options.customerId ?? null
    const customerRecord =
        customerId != null
            ? findRecordById(state.catalogs.customers, resolveMappedId(state, 'customers', customerId))
                || findRecordById(state.catalogs.customers, customerId)
            : null
    const items = Array.isArray(order.items)
        ? order.items.map((item) => normalizeOrderItem(state, item))
        : []
    const subtotal = normalizeNumber(
        order.subtotal,
        items.reduce((total, item) => total + Number(item.sale_price) * Number(item.qty), 0),
    )
    const total = normalizeNumber(order.total, subtotal)

    return {
        id,
        type,
        channel: order.channel ?? options.channel ?? 'store',
        reference,
        label: order.label || buildOrderLabel(type, reference, id),
        status,
        subtotal,
        total,
        items_count: items.length,
        customer: customerRecord ? normalizeCustomerRecord(customerRecord) : null,
        created_by: order.created_by ?? options.created_by ?? null,
        sent_to_cashier_at: status === 'sent_to_cashier'
            ? (order.sent_to_cashier_at ?? options.sent_to_cashier_at ?? nowIso())
            : null,
        updated_at: order.updated_at ?? order.updatedAt ?? options.updated_at ?? nowIso(),
        notes: String(order.notes ?? options.notes ?? ''),
        items,
    }
}

function normalizePendingSale(pendingSale) {
    if (!pendingSale) {
        return null
    }

    return {
        ...pendingSale,
        customer_id: pendingSale.customer_id == null || pendingSale.customer_id === '' ? null : Number(pendingSale.customer_id),
        company_id: pendingSale.company_id == null || pendingSale.company_id === '' ? null : Number(pendingSale.company_id),
        order_draft_id: pendingSale.order_draft_id == null || pendingSale.order_draft_id === '' ? null : Number(pendingSale.order_draft_id),
        cart: Array.isArray(pendingSale.cart)
            ? pendingSale.cart.map((item) => ({
                ...item,
                id: Number(item.id),
                qty: normalizeNumber(item.qty, 1),
                cost_price: normalizeNumber(item.cost_price, 0),
                sale_price: normalizeNumber(item.sale_price, 0),
                stock_quantity: normalizeNumber(item.stock_quantity, 0),
                lineDiscount: normalizeNumber(item.lineDiscount, 0),
                lineTotal: normalizeNumber(item.lineTotal, normalizeNumber(item.sale_price, 0) * normalizeNumber(item.qty, 1)),
            }))
            : [],
        discount: pendingSale.discount || { config: { type: 'none' }, authorizer: null },
        payment: pendingSale.payment || { payment_method: 'cash', mixed_payments: [], mixed_draft: { method: 'cash', amount: '' } },
        saved_at: pendingSale.saved_at || nowIso(),
    }
}

function ensureStateShape(rawState, tenantId) {
    const fallback = createEmptyState(tenantId)

    if (!rawState || rawState.version !== SCHEMA_VERSION) {
        return fallback
    }

    return {
        ...fallback,
        ...rawState,
        tenantId,
        meta: {
            ...fallback.meta,
            ...(rawState.meta || {}),
        },
        catalogs: {
            ...fallback.catalogs,
            ...(rawState.catalogs || {}),
            products: Array.isArray(rawState.catalogs?.products) ? rawState.catalogs.products.map(normalizeProductRecord) : [],
            categories: Array.isArray(rawState.catalogs?.categories) ? rawState.catalogs.categories.map(normalizeCategoryRecord) : [],
            customers: Array.isArray(rawState.catalogs?.customers) ? rawState.catalogs.customers.map(normalizeCustomerRecord) : [],
            companies: Array.isArray(rawState.catalogs?.companies) ? rawState.catalogs.companies.map(normalizeCompanyRecord) : [],
            suppliers: Array.isArray(rawState.catalogs?.suppliers) ? rawState.catalogs.suppliers.map(normalizeSupplierRecord) : [],
        },
        orders: {
            details: Array.isArray(rawState.orders?.details)
                ? rawState.orders.details.map((detail) => normalizeOrderDetail({ ...fallback, ...rawState }, detail))
                : [],
        },
        pendingSalesByUser: Object.fromEntries(
            Object.entries(rawState.pendingSalesByUser || {}).map(([userId, pendingSale]) => [userId, normalizePendingSale(pendingSale)]),
        ),
        mappings: {
            ...fallback.mappings,
            ...(rawState.mappings || {}),
        },
        queue: {
            ...fallback.queue,
            ...(rawState.queue || {}),
            products: Array.isArray(rawState.queue?.products) ? rawState.queue.products : [],
            customers: Array.isArray(rawState.queue?.customers) ? rawState.queue.customers : [],
            companies: Array.isArray(rawState.queue?.companies) ? rawState.queue.companies : [],
            orders: Array.isArray(rawState.queue?.orders) ? rawState.queue.orders : [],
            sales: Array.isArray(rawState.queue?.sales) ? rawState.queue.sales : [],
        },
    }
}

function readState(tenantId) {
    if (!tenantId) {
        return createEmptyState('anonymous')
    }

    const tenantKey = String(tenantId)
    const memoryState = memoryStateByTenant.get(tenantKey)
    if (memoryState) {
        return cloneValue(memoryState)
    }

    if (!hasWindowStorage()) {
        const emptyState = createEmptyState(tenantId)
        memoryStateByTenant.set(tenantKey, emptyState)
        return emptyState
    }

    try {
        const raw = window.localStorage.getItem(buildStorageKey(tenantId))
        if (!raw) {
            const emptyState = createEmptyState(tenantId)
            memoryStateByTenant.set(tenantKey, emptyState)
            return emptyState
        }

        const state = ensureStateShape(JSON.parse(raw), tenantId)
        memoryStateByTenant.set(tenantKey, state)
        return cloneValue(state)
    } catch {
        const emptyState = createEmptyState(tenantId)
        memoryStateByTenant.set(tenantKey, emptyState)
        return emptyState
    }
}

function countPending(state) {
    return [
        state.queue.products.length,
        state.queue.customers.length,
        state.queue.companies.length,
        state.queue.orders.length,
        state.queue.sales.length,
    ].reduce((total, count) => total + count, 0)
}

function buildSummary(state) {
    return {
        tenantId: state.tenantId,
        isOffline: isBrowserOffline(),
        pendingCount: countPending(state),
        lastSyncAt: state.meta.lastSyncAt,
        lastSyncAttemptAt: state.meta.lastSyncAttemptAt,
        lastSyncError: state.meta.lastSyncError,
    }
}

function dispatchWorkspaceChange(tenantId, state) {
    if (typeof window === 'undefined') {
        return
    }

    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
        detail: {
            tenantId,
            state,
            summary: buildSummary(state),
        },
    }))
}

function schedulePersistenceWrite(tenantId, state) {
    if (!tenantId || typeof window === 'undefined') {
        return
    }

    const tenantKey = String(tenantId)
    const snapshot = cloneValue(state)

    if (persistenceTimers.has(tenantKey)) {
        window.clearTimeout(persistenceTimers.get(tenantKey))
    }

    persistenceTimers.set(tenantKey, window.setTimeout(() => {
        persistenceTimers.delete(tenantKey)

        void saveIndexedDbWorkspaceSnapshot(tenantId, snapshot).catch(() => {})
        void saveLocalAgentWorkspaceSnapshot(tenantId, snapshot, bridgeByTenant.get(tenantKey) || null).catch(() => {})
    }, 120))
}

function commitState(tenantId, nextState, options = {}) {
    const normalized = ensureStateShape(nextState, tenantId)
    const shouldTouchUpdatedAt = options.touchUpdatedAt !== false
    const shouldPersistRemotely = options.persist !== false

    normalized.meta.lastUpdatedAt = shouldTouchUpdatedAt
        ? nowIso()
        : (normalized.meta.lastUpdatedAt || nowIso())
    memoryStateByTenant.set(String(tenantId), normalized)

    if (!hasWindowStorage()) {
        if (shouldPersistRemotely) {
            schedulePersistenceWrite(tenantId, normalized)
        }
        return normalized
    }

    window.localStorage.setItem(buildStorageKey(tenantId), JSON.stringify(normalized))
    dispatchWorkspaceChange(tenantId, normalized)

    if (shouldPersistRemotely) {
        schedulePersistenceWrite(tenantId, normalized)
    }

    return normalized
}

function writeState(tenantId, nextState) {
    return commitState(tenantId, nextState)
}

function updateState(tenantId, updater) {
    const current = readState(tenantId)
    const draft = cloneValue(current)
    const nextState = updater(draft) || draft

    return writeState(tenantId, nextState)
}

function normalizeTimestamp(value) {
    if (!value) {
        return 0
    }

    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
}

function resolveStateTimestamp(state, fallback = null) {
    return normalizeTimestamp(
        state?.meta?.lastUpdatedAt
        || state?.meta?.lastSyncAt
        || state?.meta?.lastSeededAt
        || fallback,
    )
}

function pickNewestWorkspaceSnapshot(tenantId, snapshots = []) {
    const currentState = readState(tenantId)
    const currentTimestamp = resolveStateTimestamp(currentState)

    return snapshots.reduce((latest, snapshot) => {
        if (!snapshot?.state) {
            return latest
        }

        const snapshotTimestamp = resolveStateTimestamp(snapshot.state, snapshot.updatedAt || null)
        return snapshotTimestamp > latest.timestamp
            ? { state: snapshot.state, timestamp: snapshotTimestamp }
            : latest
    }, { state: currentState, timestamp: currentTimestamp })
}

function replaceQueueRecord(queueItems, nextRecord) {
    const queueKey = String(nextRecord.entityId)
    const nextItems = queueItems.filter((item) => String(item.entityId) !== queueKey)
    nextItems.push({
        queuedAt: nowIso(),
        ...nextRecord,
    })

    return nextItems
}

function removeQueueRecord(queueItems, entityId) {
    const queueKey = String(entityId)
    return queueItems.filter((item) => String(item.entityId) !== queueKey)
}

function allocateTempId(state) {
    const current = Number(state.meta.nextTempId || -1)
    state.meta.nextTempId = current - 1
    return current
}

function registerMapping(state, entityType, localId, remoteId) {
    state.mappings[entityType] = {
        ...(state.mappings[entityType] || {}),
        [String(localId)]: Number(remoteId),
    }
}

function mergeSnapshotRecords(existingRecords, incomingRecords, queueItems, normalizeRecord, sortFn) {
    const deletes = new Set(
        queueItems
            .filter((item) => item.action === 'delete')
            .map((item) => String(item.entityId)),
    )
    const dirtyIds = new Set(queueItems.map((item) => String(item.entityId)))
    const nextMap = new Map()

    incomingRecords
        .map((record) => normalizeRecord(record))
        .forEach((record) => {
            if (!deletes.has(String(record.id))) {
                nextMap.set(String(record.id), record)
            }
        })

    existingRecords.forEach((record) => {
        const recordId = String(record.id)

        if (deletes.has(recordId)) {
            return
        }

        if (isTemporaryId(record.id) || dirtyIds.has(recordId)) {
            nextMap.set(recordId, normalizeRecord(record))
        }
    })

    return sortFn([...nextMap.values()])
}

function replaceProductReferences(state, localId, remoteProduct) {
    const normalizedRemote = normalizeProductRecord(remoteProduct)

    state.catalogs.products = sortProducts(
        state.catalogs.products.map((product) =>
            String(product.id) === String(localId) ? normalizedRemote : product,
        ),
    )

    state.orders.details = state.orders.details.map((order) => ({
        ...order,
        items: order.items.map((item) =>
            String(item.id) === String(localId)
                ? {
                    ...item,
                    id: normalizedRemote.id,
                    product_id: normalizedRemote.id,
                    name: normalizedRemote.name,
                    code: normalizedRemote.code,
                    barcode: normalizedRemote.barcode,
                    unit: normalizedRemote.unit,
                    cost_price: normalizedRemote.cost_price,
                    sale_price: normalizedRemote.sale_price,
                    stock_quantity: normalizedRemote.stock_quantity,
                    lineTotal: normalizeNumber(item.qty, 1) * normalizedRemote.sale_price,
                }
                : item,
        ),
    }))

    state.pendingSalesByUser = Object.fromEntries(
        Object.entries(state.pendingSalesByUser).map(([userId, pendingSale]) => [
            userId,
            pendingSale
                ? {
                    ...pendingSale,
                    cart: pendingSale.cart.map((item) =>
                        String(item.id) === String(localId)
                            ? {
                                ...item,
                                id: normalizedRemote.id,
                                code: normalizedRemote.code,
                                barcode: normalizedRemote.barcode,
                                name: normalizedRemote.name,
                                unit: normalizedRemote.unit,
                                cost_price: normalizedRemote.cost_price,
                                sale_price: normalizedRemote.sale_price,
                                stock_quantity: normalizedRemote.stock_quantity,
                                lineTotal: normalizeNumber(item.qty, 1) * normalizedRemote.sale_price,
                            }
                            : item,
                    ),
                }
                : pendingSale,
        ]),
    )
}

function replaceCustomerReferences(state, localId, remoteCustomer) {
    const normalizedRemote = normalizeCustomerRecord(remoteCustomer)

    state.catalogs.customers = sortNamedRecords(
        state.catalogs.customers.map((customer) =>
            String(customer.id) === String(localId) ? normalizedRemote : customer,
        ),
    )

    state.orders.details = state.orders.details.map((order) =>
        order.customer && String(order.customer.id) === String(localId)
            ? { ...order, customer: normalizedRemote }
            : order,
    )

    state.pendingSalesByUser = Object.fromEntries(
        Object.entries(state.pendingSalesByUser).map(([userId, pendingSale]) => [
            userId,
            pendingSale && String(pendingSale.customer_id) === String(localId)
                ? {
                    ...pendingSale,
                    customer_id: normalizedRemote.id,
                    recipient_payload: pendingSale.recipient_payload?.customer_id === localId
                        ? { ...pendingSale.recipient_payload, customer_id: normalizedRemote.id }
                        : pendingSale.recipient_payload,
                }
                : pendingSale,
        ]),
    )
}

function replaceCompanyReferences(state, localId, remoteCompany) {
    const normalizedRemote = normalizeCompanyRecord(remoteCompany)

    state.catalogs.companies = sortNamedRecords(
        state.catalogs.companies.map((company) =>
            String(company.id) === String(localId) ? normalizedRemote : company,
        ),
    )

    state.pendingSalesByUser = Object.fromEntries(
        Object.entries(state.pendingSalesByUser).map(([userId, pendingSale]) => [
            userId,
            pendingSale && String(pendingSale.company_id) === String(localId)
                ? {
                    ...pendingSale,
                    company_id: normalizedRemote.id,
                    recipient_payload: pendingSale.recipient_payload?.company_id === localId
                        ? { ...pendingSale.recipient_payload, company_id: normalizedRemote.id }
                        : pendingSale.recipient_payload,
                }
                : pendingSale,
        ]),
    )
}

function replaceOrderReferences(state, localId, remoteOrder) {
    const normalizedRemote = normalizeOrderDetail(state, remoteOrder)

    state.orders.details = sortOrders(
        state.orders.details.map((order) =>
            String(order.id) === String(localId) ? normalizedRemote : order,
        ),
    )

    state.pendingSalesByUser = Object.fromEntries(
        Object.entries(state.pendingSalesByUser).map(([userId, pendingSale]) => [
            userId,
            pendingSale && String(pendingSale.order_draft_id) === String(localId)
                ? { ...pendingSale, order_draft_id: normalizedRemote.id }
                : pendingSale,
        ]),
    )
}

export function isBrowserOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function resolveOfflineEntityId(tenantId, entityType, entityId) {
    const state = readState(tenantId)
    return resolveMappedId(state, entityType, entityId)
}

export function getOfflineWorkspaceSnapshot(tenantId) {
    return readState(tenantId)
}

export function getOfflineWorkspaceSummary(tenantId) {
    return buildSummary(readState(tenantId))
}

export function configureOfflineWorkspaceBridge(tenantId, bridge) {
    if (!tenantId) {
        return
    }

    const tenantKey = String(tenantId)

    if (bridge?.enabled && bridge?.agent_key && bridge?.base_url) {
        bridgeByTenant.set(tenantKey, bridge)
        return
    }

    bridgeByTenant.delete(tenantKey)
}

export async function hydrateOfflineWorkspace(tenantId) {
    if (!tenantId) {
        return createEmptyState('anonymous')
    }

    if (hydrationLocks.has(tenantId)) {
        return hydrationLocks.get(tenantId)
    }

    const hydrationPromise = (async () => {
        const tenantKey = String(tenantId)
        const bridge = bridgeByTenant.get(tenantKey) || null
        const snapshots = await Promise.all([
            loadIndexedDbWorkspaceSnapshot(tenantId).catch(() => null),
            loadLocalAgentWorkspaceSnapshot(tenantId, bridge).catch(() => null),
        ])

        const freshest = pickNewestWorkspaceSnapshot(tenantId, snapshots)

        if (freshest?.state) {
            return commitState(tenantId, freshest.state, {
                touchUpdatedAt: false,
                persist: false,
            })
        }

        return readState(tenantId)
    })().finally(() => {
        hydrationLocks.delete(tenantId)
    })

    hydrationLocks.set(tenantId, hydrationPromise)
    return hydrationPromise
}

export function subscribeOfflineWorkspace(tenantId, callback) {
    if (typeof window === 'undefined' || !tenantId) {
        return () => {}
    }

    const storageKey = buildStorageKey(tenantId)
    const emit = () => {
        const state = readState(tenantId)
        callback({
            state,
            summary: buildSummary(state),
        })
    }

    const handleChange = (event) => {
        if (event.detail?.tenantId !== tenantId) {
            return
        }

        callback({
            state: event.detail.state,
            summary: event.detail.summary,
        })
    }

    const handleStorage = (event) => {
        if (event.key !== storageKey) {
            return
        }

        emit()
    }

    const handleConnectivity = () => emit()

    window.addEventListener(CHANGE_EVENT, handleChange)
    window.addEventListener('storage', handleStorage)
    window.addEventListener('online', handleConnectivity)
    window.addEventListener('offline', handleConnectivity)

    return () => {
        window.removeEventListener(CHANGE_EVENT, handleChange)
        window.removeEventListener('storage', handleStorage)
        window.removeEventListener('online', handleConnectivity)
        window.removeEventListener('offline', handleConnectivity)
    }
}

export function seedOfflineWorkspace(tenantId, snapshot = {}) {
    if (!tenantId) {
        return createEmptyState('anonymous')
    }

    return updateState(tenantId, (state) => {
        if (Array.isArray(snapshot.categories)) {
            state.catalogs.categories = mergeSnapshotRecords(state.catalogs.categories, snapshot.categories, [], normalizeCategoryRecord, sortNamedRecords)
        }

        if (Array.isArray(snapshot.suppliers)) {
            state.catalogs.suppliers = mergeSnapshotRecords(state.catalogs.suppliers, snapshot.suppliers, [], normalizeSupplierRecord, sortNamedRecords)
        }

        if (Array.isArray(snapshot.customers)) {
            state.catalogs.customers = mergeSnapshotRecords(state.catalogs.customers, snapshot.customers, state.queue.customers, normalizeCustomerRecord, sortNamedRecords)
        }

        if (Array.isArray(snapshot.companies)) {
            state.catalogs.companies = mergeSnapshotRecords(state.catalogs.companies, snapshot.companies, state.queue.companies, normalizeCompanyRecord, sortNamedRecords)
        }

        if (Array.isArray(snapshot.products)) {
            const productQueueWithPendingSales = [
                ...state.queue.products,
                ...state.queue.sales.flatMap((entry) =>
                    (entry.payload?.items || []).map((item) => ({
                        entityId: item.id,
                        action: 'upsert',
                    })),
                ),
            ]

            state.catalogs.products = mergeSnapshotRecords(
                state.catalogs.products,
                snapshot.products,
                productQueueWithPendingSales,
                normalizeProductRecord,
                sortProducts,
            )
        }

        if (Array.isArray(snapshot.orders)) {
            state.orders.details = mergeSnapshotRecords(
                state.orders.details,
                snapshot.orders.map((order) => normalizeOrderDetail(state, order)),
                state.queue.orders,
                (order) => normalizeOrderDetail(state, order),
                sortOrders,
            )
        }

        if (Object.prototype.hasOwnProperty.call(snapshot, 'cashRegister')) {
            state.cashRegister = snapshot.cashRegister || null
        }

        if (snapshot.pendingSaleUserId != null && Object.prototype.hasOwnProperty.call(snapshot, 'pendingSale')) {
            const userKey = String(snapshot.pendingSaleUserId)

            if (!state.pendingSalesByUser[userKey]) {
                state.pendingSalesByUser[userKey] = normalizePendingSale(snapshot.pendingSale)
            }
        }

        state.meta.lastSeededAt = nowIso()
        return state
    })
}

export function searchOfflineProducts(tenantId, { term, categoryId } = {}) {
    const normalizedTerm = String(term || '').trim().toLowerCase()

    if (!normalizedTerm) {
        return []
    }

    const state = readState(tenantId)
    const likeMatcher = (value) => String(value || '').trim().toLowerCase().includes(normalizedTerm)

    return state.catalogs.products
        .filter((product) => product.active !== false)
        .filter((product) => !categoryId || String(product.category_id) === String(categoryId))
        .filter((product) =>
            [product.barcode, product.code, product.name, product.description]
                .filter(Boolean)
                .some((value) => likeMatcher(value)),
        )
        .slice(0, 15)
}

export function getOfflineOrderSummaries(tenantId) {
    const state = readState(tenantId)

    return sortOrders(state.orders.details)
        .filter((order) => order.status === 'draft' || order.status === 'sent_to_cashier')
        .map((order) => ({
            id: order.id,
            type: order.type,
            channel: order.channel,
            reference: order.reference,
            label: order.label,
            status: order.status,
            subtotal: order.subtotal,
            total: order.total,
            items_count: order.items.length,
            customer: order.customer ? { id: order.customer.id, name: order.customer.name } : null,
            created_by: order.created_by,
            sent_to_cashier_at: order.sent_to_cashier_at,
            updated_at: order.updated_at,
        }))
}

export function getOfflinePendingCheckoutSummaries(tenantId) {
    return getOfflineOrderSummaries(tenantId).filter((order) => order.status === 'sent_to_cashier')
}

export function getOfflineOrderDetail(tenantId, orderId) {
    const state = readState(tenantId)
    const order = state.orders.details.find((entry) => String(entry.id) === String(orderId))
    const mappedId = resolveMappedId(state, 'orders', orderId)

    if (order) {
        return cloneValue(order)
    }

    return cloneValue(state.orders.details.find((entry) => String(entry.id) === String(mappedId)) || null)
}

export function getOfflinePendingSale(tenantId, userId) {
    if (userId == null) {
        return null
    }

    const state = readState(tenantId)
    return cloneValue(state.pendingSalesByUser[String(userId)] || null)
}

export function saveOfflinePendingSale(tenantId, userId, pendingSale) {
    if (!tenantId || userId == null) {
        return null
    }

    let saved = null

    updateState(tenantId, (state) => {
        saved = normalizePendingSale(pendingSale)
        state.pendingSalesByUser[String(userId)] = saved
        return state
    })

    return saved
}

export function discardOfflinePendingSale(tenantId, userId) {
    if (!tenantId || userId == null) {
        return
    }

    updateState(tenantId, (state) => {
        delete state.pendingSalesByUser[String(userId)]
        return state
    })
}

export function createOfflineCustomer(tenantId, payload) {
    let created = null

    updateState(tenantId, (state) => {
        const tempId = allocateTempId(state)
        created = normalizeCustomerRecord({
            id: tempId,
            name: payload.name,
            phone: payload.phone || null,
            document: payload.document || null,
            document_type: payload.document_type || null,
            email: payload.email || null,
            credit_limit: 0,
            active: true,
        })

        state.catalogs.customers = sortNamedRecords([...state.catalogs.customers, created])
        state.queue.customers = replaceQueueRecord(state.queue.customers, {
            entityId: tempId,
            action: 'create',
            payload: created,
        })

        return state
    })

    return created
}

export function createOfflineCompany(tenantId, payload) {
    let created = null

    updateState(tenantId, (state) => {
        const tempId = allocateTempId(state)
        created = normalizeCompanyRecord({
            id: tempId,
            name: payload.name,
            trade_name: payload.trade_name || null,
            document: payload.document || null,
            document_type: payload.document_type || null,
            email: payload.email || null,
            phone: payload.phone || null,
            state_registration: payload.state_registration || null,
            active: true,
        })

        state.catalogs.companies = sortNamedRecords([...state.catalogs.companies, created])
        state.queue.companies = replaceQueueRecord(state.queue.companies, {
            entityId: tempId,
            action: 'create',
            payload: created,
        })

        return state
    })

    return created
}

export function upsertOfflineProduct(tenantId, payload) {
    let savedProduct = null

    updateState(tenantId, (state) => {
        const productId = payload.id != null ? Number(payload.id) : allocateTempId(state)
        const productRecord = normalizeProductRecord({
            ...payload,
            id: productId,
        })
        const exists = state.catalogs.products.some((product) => String(product.id) === String(productId))

        savedProduct = productRecord
        state.catalogs.products = sortProducts(
            exists
                ? state.catalogs.products.map((product) => (String(product.id) === String(productId) ? productRecord : product))
                : [...state.catalogs.products, productRecord],
        )
        state.queue.products = replaceQueueRecord(state.queue.products, {
            entityId: productId,
            action: 'upsert',
            payload: productRecord,
        })

        return state
    })

    return savedProduct
}

export function removeOfflineProduct(tenantId, productId) {
    updateState(tenantId, (state) => {
        const mappedId = resolveMappedId(state, 'products', productId)
        const targetId = String(productId)

        state.catalogs.products = state.catalogs.products.filter((product) => String(product.id) !== targetId)

        if (isTemporaryId(productId) && String(mappedId) === targetId) {
            state.queue.products = removeQueueRecord(state.queue.products, productId)
        } else {
            state.queue.products = replaceQueueRecord(state.queue.products, {
                entityId: mappedId,
                action: 'delete',
                payload: { id: mappedId },
            })
        }

        return state
    })
}

export function createOfflineOrderDraft(tenantId, attributes = {}, context = {}) {
    let created = null

    updateState(tenantId, (state) => {
        const tempId = allocateTempId(state)
        created = normalizeOrderDetail(state, {
            id: tempId,
            type: attributes.type || 'comanda',
            channel: attributes.channel || 'store',
            reference: attributes.reference || '',
            customer_id: attributes.customerId || attributes.customer_id || null,
            notes: attributes.notes || '',
            status: 'draft',
            created_by: context.userName || null,
            items: [],
        })

        state.orders.details = sortOrders([created, ...state.orders.details])
        state.queue.orders = replaceQueueRecord(state.queue.orders, {
            entityId: tempId,
            action: 'upsert',
            payload: created,
        })

        return state
    })

    return created
}

export function saveOfflineOrderDraft(tenantId, draft, context = {}) {
    let saved = null

    updateState(tenantId, (state) => {
        saved = normalizeOrderDetail(state, {
            ...draft,
            customer_id: draft.customerId ?? draft.customer_id ?? draft.customer?.id ?? null,
            created_by: draft.created_by ?? context.userName ?? null,
            updated_at: nowIso(),
        })

        const exists = state.orders.details.some((entry) => String(entry.id) === String(saved.id))
        state.orders.details = sortOrders(
            exists
                ? state.orders.details.map((entry) => (String(entry.id) === String(saved.id) ? saved : entry))
                : [saved, ...state.orders.details],
        )
        state.queue.orders = replaceQueueRecord(state.queue.orders, {
            entityId: saved.id,
            action: 'upsert',
            payload: saved,
        })

        return state
    })

    return saved
}

export function sendOfflineOrderToCashier(tenantId, orderId) {
    let updatedOrder = null

    updateState(tenantId, (state) => {
        updatedOrder = cloneValue(state.orders.details.find((entry) => String(entry.id) === String(orderId)) || null)

        if (!updatedOrder) {
            return state
        }

        updatedOrder.status = 'sent_to_cashier'
        updatedOrder.sent_to_cashier_at = nowIso()
        updatedOrder.updated_at = nowIso()
        updatedOrder.label = buildOrderLabel(updatedOrder.type, updatedOrder.reference, updatedOrder.id)

        state.orders.details = sortOrders(
            state.orders.details.map((entry) =>
                String(entry.id) === String(orderId) ? updatedOrder : entry,
            ),
        )
        state.queue.orders = replaceQueueRecord(state.queue.orders, {
            entityId: updatedOrder.id,
            action: 'upsert',
            payload: updatedOrder,
        })

        return state
    })

    return updatedOrder
}

export function removeOfflineOrderDraft(tenantId, orderId) {
    updateState(tenantId, (state) => {
        const mappedId = resolveMappedId(state, 'orders', orderId)

        state.orders.details = state.orders.details.filter((entry) => String(entry.id) !== String(orderId))

        if (isTemporaryId(orderId) && String(mappedId) === String(orderId)) {
            state.queue.orders = removeQueueRecord(state.queue.orders, orderId)
        } else {
            state.queue.orders = replaceQueueRecord(state.queue.orders, {
                entityId: mappedId,
                action: 'delete',
                payload: { id: mappedId },
            })
        }

        return state
    })
}

function buildOfflineSaleNumber(state) {
    const sequence = Number(state.meta.nextLocalSaleSequence || 1)
    state.meta.nextLocalSaleSequence = sequence + 1

    return `OFF-${nowIso().slice(0, 10).replaceAll('-', '')}-${String(sequence).padStart(4, '0')}`
}

function normalizeSaleQueuePayload(state, payload) {
    const productsById = state.catalogs.products.reduce((accumulator, product) => {
        accumulator[String(product.id)] = product
        return accumulator
    }, {})

    const items = (payload.items || []).map((item) => {
        const product = productsById[String(item.id)]
        const quantity = normalizeNumber(item.qty, 1)
        const unitPrice = normalizeNumber(product?.sale_price, 0)

        return {
            ...item,
            id: Number(item.id),
            qty: quantity,
            discount: normalizeNumber(item.discount, 0),
            line_subtotal: unitPrice * quantity,
        }
    })

    return {
        ...payload,
        order_draft_id: payload.order_draft_id == null ? null : Number(payload.order_draft_id),
        customer_id: payload.customer_id == null || payload.customer_id === '' ? null : Number(payload.customer_id),
        company_id: payload.company_id == null || payload.company_id === '' ? null : Number(payload.company_id),
        items,
        payments: Array.isArray(payload.payments)
            ? payload.payments.map((payment) => ({
                method: payment.method,
                amount: normalizeNumber(payment.amount, 0),
            }))
            : [],
    }
}

export function queueOfflineSaleFinalize(tenantId, payload, context = {}) {
    let result = null

    updateState(tenantId, (state) => {
        const salePayload = normalizeSaleQueuePayload(state, payload)
        const saleNumber = buildOfflineSaleNumber(state)
        const saleId = allocateTempId(state)
        const productsById = state.catalogs.products.reduce((accumulator, product) => {
            accumulator[String(product.id)] = product
            return accumulator
        }, {})

        salePayload.items.forEach((item) => {
            const product = productsById[String(item.id)]

            if (!product) {
                throw new Error('Um dos produtos desta venda nao esta mais disponivel no modo offline.')
            }

            if (product.stock_quantity < item.qty) {
                throw new Error(`Estoque insuficiente para ${product.name} no modo offline.`)
            }
        })

        state.catalogs.products = sortProducts(
            state.catalogs.products.map((product) => {
                const saleItem = salePayload.items.find((item) => String(item.id) === String(product.id))
                return saleItem
                    ? { ...product, stock_quantity: Number(product.stock_quantity) - Number(saleItem.qty) }
                    : product
            }),
        )

        const linkedOrder = salePayload.order_draft_id != null
            ? cloneValue(state.orders.details.find((entry) => String(entry.id) === String(salePayload.order_draft_id)) || null)
            : null

        if (linkedOrder) {
            state.orders.details = state.orders.details.filter((entry) => String(entry.id) !== String(linkedOrder.id))
            state.queue.orders = removeQueueRecord(state.queue.orders, linkedOrder.id)
        }

        state.queue.sales = [
            ...state.queue.sales,
            {
                entityId: saleId,
                action: 'finalize',
                payload: {
                    ...salePayload,
                    sale_id: saleId,
                    sale_number: saleNumber,
                    created_at: nowIso(),
                    order_snapshot: linkedOrder,
                },
            },
        ]

        if (context.userId != null) {
            delete state.pendingSalesByUser[String(context.userId)]
        }

        result = {
            message: 'Venda registrada no modo offline e pronta para sincronizar quando a internet voltar.',
            sale: {
                sale_id: saleId,
                sale_number: saleNumber,
                total: normalizeNumber(payload.total, 0),
            },
        }

        return state
    })

    return result
}

function buildProductPayloadForSync(product) {
    return {
        code: product.code || '',
        barcode: product.barcode || '',
        name: product.name,
        description: product.description || null,
        category_id: product.category_id == null ? null : Number(product.category_id),
        supplier_id: product.supplier_id == null ? null : Number(product.supplier_id),
        unit: product.unit || 'UN',
        commercial_unit: product.commercial_unit || product.unit || 'UN',
        taxable_unit: product.taxable_unit || product.commercial_unit || product.unit || 'UN',
        cost_price: product.cost_price === '' ? null : Number(product.cost_price || 0),
        sale_price: product.sale_price === '' ? null : Number(product.sale_price || 0),
        stock_quantity: Number(product.stock_quantity || 0),
        min_stock: Number(product.min_stock || 0),
        ncm: product.ncm || null,
        cfop: product.cfop || null,
        cest: product.cest || null,
        origin_code: product.origin_code || '0',
        icms_csosn: product.icms_csosn || '102',
        pis_cst: product.pis_cst || '49',
        cofins_cst: product.cofins_cst || '49',
        fiscal_enabled: product.fiscal_enabled !== false,
        internal_notes: product.internal_notes || null,
        style_reference: product.style_reference || null,
        color: product.color || null,
        size: product.size || null,
        collection: product.collection || null,
        catalog_visible: Boolean(product.catalog_visible),
        icms_rate: product.icms_rate == null ? null : Number(product.icms_rate),
        pis_rate: product.pis_rate == null ? null : Number(product.pis_rate),
        cofins_rate: product.cofins_rate == null ? null : Number(product.cofins_rate),
        ipi_rate: product.ipi_rate == null ? null : Number(product.ipi_rate),
        active: product.active !== false,
    }
}

function buildOrderPayloadForSync(state, order) {
    return {
        type: order.type,
        reference: order.reference || null,
        customer_id: order.customer?.id != null ? resolveMappedId(state, 'customers', order.customer.id) : null,
        notes: order.notes || null,
        items: order.items.map((item) => ({
            id: Number(resolveMappedId(state, 'products', item.id)),
            qty: Number(item.qty),
        })),
    }
}

async function syncProductQueue(tenantId, state, request) {
    for (const entry of [...state.queue.products]) {
        const localId = entry.entityId
        const remoteId = resolveMappedId(state, 'products', localId)

        if (entry.action === 'delete') {
            if (isTemporaryId(localId) && String(remoteId) === String(localId)) {
                state.queue.products = removeQueueRecord(state.queue.products, localId)
                writeState(tenantId, state)
                continue
            }

            await request(`/api/products/${remoteId}`, { method: 'delete' })
            state.queue.products = removeQueueRecord(state.queue.products, localId)
            writeState(tenantId, state)
            continue
        }

        const response = isTemporaryId(localId) && String(remoteId) === String(localId)
            ? await request('/api/products', { method: 'post', data: buildProductPayloadForSync(entry.payload) })
            : await request(`/api/products/${remoteId}`, { method: 'put', data: buildProductPayloadForSync(entry.payload) })

        const remoteProduct = normalizeProductRecord(response.product)

        if (String(remoteProduct.id) !== String(localId)) {
            registerMapping(state, 'products', localId, remoteProduct.id)
            replaceProductReferences(state, localId, remoteProduct)
        } else {
            state.catalogs.products = sortProducts(state.catalogs.products.map((product) => (String(product.id) === String(remoteProduct.id) ? remoteProduct : product)))
        }

        state.queue.products = removeQueueRecord(state.queue.products, localId)
        writeState(tenantId, state)
    }
}

async function syncCustomerQueue(tenantId, state, request) {
    for (const entry of [...state.queue.customers]) {
        const response = await request('/api/pdv/customers/quick', {
            method: 'post',
            data: {
                name: entry.payload.name,
                phone: entry.payload.phone || null,
                document: entry.payload.document || null,
                email: entry.payload.email || null,
            },
        })

        const remoteCustomer = normalizeCustomerRecord(response.customer)
        registerMapping(state, 'customers', entry.entityId, remoteCustomer.id)
        replaceCustomerReferences(state, entry.entityId, remoteCustomer)
        state.queue.customers = removeQueueRecord(state.queue.customers, entry.entityId)
        writeState(tenantId, state)
    }
}

async function syncCompanyQueue(tenantId, state, request) {
    for (const entry of [...state.queue.companies]) {
        const response = await request('/api/pdv/companies/quick', {
            method: 'post',
            data: {
                name: entry.payload.name,
                trade_name: entry.payload.trade_name || null,
                document: entry.payload.document || null,
                email: entry.payload.email || null,
                phone: entry.payload.phone || null,
                state_registration: entry.payload.state_registration || null,
            },
        })

        const remoteCompany = normalizeCompanyRecord(response.company)
        registerMapping(state, 'companies', entry.entityId, remoteCompany.id)
        replaceCompanyReferences(state, entry.entityId, remoteCompany)
        state.queue.companies = removeQueueRecord(state.queue.companies, entry.entityId)
        writeState(tenantId, state)
    }
}

async function ensureRemoteOrder(state, orderSnapshot, request) {
    const localOrderId = orderSnapshot.id
    const resolvedOrderId = resolveMappedId(state, 'orders', localOrderId)

    if (!isTemporaryId(localOrderId) || String(resolvedOrderId) !== String(localOrderId)) {
        await request(`/api/orders/${resolvedOrderId}`, { method: 'put', data: buildOrderPayloadForSync(state, orderSnapshot) })

        if (orderSnapshot.status === 'sent_to_cashier') {
            const sendResponse = await request(`/api/orders/${resolvedOrderId}/send-to-cashier`, { method: 'post' })
            return normalizeOrderDetail(state, sendResponse.order)
        }

        return { ...orderSnapshot, id: Number(resolvedOrderId) }
    }

    const createdResponse = await request('/api/orders', { method: 'post' })
    const remoteOrderId = Number(createdResponse.order.id)
    registerMapping(state, 'orders', localOrderId, remoteOrderId)

    const savedResponse = await request(`/api/orders/${remoteOrderId}`, { method: 'put', data: buildOrderPayloadForSync(state, orderSnapshot) })

    if (orderSnapshot.status === 'sent_to_cashier') {
        const sendResponse = await request(`/api/orders/${remoteOrderId}/send-to-cashier`, { method: 'post' })
        return normalizeOrderDetail(state, sendResponse.order)
    }

    return normalizeOrderDetail(state, savedResponse.order)
}

async function syncOrderQueue(tenantId, state, request) {
    for (const entry of [...state.queue.orders]) {
        const localOrderId = entry.entityId
        const resolvedOrderId = resolveMappedId(state, 'orders', localOrderId)

        if (entry.action === 'delete') {
            if (isTemporaryId(localOrderId) && String(resolvedOrderId) === String(localOrderId)) {
                state.queue.orders = removeQueueRecord(state.queue.orders, localOrderId)
                writeState(tenantId, state)
                continue
            }

            await request(`/api/orders/${resolvedOrderId}`, { method: 'delete' })
            state.queue.orders = removeQueueRecord(state.queue.orders, localOrderId)
            writeState(tenantId, state)
            continue
        }

        const remoteOrder = await ensureRemoteOrder(state, entry.payload, request)

        if (String(remoteOrder.id) !== String(localOrderId)) {
            replaceOrderReferences(state, localOrderId, remoteOrder)
        } else {
            state.orders.details = sortOrders(state.orders.details.map((order) => (String(order.id) === String(remoteOrder.id) ? remoteOrder : order)))
        }

        state.queue.orders = removeQueueRecord(state.queue.orders, localOrderId)
        writeState(tenantId, state)
    }
}

async function syncSaleQueue(tenantId, state, request) {
    for (const entry of [...state.queue.sales]) {
        const payload = entry.payload
        let resolvedOrderId = payload.order_draft_id

        if (payload.order_snapshot) {
            const remoteOrder = await ensureRemoteOrder(state, payload.order_snapshot, request)
            resolvedOrderId = remoteOrder.id
        } else if (resolvedOrderId != null) {
            resolvedOrderId = resolveMappedId(state, 'orders', resolvedOrderId)
        }

        const response = await request('/api/pdv/sales', {
            method: 'post',
            data: {
                order_draft_id: resolvedOrderId,
                customer_id: payload.customer_id == null ? null : Number(resolveMappedId(state, 'customers', payload.customer_id)),
                company_id: payload.company_id == null ? null : Number(resolveMappedId(state, 'companies', payload.company_id)),
                discount: Number(payload.discount || 0),
                notes: payload.notes || null,
                fiscal_decision: payload.fiscal_decision,
                requested_document_model: payload.requested_document_model || '65',
                recipient_payload: payload.recipient_payload
                    ? {
                        ...payload.recipient_payload,
                        customer_id: payload.recipient_payload.customer_id == null ? payload.recipient_payload.customer_id : Number(resolveMappedId(state, 'customers', payload.recipient_payload.customer_id)),
                        company_id: payload.recipient_payload.company_id == null ? payload.recipient_payload.company_id : Number(resolveMappedId(state, 'companies', payload.recipient_payload.company_id)),
                    }
                    : null,
                items: payload.items.map((item) => ({
                    id: Number(resolveMappedId(state, 'products', item.id)),
                    qty: Number(item.qty),
                    discount: Number(item.discount || 0),
                    discount_percent: Number(item.discount_percent || 0),
                    discount_scope: item.discount_scope || null,
                    discount_authorized_by: item.discount_authorized_by || null,
                })),
                payments: payload.payments.map((payment) => ({
                    method: payment.method,
                    amount: Number(payment.amount || 0),
                })),
            },
        })

        if (payload.fiscal_decision === 'emit') {
            try {
                await request(`/api/pdv/sales/${response.sale.sale_id}/issue-fiscal`, {
                    method: 'post',
                    data: {
                        document_model: payload.requested_document_model || '65',
                        mode: 'auto',
                        recipient: payload.recipient_payload || null,
                    },
                })
            } catch {
                state.meta.lastSyncError = `Venda ${response.sale.sale_number} sincronizada, mas a emissao fiscal precisa de revisao manual.`
                writeState(tenantId, state)
            }
        }

        state.queue.sales = state.queue.sales.filter((item) => String(item.entityId) !== String(entry.entityId))
        writeState(tenantId, state)
    }
}

const syncLocks = new Map()

export async function syncOfflineWorkspace(tenantId, request) {
    if (!tenantId || typeof request !== 'function') {
        return getOfflineWorkspaceSummary(tenantId)
    }

    if (isBrowserOffline()) {
        return getOfflineWorkspaceSummary(tenantId)
    }

    if (syncLocks.has(tenantId)) {
        return syncLocks.get(tenantId)
    }

    const syncPromise = (async () => {
        const state = cloneValue(readState(tenantId))

        if (!countPending(state)) {
            return buildSummary(state)
        }

        state.meta.lastSyncAttemptAt = nowIso()
        writeState(tenantId, state)

        try {
            await syncCustomerQueue(tenantId, state, request)
            await syncCompanyQueue(tenantId, state, request)
            await syncProductQueue(tenantId, state, request)
            await syncOrderQueue(tenantId, state, request)
            await syncSaleQueue(tenantId, state, request)

            state.meta.lastSyncAt = nowIso()
            state.meta.lastSyncError = null
            writeState(tenantId, state)

            return buildSummary(state)
        } catch (error) {
            state.meta.lastSyncError = error.message || 'Nao foi possivel sincronizar os dados offline.'
            writeState(tenantId, state)
            throw error
        }
    })().finally(() => {
        syncLocks.delete(tenantId)
    })

    syncLocks.set(tenantId, syncPromise)
    return syncPromise
}
