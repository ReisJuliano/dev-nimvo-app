export function validateCpf(value) {
    const digits = String(value || '').replace(/\D/g, '')

    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
        return false
    }

    let sum = 0
    for (let index = 0; index < 9; index += 1) {
        sum += Number(digits[index]) * (10 - index)
    }

    let check = 11 - (sum % 11)
    if (check >= 10) {
        check = 0
    }

    if (check !== Number(digits[9])) {
        return false
    }

    sum = 0
    for (let index = 0; index < 10; index += 1) {
        sum += Number(digits[index]) * (11 - index)
    }

    check = 11 - (sum % 11)
    if (check >= 10) {
        check = 0
    }

    return check === Number(digits[10])
}

export function validateCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '')

    if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
        return false
    }

    const calc = (documentDigits, weights) => (
        weights.reduce((accumulator, weight, index) => accumulator + Number(documentDigits[index]) * weight, 0)
    )
    const mod = (number) => {
        const remainder = number % 11
        return remainder < 2 ? 0 : 11 - remainder
    }
    const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    if (mod(calc(digits, firstWeights)) !== Number(digits[12])) {
        return false
    }

    if (mod(calc(digits, secondWeights)) !== Number(digits[13])) {
        return false
    }

    return true
}

export function validateCpfOrCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '')

    if (digits.length === 11) {
        return validateCpf(digits)
    }

    if (digits.length === 14) {
        return validateCnpj(digits)
    }

    return false
}

export function maskDocument(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 14)

    if (digits.length <= 3) {
        return digits
    }

    if (digits.length <= 6) {
        return digits.replace(/(\d{3})(\d{0,3})/, (_, first, second) => [first, second].filter(Boolean).join('.'))
    }

    if (digits.length <= 9) {
        return digits.replace(/(\d{3})(\d{3})(\d{0,3})/, (_, first, second, third) => [first, second, third].filter(Boolean).join('.'))
    }

    if (digits.length <= 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, first, second, third, fourth) => (
            [first, second, third].filter(Boolean).join('.') + (fourth ? `-${fourth}` : '')
        ))
    }

    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, first, second, third, fourth, fifth) => (
        `${first}.${second}.${third}/${fourth}${fifth ? `-${fifth}` : ''}`
    ))
}
