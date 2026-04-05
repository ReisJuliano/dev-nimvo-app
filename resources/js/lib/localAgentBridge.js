function normalizeBaseUrl(value) {
    return String(value || '').replace(/\/+$/, '')
}

export function canUseLocalAgentBridge(bridge) {
    return Boolean(
        bridge?.enabled
        && bridge?.agent_key
        && normalizeBaseUrl(bridge?.base_url),
    )
}

export async function requestLocalAgent(bridge, path, options = {}) {
    if (!canUseLocalAgentBridge(bridge)) {
        throw new Error('O agente local de impressao nao esta disponivel nesta maquina.')
    }

    const controller = new AbortController()
    const timeoutMs = Number(options.timeoutMs || 4500)
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await window.fetch(`${normalizeBaseUrl(bridge.base_url)}${path}`, {
            method: options.method || 'get',
            headers: {
                'Content-Type': 'application/json',
                'X-Nimvo-Agent-Key': bridge.agent_key,
                ...(options.headers || {}),
            },
            body: options.body == null ? undefined : JSON.stringify(options.body),
            signal: controller.signal,
        })

        const raw = await response.text()
        const payload = raw ? JSON.parse(raw) : {}

        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || 'A API local do agente recusou a solicitacao.')
        }

        return payload
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('A API local do agente demorou demais para responder.')
        }

        if (error instanceof SyntaxError) {
            throw new Error('A API local do agente respondeu com um JSON invalido.')
        }

        throw error
    } finally {
        window.clearTimeout(timeoutId)
    }
}

export async function printPaymentReceiptViaLocalAgent(bridge, payload) {
    return requestLocalAgent(bridge, '/v1/prints/payment-receipt', {
        method: 'post',
        body: payload,
    })
}

export async function printTestViaLocalAgent(bridge, payload = {}) {
    return requestLocalAgent(bridge, '/v1/prints/test', {
        method: 'post',
        body: payload,
    })
}
