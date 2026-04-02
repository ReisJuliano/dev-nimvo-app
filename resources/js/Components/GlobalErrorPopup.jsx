import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ERROR_POPUP_EVENT, POPUP_TYPE_META, getErrorMessages, normalizePopupPayload } from '@/lib/errorPopup'

function buildEventSignature(payload) {
    return JSON.stringify([payload.mode, payload.type, payload.title, payload.message, payload.details])
}

export default function GlobalErrorPopup() {
    const [currentPopup, setCurrentPopup] = useState(null)
    const [queueSize, setQueueSize] = useState(0)
    const queueRef = useRef([])
    const currentPopupRef = useRef(null)
    const lastEventRef = useRef({ signature: '', timestamp: 0 })

    function enqueue(payload) {
        const nextPopup = {
            ...normalizePopupPayload(payload, payload?.type || 'error'),
            resolve: payload?.resolve,
        }

        if (!nextPopup.message && !nextPopup.details.length) {
            return
        }

        const signature = buildEventSignature(nextPopup)
        const timestamp = Date.now()

        if (
            currentPopupRef.current
            && signature === lastEventRef.current.signature
            && timestamp - lastEventRef.current.timestamp < 250
        ) {
            return
        }

        lastEventRef.current = { signature, timestamp }

        if (!currentPopupRef.current) {
            setCurrentPopup(nextPopup)
            setQueueSize(queueRef.current.length)
            return
        }

        queueRef.current = [...queueRef.current, nextPopup]
        setQueueSize(queueRef.current.length)
    }

    function advanceQueue() {
        const nextPopup = queueRef.current.shift() || null
        setQueueSize(queueRef.current.length)
        setCurrentPopup(nextPopup)
    }

    function resolveCurrentPopup(confirmed = false) {
        if (currentPopupRef.current?.mode === 'confirm') {
            currentPopupRef.current.resolve?.(confirmed)
        }

        advanceQueue()
    }

    function closeCurrentPopup() {
        resolveCurrentPopup(false)
    }

    function confirmCurrentPopup() {
        resolveCurrentPopup(true)
    }

    useEffect(() => {
        currentPopupRef.current = currentPopup
    }, [currentPopup])

    useLayoutEffect(() => {
        function handlePopupEvent(event) {
            enqueue(event.detail)
        }

        function handleWindowError(event) {
            const messages = getErrorMessages(event.error?.message || event.message)

            if (!messages.length) {
                return
            }

            enqueue({
                type: 'error',
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
                type: 'error',
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
        if (!currentPopup) {
            return undefined
        }

        const previousOverflow = document.body.style.overflow

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                closeCurrentPopup()
            }
        }

        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [currentPopup])

    const headingId = useMemo(
        () => `app-error-popup-title-${currentPopup ? 'open' : 'closed'}`,
        [currentPopup],
    )

    if (!currentPopup) {
        return null
    }

    const popupMeta = POPUP_TYPE_META[currentPopup.type] || POPUP_TYPE_META.error
    const queueText = queueSize > 0
        ? `${queueSize} mensagem(ns) aguardando`
        : currentPopup.mode === 'confirm'
            ? 'Revise a mensagem antes de confirmar'
            : 'Revise a mensagem antes de continuar'

    return (
        <div className={`app-error-popup-backdrop is-${currentPopup.type}`} onClick={closeCurrentPopup}>
            <div
                className={`app-error-popup is-${currentPopup.type}`}
                role={currentPopup.mode === 'confirm' ? 'alertdialog' : 'dialog'}
                aria-modal="true"
                aria-labelledby={headingId}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="app-error-popup-header">
                    <div className="app-error-popup-titlebox">
                        <div className={`app-error-popup-icon is-${currentPopup.type}`} aria-hidden="true">
                            <i className={popupMeta.icon} />
                        </div>
                        <div>
                            <span className={`app-error-popup-kicker is-${currentPopup.type}`}>{popupMeta.kicker}</span>
                            <h2 id={headingId}>{currentPopup.title}</h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="app-error-popup-close"
                        onClick={closeCurrentPopup}
                        aria-label={currentPopup.mode === 'confirm' ? 'Cancelar popup' : 'Fechar popup'}
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                <div className="app-error-popup-body">
                    <p>{currentPopup.message}</p>

                    {currentPopup.details.length ? (
                        <ul className="app-error-popup-list">
                            {currentPopup.details.map((detail, index) => (
                                <li key={`${detail}-${index}`}>{detail}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <div className="app-error-popup-footer">
                    <span className="app-error-popup-queue">{queueText}</span>

                    <div className="app-error-popup-actions">
                        {currentPopup.mode === 'confirm' ? (
                            <button type="button" className="ui-button-ghost" onClick={closeCurrentPopup}>
                                <i className="fa-solid fa-xmark" />
                                {currentPopup.cancelLabel}
                            </button>
                        ) : null}

                        <button type="button" className={popupMeta.actionClassName} onClick={currentPopup.mode === 'confirm' ? confirmCurrentPopup : closeCurrentPopup}>
                            <i className={`fa-solid ${currentPopup.mode === 'confirm' ? 'fa-check' : 'fa-check-double'}`} />
                            {currentPopup.confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
