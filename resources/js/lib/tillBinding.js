const STORAGE_PREFIX = 'nimvo:till-binding'

function storageKey(tenantId) {
    return `${STORAGE_PREFIX}:${tenantId}`
}

export function getTillBinding(tenantId) {
    if (!tenantId || typeof window === 'undefined') {
        return null
    }

    try {
        const raw = window.localStorage.getItem(storageKey(tenantId))

        if (!raw) {
            return null
        }

        const parsed = JSON.parse(raw)

        return parsed && parsed.till_id ? parsed : null
    } catch {
        return null
    }
}

export function setTillBinding(tenantId, till) {
    if (!tenantId || typeof window === 'undefined' || !till?.id) {
        return
    }

    window.localStorage.setItem(storageKey(tenantId), JSON.stringify({
        till_id: till.id,
        till_name: till.name,
    }))
}

export function clearTillBinding(tenantId) {
    if (!tenantId || typeof window === 'undefined') {
        return
    }

    window.localStorage.removeItem(storageKey(tenantId))
}

export function resolveTillBinding(tenantId, tills) {
    if (!Array.isArray(tills) || tills.length === 0) {
        return null
    }

    if (tills.length === 1) {
        return { till_id: tills[0].id, till_name: tills[0].name }
    }

    const saved = getTillBinding(tenantId)

    if (saved && tills.some((till) => till.id === saved.till_id)) {
        return saved
    }

    return null
}
