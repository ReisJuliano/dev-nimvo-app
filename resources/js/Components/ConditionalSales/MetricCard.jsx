const toneClass = {
    warning: 'tone-warning',
    success: 'tone-success',
    danger: 'tone-danger',
    info: 'tone-accent',
}

export default function MetricCard({ title, value, chipLabel, chipTone = 'warning', icon = 'fa-chart-line' }) {
    const articleTone = toneClass[chipTone] || 'tone-warning'

    return (
        <article className={articleTone}>
            <span className="products-summary-kicker">{chipLabel}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.35rem' }}>
                <span className="data-list-icon" aria-hidden>
                    <i className={`fa-solid ${icon}`} />
                </span>
                <div style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: 'var(--app-text-muted)', fontSize: '0.82rem' }}>{title}</span>
                    <strong>{value}</strong>
                </div>
            </div>
        </article>
    )
}
