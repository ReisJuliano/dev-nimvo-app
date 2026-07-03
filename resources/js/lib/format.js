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

function parseDisplayDate(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number)

        return new Date(year, month - 1, day)
    }

    return new Date(value)
}

export function formatDate(value) {
    if (!value) {
        return '-'
    }

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
    }).format(parseDisplayDate(value))
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
