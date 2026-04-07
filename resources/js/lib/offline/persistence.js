import {
    canUseLocalAgentBridge,
    readOfflineWorkspaceViaLocalAgent,
    writeOfflineWorkspaceViaLocalAgent,
} from '@/lib/localAgentBridge'

const DB_NAME = 'nimvo-offline-workspace'
const STORE_NAME = 'workspaces'
const DB_VERSION = 1

function hasIndexedDb() {
    return typeof window !== 'undefined' && 'indexedDB' in window
}

function resolveUpdatedAt(state, fallback = null) {
    return state?.meta?.lastUpdatedAt
        || state?.meta?.lastSyncAt
        || state?.meta?.lastSeededAt
        || fallback
}

function openWorkspaceDatabase() {
    if (!hasIndexedDb()) {
        return Promise.resolve(null)
    }

    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = () => {
            const database = request.result

            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'tenantId' })
            }
        }

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error('Nao foi possivel abrir o IndexedDB offline.'))
    })
}

export async function loadIndexedDbWorkspaceSnapshot(tenantId) {
    if (!tenantId) {
        return null
    }

    const database = await openWorkspaceDatabase()
    if (!database) {
        return null
    }

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(String(tenantId))

        request.onsuccess = () => {
            const record = request.result
            database.close()

            if (!record?.state) {
                resolve(null)
                return
            }

            resolve({
                state: record.state,
                updatedAt: resolveUpdatedAt(record.state, record.updatedAt || null),
            })
        }

        request.onerror = () => {
            database.close()
            reject(request.error || new Error('Nao foi possivel ler o IndexedDB offline.'))
        }
    })
}

export async function saveIndexedDbWorkspaceSnapshot(tenantId, state) {
    if (!tenantId) {
        return null
    }

    const database = await openWorkspaceDatabase()
    if (!database) {
        return null
    }

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)
        const record = {
            tenantId: String(tenantId),
            updatedAt: resolveUpdatedAt(state, new Date().toISOString()),
            state,
        }

        const request = store.put(record)

        request.onsuccess = () => {
            database.close()
            resolve(record)
        }

        request.onerror = () => {
            database.close()
            reject(request.error || new Error('Nao foi possivel salvar o IndexedDB offline.'))
        }
    })
}

export async function loadLocalAgentWorkspaceSnapshot(tenantId, bridge) {
    if (!tenantId || !canUseLocalAgentBridge(bridge)) {
        return null
    }

    try {
        const response = await readOfflineWorkspaceViaLocalAgent(bridge, tenantId)

        if (!response?.workspace) {
            return null
        }

        return {
            state: response.workspace,
            updatedAt: resolveUpdatedAt(response.workspace, response.updated_at || null),
        }
    } catch (error) {
        if (error?.status === 404) {
            return null
        }

        throw error
    }
}

export async function saveLocalAgentWorkspaceSnapshot(tenantId, state, bridge) {
    if (!tenantId || !canUseLocalAgentBridge(bridge)) {
        return null
    }

    return writeOfflineWorkspaceViaLocalAgent(bridge, tenantId, state)
}
