import { router } from '@inertiajs/react'
import { resolveVisitPathname } from '@/lib/inertiaHistory'
import { showPopup } from '@/lib/errorPopup'

const OFFLINE_FALLBACK_PATH = '/dashboard'
const OFFLINE_CAPABLE_PATH_PREFIXES = ['/dashboard', '/pdv', '/caixa', '/produtos', '/pedidos']
const OFFLINE_CAPABLE_LABEL = 'Painel, PDV, Caixa, Pedidos e Produtos'

let guardInitialized = false

export function isOfflineCapablePath(pathname) {
    if (!pathname) {
        return false
    }

    return OFFLINE_CAPABLE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function redirectToDashboard() {
    if (typeof window === 'undefined' || window.location.pathname === OFFLINE_FALLBACK_PATH) {
        return
    }

    window.location.assign(OFFLINE_FALLBACK_PATH)
}

function warnPageUnavailableOffline() {
    showPopup({
        type: 'warning',
        title: 'Página indisponível offline',
        message: `Esta página não funciona sem conexão. Você foi levado para o Painel, que continua disponível junto com ${OFFLINE_CAPABLE_LABEL}.`,
    })
}

function warnWentOffline() {
    showPopup({
        type: 'warning',
        title: 'Você ficou offline',
        message: `Sem conexão com a internet, o acesso fica limitado a ${OFFLINE_CAPABLE_LABEL} até a rede voltar.`,
    })
}

function notifyBackOnline() {
    showPopup({
        type: 'success',
        title: 'Conexão restabelecida',
        message: 'A internet voltou. As pendências salvas nesta máquina serão sincronizadas em instantes.',
    })
}

export function initOfflineNavigationGuard() {
    if (guardInitialized || typeof window === 'undefined') {
        return () => {}
    }

    guardInitialized = true

    const unsubscribeVisit = router.on('before', (event) => {
        if (navigator.onLine !== false) {
            return
        }

        const visit = event?.detail?.visit
        const method = String(visit?.method || 'get').toLowerCase()

        if (method !== 'get') {
            return
        }

        const nextPathname = resolveVisitPathname(visit?.url)

        if (!nextPathname || isOfflineCapablePath(nextPathname)) {
            return
        }

        event.preventDefault()
        warnPageUnavailableOffline()
        redirectToDashboard()
    })

    const handleOffline = () => {
        warnWentOffline()

        if (!isOfflineCapablePath(window.location.pathname)) {
            redirectToDashboard()
        }
    }

    const handleOnline = () => {
        notifyBackOnline()
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
        guardInitialized = false
        unsubscribeVisit()
        window.removeEventListener('offline', handleOffline)
        window.removeEventListener('online', handleOnline)
    }
}
