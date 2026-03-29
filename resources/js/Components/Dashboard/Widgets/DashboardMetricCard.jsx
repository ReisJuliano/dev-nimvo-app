import { formatMoney, formatNumber } from '@/lib/format'

export default function DashboardMetricCard({
    title,
    value,
    subtitle,
    icon = 'fa-chart-line',
    type = 'money',
    tone = 'default',
    footer,
}) {
    const formattedValue = type === 'money' ? formatMoney(value) : formatNumber(value)

    return (
        <article className={`dashboard-metric-card tone-${tone}`}>
            <div className="dashboard-metric-header">
                <span className="dashboard-metric-title">{title}</span>
                <div className={`dashboard-metric-icon tone-${tone}`}>
                    <i className={`fa-solid ${icon}`} />
                </div>
            </div>
            <strong className="dashboard-metric-value">{formattedValue}</strong>
            <span className="dashboard-metric-subtitle">{subtitle}</span>
            {footer ? <div className="dashboard-metric-footer">{footer}</div> : null}
        </article>
    )
}
