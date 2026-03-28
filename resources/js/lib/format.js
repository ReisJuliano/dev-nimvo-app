export function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(Number(value || 0))
}

export function formatNumber(value, options = {}) {
    return new Intl.NumberFormat('pt-BR', options).format(Number(value || 0))
}

export function formatDateTime(value) {
    if (!value) {
        return '-'
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(new Date(value))
}

export function formatDate(value) {
    if (!value) {
        return '-'
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
    }).format(new Date(value))
}

export function formatTime(value) {
    if (!value) {
        return '-'
    }

    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

export function formatPercent(value) {
    return `${formatNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
