import { formatMoney, formatNumber } from '@/lib/format'

export default function DashboardMetricCard({ title, value, subtitle, type = 'money', tone = 'default' }) {
    const formattedValue = type === 'money' ? formatMoney(value) : formatNumber(value)

    return (
        <article className={`dashboard-metric-card tone-${tone}`}>
            <span className="dashboard-metric-title">{title}</span>
            <strong className="dashboard-metric-value">{formattedValue}</strong>
            <span className="dashboard-metric-subtitle">{subtitle}</span>
        </article>
    )
}
