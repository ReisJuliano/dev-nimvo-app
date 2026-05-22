function normalizeTone(tone) {
    switch (tone) {
        case 'success':
        case 'positive':
        case 'delivered':
        case 'done':
        case 'finalized':
        case 'finished':
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
        case 'active':
        case 'open':
        case 'aberto':
            return 'info'
        case 'draft':
        case 'rascunho':
        case 'neutral':
        case 'inactive':
            return 'neutral'
        case 'warning':
        case 'pending':
        case 'in_progress':
        case 'em_andamento':
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
