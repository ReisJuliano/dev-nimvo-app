import { useEffect, useLayoutEffect, useRef } from 'react'

export const ERROR_POPUP_EVENT = 'nimvo:error-popup'
export const POPUP_TYPE_META = {
    error: {
        kicker: 'Erro',
        icon: 'fa-solid fa-triangle-exclamation',
        defaultTitle: 'Algo saiu do esperado',
        confirmTitle: 'Confirme para continuar',
        actionClassName: 'ui-button-danger',
    },
    success: {
        kicker: 'Sucesso',
        icon: 'fa-solid fa-circle-check',
        defaultTitle: 'Tudo certo',
        confirmTitle: 'Confirme para continuar',
        actionClassName: 'ui-button',
    },
    warning: {
        kicker: 'Alerta',
        icon: 'fa-solid fa-circle-exclamation',
        defaultTitle: 'Atencao',
        confirmTitle: 'Confirme esta acao',
        actionClassName: 'ui-button-secondary',
    },
    info: {
        kicker: 'Informacao',
        icon: 'fa-solid fa-circle-info',
        defaultTitle: 'Aviso do sistema',
        confirmTitle: 'Confirme para continuar',
        actionClassName: 'ui-button-secondary',
    },
}

function resolvePopupType(type) {
    return Object.hasOwn(POPUP_TYPE_META, type) ? type : 'error'
}

function resolvePopupMode(mode) {
    return mode === 'confirm' ? 'confirm' : 'message'
}

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

export function normalizePopupPayload(payload, fallbackType = 'error') {
    const normalizedPayload =
        typeof payload === 'string'
            ? { message: payload }
            : payload || {}

    const type = resolvePopupType(normalizedPayload.type || fallbackType)
    const mode = resolvePopupMode(normalizedPayload.mode)
    const popupMeta = POPUP_TYPE_META[type]
    const fallbackDetails = getErrorMessages(normalizedPayload.details)
    const inlineMessages = getErrorMessages(normalizedPayload.message)
    const messages = [...inlineMessages, ...fallbackDetails]
    const defaultTitle = mode === 'confirm' ? popupMeta.confirmTitle : popupMeta.defaultTitle
    const defaultConfirmLabel = mode === 'confirm' ? 'Confirmar' : 'Entendi'
    const title = String(normalizedPayload.title || defaultTitle).trim() || defaultTitle
    const confirmLabel = String(normalizedPayload.confirmLabel || defaultConfirmLabel).trim() || defaultConfirmLabel
    const cancelLabel = mode === 'confirm'
        ? String(normalizedPayload.cancelLabel || 'Cancelar').trim() || 'Cancelar'
        : ''

    return {
        mode,
        type,
        title,
        message: messages[0] || '',
        details: messages.slice(1, 5),
        confirmLabel,
        cancelLabel,
    }
}

export function normalizeErrorPopupPayload(payload) {
    return normalizePopupPayload(payload, 'error')
}

function dispatchPopup(detail) {
    window.dispatchEvent(new CustomEvent(ERROR_POPUP_EVENT, { detail }))
}

export function showPopup(payload) {
    if (typeof window === 'undefined') {
        return
    }

    const detail = normalizePopupPayload(payload)

    if (!detail.message && !detail.details.length) {
        return
    }

    dispatchPopup(detail)
}

export function showErrorPopup(payload) {
    showPopup(
        typeof payload === 'string'
            ? { type: 'error', message: payload }
            : { ...(payload || {}), type: 'error' },
    )
}

export function confirmPopup(payload) {
    if (typeof window === 'undefined') {
        return Promise.resolve(false)
    }

    const detail = normalizePopupPayload(
        typeof payload === 'string'
            ? { mode: 'confirm', message: payload }
            : { ...(payload || {}), mode: 'confirm' },
        'warning',
    )

    if (!detail.message && !detail.details.length) {
        return Promise.resolve(false)
    }

    return new Promise((resolve) => {
        dispatchPopup({
            ...detail,
            resolve,
        })
    })
}

export function useErrorFeedbackPopup(feedback, options = {}) {
    const lastFeedbackRef = useRef(null)

    useLayoutEffect(() => {
        if (!feedback?.type) {
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

        showPopup({
            type: feedback.type,
            title: options.title,
            message: messages[0],
            details: messages.slice(1),
            confirmLabel: options.confirmLabel,
        })

        options.onConsumed?.()
    }, [feedback, options.confirmLabel, options.onConsumed, options.title])
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

        showPopup({
            type: 'error',
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

        showPopup({
            type: 'error',
            title: options.title || 'Verifique os dados informados',
            message: messages[0],
            details: messages.slice(1),
            confirmLabel: options.confirmLabel,
        })
    }, [messages, options.confirmLabel, options.title, signature])
}

export function useFlashPopup(flash, options = {}) {
    const lastSignatureRef = useRef('')

    useEffect(() => {
        const entries = ['error', 'warning', 'success', 'info']
            .map((type) => {
                const messages = getErrorMessages(flash?.[type])

                return messages.length ? { type, messages } : null
            })
            .filter(Boolean)

        const signature = entries
            .map(({ type, messages }) => `${type}:${messages.join('|')}`)
            .join('||')

        if (!signature) {
            lastSignatureRef.current = ''
            return
        }

        if (signature === lastSignatureRef.current) {
            return
        }

        lastSignatureRef.current = signature

        entries.forEach(({ type, messages }) => {
            showPopup({
                type,
                title: options[`${type}Title`] || options.title,
                message: messages[0],
                details: messages.slice(1),
            })
        })
    }, [flash, options.errorTitle, options.infoTitle, options.successTitle, options.title, options.warningTitle])
}
