const CACHE_VERSION = 'nimvo-offline-v2'
const APP_CACHE = `${CACHE_VERSION}:app`
const PAGE_CACHE = `${CACHE_VERSION}:pages`

self.addEventListener('install', (event) => {
    self.skipWaiting()
    event.waitUntil(caches.open(APP_CACHE))
})

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys()

        await Promise.all(
            keys
                .filter((key) => !key.startsWith(CACHE_VERSION))
                .map((key) => caches.delete(key)),
        )

        await self.clients.claim()
    })())
})

async function warmWorkspacePaths(paths = []) {
    const cache = await caches.open(PAGE_CACHE)

    await Promise.all(
        paths.map(async (path) => {
            try {
                const request = new Request(path, { credentials: 'same-origin', cache: 'no-store' })
                const response = await fetch(request)

                if (isCacheableNavigationResponse(request, response)) {
                    await cache.put(request, response.clone())
                }
            } catch {
                // Ignore warm failures and keep the latest cached shell.
            }
        }),
    )
}

function isCacheableNavigationResponse(request, response) {
    if (!response?.ok) {
        return false
    }

    if (!response.url) {
        return true
    }

    if (response.redirected) {
        return false
    }

    const requestUrl = new URL(request.url)
    const responseUrl = new URL(response.url, self.location.origin)

    return requestUrl.origin === responseUrl.origin && requestUrl.pathname === responseUrl.pathname
}

self.addEventListener('message', (event) => {
    if (event.data?.type !== 'nimvo:warm-cache') {
        return
    }

    event.waitUntil(warmWorkspacePaths(event.data.paths))
})

async function cacheFirst(request) {
    const cache = await caches.open(APP_CACHE)
    const cached = await cache.match(request)

    if (cached) {
        return cached
    }

    const response = await fetch(request)

    if (response.ok) {
        await cache.put(request, response.clone())
    }

    return response
}

async function networkFirst(request) {
    const cache = await caches.open(PAGE_CACHE)

    try {
        const response = await fetch(request)

        if (isCacheableNavigationResponse(request, response)) {
            await cache.put(request, response.clone())
        }

        return response
    } catch {
        const cached = await cache.match(request)

        if (cached) {
            return cached
        }

        throw new Error('Offline page not cached yet.')
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(APP_CACHE)
    const cached = await cache.match(request)

    const networkFetch = fetch(request)
        .then(async (response) => {
            if (response.ok) {
                await cache.put(request, response.clone())
            }

            return response
        })
        .catch(() => null)

    if (cached) {
        networkFetch.catch(() => {})
        return cached
    }

    const networkResponse = await networkFetch

    if (networkResponse) {
        return networkResponse
    }

    throw new Error('Network unavailable and resource not cached.')
}

self.addEventListener('fetch', (event) => {
    const { request } = event

    if (request.method !== 'GET') {
        return
    }

    const url = new URL(request.url)

    if (url.origin !== self.location.origin) {
        return
    }

    if (url.pathname.startsWith('/api/')) {
        return
    }

    if (
        request.destination === 'style'
        || request.destination === 'script'
        || request.destination === 'font'
        || request.destination === 'image'
        || url.pathname.startsWith('/build/')
    ) {
        event.respondWith(cacheFirst(request))
        return
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request))
        return
    }

    event.respondWith(staleWhileRevalidate(request))
})
