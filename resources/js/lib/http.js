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
        if (error?.response?.status === 419) {
            throw new Error('Sua sessao expirou ou o token de seguranca ficou invalido. Recarregue a tela e tente novamente.')
        }

        const message =
            error?.response?.data?.message ||
            Object.values(error?.response?.data?.errors || {})?.[0]?.[0] ||
            'Nao foi possivel concluir a solicitacao.'

        throw new Error(message)
    }
}
