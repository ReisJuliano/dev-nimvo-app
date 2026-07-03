const CACHE_VERSION = 'nimvo-offline-v5'
const APP_CACHE = `${CACHE_VERSION}:app`
const PAGE_CACHE = `${CACHE_VERSION}:pages`
const OFFLINE_FALLBACK_PATH = '/dashboard'

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

async function offlineFallbackRedirect(request) {
    const requestUrl = new URL(request.url)

    if (requestUrl.pathname === OFFLINE_FALLBACK_PATH) {
        return null
    }

    const fallbackUrl = new URL(OFFLINE_FALLBACK_PATH, self.location.origin)
    const cache = await caches.open(PAGE_CACHE)
    const cachedFallback = await cache.match(fallbackUrl.toString())

    if (!cachedFallback) {
        return null
    }

    // A real redirect (rather than serving the cached body directly) keeps the
    // address bar in sync, so the user sees /dashboard instead of the page they
    // actually tried to open while offline.
    return Response.redirect(fallbackUrl.toString(), 302)
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

        const fallback = await offlineFallbackRedirect(request)

        if (fallback) {
            return fallback
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

async function networkFirstStatic(request) {
    const cache = await caches.open(APP_CACHE)

    try {
        const response = await fetch(request, { cache: 'no-store' })

        if (response.ok) {
            await cache.put(request, response.clone())
        }

        return response
    } catch {
        const cached = await cache.match(request)

        if (cached) {
            return cached
        }

        throw new Error('Static resource unavailable and not cached.')
    }
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

    if (url.pathname.startsWith('/build/')) {
        event.respondWith(networkFirstStatic(request))
        return
    }

    if (
        request.destination === 'style'
        || request.destination === 'script'
        || request.destination === 'font'
        || request.destination === 'image'
    ) {
        event.respondWith(staleWhileRevalidate(request))
        return
    }

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request))
        return
    }

    event.respondWith(staleWhileRevalidate(request))
})
