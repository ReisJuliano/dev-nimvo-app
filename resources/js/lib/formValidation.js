const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function hasValue(value) {
    return String(value ?? '').trim() !== ''
}

export function validateEmail(value) {
    const email = String(value || '').trim()
    return email === '' || EMAIL_REGEX.test(email)
}

export function requiredMessage(value, label) {
    return hasValue(value) ? null : `Informe ${label}.`
}
