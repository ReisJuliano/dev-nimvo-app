import { useEffect, useRef } from 'react'

export const ERROR_POPUP_EVENT = 'nimvo:error-popup'
const DEFAULT_TITLE = 'Algo saiu do esperado'
const DEFAULT_CONFIRM_LABEL = 'Entendi'

export function getErrorMessages(source) {
    if (!source) {
        return []
    }

    if (typeof source === 'string') {
        const message = source.trim()
        return message ? [message] : []
    }

    if (Array.isArray(source)) {
        return [...new Set(source.flatMap((item) => getErrorMessages(item)))]
    }

    if (typeof source === 'object') {
        return [...new Set(Object.values(source).flatMap((value) => getErrorMessages(value)))]
    }

    const message = String(source).trim()

    return message ? [message] : []
}

export function normalizeErrorPopupPayload(payload) {
    const normalizedPayload =
        typeof payload === 'string'
            ? { message: payload }
            : payload || {}

    const fallbackDetails = getErrorMessages(normalizedPayload.details)
    const inlineMessages = getErrorMessages(normalizedPayload.message)
    const messages = [...inlineMessages, ...fallbackDetails]
    const title = String(normalizedPayload.title || DEFAULT_TITLE).trim() || DEFAULT_TITLE
    const confirmLabel = String(normalizedPayload.confirmLabel || DEFAULT_CONFIRM_LABEL).trim() || DEFAULT_CONFIRM_LABEL

    return {
        title,
        message: messages[0] || '',
        details: messages.slice(1, 5),
        confirmLabel,
    }
}

export function showErrorPopup(payload) {
    if (typeof window === 'undefined') {
        return
    }

    const detail = normalizeErrorPopupPayload(payload)

    if (!detail.message && !detail.details.length) {
        return
    }

    window.dispatchEvent(new CustomEvent(ERROR_POPUP_EVENT, { detail }))
}

export function useErrorFeedbackPopup(feedback, options = {}) {
    const lastFeedbackRef = useRef(null)

    useEffect(() => {
        if (feedback?.type !== 'error') {
            lastFeedbackRef.current = null
            return
        }

        if (feedback === lastFeedbackRef.current) {
            return
        }

        lastFeedbackRef.current = feedback

        const messages = getErrorMessages(feedback.text)

        if (!messages.length) {
            return
        }

        showErrorPopup({
            title: options.title,
            message: messages[0],
            details: messages.slice(1),
            confirmLabel: options.confirmLabel,
        })
    }, [feedback, options.confirmLabel, options.title])
}

export function useErrorMessagePopup(message, options = {}) {
    const lastSignatureRef = useRef('')

    useEffect(() => {
        const messages = getErrorMessages(message)
        const signature = messages.join('|')

        if (!signature) {
            lastSignatureRef.current = ''
            return
        }

        if (signature === lastSignatureRef.current) {
            return
        }

        lastSignatureRef.current = signature

        showErrorPopup({
            title: options.title,
            message: messages[0],
            details: messages.slice(1),
            confirmLabel: options.confirmLabel,
        })
    }, [message, options.confirmLabel, options.title])
}

export function useErrorMapPopup(errors, options = {}) {
    const lastSignatureRef = useRef('')
    const messages = getErrorMessages(errors)
    const signature = messages.join('|')

    useEffect(() => {
        if (!signature) {
            lastSignatureRef.current = ''
            return
        }

        if (signature === lastSignatureRef.current) {
            return
        }

        lastSignatureRef.current = signature

        showErrorPopup({
            title: options.title || 'Verifique os dados informados',
            message: messages[0],
            details: messages.slice(1),
            confirmLabel: options.confirmLabel,
        })
    }, [messages, options.confirmLabel, options.title, signature])
}
