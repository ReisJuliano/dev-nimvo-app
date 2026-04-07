const OFFLINE_WORKSPACE_PATHS = ['/pdv', '/pedidos', '/produtos', '/caixa']

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

            postWarmMessage(registration)
            navigator.serviceWorker.ready.then(postWarmMessage).catch(() => {})
        } catch {
            // The offline shell is optional and should not block the workspace.
        }
    })
}
