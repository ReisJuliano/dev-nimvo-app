function isEncryptedPage(page) {
    return typeof ArrayBuffer !== 'undefined' && page instanceof ArrayBuffer
}

export function resolveVisitPathname(rawUrl) {
    if (typeof window === 'undefined' || !rawUrl) {
        return null
    }

    try {
        if (rawUrl instanceof URL) {
            return rawUrl.pathname
        }

        if (typeof rawUrl === 'string') {
            return new URL(rawUrl, window.location.origin).pathname
        }

        if (typeof rawUrl?.pathname === 'string') {
            return rawUrl.pathname
        }
    } catch {
        return null
    }

    return null
}

export function replaceCurrentInertiaHistoryPage(transformPage, nextUrl = null) {
    if (typeof window === 'undefined' || typeof transformPage !== 'function') {
        return
    }

    const currentState = window.history.state
    const currentPage = currentState?.page

    if (!currentState || !currentPage || isEncryptedPage(currentPage)) {
        return
    }

    const updatedPage = transformPage(currentPage)

    if (!updatedPage || typeof updatedPage !== 'object') {
        return
    }

    window.history.replaceState(
        {
            ...currentState,
            page: updatedPage,
        },
        '',
        nextUrl || updatedPage.url || window.location.pathname,
    )
}

export function invalidateCurrentInertiaHistoryPage(nextUrl = null) {
    if (typeof window === 'undefined') {
        return
    }

    const currentState = window.history.state

    if (!currentState) {
        return
    }

    window.history.replaceState(
        {
            ...currentState,
            page: null,
        },
        '',
        nextUrl || window.location.pathname,
    )
}
