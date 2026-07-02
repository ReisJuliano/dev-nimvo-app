import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/http'

const terminalStatuses = ['completed', 'failed']

export default function PrintStatusBadge({ commandId, initialMessage = '' }) {
    const [activeCommandId, setActiveCommandId] = useState(commandId || null)
    const [command, setCommand] = useState(commandId ? { id: commandId, status: 'pending', message: initialMessage } : null)
    const [timedOut, setTimedOut] = useState(false)
    const [retrying, setRetrying] = useState(false)

    useEffect(() => {
        setActiveCommandId(commandId || null)
        setCommand(commandId ? { id: commandId, status: 'pending', message: initialMessage } : null)
        setTimedOut(false)
    }, [commandId, initialMessage])

    useEffect(() => {
        if (!activeCommandId) {
            return undefined
        }

        let cancelled = false
        let timer = null
        const startedAt = Date.now()

        const poll = async () => {
            try {
                const response = await apiRequest(`/api/pdv/local-agent/commands/${activeCommandId}`)

                if (cancelled) {
                    return
                }

                const nextCommand = response?.command || response || null
                setCommand(nextCommand)

                if (nextCommand && terminalStatuses.includes(nextCommand.status)) {
                    return
                }
            } catch (error) {
                if (!cancelled) {
                    setCommand((current) => ({
                        ...(current || { id: activeCommandId }),
                        status: 'failed',
                        message: error.message,
                        last_error: error.message,
                    }))
                }

                return
            }

            if (Date.now() - startedAt >= 20000) {
                setTimedOut(true)
                return
            }

            timer = window.setTimeout(poll, 2000)
        }

        poll()

        return () => {
            cancelled = true
            if (timer) {
                window.clearTimeout(timer)
            }
        }
    }, [activeCommandId])

    async function handleRetry() {
        if (!command?.id || retrying) {
            return
        }

        setRetrying(true)
        setTimedOut(false)

        try {
            const response = await apiRequest(`/api/pdv/local-agent/commands/${command.id}/retry`, { method: 'post' })
            const nextCommand = response.command || null

            setCommand(nextCommand)
            setActiveCommandId(nextCommand?.id || null)
        } catch (error) {
            setCommand((current) => ({
                ...(current || command),
                status: 'failed',
                message: error.message,
                last_error: error.message,
            }))
        } finally {
            setRetrying(false)
        }
    }

    if (!activeCommandId) {
        return null
    }

    const status = command?.status || 'pending'
    const message = command?.last_error || command?.message || ''
    const tone = status === 'completed' ? 'success' : status === 'failed' ? 'danger' : timedOut ? 'warning' : 'pending'
    const label = status === 'completed'
        ? 'Impresso ✓'
        : status === 'failed'
            ? `Falhou - ${message || 'verifique o agente local'}`
            : timedOut
                ? 'Aguardando confirmação do agente...'
                : 'Enviando para impressora...'

    return (
        <span className={`pos-print-status-badge ${tone}`} role="status">
            {status !== 'completed' && status !== 'failed' ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> : null}
            {status === 'completed' ? <i className="fa-solid fa-check" aria-hidden="true" /> : null}
            {status === 'failed' ? <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> : null}
            <span>{label}</span>
            {status === 'failed' ? (
                <button type="button" onClick={handleRetry} disabled={retrying}>
                    {retrying ? 'Reenviando...' : 'Reenviar'}
                </button>
            ) : null}
        </span>
    )
}
