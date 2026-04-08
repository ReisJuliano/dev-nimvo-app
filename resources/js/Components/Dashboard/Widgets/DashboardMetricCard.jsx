import { formatMoney, formatNumber } from '@/lib/format'

export default function DashboardMetricCard({
    title,
    value,
    caption,
    badge,
    badgeTone = 'neutral',
    icon = 'fa-chart-line',
    format = 'money',
    tone = 'default',
}) {
    const formattedValue = format === 'number' ? formatNumber(value) : formatMoney(value)

    return (
        <article className={`dashboard-stat-card tone-${tone}`}>
            <div className="dashboard-stat-head">
                <span className={`dashboard-stat-icon tone-${tone}`}>
                    <i className={`fa-solid ${icon}`} />
                </span>
                {badge ? <span className={`dashboard-stat-badge tone-${badgeTone}`}>{badge}</span> : null}
            </div>

            <strong className="dashboard-stat-value">{formattedValue}</strong>

            <div className="dashboard-stat-copy">
                <span>{title}</span>
                {caption ? <small>{caption}</small> : null}
            </div>
        </article>
    )
}
