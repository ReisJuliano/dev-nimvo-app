import { formatMoney, formatNumber, formatPercent } from '@/lib/format'

function renderValue(metric) {
    if (metric.format === 'money') {
        return formatMoney(metric.value)
    }

    if (metric.format === 'percent') {
        return formatPercent(metric.value)
    }

    return formatNumber(metric.value)
}

export default function MetricGrid({ metrics }) {
    return (
        <section className="operations-metric-grid">
            {metrics.map((metric) => (
                <article key={metric.label} className="operations-metric-card">
                    <span>{metric.label}</span>
                    <strong>{renderValue(metric)}</strong>
                    <small>{metric.caption || 'Visão consolidada do módulo'}</small>
                </article>
            ))}
        </section>
    )
}
