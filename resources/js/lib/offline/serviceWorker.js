const OFFLINE_CACHE_VERSION = 'nimvo-offline-v2'
const OFFLINE_APP_CACHE = `${OFFLINE_CACHE_VERSION}:app`
const OFFLINE_WORKSPACE_PATHS = ['/pdv', '/pedidos', '/produtos', '/caixa']
const OFFLINE_WORKSPACE_PAGE_ENTRIES = [
    'resources/js/Pages/Pos/Index.jsx',
    'resources/js/Pages/Orders/Index.jsx',
    'resources/js/Pages/Products/Index.jsx',
    'resources/js/Pages/CashRegister/Index.jsx',
]
const BUILD_MANIFEST_URL = '/build/manifest.json'

function normalizeAssetUrl(path) {
    const normalizedPath = String(path || '').replace(/^\/+/, '')

    if (!normalizedPath) {
        return null
    }

    if (normalizedPath.startsWith('build/')) {
        return `/${normalizedPath}`
    }

    return `/build/${normalizedPath}`
}

function collectManifestAssetUrls(manifest, entryKeys = []) {
    const visited = new Set()
    const assetUrls = new Set([
        BUILD_MANIFEST_URL,
        '/manifest.webmanifest',
        '/nimvo-offline-sw.js',
        '/favicon.ico',
    ])

    const visitRecord = (recordKey) => {
        if (visited.has(recordKey)) {
            return
        }

        visited.add(recordKey)

        const record = manifest?.[recordKey]
        if (!record) {
            return
        }

        ;[record.file, ...(record.css || []), ...(record.assets || [])]
            .map((assetPath) => normalizeAssetUrl(assetPath))
            .filter(Boolean)
            .forEach((assetUrl) => assetUrls.add(assetUrl))

        ;(record.imports || []).forEach(visitRecord)
    }

    entryKeys.forEach(visitRecord)

    return Array.from(assetUrls)
}

async function warmOfflineAssets() {
    if (typeof window === 'undefined' || !('caches' in window)) {
        return
    }

    try {
        const manifestResponse = await window.fetch(BUILD_MANIFEST_URL, {
            credentials: 'same-origin',
            cache: 'no-store',
        })

        if (!manifestResponse.ok) {
            return
        }

        const manifest = await manifestResponse.json()
        const assetUrls = collectManifestAssetUrls(manifest, OFFLINE_WORKSPACE_PAGE_ENTRIES)
        const cache = await window.caches.open(OFFLINE_APP_CACHE)

        await Promise.all(
            assetUrls.map(async (assetUrl) => {
                try {
                    const response = await window.fetch(assetUrl, {
                        credentials: 'same-origin',
                        cache: 'no-store',
                    })

                    if (response.ok) {
                        await cache.put(assetUrl, response.clone())
                    }
                } catch {
                    // Asset warm failures should not block the live session.
                }
            }),
        )
    } catch {
        // Asset warming is opportunistic and must not break the app.
    }
}

function postWarmMessage(registration) {
    const worker =
        registration?.active
        || registration?.waiting
        || registration?.installing
        || navigator.serviceWorker.controller

    if (!worker) {
        return
    }

    worker.postMessage({
        type: 'nimvo:warm-cache',
        paths: OFFLINE_WORKSPACE_PATHS,
    })
}

export function registerOfflineServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return
    }

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/nimvo-offline-sw.js')

            warmOfflineAssets().catch(() => {})
            postWarmMessage(registration)
            navigator.serviceWorker.ready.then((readyRegistration) => {
                warmOfflineAssets().catch(() => {})
                postWarmMessage(readyRegistration)
            }).catch(() => {})
        } catch {
            // The offline shell is optional and should not block the workspace.
        }
    })
}
