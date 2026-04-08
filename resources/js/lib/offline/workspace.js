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
const CASH_REGISTER_PAYMENT_LABELS = {
    cash: 'Dinheiro',
    pix: 'Pix',
    debit_card: 'Cartao de debito',
    credit_card: 'Cartao de credito',
    credit: 'A Prazo',
}

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
        cashRegisterHistory: [],
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
            cashRegisters: {},
            products: {},
            customers: {},
            companies: {},
            orders: {},
        },
        queue: {
            cashRegisters: [],
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

function normalizeCashRegisterRecord(cashRegister) {
    if (!cashRegister) {
        return null
    }

    return {
        id: Number(cashRegister.id),
        status: cashRegister.status || 'open',
        opening_amount: normalizeNumber(cashRegister.opening_amount, 0),
        closing_amount: normalizeNumber(cashRegister.closing_amount, 0),
        opening_notes: cashRegister.opening_notes || null,
        closing_notes: cashRegister.closing_notes || null,
        opened_at: cashRegister.opened_at || nowIso(),
        closed_at: cashRegister.closed_at || null,
        user_name: cashRegister.user_name || null,
    }
}

function normalizeCashMovementRecord(movement) {
    return {
        id: movement.id ?? null,
        type: movement.type === 'supply' ? 'supply' : 'withdrawal',
        amount: normalizeNumber(movement.amount, 0),
        reason: movement.reason || null,
        user_name: movement.user_name || null,
        created_at: movement.created_at || nowIso(),
    }
}

function normalizeCashRegisterClosingBreakdownRow(row) {
    return {
        payment_method: row.payment_method,
        label: row.label || CASH_REGISTER_PAYMENT_LABELS[row.payment_method] || row.payment_method,
        expected: normalizeNumber(row.expected, 0),
        informed: row.informed == null ? null : normalizeNumber(row.informed, 0),
        difference: row.difference == null ? null : normalizeNumber(row.difference, 0),
        recorded_at: row.recorded_at || null,
    }
}

function normalizeCashRegisterReport(report) {
    if (!report?.cashRegister) {
        return null
    }

    const payments = Array.isArray(report.payments)
        ? report.payments.map((payment) => ({
            payment_method: payment.payment_method,
            label: payment.label || CASH_REGISTER_PAYMENT_LABELS[payment.payment_method] || payment.payment_method,
            qtd: normalizeNumber(payment.qtd, 0),
            total: normalizeNumber(payment.total, 0),
        }))
        : []
    const paymentTotals = report.payment_totals && typeof report.payment_totals === 'object'
        ? Object.fromEntries(
            Object.entries(report.payment_totals).map(([paymentMethod, total]) => [
                paymentMethod,
                normalizeNumber(total, 0),
            ]),
        )
        : Object.fromEntries(payments.map((payment) => [payment.payment_method, payment.total]))

    return {
        ...report,
        cashRegister: normalizeCashRegisterRecord(report.cashRegister),
        payments,
        payment_totals: paymentTotals,
        movements: Array.isArray(report.movements) ? report.movements.map(normalizeCashMovementRecord) : [],
        total_sales: normalizeNumber(report.total_sales, 0),
        sales_count: normalizeNumber(report.sales_count, 0),
        total_withdrawals: normalizeNumber(report.total_withdrawals, 0),
        total_supplies: normalizeNumber(report.total_supplies, 0),
        cash_sales: normalizeNumber(report.cash_sales, 0),
        expected_cash: normalizeNumber(report.expected_cash, 0),
        difference: normalizeNumber(report.difference, 0),
        closing_breakdown: Array.isArray(report.closing_breakdown)
            ? report.closing_breakdown.map(normalizeCashRegisterClosingBreakdownRow)
            : [],
    }
}

function summarizeCashRegisterReport(report) {
    const normalizedReport = normalizeCashRegisterReport(report)

    if (!normalizedReport) {
        return null
    }

    return {
        id: normalizedReport.cashRegister.id,
        user_name: normalizedReport.cashRegister.user_name || null,
        opening_amount: normalizeNumber(normalizedReport.cashRegister.opening_amount, 0),
        closing_amount: normalizeNumber(normalizedReport.cashRegister.closing_amount, 0),
        opened_at: normalizedReport.cashRegister.opened_at || null,
        closed_at: normalizedReport.cashRegister.closed_at || null,
        difference: normalizeNumber(normalizedReport.difference, 0),
        sales_count: normalizeNumber(normalizedReport.sales_count, 0),
        total_sales: normalizeNumber(normalizedReport.total_sales, 0),
        report: normalizedReport,
    }
}

function sortCashRegisterHistory(records) {
    return [...records].sort((left, right) => {
        const rightDate = normalizeTimestamp(right.closed_at || right.opened_at || 0)
        const leftDate = normalizeTimestamp(left.closed_at || left.opened_at || 0)
        return rightDate - leftDate
    })
}

function normalizeCashRegisterHistoryRecord(record) {
    const summarizedFromReport = record?.report ? summarizeCashRegisterReport(record.report) : null

    return {
        id: Number(record?.id ?? summarizedFromReport?.id),
        user_name: record?.user_name || summarizedFromReport?.user_name || null,
        opening_amount: normalizeNumber(record?.opening_amount ?? summarizedFromReport?.opening_amount, 0),
        closing_amount: normalizeNumber(record?.closing_amount ?? summarizedFromReport?.closing_amount, 0),
        opened_at: record?.opened_at || summarizedFromReport?.opened_at || null,
        closed_at: record?.closed_at || summarizedFromReport?.closed_at || null,
        difference: normalizeNumber(record?.difference ?? summarizedFromReport?.difference, 0),
        sales_count: normalizeNumber(record?.sales_count ?? summarizedFromReport?.sales_count, 0),
        total_sales: normalizeNumber(record?.total_sales ?? summarizedFromReport?.total_sales, 0),
        report: summarizedFromReport?.report || null,
    }
}

function mergeCashRegisterHistory(existing = [], incoming = []) {
    const registerMap = new Map(
        existing.map((record) => {
            const normalized = normalizeCashRegisterHistoryRecord(record)
            return [String(normalized.id), normalized]
        }),
    )

    incoming.forEach((record) => {
        const normalized = normalizeCashRegisterHistoryRecord(record)
        const current = registerMap.get(String(normalized.id))

        registerMap.set(String(normalized.id), {
            ...current,
            ...normalized,
            report: normalized.report || current?.report || null,
        })
    })

    return sortCashRegisterHistory(Array.from(registerMap.values()))
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
        cash_register_id: pendingSale.cash_register_id == null || pendingSale.cash_register_id === '' ? null : Number(pendingSale.cash_register_id),
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
        cashRegisterHistory: Array.isArray(rawState.cashRegisterHistory)
            ? rawState.cashRegisterHistory.map(normalizeCashRegisterHistoryRecord)
            : [],
        mappings: {
            ...fallback.mappings,
            ...(rawState.mappings || {}),
            cashRegisters: rawState.mappings?.cashRegisters || {},
        },
        queue: {
            ...fallback.queue,
            ...(rawState.queue || {}),
            cashRegisters: Array.isArray(rawState.queue?.cashRegisters) ? rawState.queue.cashRegisters : [],
            products: Array.isArray(rawState.queue?.products) ? rawState.queue.products : [],
            customers: Array.isArray(rawState.queue?.customers) ? rawState.queue.customers : [],
            companies: Array.isArray(rawState.queue?.companies) ? rawState.queue.companies : [],
            orders: Array.isArray(rawState.queue?.orders) ? rawState.queue.orders : [],
            sales: Array.isArray(rawState.queue?.sales) ? rawState.queue.sales : [],
        },
        cashRegister: normalizeCashRegisterRecord(rawState.cashRegister),
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
        state.queue.cashRegisters.length,
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

function removeQueuedCashRegisterAction(queueItems, queueId) {
    const queueKey = String(queueId)
    return queueItems.filter((item) => String(item.queueId) !== queueKey)
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

function replaceCashRegisterReferences(state, localId, remoteCashRegister) {
    const normalizedRemote = normalizeCashRegisterRecord(remoteCashRegister)

    if (state.cashRegister && String(state.cashRegister.id) === String(localId)) {
        state.cashRegister = normalizedRemote
    }

    state.pendingSalesByUser = Object.fromEntries(
        Object.entries(state.pendingSalesByUser).map(([userId, pendingSale]) => [
            userId,
            pendingSale && String(pendingSale.cash_register_id) === String(localId)
                ? { ...pendingSale, cash_register_id: normalizedRemote.id }
                : pendingSale,
        ]),
    )

    state.queue.sales = state.queue.sales.map((entry) =>
        String(entry.payload?.cash_register_id) === String(localId)
            ? {
                ...entry,
                payload: {
                    ...entry.payload,
                    cash_register_id: normalizedRemote.id,
                },
            }
            : entry,
    )

    state.queue.cashRegisters = state.queue.cashRegisters.map((entry) => {
        const resolvedEntityId = resolveMappedId(state, 'cashRegisters', entry.entityId)
        const nextEntityId = String(resolvedEntityId) === String(localId)
            ? normalizedRemote.id
            : entry.entityId
        const nextPayloadCashRegisterId = entry.payload?.cash_register_id == null
            ? entry.payload?.cash_register_id
            : (String(resolveMappedId(state, 'cashRegisters', entry.payload.cash_register_id)) === String(localId)
                ? normalizedRemote.id
                : entry.payload.cash_register_id)

        return {
            ...entry,
            entityId: nextEntityId,
            payload: entry.payload
                ? {
                    ...entry.payload,
                    cash_register_id: nextPayloadCashRegisterId,
                }
                : entry.payload,
        }
    })

    state.cashRegisterHistory = state.cashRegisterHistory.map((record) => {
        if (String(record.id) !== String(localId)) {
            return record
        }

        const nextReport = record.report
            ? normalizeCashRegisterReport({
                ...record.report,
                cashRegister: {
                    ...record.report.cashRegister,
                    ...normalizedRemote,
                    status: record.report.cashRegister?.status || normalizedRemote.status,
                    closing_amount: record.report.cashRegister?.closing_amount ?? normalizedRemote.closing_amount,
                    closing_notes: record.report.cashRegister?.closing_notes ?? normalizedRemote.closing_notes,
                    closed_at: record.report.cashRegister?.closed_at ?? normalizedRemote.closed_at,
                },
            })
            : null

        return normalizeCashRegisterHistoryRecord({
            ...record,
            id: normalizedRemote.id,
            report: nextReport,
        })
    })
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

export function hasOfflineWorkspaceData(tenantId) {
    const state = readState(tenantId)

    return Boolean(
        state.catalogs.products.length
        || state.catalogs.categories.length
        || state.catalogs.customers.length
        || state.catalogs.companies.length
        || state.catalogs.suppliers.length
        || state.orders.details.length
        || state.cashRegister
        || state.cashRegisterHistory.length
        || Object.values(state.pendingSalesByUser || {}).some(Boolean)
        || countPending(state) > 0,
    )
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
            const hasPendingCashRegisterStateChange = state.queue.cashRegisters.some((entry) =>
                entry.action === 'open' || entry.action === 'close',
            )

            if (!hasPendingCashRegisterStateChange) {
                state.cashRegister = normalizeCashRegisterRecord(snapshot.cashRegister)
            }
        }

        if (Array.isArray(snapshot.cashRegisterHistory)) {
            state.cashRegisterHistory = mergeCashRegisterHistory(state.cashRegisterHistory, snapshot.cashRegisterHistory)
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

export function createOfflineCashRegister(tenantId, payload = {}, context = {}) {
    let created = null

    updateState(tenantId, (state) => {
        if (state.cashRegister?.status === 'open') {
            throw new Error('Ja existe um caixa aberto nesta maquina.')
        }

        const tempId = allocateTempId(state)
        created = normalizeCashRegisterRecord({
            id: tempId,
            status: 'open',
            opening_amount: payload.opening_amount,
            opening_notes: payload.opening_notes || null,
            opened_at: context.openedAt || nowIso(),
            user_name: context.userName || null,
        })

        state.cashRegister = created
        state.queue.cashRegisters.push({
            queueId: allocateTempId(state),
            queuedAt: nowIso(),
            entityId: tempId,
            action: 'open',
            payload: created,
        })

        return state
    })

    return created
}

function resolveCashRegisterQueueTargetId(state, entry) {
    const explicitId = entry.payload?.cash_register_id

    if (explicitId != null && explicitId !== '') {
        return resolveMappedId(state, 'cashRegisters', explicitId)
    }

    return resolveMappedId(state, 'cashRegisters', entry.entityId)
}

function queueEntryMatchesCashRegister(state, entry, cashRegisterId) {
    return String(resolveCashRegisterQueueTargetId(state, entry)) === String(cashRegisterId)
}

function buildQueuedCashRegisterMovement(entry, fallbackUserName = null) {
    return normalizeCashMovementRecord({
        id: entry.queueId,
        type: entry.payload?.type,
        amount: entry.payload?.amount,
        reason: entry.payload?.reason,
        user_name: entry.payload?.user_name || fallbackUserName || null,
        created_at: entry.payload?.created_at || entry.queuedAt || nowIso(),
    })
}

function buildOfflineCashRegisterClosingBreakdown(report, closingTotals = {}, recordedAt = null) {
    return Object.entries(CASH_REGISTER_PAYMENT_LABELS).map(([paymentMethod, label]) => {
        const expected = paymentMethod === 'cash'
            ? Number(report.expected_cash || 0)
            : Number(report.payment_totals?.[paymentMethod] || 0)
        const hasInformedValue = Object.prototype.hasOwnProperty.call(closingTotals, paymentMethod)
        const informed = hasInformedValue ? Number(closingTotals[paymentMethod] || 0) : null

        return {
            payment_method: paymentMethod,
            label,
            expected,
            informed,
            difference: informed == null ? null : informed - expected,
            recorded_at: recordedAt,
        }
    })
}

export function registerOfflineCashMovement(tenantId, cashRegisterId, payload = {}, context = {}) {
    let movement = null

    updateState(tenantId, (state) => {
        if (!state.cashRegister || String(state.cashRegister.id) !== String(cashRegisterId)) {
            throw new Error('Nenhum caixa aberto foi encontrado para registrar a movimentacao.')
        }

        const queuedAction = {
            queueId: allocateTempId(state),
            queuedAt: nowIso(),
            entityId: state.cashRegister.id,
            action: 'movement',
            payload: {
                cash_register_id: state.cashRegister.id,
                type: payload.type,
                amount: normalizeNumber(payload.amount, 0),
                reason: payload.reason || null,
                user_name: context.userName || state.cashRegister.user_name || null,
                created_at: context.createdAt || nowIso(),
            },
        }

        state.queue.cashRegisters.push(queuedAction)
        movement = buildQueuedCashRegisterMovement(queuedAction, context.userName || state.cashRegister.user_name)
        return state
    })

    return movement
}

export function getOfflineCashRegisterHistory(tenantId) {
    const state = readState(tenantId)
    return sortCashRegisterHistory(state.cashRegisterHistory).map((record) => cloneValue(record))
}

export function cacheOfflineCashRegisterReport(tenantId, report) {
    if (!tenantId) {
        return null
    }

    let cached = null

    updateState(tenantId, (state) => {
        const summary = summarizeCashRegisterReport(report)

        if (!summary) {
            return state
        }

        state.cashRegisterHistory = mergeCashRegisterHistory(state.cashRegisterHistory, [summary])
        cached = summary.report
        return state
    })

    return cached
}

export function getOfflineCashRegisterReport(tenantId, cashRegisterId, options = {}) {
    const state = readState(tenantId)
    const normalizedId = String(cashRegisterId)

    if (state.cashRegister && String(state.cashRegister.id) === normalizedId) {
        return buildOfflineCashRegisterReport(tenantId, options)
    }

    const cached = state.cashRegisterHistory.find((record) => String(record.id) === normalizedId)
        || state.cashRegisterHistory.find((record) =>
            String(resolveMappedId(state, 'cashRegisters', record.id)) === normalizedId,
        )

    return cached?.report ? cloneValue(cached.report) : null
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
        cash_register_id: payload.cash_register_id == null || payload.cash_register_id === '' ? null : Number(payload.cash_register_id),
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
        if (!state.cashRegister || state.cashRegister.status !== 'open') {
            throw new Error('Abra um caixa antes de finalizar a venda no modo offline.')
        }

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
                    cash_register_id: salePayload.cash_register_id ?? state.cashRegister.id,
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

export function buildOfflineCashRegisterReport(tenantId, options = {}) {
    const state = readState(tenantId)
    const cashRegister = normalizeCashRegisterRecord(state.cashRegister)

    if (!cashRegister) {
        return null
    }

    const fallbackReport = options.fallbackReport
    const useFallbackTotals = String(fallbackReport?.cashRegister?.id || '') === String(cashRegister.id)
    const basePayments = useFallbackTotals ? (fallbackReport?.payments || []) : []
    const paymentsMap = new Map(
        basePayments.map((payment) => [
            payment.payment_method,
            {
                payment_method: payment.payment_method,
                label: payment.label || CASH_REGISTER_PAYMENT_LABELS[payment.payment_method] || payment.payment_method,
                qtd: Number(payment.qtd || 0),
                total: Number(payment.total || 0),
            },
        ]),
    )

    const queuedSales = state.queue.sales.filter((entry) =>
        String(entry.payload?.cash_register_id) === String(cashRegister.id),
    )

    queuedSales.forEach((entry) => {
        ;(entry.payload?.payments || []).forEach((payment) => {
            const current = paymentsMap.get(payment.method) || {
                payment_method: payment.method,
                label: CASH_REGISTER_PAYMENT_LABELS[payment.method] || payment.method,
                qtd: 0,
                total: 0,
            }

            paymentsMap.set(payment.method, {
                ...current,
                qtd: Number(current.qtd || 0) + 1,
                total: Number(current.total || 0) + Number(payment.amount || 0),
            })
        })
    })

    const payments = Array.from(paymentsMap.values())
    const paymentTotals = Object.fromEntries(payments.map((payment) => [payment.payment_method, Number(payment.total || 0)]))
    const baseTotalSales = useFallbackTotals ? Number(fallbackReport?.total_sales || 0) : 0
    const baseSalesCount = useFallbackTotals ? Number(fallbackReport?.sales_count || 0) : 0
    const baseSupplies = useFallbackTotals ? Number(fallbackReport?.total_supplies || 0) : 0
    const baseWithdrawals = useFallbackTotals ? Number(fallbackReport?.total_withdrawals || 0) : 0
    const baseMovements = useFallbackTotals
        ? (fallbackReport?.movements || []).map(normalizeCashMovementRecord)
        : []
    const queuedMovements = state.queue.cashRegisters
        .filter((entry) => entry.action === 'movement' && queueEntryMatchesCashRegister(state, entry, cashRegister.id))
        .map((entry) => buildQueuedCashRegisterMovement(entry, cashRegister.user_name || options.userName || 'Operador'))
    const totalQueuedSupplies = queuedMovements
        .filter((movement) => movement.type === 'supply')
        .reduce((sum, movement) => sum + Number(movement.amount || 0), 0)
    const totalQueuedWithdrawals = queuedMovements
        .filter((movement) => movement.type === 'withdrawal')
        .reduce((sum, movement) => sum + Number(movement.amount || 0), 0)
    const totalSupplies = baseSupplies + totalQueuedSupplies
    const totalWithdrawals = baseWithdrawals + totalQueuedWithdrawals
    const totalSales = baseTotalSales + queuedSales.reduce((sum, entry) => sum + Number(entry.payload?.total || 0), 0)
    const salesCount = baseSalesCount + queuedSales.length
    const cashSales = Number(paymentTotals.cash || 0)
    const expectedCash = Number(cashRegister.opening_amount || 0) + totalSupplies + cashSales - totalWithdrawals

    return normalizeCashRegisterReport({
        cashRegister: {
            ...(useFallbackTotals ? fallbackReport.cashRegister : {}),
            ...cashRegister,
            user_name: cashRegister.user_name || fallbackReport?.cashRegister?.user_name || options.userName || 'Operador',
            closing_amount: 0,
            closing_notes: null,
            closed_at: null,
        },
        payments,
        payment_totals: paymentTotals,
        movements: [...baseMovements, ...queuedMovements],
        total_sales: totalSales,
        sales_count: salesCount,
        total_withdrawals: totalWithdrawals,
        total_supplies: totalSupplies,
        cash_sales: cashSales,
        expected_cash: expectedCash,
        difference: 0,
        closing_breakdown: buildOfflineCashRegisterClosingBreakdown({
            expected_cash: expectedCash,
            payment_totals: paymentTotals,
        }),
    })
}

export function closeOfflineCashRegister(tenantId, cashRegisterId, payload = {}, context = {}) {
    let result = null

    updateState(tenantId, (state) => {
        if (!state.cashRegister || String(state.cashRegister.id) !== String(cashRegisterId)) {
            throw new Error('Nenhum caixa aberto foi encontrado para concluir o fechamento.')
        }

        const currentReport = buildOfflineCashRegisterReport(tenantId, {
            userName: context.userName || state.cashRegister.user_name || 'Operador',
            fallbackReport: context.fallbackReport || null,
        })

        if (!currentReport) {
            throw new Error('Nao foi possivel montar o resumo offline do caixa para o fechamento.')
        }

        const closedAt = context.closedAt || nowIso()
        const closingTotals = payload.closing_totals && typeof payload.closing_totals === 'object'
            ? Object.fromEntries(
                Object.entries(payload.closing_totals).map(([paymentMethod, amount]) => [
                    paymentMethod,
                    normalizeNumber(amount, 0),
                ]),
            )
            : {}
        const closingBreakdown = buildOfflineCashRegisterClosingBreakdown(currentReport, closingTotals, closedAt)
        const cashClosing = closingBreakdown.find((entry) => entry.payment_method === 'cash') || null
        const closingAmount = Number(payload.closing_amount ?? cashClosing?.informed ?? 0)
        const difference = Number(cashClosing?.difference ?? (closingAmount - Number(currentReport.expected_cash || 0)))
        const closedReport = normalizeCashRegisterReport({
            ...currentReport,
            cashRegister: {
                ...currentReport.cashRegister,
                status: 'closed',
                closing_amount: closingAmount,
                closing_notes: payload.closing_notes || null,
                closed_at: closedAt,
            },
            difference,
            closing_breakdown: closingBreakdown,
        })

        state.cashRegisterHistory = mergeCashRegisterHistory(state.cashRegisterHistory, [summarizeCashRegisterReport(closedReport)])
        state.queue.cashRegisters.push({
            queueId: allocateTempId(state),
            queuedAt: nowIso(),
            entityId: state.cashRegister.id,
            action: 'close',
            payload: {
                cash_register_id: state.cashRegister.id,
                closing_amount: closingAmount,
                closing_notes: payload.closing_notes || null,
                closing_totals: closingTotals,
                closed_at: closedAt,
                report: closedReport,
            },
        })
        state.cashRegister = null
        result = {
            message: 'Caixa fechado no modo offline e pronto para sincronizar quando a internet voltar.',
            report: closedReport,
        }

        return state
    })

    return result
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

async function syncCashRegisterQueue(tenantId, state, request, allowedActions = ['open']) {
    for (const entry of [...state.queue.cashRegisters]) {
        if (!allowedActions.includes(entry.action)) {
            continue
        }

        if (entry.action === 'open') {
            const response = await request('/api/cash-registers', {
                method: 'post',
                data: {
                    opening_amount: Number(entry.payload?.opening_amount || 0),
                    opening_notes: entry.payload?.opening_notes || null,
                },
            })

            const remoteCashRegister = normalizeCashRegisterRecord({
                id: response.cash_register_id,
                status: 'open',
                opening_amount: entry.payload?.opening_amount || 0,
                opening_notes: entry.payload?.opening_notes || null,
                opened_at: entry.payload?.opened_at || nowIso(),
                user_name: entry.payload?.user_name || state.cashRegister?.user_name || null,
            })

            registerMapping(state, 'cashRegisters', entry.entityId, remoteCashRegister.id)
            replaceCashRegisterReferences(state, entry.entityId, remoteCashRegister)
            state.queue.cashRegisters = removeQueuedCashRegisterAction(state.queue.cashRegisters, entry.queueId)
            writeState(tenantId, state)
            continue
        }

        const remoteCashRegisterId = Number(resolveCashRegisterQueueTargetId(state, entry))

        if (!remoteCashRegisterId) {
            throw new Error('Nao foi possivel resolver o caixa remoto para sincronizar a fila offline.')
        }

        if (entry.action === 'movement') {
            await request(`/api/cash-registers/${remoteCashRegisterId}/movements`, {
                method: 'post',
                data: {
                    type: entry.payload?.type,
                    amount: Number(entry.payload?.amount || 0),
                    reason: entry.payload?.reason || null,
                },
            })

            state.queue.cashRegisters = removeQueuedCashRegisterAction(state.queue.cashRegisters, entry.queueId)
            writeState(tenantId, state)
            continue
        }

        if (entry.action === 'close') {
            const response = await request(`/api/cash-registers/${remoteCashRegisterId}/close`, {
                method: 'post',
                data: {
                    closing_amount: Number(entry.payload?.closing_amount || 0),
                    closing_notes: entry.payload?.closing_notes || null,
                    closing_totals: entry.payload?.closing_totals || {},
                },
            })

            const remoteReport = normalizeCashRegisterReport(response.report)

            if (remoteReport) {
                state.cashRegisterHistory = mergeCashRegisterHistory(state.cashRegisterHistory, [summarizeCashRegisterReport(remoteReport)])
            }

            state.queue.cashRegisters = removeQueuedCashRegisterAction(state.queue.cashRegisters, entry.queueId)
            writeState(tenantId, state)
        }
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
                cash_register_id: payload.cash_register_id == null
                    ? null
                    : Number(resolveMappedId(state, 'cashRegisters', payload.cash_register_id)),
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
                    unit_price: item.unit_price == null ? null : Number(item.unit_price),
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
            await syncCashRegisterQueue(tenantId, state, request, ['open'])
            await syncCustomerQueue(tenantId, state, request)
            await syncCompanyQueue(tenantId, state, request)
            await syncProductQueue(tenantId, state, request)
            await syncOrderQueue(tenantId, state, request)
            await syncSaleQueue(tenantId, state, request)
            await syncCashRegisterQueue(tenantId, state, request, ['movement', 'close'])

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
