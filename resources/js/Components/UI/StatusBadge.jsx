function normalizeTone(tone) {
    switch (tone) {
        case 'success':
        case 'positive':
        case 'active':
        case 'delivered':
            return 'success'
        case 'danger':
        case 'error':
        case 'blocked':
        case 'cancelled':
        case 'canceled':
            return 'danger'
        case 'info':
        case 'primary':
        case 'processing':
        case 'dispatched':
            return 'info'
        case 'warning':
        case 'pending':
        case 'neutral':
        default:
            return 'warning'
    }
}

export default function StatusBadge({
    label,
    children,
    tone = 'warning',
    icon = null,
    compact = false,
    className = '',
}) {
    const resolvedTone = normalizeTone(tone)
    const content = label ?? children

    return (
        <span className={['status-badge', `tone-${resolvedTone}`, compact ? 'compact' : '', className].filter(Boolean).join(' ')}>
            {icon ? <i className={`fa-solid ${icon}`} /> : null}
            <span>{content}</span>
        </span>
    )
}
