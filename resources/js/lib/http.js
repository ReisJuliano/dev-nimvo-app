function readCsrfToken() {
    const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')

    if (metaToken) {
        return metaToken
    }

    const xsrfCookie = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith('XSRF-TOKEN='))

    return xsrfCookie ? decodeURIComponent(xsrfCookie.split('=').slice(1).join('=')) : null
}

function buildApiError(error) {
    if (error?.response?.status === 419) {
        const sessionError = new Error('Sua sessao expirou ou o token de seguranca ficou invalido. Recarregue a tela e tente novamente.')
        sessionError.status = 419
        sessionError.isNetworkError = false
        return sessionError
    }

    const message =
        error?.response?.data?.message ||
        Object.values(error?.response?.data?.errors || {})?.[0]?.[0] ||
        (error?.response ? 'Nao foi possivel concluir a solicitacao.' : 'A conexao com o servidor foi interrompida.')

    const normalizedError = new Error(message)
    normalizedError.status = error?.response?.status ?? null
    normalizedError.isNetworkError = !error?.response

    return normalizedError
}

export function isNetworkApiError(error) {
    return Boolean(error?.isNetworkError)
}

export async function apiRequest(url, options = {}) {
    try {
        const csrfToken = readCsrfToken()
        const response = await window.axios({
            url,
            method: options.method ?? 'get',
            data: options.data,
            params: options.params,
            headers: csrfToken
                ? {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    ...(options.headers || {}),
                }
                : options.headers,
        })

        return response.data
    } catch (error) {
        throw buildApiError(error)
    }
}
