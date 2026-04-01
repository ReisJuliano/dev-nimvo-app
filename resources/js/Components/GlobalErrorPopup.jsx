import { useEffect, useMemo, useRef, useState } from 'react'
import { ERROR_POPUP_EVENT, getErrorMessages, normalizeErrorPopupPayload } from '@/lib/errorPopup'

function buildEventSignature(payload) {
    return JSON.stringify([payload.title, payload.message, payload.details])
}

export default function GlobalErrorPopup() {
    const [currentError, setCurrentError] = useState(null)
    const [queueSize, setQueueSize] = useState(0)
    const queueRef = useRef([])
    const currentErrorRef = useRef(null)
    const lastEventRef = useRef({ signature: '', timestamp: 0 })

    function enqueue(payload) {
        const nextError = normalizeErrorPopupPayload(payload)

        if (!nextError.message && !nextError.details.length) {
            return
        }

        const signature = buildEventSignature(nextError)
        const timestamp = Date.now()

        if (
            currentErrorRef.current
            && signature === lastEventRef.current.signature
            && timestamp - lastEventRef.current.timestamp < 250
        ) {
            return
        }

        lastEventRef.current = { signature, timestamp }

        if (!currentErrorRef.current) {
            setCurrentError(nextError)
            setQueueSize(queueRef.current.length)
            return
        }

        queueRef.current = [...queueRef.current, nextError]
        setQueueSize(queueRef.current.length)
    }

    function closeCurrentError() {
        const nextError = queueRef.current.shift() || null
        setQueueSize(queueRef.current.length)
        setCurrentError(nextError)
    }

    useEffect(() => {
        currentErrorRef.current = currentError
    }, [currentError])

    useEffect(() => {
        function handlePopupEvent(event) {
            enqueue(event.detail)
        }

        function handleWindowError(event) {
            const messages = getErrorMessages(event.error?.message || event.message)

            if (!messages.length) {
                return
            }

            enqueue({
                title: 'Erro inesperado na tela',
                message: messages[0],
            })
        }

        function handleUnhandledRejection(event) {
            const messages = getErrorMessages(
                event.reason?.message
                || event.reason?.response?.data?.message
                || event.reason,
            )

            if (!messages.length) {
                return
            }

            enqueue({
                title: 'Erro inesperado na tela',
                message: messages[0],
                details: messages.slice(1),
            })
        }

        window.addEventListener(ERROR_POPUP_EVENT, handlePopupEvent)
        window.addEventListener('error', handleWindowError)
        window.addEventListener('unhandledrejection', handleUnhandledRejection)

        return () => {
            window.removeEventListener(ERROR_POPUP_EVENT, handlePopupEvent)
            window.removeEventListener('error', handleWindowError)
            window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        }
    }, [])

    useEffect(() => {
        if (!currentError) {
            return undefined
        }

        const previousOverflow = document.body.style.overflow

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                closeCurrentError()
            }
        }

        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [currentError])

    const headingId = useMemo(
        () => `app-error-popup-title-${currentError ? 'open' : 'closed'}`,
        [currentError],
    )

    if (!currentError) {
        return null
    }

    return (
        <div className="app-error-popup-backdrop" onClick={closeCurrentError}>
            <div
                className="app-error-popup"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={headingId}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="app-error-popup-header">
                    <div className="app-error-popup-titlebox">
                        <div className="app-error-popup-icon" aria-hidden="true">
                            <i className="fa-solid fa-triangle-exclamation" />
                        </div>
                        <div>
                            <span className="app-error-popup-kicker">Erro</span>
                            <h2 id={headingId}>{currentError.title}</h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="app-error-popup-close"
                        onClick={closeCurrentError}
                        aria-label="Fechar popup de erro"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="app-error-popup-body">
                    <p>{currentError.message}</p>

                    {currentError.details.length ? (
                        <ul className="app-error-popup-list">
                            {currentError.details.map((detail, index) => (
                                <li key={`${detail}-${index}`}>{detail}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <div className="app-error-popup-footer">
                    <span className="app-error-popup-queue">
                        {queueSize > 0 ? `${queueSize} erro(s) aguardando` : 'Revise a mensagem antes de continuar'}
                    </span>

                    <button type="button" className="ui-button-danger" onClick={closeCurrentError}>
                        <i className="fa-solid fa-check" />
                        {currentError.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
