export async function apiRequest(url, options = {}) {
    try {
        const response = await window.axios({
            url,
            method: options.method ?? 'get',
            data: options.data,
            params: options.params,
        })

        return response.data
    } catch (error) {
        const message =
            error?.response?.data?.message ||
            Object.values(error?.response?.data?.errors || {})?.[0]?.[0] ||
            'Nao foi possivel concluir a solicitacao.'

        throw new Error(message)
    }
}
